-- Phase 30: Per-document-type upload validation
-- Add advisory validation columns to client_documents.
--
-- needs_review: boolean flag set at upload time when per-type validation raised
--               advisory warnings. Cleared by the accountant after review.
-- validation_warnings: JSONB array of ValidationWarning objects (code, message,
--                      expected, found). NULL when no warnings were raised at upload.
--
-- Both columns have safe defaults: existing rows and future inserts that do not
-- set these values (e.g. upload-finalize route for large files, inbound email
-- attachment handler) default to needs_review=false and validation_warnings=null.

ALTER TABLE client_documents
  ADD COLUMN IF NOT EXISTS needs_review BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS validation_warnings JSONB DEFAULT NULL;

COMMENT ON COLUMN client_documents.needs_review IS
  'True when per-type validation raised advisory warnings at upload time; cleared by accountant after review.';

COMMENT ON COLUMN client_documents.validation_warnings IS
  'Structured array of ValidationWarning objects from upload validation (code, message, expected, found). Null when no warnings were raised.';

-- Update BANK_STATEMENT document type to accept text/csv uploads.
-- Bank statement CSV exports from online banking are common; the server-side
-- ALLOWED_MIME array is also updated in the upload route (Plan 01 change).
UPDATE document_types
SET expected_mime_types = array_append(expected_mime_types, 'text/csv')
WHERE code = 'BANK_STATEMENT'
  AND NOT ('text/csv' = ANY(expected_mime_types));
