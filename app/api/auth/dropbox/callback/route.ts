/**
 * GET /api/auth/dropbox/callback
 *
 * Handles the Dropbox OAuth2 callback after the user grants access.
 *
 * Flow:
 * 1. Auth check — redirects to /login if not authenticated.
 * 2. CSRF state validation — compares `state` URL param against
 *    organisations.dropbox_oauth_state (DB-based CSRF, set in connect route).
 *    Redirects to /settings?tab=storage&error=invalid_state on mismatch.
 * 3. Token exchange — exchanges `code` for access/refresh tokens via
 *    direct POST to Dropbox token endpoint.
 * 4. DRPBX-01: Mandatory refresh_token presence check — rejects immediately
 *    if refresh_token is absent. This validates that token_access_type=offline
 *    was correctly included in the connect route's authorization URL.
 * 5. Persists encrypted tokens to organisations — uses encryptToken() for both
 *    access and refresh tokens; NEVER writes plaintext tokens to the database.
 * 6. Sets storage_backend='dropbox', storage_backend_status='active'.
 * 7. Clears dropbox_oauth_state to prevent replay.
 * 8. Redirects to /settings?tab=storage&connected=dropbox on success.
 *
 * All error paths redirect to /settings with an error query param — OAuth
 * callbacks must never expose raw error state to users.
 *
 * Token exchange uses direct fetch() to the Dropbox API rather than the
 * DropboxAuth SDK — avoids constructor issues with node-fetch v3 (ESM-only).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrgContext } from '@/lib/auth/org-context';
import { encryptToken } from '@/lib/crypto/tokens';

/**
 * Build the org's subdomain base URL from its slug.
 * e.g. slug="acme", NEXT_PUBLIC_APP_URL="https://prompt.accountants"
 *      → "https://acme.app.prompt.accountants"
 */
function buildOrgBaseUrl(slug: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const hostname = appUrl.replace(/^https?:\/\//, '').split('/')[0];
  return `https://${slug}.app.${hostname}`;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  // Early-error fallback uses main domain (org not yet resolved)
  const earlyErrorBase = `${appUrl}/settings?tab=storage&error=`;

  // ── Auth check ─────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // ── Extract URL params ───────────────────────────────────────────────────
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const stateParam = searchParams.get('state');

  if (!code) {
    return NextResponse.redirect(`${earlyErrorBase}missing_code`);
  }

  // ── Get org context ──────────────────────────────────────────────────────
  let orgId: string;
  try {
    const ctx = await getOrgContext();
    orgId = ctx.orgId;
  } catch {
    return NextResponse.redirect(`${earlyErrorBase}no_org_context`);
  }

  // ── Fetch org state + slug (slug needed for subdomain redirect) ──────────
  const admin = createAdminClient();
  const { data: org } = await admin.from('organisations')
    .select('dropbox_oauth_state, slug')
    .eq('id', orgId)
    .single();

  // Org subdomain base URL — used for all post-resolution redirects
  const orgBaseUrl = org?.slug ? buildOrgBaseUrl(org.slug) : appUrl;
  const errorBase = `${orgBaseUrl}/settings?tab=storage&error=`;

  // ── CSRF state validation (DB-based) ────────────────────────────────────
  if (!stateParam || !org?.dropbox_oauth_state || stateParam !== org.dropbox_oauth_state) {
    return NextResponse.redirect(`${errorBase}invalid_state`);
  }

  // ── Token exchange + persist ─────────────────────────────────────────────
  try {
    // Exchange code for tokens via Dropbox token endpoint directly.
    // Avoids DropboxAuth SDK constructor which fails due to node-fetch v3
    // being ESM-only (require('node-fetch') in the SDK constructor throws).
    const tokenRes = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: process.env.DROPBOX_APP_KEY!,
        client_secret: process.env.DROPBOX_APP_SECRET!,
        redirect_uri: process.env.DROPBOX_REDIRECT_URI!,
      }).toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      throw new Error(`Token exchange failed (${tokenRes.status}): ${errText}`);
    }

    const result = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };

    // ── DRPBX-01: Mandatory refresh_token presence check ─────────────────
    // If refresh_token is absent, token_access_type=offline was not honoured.
    // Reject immediately — do NOT store the short-lived access token.
    if (!result.refresh_token) {
      return NextResponse.redirect(
        `${errorBase}dropbox_no_refresh_token`,
      );
    }

    if (!result.access_token) {
      return NextResponse.redirect(
        `${errorBase}dropbox_no_access_token`,
      );
    }

    const accessToken = result.access_token;
    const refreshToken = result.refresh_token;
    const expiresIn = result.expires_in ?? 14400; // Dropbox default: 4 hours
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // ── Persist encrypted tokens — never write plaintext ─────────────────
    await admin.from('organisations').update({
      dropbox_refresh_token_enc: encryptToken(refreshToken),
      dropbox_access_token_enc: encryptToken(accessToken),
      dropbox_token_expires_at: expiresAt.toISOString(),
      storage_backend: 'dropbox',
      storage_backend_status: 'active',
      dropbox_oauth_state: null, // Clear CSRF token to prevent replay
    }).eq('id', orgId);
  } catch (err) {
    // Avoid leaking error details — redirect with generic error code
    console.error('[dropbox/callback] token exchange failed:', err);
    return NextResponse.redirect(`${errorBase}dropbox_exchange_failed`);
  }

  // ── Success redirect ─────────────────────────────────────────────────────
  // Wizard lives on the main domain; settings lives on the org subdomain.
  const fromWizard = request.cookies.get('wizard_oauth_return')?.value === '1';
  const successUrl = fromWizard
    ? `${appUrl}/setup/wizard?storage_connected=dropbox`
    : `${orgBaseUrl}/settings?tab=storage&connected=dropbox`;
  const successResponse = NextResponse.redirect(successUrl);
  successResponse.cookies.delete('wizard_oauth_return');
  return successResponse;
}
