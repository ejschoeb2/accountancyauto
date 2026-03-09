/**
 * GET /api/auth/dropbox/callback
 *
 * Handles the Dropbox OAuth2 callback after the user grants access.
 *
 * Flow:
 * 1. Auth check — redirects to /login if not authenticated.
 * 2. CSRF state validation — compares `state` URL param against
 *    organisations.dropbox_oauth_state (DB-based CSRF, set in connect route).
 * 3. Token exchange — exchanges `code` for access/refresh tokens via
 *    direct POST to Dropbox token endpoint.
 * 4. DRPBX-01: Mandatory refresh_token presence check — rejects immediately
 *    if refresh_token is absent. This validates that token_access_type=offline
 *    was correctly included in the connect route's authorization URL.
 * 5. Persists encrypted tokens to organisations — uses encryptToken() for both
 *    access and refresh tokens; NEVER writes plaintext tokens to the database.
 * 6. Sets storage_backend='dropbox', storage_backend_status='active'.
 * 7. Clears dropbox_oauth_state to prevent replay.
 * 8. Redirects to org subdomain — /setup/wizard?storage_connected=dropbox if
 *    from wizard, otherwise /settings?tab=storage&connected=dropbox.
 *
 * All error paths redirect with an error query param — OAuth callbacks must
 * never expose raw error state to users.
 *
 * IMPORTANT: Error redirects use request.url as the base (NOT NEXT_PUBLIC_APP_URL)
 * to stay on the callback's origin domain. Using NEXT_PUBLIC_APP_URL can redirect
 * to the marketing site when env is set to the apex domain.
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

/**
 * Build error/success redirect URL.
 * Uses the org's subdomain when slug is available, otherwise falls back to
 * request.url origin (the callback domain) — NEVER NEXT_PUBLIC_APP_URL which
 * may point to the marketing site.
 */
function buildRedirectUrl(path: string, orgSlug: string | null | undefined, requestUrl: string): string {
  if (orgSlug) {
    return `${buildOrgBaseUrl(orgSlug)}${path}`;
  }
  // Fallback: stay on the callback's own origin
  const origin = new URL(requestUrl).origin;
  return `${origin}${path}`;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  console.log('[dropbox/callback] Callback hit:', request.nextUrl.pathname, 'params:', Object.fromEntries(request.nextUrl.searchParams.entries()));

  // Detect wizard origin from state param prefix — safe for redirect routing
  // even before CSRF validation (worst case: wrong redirect target, not a
  // security issue since no tokens are granted on error paths).
  const stateParam = request.nextUrl.searchParams.get('state');
  let fromWizard = stateParam?.startsWith('wizard_') ?? false;

  /** Build an error redirect URL, routing to wizard or settings as appropriate. */
  function errorUrl(code: string, orgSlug?: string | null): string {
    const path = fromWizard
      ? `/setup/wizard?storage_error=${code}`
      : `/settings?tab=storage&error=${code}`;
    return buildRedirectUrl(path, orgSlug, request.url);
  }

  // ── Auth check ─────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error('[dropbox/callback] Auth check failed:', authError?.message ?? 'no user');
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // ── Extract URL params ───────────────────────────────────────────────────
  const code = request.nextUrl.searchParams.get('code');

  if (!code) {
    console.error('[dropbox/callback] No code param in callback URL');
    return NextResponse.redirect(errorUrl('missing_code'));
  }

  // ── Get org context ──────────────────────────────────────────────────────
  let orgId: string;
  try {
    const ctx = await getOrgContext();
    orgId = ctx.orgId;
  } catch (ctxErr) {
    console.error('[dropbox/callback] getOrgContext failed:', ctxErr);
    return NextResponse.redirect(errorUrl('no_org_context'));
  }

  // ── Fetch org state + slug (slug needed for subdomain redirect) ──────────
  const admin = createAdminClient();
  const { data: org } = await admin.from('organisations')
    .select('dropbox_oauth_state, slug')
    .eq('id', orgId)
    .single();

  // ── CSRF state validation (DB-based) ────────────────────────────────────
  if (!stateParam || !org?.dropbox_oauth_state || stateParam !== org.dropbox_oauth_state) {
    console.error('[dropbox/callback] CSRF state mismatch', {
      stateParam: stateParam ? `${stateParam.slice(0, 12)}...` : null,
      dbState: org?.dropbox_oauth_state ? `${org.dropbox_oauth_state.slice(0, 12)}...` : null,
    });
    return NextResponse.redirect(errorUrl('invalid_state', org?.slug));
  }

  // DB state is authoritative after CSRF passes — correct fromWizard if needed
  if (!fromWizard && org.dropbox_oauth_state.startsWith('wizard_')) {
    fromWizard = true;
  }

  // ── Token exchange ──────────────────────────────────────────────────────
  let accessToken: string;
  let refreshToken: string;
  let expiresIn: number;

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
      console.error('[dropbox/callback] Token exchange HTTP error:', tokenRes.status, errText);
      return NextResponse.redirect(errorUrl('dropbox_token_http_' + tokenRes.status, org?.slug));
    }

    const result = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };

    // ── DRPBX-01: Mandatory refresh_token presence check ─────────────────
    if (!result.refresh_token) {
      console.error('[dropbox/callback] No refresh_token in response');
      return NextResponse.redirect(errorUrl('dropbox_no_refresh_token', org?.slug));
    }

    if (!result.access_token) {
      console.error('[dropbox/callback] No access_token in response');
      return NextResponse.redirect(errorUrl('dropbox_no_access_token', org?.slug));
    }

    accessToken = result.access_token;
    refreshToken = result.refresh_token;
    expiresIn = result.expires_in ?? 14400; // Dropbox default: 4 hours
  } catch (err) {
    console.error('[dropbox/callback] Token exchange failed:', err);
    return NextResponse.redirect(errorUrl('dropbox_exchange_failed', org?.slug));
  }

  // ── Encrypt + persist tokens ────────────────────────────────────────────
  try {
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    await admin.from('organisations').update({
      dropbox_refresh_token_enc: encryptToken(refreshToken),
      dropbox_access_token_enc: encryptToken(accessToken),
      dropbox_token_expires_at: expiresAt.toISOString(),
      storage_backend: 'dropbox',
      storage_backend_status: 'active',
      dropbox_oauth_state: null, // Clear CSRF token to prevent replay
    }).eq('id', orgId);
  } catch (err) {
    console.error('[dropbox/callback] Token encryption/persist failed:', err);
    return NextResponse.redirect(errorUrl('dropbox_encrypt_failed', org?.slug));
  }

  // ── Success redirect ─────────────────────────────────────────────────────
  const successPath = fromWizard
    ? '/setup/wizard?storage_connected=dropbox'
    : '/settings?tab=storage&connected=dropbox';
  return NextResponse.redirect(buildRedirectUrl(successPath, org?.slug, request.url));
}
