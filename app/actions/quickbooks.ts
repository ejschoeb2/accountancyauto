"use server";

import { getOAuthClient } from "@/lib/quickbooks/oauth-client";
import { TokenManager } from "@/lib/quickbooks/token-manager";
import { syncClients } from "@/lib/quickbooks/sync";
import OAuthClient from "intuit-oauth";

const OAUTH_SCOPE = [OAuthClient.scopes.Accounting];

/**
 * Initiate QuickBooks OAuth flow
 */
export async function initiateQuickBooksOAuth(): Promise<string> {
  const oauthClient = getOAuthClient();

  const authUri = oauthClient.authorizeUri({
    scope: OAUTH_SCOPE,
    state: "init",
  });

  return authUri;
}

/**
 * Handle OAuth callback - exchange authorization code for tokens
 */
export async function handleQuickBooksCallback(
  redirectUrl: string,
  realmId: string
): Promise<void> {
  const oauthClient = getOAuthClient();
  const tokenManager = new TokenManager();

  // Exchange authorization code for tokens (library needs full redirect URL)
  const authResponse = await oauthClient.createToken(redirectUrl);
  const tokenData = authResponse.getToken();

  // Store tokens
  await tokenManager.storeTokens(
    {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_in: tokenData.expires_in,
      x_refresh_token_expires_in: tokenData.x_refresh_token_expires_in,
      created_at: new Date().toISOString(),
      realm_id: realmId,
    },
    realmId
  );
}

export interface SyncResult {
  success: boolean;
  count: number;
  error?: string;
}

/**
 * Sync clients from QuickBooks
 */
export async function syncClientsAction(): Promise<SyncResult> {
  return syncClients();
}

export interface ConnectionStatus {
  connected: boolean;
  realmId?: string;
}

/**
 * Check if QuickBooks connection exists (tokens stored).
 * Does NOT attempt to refresh — that happens lazily on actual API calls.
 */
export async function getConnectionStatus(): Promise<ConnectionStatus> {
  const tokenManager = new TokenManager();

  try {
    const tokens = await tokenManager.getStoredTokens();

    if (!tokens) {
      return { connected: false };
    }

    return { connected: true, realmId: tokens.realm_id };
  } catch {
    return { connected: false };
  }
}

/**
 * Disconnect QuickBooks by removing all stored tokens
 */
export async function disconnectQuickBooks(): Promise<void> {
  const tokenManager = new TokenManager();
  const supabase = tokenManager["supabase"];

  const { error } = await supabase
    .from("oauth_tokens")
    .delete()
    .eq("provider", "quickbooks");

  if (error) {
    throw new Error(`Failed to disconnect QuickBooks: ${error.message}`);
  }
}
