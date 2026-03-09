/**
 * GET /api/auth/onedrive/callback
 *
 * Handles the Microsoft OneDrive OAuth2 callback after the user grants access.
 *
 * Flow:
 * 1. Auth check — redirect to /login if not authenticated.
 * 2. CSRF validation — compare `state` URL param against
 *    organisations.ms_oauth_state (DB-based CSRF, set in connect route).
 *    DB storage avoids cross-subdomain cookie loss where the connect route
 *    runs on acme.app.X but the OAuth callback URI is app.X.
 * 3. Token exchange with MSAL (including PostgresMsalCachePlugin for persistence).
 * 4. Persists homeAccountId and updates storage_backend on the org.
 * 5. Clears ms_oauth_state to prevent replay and redirects to the org's subdomain.
 *
 * All error paths redirect with an error query param — OAuth callbacks must never
 * expose raw error state to users.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrgContext } from '@/lib/auth/org-context';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { PostgresMsalCachePlugin } from '@/lib/storage/msal-cache-plugin';

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
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // ── Extract code and state from URL ────────────────────────────────────
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const stateFromUrl = searchParams.get('state');

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
    .select('ms_oauth_state, slug')
    .eq('id', orgId)
    .single();

  // Org subdomain base URL — used for all post-resolution redirects
  const orgBaseUrl = org?.slug ? buildOrgBaseUrl(org.slug) : appUrl;
  const errorBase = `${orgBaseUrl}/settings?tab=storage&error=`;

  // ── CSRF state validation (DB-based) ────────────────────────────────────
  if (!stateFromUrl || !org?.ms_oauth_state || stateFromUrl !== org.ms_oauth_state) {
    return NextResponse.redirect(`${errorBase}invalid_state`);
  }

  // ── Token exchange with MSAL (including PostgresMsalCachePlugin) ───────
  const msalClient = new ConfidentialClientApplication({
    auth: {
      clientId: process.env.MS_CLIENT_ID!,
      authority: 'https://login.microsoftonline.com/common',
      clientSecret: process.env.MS_CLIENT_SECRET!,
    },
    cache: {
      cachePlugin: new PostgresMsalCachePlugin(orgId),
    },
  });

  let tokenResponse;
  try {
    tokenResponse = await msalClient.acquireTokenByCode({
      code,
      redirectUri: process.env.MS_REDIRECT_URI!,
      scopes: ['Files.ReadWrite.AppFolder', 'offline_access'],
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('AADSTS53003')) {
      return NextResponse.redirect(`${errorBase}conditional_access_blocked`);
    }

    console.error('[onedrive/callback] token exchange failed:', error);
    return NextResponse.redirect(`${errorBase}auth_failed`);
  }

  // ── Persist homeAccountId and update org storage backend ───────────────
  try {
    const { error: dbError } = await admin
      .from('organisations')
      .update({
        storage_backend: 'onedrive',
        storage_backend_status: 'active',
        ms_home_account_id: tokenResponse.account!.homeAccountId,
        ms_oauth_state: null, // Clear CSRF token to prevent replay
      })
      .eq('id', orgId);

    if (dbError) {
      throw new Error(dbError.message);
    }
  } catch (error) {
    console.error('[onedrive/callback] DB persist error:', error);
    return NextResponse.redirect(`${errorBase}db_error`);
  }

  // ── Success redirect ─────────────────────────────────────────────────────
  // Origin context is encoded in the state param ("wizard_<hex>" vs "<hex>"),
  // which Microsoft returns unchanged — more reliable than a cookie.
  const fromWizard = stateFromUrl?.startsWith('wizard_') ?? false;
  const successUrl = fromWizard
    ? `${orgBaseUrl}/setup/wizard?storage_connected=onedrive`
    : `${orgBaseUrl}/settings?tab=storage&connected=onedrive`;
  return NextResponse.redirect(successUrl);
}
