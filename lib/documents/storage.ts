import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Private Supabase Storage bucket for client documents.
 * Bucket must be created manually in the Supabase Dashboard (private, not public).
 * Defaults to 'prompt-documents' if SUPABASE_STORAGE_BUCKET_DOCUMENTS is not set.
 */
const BUCKET_NAME = process.env.SUPABASE_STORAGE_BUCKET_DOCUMENTS ?? 'prompt-documents';

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * The set of supported storage backends. Mirrors the storage_backend_enum Postgres type.
 */
export type StorageBackend = 'supabase' | 'google_drive' | 'onedrive' | 'dropbox';

/**
 * Minimal org config needed by resolveProvider(). Does not include token columns —
 * those are read inside provider constructors in Phases 25-27, not by the factory.
 * Treat null storage_backend as 'supabase' (safe default for pre-migration rows).
 */
export interface OrgStorageConfig {
  id: string;
  storage_backend: StorageBackend | null;
}

/**
 * Parameters for uploading a document. Shared across all StorageProvider implementations.
 */
export interface UploadParams {
  orgId: string;
  clientId: string;
  filingTypeId: string;
  taxYear: string;
  file: Buffer | Uint8Array;
  originalFilename: string;
  mimeType: string;
}

// ── StorageProvider interface ─────────────────────────────────────────────────

/**
 * Provider-agnostic interface for document storage operations.
 * Implemented by SupabaseStorageProvider (Phase 24) and extended by
 * GoogleDriveProvider (Phase 25), OneDriveProvider (Phase 26), DropboxProvider (Phase 27).
 *
 * All implementations must be created via resolveProvider() — do not instantiate directly.
 */
export interface StorageProvider {
  /**
   * Upload a document and return its storage path.
   * The path format is provider-specific; it is stored in client_documents.storage_path.
   */
  upload(params: UploadParams): Promise<{ storagePath: string }>;

  /**
   * Generate a short-lived URL or equivalent for downloading a document.
   * For Supabase: a signed URL (300s max). For Google Drive: a server-proxied response.
   * For OneDrive/Dropbox: a provider-generated temporary link.
   */
  getDownloadUrl(storagePath: string): Promise<{ url: string }>;

  /**
   * Permanently delete a document from storage.
   * Called only after verifying org-scoped authorisation in application code.
   */
  delete(storagePath: string): Promise<void>;

  /**
   * Fetch the raw bytes of a document. Used by DSAR export (Phase 25+).
   * Returns a Buffer regardless of the underlying provider's native format.
   */
  getBytes(storagePath: string): Promise<Buffer>;
}

// ── SupabaseStorageProvider ───────────────────────────────────────────────────

/**
 * StorageProvider implementation backed by Supabase Storage.
 *
 * Uses the admin client (service role) for all operations to bypass RLS.
 * Do NOT use createSignedUploadUrl — known storage-js bug (#186) results in owner=null.
 * createSignedUrl (for downloads) is safe with admin client.
 */
export class SupabaseStorageProvider implements StorageProvider {
  async upload(params: UploadParams): Promise<{ storagePath: string }> {
    const adminClient = createAdminClient();
    const ext = params.originalFilename.split('.').pop()?.toLowerCase() ?? 'bin';
    const uuid = crypto.randomUUID();
    const storagePath = `orgs/${params.orgId}/clients/${params.clientId}/${params.filingTypeId}/${params.taxYear}/${uuid}.${ext}`;

    const { error } = await adminClient.storage
      .from(BUCKET_NAME)
      .upload(storagePath, params.file, { contentType: params.mimeType, upsert: false });

    if (error) throw new Error(`Storage upload failed: ${error.message}`);
    return { storagePath };
  }

  async getDownloadUrl(storagePath: string): Promise<{ url: string }> {
    const adminClient = createAdminClient();
    const { data, error } = await adminClient.storage
      .from(BUCKET_NAME)
      .createSignedUrl(storagePath, 300); // 300 seconds max (5 minutes) — never exceed

    if (error || !data?.signedUrl) throw new Error(`Signed URL generation failed: ${error?.message}`);
    return { url: data.signedUrl };
  }

  async delete(storagePath: string): Promise<void> {
    const adminClient = createAdminClient();
    const { error } = await adminClient.storage
      .from(BUCKET_NAME)
      .remove([storagePath]);

    if (error) throw new Error(`Storage delete failed: ${error.message}`);
  }

  async getBytes(storagePath: string): Promise<Buffer> {
    // Reuse getDownloadUrl() to get a signed URL, then fetch the bytes.
    // This matches what the DSAR route currently does inline.
    const { url } = await this.getDownloadUrl(storagePath);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch document bytes: ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Returns the correct StorageProvider implementation for the given org config.
 * Always use this factory — never instantiate providers directly.
 *
 * Phases 25-27 add cases for 'google_drive', 'onedrive', 'dropbox'.
 * The default case returns SupabaseStorageProvider for safety (null or unrecognised backend).
 */
export function resolveProvider(orgConfig: OrgStorageConfig): StorageProvider {
  switch (orgConfig.storage_backend) {
    case 'supabase':
    default:
      return new SupabaseStorageProvider();
    // Phase 25: case 'google_drive': return new GoogleDriveProvider(orgConfig);
    // Phase 26: case 'onedrive': return new OneDriveProvider(orgConfig);
    // Phase 27: case 'dropbox': return new DropboxProvider(orgConfig);
  }
}

// ── Backwards-compatible named exports ───────────────────────────────────────
// These preserve the existing call-site contracts. All four existing callers
// import these functions and must continue to work without modification.

/**
 * Upload a document to Supabase Storage.
 *
 * @deprecated Prefer resolveProvider(orgConfig).upload(params) for new code.
 * Kept for backwards compatibility with existing call sites.
 */
export async function uploadDocument(params: UploadParams): Promise<{ storagePath: string }> {
  return new SupabaseStorageProvider().upload(params);
}

/**
 * Generate a signed download URL for a stored document.
 *
 * Expiry is hardcoded at 300 seconds (5 minutes) — never exceed this value.
 * UK GDPR requires that access to personal data be appropriately controlled.
 * Every call to this function must be accompanied by an insert into document_access_log.
 *
 * @deprecated Prefer resolveProvider(orgConfig).getDownloadUrl(storagePath) for new code.
 * Kept for backwards compatibility with existing call sites.
 */
export async function getSignedDownloadUrl(storagePath: string): Promise<{ signedUrl: string }> {
  const { url } = await new SupabaseStorageProvider().getDownloadUrl(storagePath);
  return { signedUrl: url };
}

/**
 * Delete a document from Supabase Storage.
 *
 * Uses the admin client (service role) to bypass RLS.
 * Call only after verifying the caller is authorised (org-scoped) in application code.
 * Also delete or soft-delete the corresponding client_documents row.
 *
 * @deprecated Prefer resolveProvider(orgConfig).delete(storagePath) for new code.
 * Kept for backwards compatibility with existing call sites.
 */
export async function deleteDocument(storagePath: string): Promise<void> {
  return new SupabaseStorageProvider().delete(storagePath);
}
