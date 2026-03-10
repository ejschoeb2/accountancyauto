/**
 * GET /api/auth/google-drive/callback
 *
 * Handles the Google OAuth2 callback after the user grants Drive access.
 *
 * Flow:
 * 1. Auth check — redirect to /login if not authenticated.
 * 2. CSRF validation — compare `state` URL param against
 *    organisations.google_oauth_state (DB-based CSRF, set in connect route).
 * 3. Token exchange — exchanges `code` for access/refresh tokens via OAuth2Client.getToken().
 * 4. Prompt/ root folder — reuses existing folder or creates a new one.
 * 5. Persists encrypted tokens to organisations.
 * 6. Clears google_oauth_state to prevent replay and redirects to org subdomain.
 *
 * IMPORTANT: Error redirects use request.url as the base (NOT NEXT_PUBLIC_APP_URL)
 * to stay on the callback's origin domain. Using NEXT_PUBLIC_APP_URL can redirect
 * to the marketing site when env is set to the apex domain.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrgContext } from '@/lib/auth/org-context';
import { auth, drive } from '@googleapis/drive';
import { encryptToken } from '@/lib/crypto/tokens';

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

function getOAuth2Client() {
  return new auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI!,
  );
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const stateParam = request.nextUrl.searchParams.get('state');
  // Determine origin from URL state param; after CSRF validation the DB state
  // is used as an authoritative fallback (see below).
  let fromWizard = stateParam?.startsWith('wizard_') ?? false;

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
    console.warn('[google-drive/callback] no auth session — redirecting to login');
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // ── Extract URL params ───────────────────────────────────────────────────
  const code = request.nextUrl.searchParams.get('code');

  if (!code) {
    console.warn('[google-drive/callback] missing code param, fromWizard=%s', fromWizard);
    return NextResponse.redirect(errorUrl('missing_code'));
  }

  // ── Get org context ──────────────────────────────────────────────────────
  let orgId: string;
  try {
    const ctx = await getOrgContext();
    orgId = ctx.orgId;
  } catch {
    console.warn('[google-drive/callback] no org context, fromWizard=%s', fromWizard);
    return NextResponse.redirect(errorUrl('no_org_context'));
  }

  // ── Fetch org state + slug ───────────────────────────────────────────────
  const admin = createAdminClient();
  const { data: org } = await admin.from('organisations')
    .select('google_oauth_state, slug, google_drive_folder_id')
    .eq('id', orgId)
    .single();

  // ── CSRF state validation (DB-based) ────────────────────────────────────
  if (!stateParam || !org?.google_oauth_state || stateParam !== org.google_oauth_state) {
    console.warn('[google-drive/callback] CSRF mismatch — stateParam=%s, dbState=%s, fromWizard=%s',
      stateParam ? 'present' : 'null',
      org?.google_oauth_state ? 'present' : 'null',
      fromWizard);
    return NextResponse.redirect(errorUrl('invalid_state', org?.slug));
  }

  // After CSRF validation passes, the DB state is authoritative. Use it as a
  // fallback in case the URL state param was somehow decoded differently.
  if (!fromWizard && org.google_oauth_state.startsWith('wizard_')) {
    console.warn('[google-drive/callback] fromWizard corrected via DB state');
    fromWizard = true;
  }

  // ── Token exchange ────────────────────────────────────────────────────────
  const oauth2Client = getOAuth2Client();

  let accessToken: string;
  let refreshToken: string;
  let expiryDate: number | null | undefined;

  try {
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      return NextResponse.redirect(errorUrl('no_refresh_token', org?.slug));
    }
    if (!tokens.access_token) {
      return NextResponse.redirect(errorUrl('no_access_token', org?.slug));
    }

    accessToken = tokens.access_token;
    refreshToken = tokens.refresh_token;
    expiryDate = tokens.expiry_date;

    oauth2Client.setCredentials(tokens);
  } catch (err) {
    if (err instanceof Response || (err instanceof NextResponse)) throw err;
    console.error('[google-drive/callback] token exchange failed:', err);
    return NextResponse.redirect(errorUrl('token_exchange_failed', org?.slug));
  }

  // ── Reuse existing folder or create Prompt/ root folder ─────────────────
  const driveClient = drive({ version: 'v3', auth: oauth2Client });
  let rootFolderId: string;

  if (org?.google_drive_folder_id) {
    // Verify the saved folder is still accessible with these credentials.
    // If the user previously connected a different Google account, the old
    // folder ID won't be reachable — fall through to create a new one.
    try {
      const check = await driveClient.files.get({
        fileId: org.google_drive_folder_id,
        fields: 'id,trashed',
      });
      if (check.data.id && !check.data.trashed) {
        rootFolderId = org.google_drive_folder_id;
      } else {
        throw new Error('folder trashed or inaccessible');
      }
    } catch {
      console.warn('[google-drive/callback] saved folder %s inaccessible, creating new one', org.google_drive_folder_id);
      try {
        const folderRes = await driveClient.files.create({
          requestBody: {
            name: 'Prompt',
            mimeType: 'application/vnd.google-apps.folder',
          },
          fields: 'id',
        });
        rootFolderId = folderRes.data.id!;
      } catch {
        return NextResponse.redirect(errorUrl('folder_creation_failed', org?.slug));
      }
    }
  } else {
    try {
      const folderRes = await driveClient.files.create({
        requestBody: {
          name: 'Prompt',
          mimeType: 'application/vnd.google-apps.folder',
        },
        fields: 'id',
      });
      rootFolderId = folderRes.data.id!;
    } catch {
      return NextResponse.redirect(errorUrl('folder_creation_failed', org?.slug));
    }
  }

  // ── Persist encrypted tokens to organisations ─────────────────────────────
  const { error: updateError } = await admin.from('organisations').update({
    storage_backend: 'google_drive',
    storage_backend_status: 'active',
    google_access_token_enc: encryptToken(accessToken),
    google_refresh_token_enc: encryptToken(refreshToken),
    google_token_expires_at: expiryDate
      ? new Date(expiryDate).toISOString()
      : null,
    google_drive_folder_id: rootFolderId,
    google_oauth_state: null, // Clear CSRF token to prevent replay
  }).eq('id', orgId);

  if (updateError) {
    console.error('[google-drive/callback] DB update failed:', updateError.message);
    return NextResponse.redirect(errorUrl('db_error', org?.slug));
  }

  // ── Success redirect ─────────────────────────────────────────────────────
  const successPath = fromWizard
    ? '/setup/wizard?storage_connected=google_drive'
    : '/settings?tab=storage&connected=google_drive';
  const redirectTarget = buildRedirectUrl(successPath, org?.slug, request.url);
  console.log('[google-drive/callback] success — fromWizard=%s, slug=%s, redirect=%s',
    fromWizard, org?.slug ?? 'null', redirectTarget);
  return NextResponse.redirect(redirectTarget);
}
