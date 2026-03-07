import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrgContext } from '@/lib/auth/org-context';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { PostgresMsalCachePlugin } from '@/lib/storage/msal-cache-plugin';

export async function GET(request: NextRequest): Promise<NextResponse> {
  // --- Auth: verify user is authenticated ---
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // --- Get org context ---
  const { orgId } = await getOrgContext();

  // --- Extract code and state from URL ---
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const stateFromUrl = searchParams.get('state');

  // --- CSRF validation ---
  const storedState = request.cookies.get('ms_oauth_state')?.value;

  if (!storedState || !stateFromUrl || stateFromUrl !== storedState) {
    const errorUrl = new URL('/settings', request.url);
    errorUrl.searchParams.set('tab', 'storage');
    errorUrl.searchParams.set('error', 'invalid_state');
    const errorResponse = NextResponse.redirect(errorUrl);
    errorResponse.cookies.delete('ms_oauth_state');
    return errorResponse;
  }

  // --- Token exchange with MSAL (including PostgresMsalCachePlugin) ---
  // CRITICAL: cachePlugin must be present so afterCacheAccess fires after acquireTokenByCode,
  // persisting the initial token cache to Postgres (ms_token_cache_enc column).
  const msalClient = new ConfidentialClientApplication({
    auth: {
      clientId: process.env.MS_CLIENT_ID!,
      authority: 'https://login.microsoftonline.com/common',
      clientSecret: process.env.MS_CLIENT_SECRET!,
    },
    cache: {
      cachePlugin: new PostgresMsalCachePlugin(orgId),
    },
  });

  let tokenResponse;
  try {
    tokenResponse = await msalClient.acquireTokenByCode({
      code: code!,
      redirectUri: process.env.MS_REDIRECT_URI!,
      scopes: ['Files.ReadWrite.AppFolder', 'offline_access'],
    });
    // afterCacheAccess fires automatically — the encrypted cache is now persisted to ms_token_cache_enc.
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('AADSTS53003')) {
      // Conditional Access policy blocked the app — redirect with specific error
      const errorUrl = new URL('/settings', request.url);
      errorUrl.searchParams.set('tab', 'storage');
      errorUrl.searchParams.set('error', 'conditional_access_blocked');
      const errorResponse = NextResponse.redirect(errorUrl);
      errorResponse.cookies.delete('ms_oauth_state');
      return errorResponse;
    }

    console.error('OneDrive OAuth callback error:', error);
    const errorUrl = new URL('/settings', request.url);
    errorUrl.searchParams.set('tab', 'storage');
    errorUrl.searchParams.set('error', 'auth_failed');
    const errorResponse = NextResponse.redirect(errorUrl);
    errorResponse.cookies.delete('ms_oauth_state');
    return errorResponse;
  }

  // --- Persist homeAccountId and update org storage backend ---
  const admin = createAdminClient();
  try {
    const { error: dbError } = await admin
      .from('organisations')
      .update({
        storage_backend: 'onedrive',
        storage_backend_status: 'active',
        ms_home_account_id: tokenResponse.account!.homeAccountId,
        // ms_token_cache_enc is already persisted by afterCacheAccess above
      })
      .eq('id', orgId);

    if (dbError) {
      throw new Error(dbError.message);
    }
  } catch (error) {
    console.error('OneDrive OAuth DB persist error:', error);
    const errorUrl = new URL('/settings', request.url);
    errorUrl.searchParams.set('tab', 'storage');
    errorUrl.searchParams.set('error', 'db_error');
    const errorResponse = NextResponse.redirect(errorUrl);
    errorResponse.cookies.delete('ms_oauth_state');
    return errorResponse;
  }

  // --- Clean up state cookie and redirect to success ---
  // Wizard origin is encoded in the state param prefix ("wizard_") so we don't
  // rely on a cookie — avoids cross-subdomain cookie issues in production.
  const fromWizard = stateFromUrl?.startsWith('wizard_') ?? false;
  const successUrl = fromWizard
    ? new URL('/setup/wizard?storage_connected=onedrive', request.url)
    : (() => { const u = new URL('/settings', request.url); u.searchParams.set('tab', 'storage'); u.searchParams.set('connected', 'onedrive'); return u; })();

  const response = NextResponse.redirect(successUrl);
  response.cookies.delete('ms_oauth_state');
  return response;
}
