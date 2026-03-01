/**
 * GET /api/auth/google-drive/callback
 *
 * Handles the Google OAuth2 callback after the user grants Drive access.
 *
 * Flow:
 * 1. Auth check — redirect to /login if not authenticated.
 * 2. CSRF validation — compare `state` URL param against `google_oauth_state` cookie.
 *    Redirects to /settings?tab=storage&error=invalid_state on mismatch.
 * 3. Token exchange — exchanges `code` for access/refresh tokens via OAuth2Client.getToken().
 *    Redirects to /settings?tab=storage&error=no_refresh_token if refresh_token absent
 *    (should not happen with prompt=consent, but must be guarded).
 * 4. Prompt/ root folder creation — creates a "Prompt" folder in the user's Drive root.
 * 5. Persists encrypted tokens to organisations — uses encryptToken() for both access and
 *    refresh tokens; NEVER writes plaintext tokens to the database.
 * 6. Cleans up — deletes the CSRF state cookie and redirects to
 *    /settings?tab=storage&connected=google_drive.
 *
 * All errors redirect to /settings with an error query param — OAuth callbacks must never
 * show raw error pages to users.
 *
 * OAuth2Client is constructed lazily (not at module level) — mirrors D-11-05-01 (Stripe
 * lazy init) and D-25-01-02 (token-refresh lazy init) to prevent Next.js build failures
 * when GOOGLE_* env vars are absent at build time or in CI.
 *
 * Note: D-25-01-01 established that @googleapis/drive exports `auth` (AuthPlus instance)
 * and `drive` (factory function) directly. Use `new auth.OAuth2(...)` and `drive({ version:
 * 'v3', auth: oauth2Client })` — NOT `google.auth.OAuth2` or `google.drive`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrgContext } from '@/lib/auth/org-context';
import { auth, drive } from '@googleapis/drive';
import { encryptToken } from '@/lib/crypto/tokens';

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
  const errorBase = '/settings?tab=storage&error=';

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

  // ── CSRF state validation ────────────────────────────────────────────────
  const storedState = request.cookies.get('google_oauth_state')?.value;

  if (!stateParam || !storedState || stateParam !== storedState) {
    return NextResponse.redirect(new URL(`${errorBase}invalid_state`, request.url));
  }

  // ── Token exchange ────────────────────────────────────────────────────────
  if (!code) {
    return NextResponse.redirect(new URL(`${errorBase}missing_code`, request.url));
  }

  const oauth2Client = getOAuth2Client();

  // Use extracted string variables to avoid type narrowing issues with the
  // google-auth-library Credentials type (scope: string | null vs string | undefined).
  let accessToken: string;
  let refreshToken: string;
  let expiryDate: number | null | undefined;

  try {
    const { tokens } = await oauth2Client.getToken(code);

    // Guard against missing refresh_token — should not happen with prompt=consent
    // but must be handled gracefully to avoid silent failures.
    if (!tokens.refresh_token) {
      return NextResponse.redirect(new URL(`${errorBase}no_refresh_token`, request.url));
    }
    if (!tokens.access_token) {
      return NextResponse.redirect(new URL(`${errorBase}no_access_token`, request.url));
    }

    accessToken = tokens.access_token;
    refreshToken = tokens.refresh_token;
    expiryDate = tokens.expiry_date;

    // Set credentials for the Drive folder creation step
    oauth2Client.setCredentials(tokens);
  } catch (err) {
    // Catch redirects thrown from inside the try block (not applicable here, but be safe)
    if (err instanceof Response || (err instanceof NextResponse)) throw err;
    return NextResponse.redirect(new URL(`${errorBase}token_exchange_failed`, request.url));
  }

  // ── Create Prompt/ root folder ────────────────────────────────────────────
  const driveClient = drive({ version: 'v3', auth: oauth2Client });

  let rootFolderId: string;
  try {
    const folderRes = await driveClient.files.create({
      requestBody: {
        name: 'Prompt',
        mimeType: 'application/vnd.google-apps.folder',
        // no parents = creates in root of user's Drive
      },
      fields: 'id',
    });
    rootFolderId = folderRes.data.id!;
  } catch {
    return NextResponse.redirect(new URL(`${errorBase}folder_creation_failed`, request.url));
  }

  // ── Persist encrypted tokens to organisations ─────────────────────────────
  let orgId: string;
  try {
    const ctx = await getOrgContext();
    orgId = ctx.orgId;
  } catch {
    return NextResponse.redirect(new URL(`${errorBase}no_org_context`, request.url));
  }

  const admin = createAdminClient();
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
    }).eq('id', orgId);
  } catch {
    return NextResponse.redirect(new URL(`${errorBase}db_error`, request.url));
  }

  // ── Clean up state cookie and redirect ───────────────────────────────────
  const fromWizard = request.cookies.get('wizard_oauth_return')?.value === '1';
  const successUrl = fromWizard
    ? new URL('/setup/wizard?storage_connected=google_drive', request.url)
    : new URL('/settings?tab=storage&connected=google_drive', request.url);

  const response = NextResponse.redirect(successUrl);
  response.cookies.delete('google_oauth_state');
  response.cookies.delete('wizard_oauth_return');

  return response;
}
