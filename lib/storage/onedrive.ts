/**
 * OneDriveProvider — StorageProvider implementation for Microsoft OneDrive.
 *
 * Uses raw fetch against the Microsoft Graph REST API. MSAL handles all token
 * refresh internally via the PostgresMsalCachePlugin (org-specific encrypted cache
 * persisted to organisations.ms_token_cache_enc).
 *
 * Path convention: Apps/Prompt/{clientName}/{filingTypeId}/{taxYear}/{filename}
 * OneDrive's path-based PUT auto-creates intermediate folders — no folder creation helper needed.
 *
 * Token management:
 * - Each method creates a fresh MSAL client (PostgresMsalCachePlugin fires beforeCacheAccess
 *   on the first cache operation within a client instance — reusing an instance across
 *   requests risks stale cache reads).
 * - acquireTokenSilent handles access token refresh transparently.
 * - On InteractionRequiredAuthError (expired/revoked refresh token), sets
 *   storage_backend_status = 'reauth_required' and clears token columns.
 *
 * @see Phase 26-01 for PostgresMsalCachePlugin, schema migration, and MS env var docs.
 */

import {
  ConfidentialClientApplication,
  InteractionRequiredAuthError,
} from '@azure/msal-node';
import { createAdminClient } from '@/lib/supabase/admin';
import { PostgresMsalCachePlugin } from './msal-cache-plugin';
import type { StorageProvider, UploadParams } from '@/lib/documents/storage';

export class OneDriveProvider implements StorageProvider {
  constructor(
    private readonly orgId: string,
    private readonly homeAccountId: string
  ) {}

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Creates a fresh ConfidentialClientApplication for each request.
   * CRITICAL: Do NOT store the MSAL client at instance level across requests.
   * PostgresMsalCachePlugin.beforeCacheAccess fires once per client instance —
   * reusing an instance would serve stale cache data for subsequent requests.
   */
  private createMsalClient(): ConfidentialClientApplication {
    return new ConfidentialClientApplication({
      auth: {
        clientId: process.env.MS_CLIENT_ID!,
        authority: 'https://login.microsoftonline.com/common',
        clientSecret: process.env.MS_CLIENT_SECRET!,
      },
      cache: {
        cachePlugin: new PostgresMsalCachePlugin(this.orgId),
      },
    });
  }

  /**
   * Acquires a valid Microsoft Graph access token using the org's cached MSAL session.
   *
   * Flow:
   * 1. Create fresh MSAL client (loads token cache from Postgres via PostgresMsalCachePlugin)
   * 2. Look up account by homeAccountId
   * 3. Call acquireTokenSilent — MSAL refreshes the access token transparently if needed
   * 4. afterCacheAccess persists updated cache back to Postgres automatically
   *
   * On InteractionRequiredAuthError: sets storage_backend_status = 'reauth_required'
   * and clears ms_token_cache_enc + ms_home_account_id — user must reconnect.
   *
   * @throws Error if account not found or token acquisition fails
   */
  private async getAccessToken(): Promise<string> {
    const msalClient = this.createMsalClient();
    const tokenCache = msalClient.getTokenCache();
    const account = await tokenCache.getAccountByHomeId(this.homeAccountId);

    if (account === null) {
      // No cached session — account was never connected or cache was cleared
      const adminClient = createAdminClient();
      await adminClient
        .from('organisations')
        .update({
          storage_backend_status: 'reauth_required',
          ms_token_cache_enc: null,
          ms_home_account_id: null,
        })
        .eq('id', this.orgId);

      throw new Error('OneDrive session not found — reconnection required');
    }

    try {
      const result = await msalClient.acquireTokenSilent({
        account,
        scopes: ['Files.ReadWrite', 'offline_access'],
      });

      // afterCacheAccess fires automatically if MSAL refreshed the token
      // — no manual persist needed

      return result.accessToken;
    } catch (err) {
      if (err instanceof InteractionRequiredAuthError) {
        // Refresh token expired, revoked, or consent withdrawn (AADSTS53003 / AADSTS50076)
        // Set reauth_required and clear the stale token cache — user must reconnect via OAuth
        const adminClient = createAdminClient();
        await adminClient
          .from('organisations')
          .update({
            storage_backend_status: 'reauth_required',
            ms_token_cache_enc: null,
            ms_home_account_id: null,
          })
          .eq('id', this.orgId);

        // Re-throw — never retry; the surface-level caller should surface a re-auth banner
        throw err;
      }

      // Any other MSAL error (network, config, etc.) — re-throw as-is
      throw err;
    }
  }

