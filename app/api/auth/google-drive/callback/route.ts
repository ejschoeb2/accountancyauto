/**
 * GET /api/auth/google-drive/callback
 *
 * Handles the Google OAuth2 callback after the user grants Drive access.
 *
 * Flow:
 * 1. Auth check — redirect to /login if not authenticated.
 * 2. CSRF validation — compare `state` URL param against
 *    organisations.google_oauth_state (DB-based CSRF, set in connect route).
 *    DB storage avoids cross-subdomain cookie loss where the connect route
 *    runs on acme.app.X but the OAuth callback URI is app.X.
 * 3. Token exchange — exchanges `code` for access/refresh tokens via OAuth2Client.getToken().
 *    Redirects with error if refresh_token absent (should not happen with prompt=consent).
 * 4. Prompt/ root folder — reuses the existing folder ID if one is already stored
 *    (reconnect case), otherwise creates a new "Prompt" folder in the user's Drive root.
 * 5. Persists encrypted tokens to organisations — uses encryptToken() for both access and
 *    refresh tokens; NEVER writes plaintext tokens to the database.
 * 6. Clears google_oauth_state to prevent replay and redirects to the org's subdomain.
 *
 * All errors redirect with an error query param — OAuth callbacks must never
 * show raw error pages to users.
 *
 * OAuth2Client is constructed lazily (not at module level) — prevents Next.js build failures
 * when GOOGLE_* env vars are absent at build time or in CI.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrgContext } from '@/lib/auth/org-context';
import { auth, drive } from '@googleapis/drive';
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
 * Constructs an OAuth2Client lazily at call time.
 * Never called at module level — prevents build failures when env vars are absent.
 */
function getOAuth2Client() {
  return new auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI!,
  );
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
    .select('google_oauth_state, slug, google_drive_folder_id')
    .eq('id', orgId)
    .single();

  // Org subdomain base URL — used for all post-resolution redirects
  const orgBaseUrl = org?.slug ? buildOrgBaseUrl(org.slug) : appUrl;
  const errorBase = `${orgBaseUrl}/settings?tab=storage&error=`;

  // ── CSRF state validation (DB-based) ────────────────────────────────────
  if (!stateParam || !org?.google_oauth_state || stateParam !== org.google_oauth_state) {
    return NextResponse.redirect(`${errorBase}invalid_state`);
  }

  // ── Token exchange ────────────────────────────────────────────────────────
  const oauth2Client = getOAuth2Client();

  let accessToken: string;
  let refreshToken: string;
  let expiryDate: number | null | undefined;

  try {
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      return NextResponse.redirect(`${errorBase}no_refresh_token`);
    }
    if (!tokens.access_token) {
      return NextResponse.redirect(`${errorBase}no_access_token`);
    }

    accessToken = tokens.access_token;
    refreshToken = tokens.refresh_token;
    expiryDate = tokens.expiry_date;

    oauth2Client.setCredentials(tokens);
  } catch (err) {
    if (err instanceof Response || (err instanceof NextResponse)) throw err;
    console.error('[google-drive/callback] token exchange failed:', err);
    return NextResponse.redirect(`${errorBase}token_exchange_failed`);
  }

  // ── Reuse existing folder or create Prompt/ root folder ─────────────────
  const driveClient = drive({ version: 'v3', auth: oauth2Client });
  let rootFolderId: string;

  if (org?.google_drive_folder_id) {
    rootFolderId = org.google_drive_folder_id;
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
      return NextResponse.redirect(`${errorBase}folder_creation_failed`);
    }
  }

  // ── Persist encrypted tokens to organisations ─────────────────────────────
  try {
    await admin.from('organisations').update({
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
  } catch {
    return NextResponse.redirect(`${errorBase}db_error`);
  }

  // ── Success redirect ─────────────────────────────────────────────────────
  // Origin context is encoded in the state param ("wizard_<hex>" vs "<hex>"),
  // which Google returns unchanged — more reliable than a cookie.
  const fromWizard = stateParam?.startsWith('wizard_') ?? false;
  const successUrl = fromWizard
    ? `${orgBaseUrl}/setup/wizard?storage_connected=google_drive`
    : `${orgBaseUrl}/settings?tab=storage&connected=google_drive`;
  return NextResponse.redirect(successUrl);
}
