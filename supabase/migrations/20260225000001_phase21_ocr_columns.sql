-- Downtime risk: NONE — safe for zero-downtime deployment
-- Phase 21: OCR extraction columns + file integrity columns on client_documents
--
-- All columns are nullable — historical documents (Phases 19-20) will have NULL.
-- Phase 22 handles NULL gracefully in the display layer per the locked decision.
--
-- extraction_source values:
--   'ocr'     — fields extracted from PDF text via pdf-parse + regex
--   'keyword' — classification via filename keyword matching (pre-Phase-21 path)
--   'rules'   — only integrity rules ran (image-only PDF, non-PDF file, or corrupt PDF)
--
-- DEFAULT 'keyword' applied to extraction_source so historical rows reflect
-- the classifier method that was in use when they were created.

ALTER TABLE client_documents
  ADD COLUMN IF NOT EXISTS extracted_tax_year  TEXT,
  ADD COLUMN IF NOT EXISTS extracted_employer   TEXT,
  ADD COLUMN IF NOT EXISTS extracted_paye_ref   TEXT,
  ADD COLUMN IF NOT EXISTS extraction_source    TEXT
    CHECK (extraction_source IN ('ocr', 'keyword', 'rules'))
    DEFAULT 'keyword',
  ADD COLUMN IF NOT EXISTS file_hash            TEXT,
  ADD COLUMN IF NOT EXISTS file_size_bytes      BIGINT,
  ADD COLUMN IF NOT EXISTS page_count           INT;

-- Partial index for O(1) duplicate detection per client.
-- WHERE file_hash IS NOT NULL excludes historical rows (no hash stored).
CREATE INDEX IF NOT EXISTS idx_client_documents_file_hash
  ON client_documents(client_id, file_hash)
  WHERE file_hash IS NOT NULL;
