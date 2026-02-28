/**
 * GET /api/auth/google-drive/connect
 *
 * Initiates the Google Drive OAuth2 authorization flow.
 *
 * 1. Verifies the user is authenticated via Supabase session.
 * 2. Generates a 32-byte hex CSRF state token.
 * 3. Builds an OAuth2 authorization URL with drive.file scope, access_type=offline,
 *    and prompt=consent (CRITICAL: ensures refresh_token is always returned, not just
 *    on the first authorization).
 * 4. Stores the state token in an HttpOnly cookie (maxAge=600, 10 minutes).
 * 5. Redirects to Google's OAuth consent screen.
 *
 * OAuth2Client is constructed lazily (not at module level) — mirrors D-11-05-01 (Stripe
 * lazy init) and D-25-01-02 (token-refresh lazy init) to prevent Next.js build failures
 * when GOOGLE_* env vars are absent at build time or in CI.
 *
 * Note: D-25-01-01 established that @googleapis/drive exports `auth` (AuthPlus instance)
 * not `google`. OAuth2 client is constructed as `new auth.OAuth2(...)`.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
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

export async function GET(): Promise<NextResponse> {
  // ── Auth check ─────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Generate CSRF state token ────────────────────────────────────────────
  const state = crypto.randomBytes(32).toString('hex');

  // ── Build authorization URL ──────────────────────────────────────────────
  const oauth2Client = getOAuth2Client();
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/drive.file'],
    state,
    prompt: 'consent', // CRITICAL: ensures refresh_token is always returned (not just first auth)
  });

  // ── Redirect with CSRF cookie ────────────────────────────────────────────
  const response = NextResponse.redirect(authUrl);

  response.cookies.set('google_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes — short TTL prevents replay
    path: '/',
  });

  return response;
}
