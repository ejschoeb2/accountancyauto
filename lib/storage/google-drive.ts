/**
 * GoogleDriveProvider — StorageProvider implementation backed by Google Drive.
 *
 * All Drive API calls go through withTokenRefresh(), which handles proactive token
 * refresh and invalid_grant detection (sets reauth_required status, nulls tokens).
 *
 * Folder structure: Prompt/{clientName}/{filingTypeId}/{taxYear}/{filename}
 * The rootFolderId points to the org's Prompt/ root folder in Drive
 * (stored in organisations.google_drive_folder_id).
 *
 * storagePath for Google Drive = Drive file ID. This is stored in
 * client_documents.storage_path and used directly for getBytes() and delete().
 *
 * Important: getDownloadUrl() is intentionally unsupported — drive.file scope
 * cannot produce public or short-lived sharing links. All download routes must
 * use getBytes() via the server-proxy download route instead.
 */

import { drive as createDrive } from '@googleapis/drive';
import { Readable } from 'stream';
import { createAdminClient } from '@/lib/supabase/admin';
import { withTokenRefresh, type GoogleCredentials } from './token-refresh';
import type { StorageProvider, UploadParams } from '@/lib/documents/storage';

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Collects a Node.js ReadableStream into a Buffer.
 * Used by getBytes() to materialise the Drive API alt=media response.
 */
async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

// ── GoogleDriveProvider ───────────────────────────────────────────────────────

export class GoogleDriveProvider implements StorageProvider {
  /**
   * @param orgId        Organisation ID — used to look up token columns per-call.
   * @param rootFolderId Drive file ID of the org's Prompt/ root folder.
   *                     Stored in organisations.google_drive_folder_id.
   */
  constructor(
    private readonly orgId: string,
    private readonly rootFolderId: string,
  ) {}

  // ── Private helpers ──────────────────────────────────────────────────────────

  /**
   * Fetches the org's encrypted Google credentials from the organisations table.
   * Throws 'Google Drive not connected' if no access token is present.
   */
  private async getOrgCredentials(): Promise<GoogleCredentials> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('organisations')
      .select('google_access_token_enc, google_refresh_token_enc, google_token_expires_at')
      .eq('id', this.orgId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch org credentials: ${error.message}`);
    }

    if (!data.google_access_token_enc) {
      throw new Error('Google Drive not connected');
    }

    return {
      access_token_enc: data.google_access_token_enc,
      refresh_token_enc: data.google_refresh_token_enc ?? '',
      expires_at: data.google_token_expires_at ?? new Date(0).toISOString(),
      org_id: this.orgId,
    };
  }

  /**
   * Finds an existing folder by name under parentId, or creates it if absent.
   *
   * Uses Drive list API with an exact match query to prevent duplicates (Research pitfall #3).
   * Single quotes in folder names are escaped to avoid Drive query syntax errors.
   *
   * @param drive    Authenticated Drive client instance.
   * @param parentId Drive file ID of the parent folder.
   * @param name     Folder display name to find or create.
   * @returns        Drive file ID of the found or newly created folder.
   */
  private async findOrCreateFolder(
    drive: ReturnType<typeof createDrive>,
    parentId: string,
    name: string,
  ): Promise<string> {
    // Escape single quotes in folder name to avoid breaking the Drive query syntax
    const escapedName = name.replace(/'/g, "\\'");

    const listResponse = await drive.files.list({
      q: `name='${escapedName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id)',
      spaces: 'drive',
    });

    const existingFiles = listResponse.data.files ?? [];
    if (existingFiles.length > 0 && existingFiles[0].id) {
      return existingFiles[0].id;
    }

    // Folder not found — create it
    const createResponse = await drive.files.create({
      requestBody: {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      },
      fields: 'id',
    });

    if (!createResponse.data.id) {
      throw new Error(`Failed to create Drive folder: ${name}`);
    }

    return createResponse.data.id;
  }

  // ── StorageProvider methods ──────────────────────────────────────────────────

  /**
   * Uploads a document to Google Drive under the folder path:
   *   Prompt/{clientName}/{filingTypeId}/{taxYear}/{originalFilename}
   *
   * Folders at each level are created lazily using findOrCreateFolder.
   * Returns the Drive file ID as storagePath — this is the identifier used
   * for all subsequent getBytes() and delete() calls.
   */
  async upload(params: UploadParams): Promise<{ storagePath: string }> {
    const creds = await this.getOrgCredentials();

    return withTokenRefresh(creds, async (auth) => {
      const drive = createDrive({ version: 'v3', auth });

      // Build folder hierarchy lazily — one level at a time
      const clientFolderId = await this.findOrCreateFolder(
        drive,
        this.rootFolderId,
        params.clientName ?? params.clientId, // Fall back to clientId if clientName not provided
      );

      const filingTypeFolderId = await this.findOrCreateFolder(
        drive,
        clientFolderId,
        params.filingTypeId,
      );

      const taxYearFolderId = await this.findOrCreateFolder(
        drive,
        filingTypeFolderId,
        params.taxYear,
      );

      // Convert Buffer/Uint8Array to a Node.js Readable stream for the Drive media upload
      const readable = Readable.from(Buffer.from(params.file));

      const uploadResponse = await drive.files.create({
        requestBody: {
          name: params.originalFilename,
          parents: [taxYearFolderId],
        },
        media: {
          mimeType: params.mimeType,
          body: readable,
        },
        fields: 'id',
      });

      if (!uploadResponse.data.id) {
        throw new Error('Drive file upload succeeded but returned no file ID');
      }

      // Drive file ID IS the storagePath for Google Drive documents
      return { storagePath: uploadResponse.data.id };
    });
  }

  /**
   * NOT SUPPORTED for Google Drive.
   *
   * drive.file scope cannot produce public URLs or short-lived sharing links.
   * All download routes must use getBytes() via the server-proxy download route instead.
   */
  async getDownloadUrl(_storagePath: string): Promise<{ url: string }> {
    throw new Error(
      'getDownloadUrl() is not available for Google Drive (drive.file scope). ' +
        'Use getBytes() via the server-proxy download route instead.',
    );
  }

  /**
   * Streams a Drive file's bytes into a Buffer using alt=media.
   * storagePath must be a Drive file ID (as returned by upload()).
   */
  async getBytes(storagePath: string): Promise<Buffer> {
    const creds = await this.getOrgCredentials();

    return withTokenRefresh(creds, async (auth) => {
      const drive = createDrive({ version: 'v3', auth });

      const response = await drive.files.get(
        { fileId: storagePath, alt: 'media' },
        { responseType: 'stream' },
      );

      return streamToBuffer(response.data as NodeJS.ReadableStream);
    });
  }

  /**
   * Permanently deletes a Drive file by file ID.
   * storagePath must be a Drive file ID (as returned by upload()).
   */
  async delete(storagePath: string): Promise<void> {
    const creds = await this.getOrgCredentials();

    await withTokenRefresh(creds, async (auth) => {
      const drive = createDrive({ version: 'v3', auth });
      await drive.files.delete({ fileId: storagePath });
    });
  }
}
