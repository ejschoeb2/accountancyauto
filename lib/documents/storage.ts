import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Private Supabase Storage bucket for client documents.
 * Bucket must be created manually in the Supabase Dashboard (private, not public).
 * Defaults to 'prompt-documents' if SUPABASE_STORAGE_BUCKET_DOCUMENTS is not set.
 */
const BUCKET_NAME = process.env.SUPABASE_STORAGE_BUCKET_DOCUMENTS ?? 'prompt-documents';

/**
 * Upload a document to Supabase Storage.
 *
 * Uses the admin client (service role) to bypass RLS — correct for server-initiated uploads.
 * Do NOT use createSignedUploadUrl: there is a known storage-js bug (#186) where service_role
 * uploads via signed upload URLs result in owner=null on the storage object.
 *
 * Storage path format: orgs/{orgId}/clients/{clientId}/{filingTypeId}/{taxYear}/{uuid}.{ext}
 * The original filename is stored in client_documents.original_filename (not in the path).
 */
export async function uploadDocument(params: {
  orgId: string;
  clientId: string;
  filingTypeId: string;
  taxYear: string;
  file: Buffer | Uint8Array;
  originalFilename: string;
  mimeType: string;
}): Promise<{ storagePath: string }> {
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

/**
 * Generate a signed download URL for a stored document.
 *
 * Expiry is hardcoded at 300 seconds (5 minutes) — never exceed this value.
 * UK GDPR requires that access to personal data be appropriately controlled.
 * Every call to this function must be accompanied by an insert into document_access_log.
 *
 * Note: createSignedUrl (for downloads) is safe with admin client.
 * The owner=null bug only affects createSignedUploadUrl (for uploads).
 */
export async function getSignedDownloadUrl(storagePath: string): Promise<{ signedUrl: string }> {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient.storage
    .from(BUCKET_NAME)
    .createSignedUrl(storagePath, 300); // 300 seconds max (5 minutes) — never exceed

  if (error || !data?.signedUrl) throw new Error(`Signed URL generation failed: ${error?.message}`);
  return { signedUrl: data.signedUrl };
}

/**
 * Delete a document from Supabase Storage.
 *
 * Uses the admin client (service role) to bypass RLS.
 * Call only after verifying the caller is authorised (org-scoped) in application code.
 * Also delete or soft-delete the corresponding client_documents row.
 */
export async function deleteDocument(storagePath: string): Promise<void> {
  const adminClient = createAdminClient();
  const { error } = await adminClient.storage
    .from(BUCKET_NAME)
    .remove([storagePath]);

  if (error) throw new Error(`Storage delete failed: ${error.message}`);
}
