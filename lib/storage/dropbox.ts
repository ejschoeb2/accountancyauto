/**
 * DropboxProvider — StorageProvider implementation backed by Dropbox.
 *
 * Uses the official 'dropbox' npm SDK with DropboxAuth for token management.
 * Tokens are stored encrypted in organisations (dropbox_access_token_enc,
 * dropbox_refresh_token_enc, dropbox_token_expires_at) and decrypted on each call.
 *
 * Rehydration pattern: reconstruct DropboxAuth from stored tokens, call
 * checkAndRefreshAccessToken(), then persist the refreshed token back to Postgres.
 *
 * Folder structure: app folder root / {clientId} / {filingTypeId} / {taxYear} / {uuid}.{ext}
 * Dropbox enforces the /Apps/Prompt/ boundary via the "App folder" access type —
 * do NOT prefix paths with /Apps/Prompt/.
 *
 * storagePath for Dropbox = the relative path from app folder root (e.g. /clientId/...)
 * This is stored in client_documents.storage_path and used for all subsequent operations.
 *
 * getDownloadUrl() uses filesGetTemporaryLink for a 4-hour TTL link — safe to return
 * to the client as { signedUrl } (unlike Google Drive which cannot produce public URLs).
 */

import { Dropbox, DropboxAuth } from 'dropbox';
import { createAdminClient } from '@/lib/supabase/admin';
import { encryptToken, decryptToken } from '@/lib/crypto/tokens';
import type { StorageProvider, UploadParams } from '@/lib/documents/storage';

// ── DropboxProvider ───────────────────────────────────────────────────────────

export class DropboxProvider implements StorageProvider {
  private readonly orgId: string;

  constructor(orgConfig: { id: string }) {
    this.orgId = orgConfig.id;
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  /**
   * Rehydrates a DropboxAuth instance from encrypted Postgres tokens,
   * calls checkAndRefreshAccessToken(), and persists refreshed tokens back.
   *
   * On unrecoverable auth error (revoked/expired refresh token):
   * - Sets storage_backend_status = 'reauth_required'
   * - Nulls all token columns
   * - Re-throws the error — callers must not retry
   */
  private async getAuthClient(): Promise<{ dbx: Dropbox; auth: DropboxAuth }> {
    const admin = createAdminClient();

    const { data: org, error } = await admin
      .from('organisations')
      .select('dropbox_access_token_enc, dropbox_refresh_token_enc, dropbox_token_expires_at')
      .eq('id', this.orgId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch org credentials: ${error.message}`);
    }

    if (!org?.dropbox_refresh_token_enc) {
      throw new Error('Dropbox not connected for this organisation');
    }

    // Construct DropboxAuth lazily (never at module scope — avoids build failures
    // when DROPBOX_APP_KEY / DROPBOX_APP_SECRET are absent at build/CI time)
    const auth = new DropboxAuth({
      clientId: process.env.DROPBOX_APP_KEY!,
      clientSecret: process.env.DROPBOX_APP_SECRET!,
      accessToken: org.dropbox_access_token_enc
        ? decryptToken(org.dropbox_access_token_enc)
        : undefined,
      refreshToken: decryptToken(org.dropbox_refresh_token_enc),
      accessTokenExpiresAt: org.dropbox_token_expires_at
        ? new Date(org.dropbox_token_expires_at)
        : undefined,
      fetch: fetch,
    });

    try {
      await auth.checkAndRefreshAccessToken();

      // Persist refreshed token back to Postgres if a new access token was obtained
      const newAccessToken = auth.getAccessToken();
      const newExpiresAt = auth.getAccessTokenExpiresAt();
      if (newAccessToken) {
        await admin
          .from('organisations')
          .update({
            dropbox_access_token_enc: encryptToken(newAccessToken),
            dropbox_token_expires_at: newExpiresAt?.toISOString() ?? null,
            storage_backend_status: 'active',
          })
          .eq('id', this.orgId);
      }
    } catch (err) {
      // Detect unrecoverable auth errors (revoked or permanently expired refresh token)
      const errMsg = err instanceof Error ? err.message : String(err);
      const isUnrecoverable =
        errMsg.includes('invalid_grant') ||
        errMsg.includes('expired_access_token') ||
        errMsg.includes('Invalid refresh token') ||
        errMsg.includes('Token has been revoked');

      if (isUnrecoverable) {
        // Signal re-auth required and clear tokens — never retry
        await admin
          .from('organisations')
          .update({
            storage_backend_status: 'reauth_required',
            dropbox_access_token_enc: null,
            dropbox_refresh_token_enc: null,
            dropbox_token_expires_at: null,
          })
          .eq('id', this.orgId);
      }

      throw err; // Always re-throw — callers must handle the failure
    }

    return { dbx: new Dropbox({ auth }), auth };
  }

  // ── StorageProvider methods ──────────────────────────────────────────────────

  /**
   * Uploads a document to Dropbox under the path:
   *   /{clientId}/{filingTypeId}/{taxYear}/{uuid}.{ext}
   *
   * Paths are relative to the app folder root — Dropbox prepends /Apps/Prompt/
   * automatically when the app uses "App folder" access type.
   * Do NOT prefix with /Apps/Prompt/.
   */
  async upload(params: UploadParams): Promise<{ storagePath: string }> {
    const { dbx } = await this.getAuthClient();

    const ext = params.originalFilename.split('.').pop()?.toLowerCase() ?? 'bin';
    const uuid = crypto.randomUUID();
    const path = `/${params.clientId}/${params.filingTypeId}/${params.taxYear}/${uuid}.${ext}`;

    await dbx.filesUpload({
      path,
      contents: Buffer.from(params.file),
      mode: { '.tag': 'add' },
      autorename: false,
    });

    return { storagePath: path };
  }

  /**
   * Generates a 4-hour TTL temporary download link via filesGetTemporaryLink.
   * Unlike Google Drive, Dropbox CAN produce direct download URLs — this link
   * can be returned to the client as { signedUrl } in the download route.
   */
  async getDownloadUrl(storagePath: string): Promise<{ url: string }> {
    const { dbx } = await this.getAuthClient();
    const response = await dbx.filesGetTemporaryLink({ path: storagePath });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { url: (response.result as any).link };
  }

  /**
   * Fetches the raw bytes of a Dropbox document.
   * Used by DSAR export. Reuses getDownloadUrl() to get the temporary link,
   * then fetches the bytes — consistent with the SupabaseStorageProvider pattern.
   */
  async getBytes(storagePath: string): Promise<Buffer> {
    const { url } = await this.getDownloadUrl(storagePath);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Dropbox getBytes failed: ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  /**
   * Permanently deletes a Dropbox file by its storage path.
   */
  async delete(storagePath: string): Promise<void> {
    const { dbx } = await this.getAuthClient();
    await dbx.filesDeleteV2({ path: storagePath });
  }
}
