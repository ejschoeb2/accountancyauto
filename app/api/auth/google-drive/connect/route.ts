/**
 * GET /api/auth/google-drive/connect
 *
 * Initiates the Google Drive OAuth2 authorization flow.
 *
 * 1. Verifies the user is authenticated via Supabase session.
 * 2. Gets the org ID via getOrgContext().
 * 3. Generates a 32-byte hex CSRF state token.
 * 4. Stores the state token in organisations.google_oauth_state (DB-based CSRF).
 *    DB storage avoids cross-subdomain cookie loss — the connect route runs on
 *    the org subdomain but the callback URL is on the main app domain.
 * 5. Builds an OAuth2 authorization URL with drive.file scope, access_type=offline,
 *    and prompt=consent (CRITICAL: ensures refresh_token is always returned).
 * 6. Redirects to Google's OAuth consent screen.
 *
 * OAuth2Client is constructed lazily (not at module level) — prevents Next.js build
 * failures when GOOGLE_* env vars are absent at build time or in CI.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrgContext } from '@/lib/auth/org-context';
import { auth } from '@googleapis/drive';
import crypto from 'crypto';

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
  const fromWizard = request.nextUrl.searchParams.get('from') === 'wizard';
  const errorUrl = fromWizard
    ? new URL('/setup/wizard?storage_error=connect_failed', request.url)
    : new URL('/settings?tab=storage&error=connect_failed', request.url);

  try {
    // ── Auth check ─────────────────────────────────────────────────────────────
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // ── Get org context ────────────────────────────────────────────────────
    const { orgId } = await getOrgContext();

    // ── Generate CSRF state token — encode origin context in the value ────
    // Format: "wizard_<hex>" when coming from the setup wizard, else "<hex>".
    // Google returns state unchanged in the callback, so this is more reliable
    // than a cookie (avoids cross-subdomain cookie delivery issues).
    const csrf = crypto.randomBytes(32).toString('hex');
    const state = fromWizard ? `wizard_${csrf}` : csrf;

    // ── Store CSRF state in DB (organisations.google_oauth_state) ────────
    const admin = createAdminClient();
    const { error: stateError } = await admin.from('organisations')
      .update({ google_oauth_state: state })
      .eq('id', orgId);

    if (stateError) {
      console.error('[google-drive/connect] Failed to store CSRF state:', stateError);
      return NextResponse.redirect(errorUrl);
    }

    // ── Build authorization URL ──────────────────────────────────────────
    const oauth2Client = getOAuth2Client();
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/drive.file'],
      state,
      prompt: 'consent', // CRITICAL: ensures refresh_token is always returned (not just first auth)
    });

    // ── Redirect to Google consent screen ────────────────────────────────
    return NextResponse.redirect(authUrl);
  } catch (err) {
    console.error('[google-drive/connect] Error initiating OAuth flow:', err);
    return NextResponse.redirect(errorUrl);
  }
}
