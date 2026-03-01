/**
 * GET /api/auth/dropbox/connect
 *
 * Initiates the Dropbox OAuth2 authorization flow.
 *
 * 1. Verifies the user is authenticated via Supabase session.
 * 2. Gets the org ID via getOrgContext().
 * 3. Generates a UUID CSRF state token via crypto.randomUUID().
 * 4. Stores the state token in organisations.dropbox_oauth_state (DB-based CSRF).
 * 5. Constructs a DropboxAuth instance lazily (NOT at module level — prevents build
 *    failures when DROPBOX_APP_KEY env var is absent at build/CI time).
 * 6. Generates the authorization URL with token_access_type='offline' as the
 *    CRITICAL 4th argument — REQUIRED for refresh token (DRPBX-01).
 * 7. Redirects to Dropbox OAuth consent screen.
 *
 * Note: DB-based CSRF state (not cookie) matches the plan spec for Phase 27.
 * The column dropbox_oauth_state was added in Plan 01 migration.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrgContext } from '@/lib/auth/org-context';
import { DropboxAuth } from 'dropbox';

export async function GET(): Promise<NextResponse> {
  // ── Auth check ─────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Get org context ──────────────────────────────────────────────────────
  const { orgId } = await getOrgContext();

  // ── Generate UUID CSRF state token ──────────────────────────────────────
  const state = crypto.randomUUID();

  // ── Store CSRF state in DB (organisations.dropbox_oauth_state) ──────────
  const admin = createAdminClient();
  await admin.from('organisations')
    .update({ dropbox_oauth_state: state })
    .eq('id', orgId);

  // ── Construct DropboxAuth lazily (never at module level) ─────────────────
  const auth = new DropboxAuth({
    clientId: process.env.DROPBOX_APP_KEY!,
    fetch: fetch,
  });

  // ── Generate authorization URL with token_access_type='offline' ───────────
  // The 4th argument 'offline' is CRITICAL — without it Dropbox will not
  // return a refresh_token in the callback, violating DRPBX-01.
  const authUrl = await auth.getAuthenticationUrl(
    process.env.DROPBOX_REDIRECT_URI!,
    state,
    'code',     // response_type
    'offline',  // token_access_type — REQUIRED for refresh token (DRPBX-01)
  );

  // ── Redirect to Dropbox consent screen ───────────────────────────────────
  return NextResponse.redirect(authUrl as string);
}
