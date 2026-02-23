-- Storage RLS for prompt-documents bucket
-- Run AFTER bucket 'prompt-documents' is created in Dashboard
-- Requires auth_org_id() function from migration 20260219000004

-- SELECT: authenticated org members can read their org's files
CREATE POLICY "documents_select_org"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'prompt-documents'
  AND (storage.foldername(name))[1] = 'orgs'
  AND (storage.foldername(name))[2] = (auth_org_id())::text
);

-- INSERT: authenticated org members can upload to their org's prefix
CREATE POLICY "documents_insert_org"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'prompt-documents'
  AND (storage.foldername(name))[1] = 'orgs'
  AND (storage.foldername(name))[2] = (auth_org_id())::text
);

-- UPDATE: authenticated org members can update metadata in their prefix
CREATE POLICY "documents_update_org"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'prompt-documents'
  AND (storage.foldername(name))[1] = 'orgs'
  AND (storage.foldername(name))[2] = (auth_org_id())::text
);

-- DELETE: authenticated org members can delete in their prefix
CREATE POLICY "documents_delete_org"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'prompt-documents'
  AND (storage.foldername(name))[1] = 'orgs'
  AND (storage.foldername(name))[2] = (auth_org_id())::text
);

-- Service role: full access for admin operations (cron, inbound webhook)
CREATE POLICY "documents_service_role_all"
ON storage.objects FOR ALL TO service_role
USING (bucket_id = 'prompt-documents')
WITH CHECK (bucket_id = 'prompt-documents');
