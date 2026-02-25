-- Phase 22: Add 'manual' to extraction_source CHECK constraint
-- Allows accountants to manually correct OCR-extracted fields in the dashboard.
-- The inline CHECK added in Phase 21 must be dropped and replaced — PostgreSQL does not
-- support in-place modification of CHECK constraints.
--
-- Auto-generated constraint name from Phase 21 ADD COLUMN inline CHECK:
--   client_documents_extraction_source_check
-- Using IF EXISTS defensively in case the name differs on a clean remote.

ALTER TABLE client_documents
  DROP CONSTRAINT IF EXISTS client_documents_extraction_source_check;

ALTER TABLE client_documents
  ADD CONSTRAINT client_documents_extraction_source_check
  CHECK (extraction_source IN ('ocr', 'keyword', 'rules', 'manual'));
