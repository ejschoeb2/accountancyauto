import type OAuthClient from "intuit-oauth";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOAuthClient } from "./oauth-client";

const REFRESH_THRESHOLD_MS = 50 * 60 * 1000; // 50 minutes
const LOCK_TIMEOUT_MS = 10 * 1000; // 10 seconds

export interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  x_refresh_token_expires_in: number;
  created_at: string;
  realm_id: string;
}

export class TokenManager {
  private oauthClient: OAuthClient;
  private supabase: SupabaseClient;

  constructor() {
    this.oauthClient = getOAuthClient();
    this.supabase = createAdminClient();
  }

  /**
   * Get a valid token, refreshing if needed (proactive refresh at 50 minutes)
   */
  async getValidToken(): Promise<string> {
    const tokens = await this.getStoredTokens();

    if (!tokens) {
      throw new Error("No OAuth tokens found. Please connect to QuickBooks.");
    }

    const expiresAt = new Date(tokens.created_at).getTime() + tokens.expires_in * 1000;
    const timeUntilExpiry = expiresAt - Date.now();

    // If token expires in less than 50 minutes, refresh it
    if (timeUntilExpiry < REFRESH_THRESHOLD_MS) {
      const lockAcquired = await this.acquireLock("qb_token_refresh");

      if (!lockAcquired) {
        // Another process is refreshing, wait and retry
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return this.getValidToken();
      }

      try {
        // Double-check token after acquiring lock
        const currentTokens = await this.getStoredTokens();
        if (!currentTokens) {
          throw new Error("No OAuth tokens found after acquiring lock.");
        }

        const currentExpiresAt =
          new Date(currentTokens.created_at).getTime() + currentTokens.expires_in * 1000;
        const currentTimeUntilExpiry = currentExpiresAt - Date.now();

        if (currentTimeUntilExpiry >= REFRESH_THRESHOLD_MS) {
          // Token was already refreshed by another process
          return currentTokens.access_token;
        }

        // Refresh the token
        this.oauthClient.setToken({
          access_token: currentTokens.access_token,
          refresh_token: currentTokens.refresh_token,
          expires_in: currentTokens.expires_in,
          x_refresh_token_expires_in: currentTokens.x_refresh_token_expires_in,
          created_at: currentTokens.created_at,
        });

        const authResponse = await this.oauthClient.refreshUsingToken(
          currentTokens.refresh_token
        );
        const refreshedToken = authResponse.getToken();

        const newTokenData: TokenData = {
          access_token: refreshedToken.access_token,
          refresh_token: refreshedToken.refresh_token,
          expires_in: refreshedToken.expires_in,
          x_refresh_token_expires_in: refreshedToken.x_refresh_token_expires_in,
          created_at: new Date().toISOString(),
          realm_id: currentTokens.realm_id,
        };

        await this.storeTokens(newTokenData, currentTokens.realm_id);

        return newTokenData.access_token;
      } finally {
        await this.releaseLock("qb_token_refresh");
      }
    }

    return tokens.access_token;
  }

  /**
   * Acquire distributed lock using Supabase locks table
   */
  private async acquireLock(lockName: string): Promise<boolean> {
    // Clean up expired locks first
    await this.supabase.rpc("cleanup_expired_locks", {
      timeout_ms: LOCK_TIMEOUT_MS,
    });

    const { data, error } = await this.supabase
      .from("locks")
      .insert({
        lock_name: lockName,
        acquired_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      // Lock already exists
      return false;
    }

    return !!data;
  }

  /**
   * Release distributed lock
   */
  private async releaseLock(lockName: string): Promise<void> {
    await this.supabase.from("locks").delete().eq("lock_name", lockName);
  }

  /**
   * Store tokens in oauth_tokens table
   */
  async storeTokens(tokens: TokenData, realmId: string): Promise<void> {
    const { error } = await this.supabase
      .from("oauth_tokens")
      .upsert(
        {
          provider: "quickbooks",
          realm_id: realmId,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_in: tokens.expires_in,
          x_refresh_token_expires_in: tokens.x_refresh_token_expires_in,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "provider" }
      );

    if (error) {
      throw new Error(`Failed to store OAuth tokens: ${error.message}`);
    }
  }

  /**
   * Get stored tokens from database
   */
  async getStoredTokens(): Promise<TokenData | null> {
    const { data, error } = await this.supabase
      .from("oauth_tokens")
      .select("*")
      .eq("provider", "quickbooks")
      .single();

    if (error || !data) {
      return null;
    }

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      x_refresh_token_expires_in: data.x_refresh_token_expires_in,
      created_at: data.created_at,
      realm_id: data.realm_id,
    };
  }
}