  // ── StorageProvider interface ──────────────────────────────────────────────

  /**
   * Upload a file to OneDrive using path-based PUT (simple upload, ≤ 4 MB).
   *
   * Destination: Apps/Prompt/{clientName}/{filingTypeId}/{taxYear}/{filename}
   * OneDrive automatically creates intermediate folders on path-based PUT.
   *
   * Returns the OneDrive item ID as storagePath — stored in client_documents.storage_path.
   * The item ID is the stable identifier for subsequent getBytes, getDownloadUrl, and delete calls.
   *
   * Note: Simple upload (PUT to /root:/path:/content) works for files up to 4 MB.
   * Phase 29 will add chunked upload session support for larger files.
   */
  async upload(params: UploadParams): Promise<{ storagePath: string }> {
    const accessToken = await this.getAccessToken();

    // Build URL-safe path segments — encode each segment individually to preserve slashes
    const clientName = params.clientName ?? params.clientId;
    const encodedPath = [
      encodeURIComponent(clientName),
      encodeURIComponent(params.filingTypeId),
      encodeURIComponent(params.taxYear),
      encodeURIComponent(params.originalFilename),
    ].join('/');

    // Path-based PUT: /me/drive/root:/{path}:/content
    // /me/drive operates on the Drive associated with the authenticated user's account
    const url = `https://graph.microsoft.com/v1.0/me/drive/root:/Apps/Prompt/${encodedPath}:/content`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': params.mimeType,
      },
      body: Buffer.from(params.file),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OneDrive upload failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    // The OneDrive item ID is the stable storage path identifier
    return { storagePath: data.id };
  }

  /**
   * Returns a pre-authenticated temporary download link for an OneDrive item.
   *
   * Uses the @microsoft.graph.downloadUrl field from item metadata — this is a
   * short-lived pre-authenticated URL (no Authorization header required to follow it).
   * Unlike Google Drive (drive.file scope), OneDrive natively supports temporary links.
   *
   * Always fetch fresh — the URL expires within minutes.
   */
  async getDownloadUrl(storagePath: string): Promise<{ url: string }> {
    const accessToken = await this.getAccessToken();

    // Select only the fields we need — avoid fetching full item metadata
    const url = `https://graph.microsoft.com/v1.0/me/drive/items/${storagePath}?$select=id,%40microsoft.graph.downloadUrl`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OneDrive item metadata fetch failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const downloadUrl = data['@microsoft.graph.downloadUrl'];

    if (!downloadUrl) {
      throw new Error('OneDrive downloadUrl not returned — item may not be accessible');
    }

    return { url: downloadUrl };
  }

  /**
   * Fetches the raw bytes of an OneDrive item.
   *
   * Uses the /content endpoint which redirects to the file's CDN location.
   * fetch follows the redirect automatically.
   *
   * Used by DSAR export to assemble documents into a ZIP archive.
   */
  async getBytes(storagePath: string): Promise<Buffer> {
    const accessToken = await this.getAccessToken();

    const url = `https://graph.microsoft.com/v1.0/me/drive/items/${storagePath}/content`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OneDrive content fetch failed (${response.status}): ${errorText}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  /**
   * Permanently deletes an OneDrive item by item ID.
   *
   * OneDrive returns 204 No Content on successful deletion.
   * Called only after verifying org-scoped authorisation in application code.
   */
  async delete(storagePath: string): Promise<void> {
    const accessToken = await this.getAccessToken();

    const url = `https://graph.microsoft.com/v1.0/me/drive/items/${storagePath}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    // 204 No Content = success; anything else is an error
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OneDrive delete failed (${response.status}): ${errorText}`);
    }
  }
}
