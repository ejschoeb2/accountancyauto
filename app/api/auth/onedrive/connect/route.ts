/**
 * GET /api/auth/onedrive/connect
 *
 * Initiates the Microsoft OneDrive OAuth2 authorization flow.
 *
 * 1. Verifies the user is authenticated via Supabase session.
 * 2. Gets the org ID via getOrgContext().
 * 3. Generates a 32-byte hex CSRF state token.
 * 4. Stores the state token in organisations.ms_oauth_state (DB-based CSRF).
 *    DB storage avoids cross-subdomain cookie loss — the connect route runs on
 *    the org subdomain but the callback URL is on the main app domain.
 * 5. Generates an authorization URL via MSAL with consent prompt.
 * 6. Redirects to Microsoft login.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrgContext } from '@/lib/auth/org-context';
import { ConfidentialClientApplication } from '@azure/msal-node';
import crypto from 'crypto';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const fromWizard = request.nextUrl.searchParams.get('from') === 'wizard';
  const errorUrl = fromWizard
    ? new URL('/setup/wizard?storage_error=connect_failed', request.url)
    : new URL('/settings?tab=storage&error=connect_failed', request.url);

  try {
    // ── Auth check ───────────────────────────────────────────────────────────
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // ── Get org context ────────────────────────────────────────────────────
    const { orgId } = await getOrgContext();

    // ── Generate CSRF state token — encode origin context in the value ────
    // Format: "wizard_<hex>" when coming from the setup wizard, else "<hex>".
    // Microsoft returns state unchanged in the callback, so this is more
    // reliable than a cookie (avoids cross-subdomain cookie delivery issues).
    const isPopup = request.nextUrl.searchParams.get('popup') === '1';
    const csrf = crypto.randomBytes(32).toString('hex');
    let state = fromWizard ? `wizard_${csrf}` : csrf;
    if (isPopup) state = `popup_${state}`;

    // ── Store CSRF state in DB (organisations.ms_oauth_state) ────────────
    const admin = createAdminClient();
    await admin.from('organisations')
      .update({ ms_oauth_state: state })
      .eq('id', orgId);

    // ── Build authorization URL via MSAL ─────────────────────────────────
    const msalClient = new ConfidentialClientApplication({
      auth: {
        clientId: process.env.MS_CLIENT_ID!,
        authority: 'https://login.microsoftonline.com/common',
        clientSecret: process.env.MS_CLIENT_SECRET!,
      },
    });

    const authUrl = await msalClient.getAuthCodeUrl({
      scopes: ['Files.ReadWrite.AppFolder', 'offline_access'],
      redirectUri: process.env.MS_REDIRECT_URI!,
      state,
      prompt: 'consent', // CRITICAL: ensures refresh token in cache; forces account picker
    });

    // ── Redirect to Microsoft consent screen ─────────────────────────────
    return NextResponse.redirect(authUrl);
  } catch (err) {
    console.error('[onedrive/connect] Error initiating OAuth flow:', err);
    return NextResponse.redirect(errorUrl);
  }
}
