import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ConfidentialClientApplication } from '@azure/msal-node';
import crypto from 'crypto';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const fromWizard = request.nextUrl.searchParams.get('from') === 'wizard';
  // Verify the user is authenticated
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Create MSAL client lazily inside handler — prevents build failure when env vars absent
  const msalClient = new ConfidentialClientApplication({
    auth: {
      clientId: process.env.MS_CLIENT_ID!,
      authority: 'https://login.microsoftonline.com/common',
      clientSecret: process.env.MS_CLIENT_SECRET!,
    },
  });

  // Generate a 32-byte hex CSRF state token.
  // Encode wizard origin in the state param prefix ("wizard_") so the callback
  // can detect it without a cookie — avoids cross-subdomain cookie issues where
  // the connect route runs on acme.app.X but the OAuth callback URI is app.X.
  const csrf = crypto.randomBytes(32).toString('hex');
  const state = fromWizard ? `wizard_${csrf}` : csrf;

  // Generate the authorization URL
  const authUrl = await msalClient.getAuthCodeUrl({
    scopes: ['Files.ReadWrite.AppFolder', 'offline_access'],
    redirectUri: process.env.MS_REDIRECT_URI!,
    state,
    prompt: 'consent', // CRITICAL: ensures refresh token in cache; forces account picker
  });

  // Create redirect response and set CSRF state cookie.
  // Store the full state (including any wizard_ prefix) for equality validation.
  const response = NextResponse.redirect(authUrl);

  response.cookies.set('ms_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  return response;
}
