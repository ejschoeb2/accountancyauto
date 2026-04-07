/**
 * PostgresMsalCachePlugin — MSAL ICachePlugin backed by encrypted Postgres storage.
 *
 * Bridges MSAL's in-memory token cache with the encrypted `ms_token_cache_enc` column
 * in the `organisations` table. One instance per org per request — never share across orgs.
 *
 * Encryption: the entire serialized MSAL cache blob is treated as a single unit.
 * Individual tokens within the cache are NOT encrypted separately — the blob as a
 * whole is encrypted via AES-256-GCM through lib/crypto/tokens.ts.
 *
 * Usage:
 *   const plugin = new PostgresMsalCachePlugin(orgId);
 *   const pca = new ConfidentialClientApplication({
 *     ...,
 *     cache: { cachePlugin: plugin },
 *   });
 */

import type { ICachePlugin, TokenCacheContext } from '@azure/msal-node';
import { createAdminClient } from '@/lib/supabase/admin';
import { encryptToken, decryptToken } from '@/lib/crypto/tokens';
import { logger } from '@/lib/logger';

export class PostgresMsalCachePlugin implements ICachePlugin {
  constructor(private readonly orgId: string) {}

  /**
   * Called by MSAL before reading from the in-memory cache.
   * Loads and decrypts the persisted cache blob from `organisations.ms_token_cache_enc`
   * into MSAL's in-memory cache.
   *
   * If no cache exists yet (fresh connect), MSAL starts with an empty in-memory cache —
   * this is correct and expected behaviour.
   */
  async beforeCacheAccess(cacheContext: TokenCacheContext): Promise<void> {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('organisations')
      .select('ms_token_cache_enc')
      .eq('id', this.orgId)
      .single();

    if (error) {
      // Log but do not throw — MSAL will start with an empty cache on failure.
      // The next successful token acquisition will repopulate and persist the cache.
      logger.error("Failed to load MSAL cache", { orgId: this.orgId, error: error.message });
      return;
    }

    if (data?.ms_token_cache_enc) {
      const decrypted = decryptToken(data.ms_token_cache_enc);
      cacheContext.tokenCache.deserialize(decrypted);
    }
    // If no cache blob exists, MSAL starts with empty in-memory cache — correct behaviour.
  }

  /**
   * Called by MSAL after any cache operation.
   * If the cache has changed, serializes it, encrypts it, and persists it to Postgres.
   *
   * Short-circuits on `cacheHasChanged === false` to avoid unnecessary DB writes.
   */
  async afterCacheAccess(cacheContext: TokenCacheContext): Promise<void> {
    if (!cacheContext.cacheHasChanged) {
      return;
    }

    const serialized = cacheContext.tokenCache.serialize();
    const encrypted = encryptToken(serialized);

    const supabase = createAdminClient();

    const { error } = await supabase
      .from('organisations')
      .update({ ms_token_cache_enc: encrypted })
      .eq('id', this.orgId);

    if (error) {
      // Log but do not throw — a cache write failure is non-fatal; the token
      // was acquired successfully this session. The next silent token acquisition
      // will trigger another cache write attempt.
      logger.error("Failed to persist MSAL cache", { orgId: this.orgId, error: error.message });
    }
  }
}
