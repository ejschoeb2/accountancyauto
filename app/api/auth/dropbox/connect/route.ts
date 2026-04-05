/**
 * GET /api/auth/dropbox/connect
 *
 * Initiates the Dropbox OAuth2 authorization flow.
 *
 * 1. Verifies the user is authenticated via Supabase session.
 * 2. Gets the org ID via getOrgContext().
 * 3. Generates a UUID CSRF state token via crypto.randomUUID().
 * 4. Stores the state token in organisations.dropbox_oauth_state (DB-based CSRF).
 * 5. Builds the authorization URL with token_access_type=offline — REQUIRED
 *    for refresh token (DRPBX-01).
 * 6. Redirects to Dropbox OAuth consent screen.
 *
 * Note: The auth URL is built manually rather than via DropboxAuth SDK because
 * the SDK constructor does require('node-fetch') which fails with node-fetch v3
 * (ESM-only). The URL is simple query-string construction — no SDK needed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrgContext } from '@/lib/auth/org-context';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const fromWizard = request.nextUrl.searchParams.get('from') === 'wizard';
  const errorUrl = fromWizard
    ? new URL('/setup/wizard?storage_error=connect_failed', request.url)
    : new URL('/settings?tab=storage&error=connect_failed', request.url);

  try {
    // ── Auth check ───────────────────────────────────────────────────────────
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // ── Get org context ────────────────────────────────────────────────────
    const { orgId } = await getOrgContext();

    // ── Generate CSRF state token — encode origin context in the value ────
    // Format: "wizard_<uuid>" when coming from the setup wizard, else "<uuid>".
    // Dropbox returns state unchanged in the callback, so this is more reliable
    // than a cookie (avoids cross-site cookie delivery issues).
    const isPopup = request.nextUrl.searchParams.get('popup') === '1';
    const uuid = crypto.randomUUID();
    let state = fromWizard ? `wizard_${uuid}` : uuid;
    if (isPopup) state = `popup_${state}`;

    // ── Store CSRF state in DB (organisations.dropbox_oauth_state) ────────
    const admin = createAdminClient();
    const { error: stateError } = await admin.from('organisations')
      .update({ dropbox_oauth_state: state })
      .eq('id', orgId);

    if (stateError) {
      console.error('[dropbox/connect] Failed to store CSRF state:', stateError);
      return NextResponse.redirect(errorUrl);
    }

    // ── Build Dropbox authorization URL ──────────────────────────────────
    // token_access_type=offline is CRITICAL — without it Dropbox will not
    // return a refresh_token in the callback, violating DRPBX-01.
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.DROPBOX_APP_KEY!,
      redirect_uri: process.env.DROPBOX_REDIRECT_URI!,
      state,
      token_access_type: 'offline',
    });
    const authUrl = `https://www.dropbox.com/oauth2/authorize?${params.toString()}`;

    // ── Redirect to Dropbox consent screen ───────────────────────────────
    return NextResponse.redirect(authUrl);
  } catch (err) {
    console.error('[dropbox/connect] Error initiating OAuth flow:', err);
    return NextResponse.redirect(errorUrl);
  }
}
