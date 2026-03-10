/**
 * GET /api/auth/onedrive/callback
 *
 * Handles the Microsoft OneDrive OAuth2 callback after the user grants access.
 *
 * Flow:
 * 1. Auth check — redirect to /login if not authenticated.
 * 2. CSRF validation — compare `state` URL param against
 *    organisations.ms_oauth_state (DB-based CSRF, set in connect route).
 * 3. Token exchange with MSAL (including PostgresMsalCachePlugin for persistence).
 * 4. Persists homeAccountId and updates storage_backend on the org.
 * 5. Clears ms_oauth_state to prevent replay and redirects to org subdomain.
 *
 * IMPORTANT: Error redirects use request.url as the base (NOT NEXT_PUBLIC_APP_URL)
 * to stay on the callback's origin domain. Using NEXT_PUBLIC_APP_URL can redirect
 * to the marketing site when env is set to the apex domain.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrgContext } from '@/lib/auth/org-context';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { PostgresMsalCachePlugin } from '@/lib/storage/msal-cache-plugin';

/**
 * Build redirect URL — org subdomain in production, origin-relative in dev.
 * NEVER uses NEXT_PUBLIC_APP_URL directly (may be the marketing domain).
 */
function buildRedirectUrl(path: string, orgSlug: string | null | undefined, requestUrl: string): string {
  if (orgSlug && process.env.NODE_ENV !== 'development') {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
    const hostname = appUrl.replace(/^https?:\/\//, '').split('/')[0];
    return `https://${orgSlug}.app.${hostname}${path}`;
  }
  const origin = new URL(requestUrl).origin;
  return `${origin}${path}`;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const stateFromUrl = request.nextUrl.searchParams.get('state');
  let fromWizard = stateFromUrl?.startsWith('wizard_') ?? false;

  function errorUrl(code: string, orgSlug?: string | null): string {
    const path = fromWizard
      ? `/setup/wizard?storage_error=${code}`
      : `/settings?tab=storage&error=${code}`;
    return buildRedirectUrl(path, orgSlug, request.url);
  }

  // ── Auth check ─────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // ── Extract code from URL ──────────────────────────────────────────────
  const code = request.nextUrl.searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(errorUrl('missing_code'));
  }

  // ── Get org context ──────────────────────────────────────────────────────
  let orgId: string;
  try {
    const ctx = await getOrgContext();
    orgId = ctx.orgId;
  } catch {
    return NextResponse.redirect(errorUrl('no_org_context'));
  }

  // ── Fetch org state + slug ───────────────────────────────────────────────
  const admin = createAdminClient();
  const { data: org } = await admin.from('organisations')
    .select('ms_oauth_state, slug')
    .eq('id', orgId)
    .single();

  // ── CSRF state validation (DB-based) ────────────────────────────────────
  if (!stateFromUrl || !org?.ms_oauth_state || stateFromUrl !== org.ms_oauth_state) {
    return NextResponse.redirect(errorUrl('invalid_state', org?.slug));
  }

  // DB state is authoritative after CSRF passes — correct fromWizard if needed
  if (!fromWizard && org.ms_oauth_state.startsWith('wizard_')) {
    fromWizard = true;
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
      return NextResponse.redirect(errorUrl('conditional_access_blocked', org?.slug));
    }

    console.error('[onedrive/callback] token exchange failed:', error);
    return NextResponse.redirect(errorUrl('auth_failed', org?.slug));
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
    return NextResponse.redirect(errorUrl('db_error', org?.slug));
  }

  // ── Success redirect ─────────────────────────────────────────────────────
  const successPath = fromWizard
    ? '/setup/wizard?storage_connected=onedrive'
    : '/settings?tab=storage&connected=onedrive';
  return NextResponse.redirect(buildRedirectUrl(successPath, org?.slug, request.url));
}
