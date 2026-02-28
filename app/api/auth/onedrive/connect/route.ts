import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ConfidentialClientApplication } from '@azure/msal-node';
import crypto from 'crypto';

export async function GET(): Promise<NextResponse> {
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

  // Generate a 32-byte hex CSRF state token
  const state = crypto.randomBytes(32).toString('hex');

  // Generate the authorization URL
  const authUrl = await msalClient.getAuthCodeUrl({
    scopes: ['Files.ReadWrite', 'offline_access'],
    redirectUri: process.env.MS_REDIRECT_URI!,
    state,
    prompt: 'consent', // CRITICAL: ensures refresh token in cache; forces account picker
  });

  // Create redirect response and set CSRF state cookie
  const response = NextResponse.redirect(authUrl);

  response.cookies.set('ms_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  });

  return response;
}
