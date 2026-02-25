---
phase: 21-document-verification-ocr-classification-pipeline
plan: 01
subsystem: database
tags: [postgres, supabase, migration, ocr, client_documents]

# Dependency graph
requires:
  - phase: 19-document-collection-mechanisms
    provides: client_documents table schema (base columns, existing RLS)
  - phase: 20-document-integration-document-aware-reminders
    provides: client_documents usage in filing cards and reminder pipeline
provides:
  - extracted_tax_year, extracted_employer, extracted_paye_ref columns on client_documents
  - extraction_source column with CHECK constraint and DEFAULT 'keyword'
  - file_hash, file_size_bytes, page_count columns on client_documents
  - idx_client_documents_file_hash partial index for O(1) duplicate detection
affects: [21-02-ocr-utilities, 21-03-upload-handler-wiring, 22-portal-feedback-dashboard-summary]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Nullable column addition pattern: ADD COLUMN IF NOT EXISTS — safe for historical rows, zero downtime"
    - "Partial index pattern: WHERE file_hash IS NOT NULL — excludes historical rows without hash from duplicate detection index"
    - "DEFAULT on new column: extraction_source DEFAULT 'keyword' — backfills historical rows to reflect pre-OCR classifier method semantics"

key-files:
  created:
    - supabase/migrations/20260225000001_phase21_ocr_columns.sql
  modified: []

key-decisions:
  - "[D-21-01-01] DEFAULT 'keyword' on extraction_source: historical rows uploaded via keyword-classifier path should be labelled 'keyword', not left NULL — Phase 22 display layer reads this value to explain extraction method"
  - "[D-21-01-02] Partial index WHERE file_hash IS NOT NULL: historical rows have no hash so including them would pollute the duplicate detection index with NULL entries that can never match"
  - "[D-21-01-03] All 7 columns nullable: Phase 22 handles NULL gracefully in display — existing rows are unaffected, no backfill required"

patterns-established:
  - "ADD COLUMN IF NOT EXISTS: idempotent migration safe to re-run; consistent with Phase 15 D-15-01-04 repair pattern"
  - "Partial index for sparse data: exclude NULL rows from index when NULLs cannot participate in equality matching"

requirements-completed: []

# Metrics
duration: 8min
completed: 2026-02-25
---

# Phase 21 Plan 01: OCR Schema Foundation Summary

**SQL migration adding 7 nullable OCR/integrity columns and a partial duplicate-detection index to client_documents, with extraction_source CHECK constraint and DEFAULT 'keyword' for historical row labelling**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-02-25T09:31:34Z
- **Completed:** 2026-02-25T09:39:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created migration `20260225000001_phase21_ocr_columns.sql` with 7 nullable columns on `client_documents`
- `extraction_source` column has CHECK constraint restricting values to `('ocr', 'keyword', 'rules')` with DEFAULT `'keyword'` for historical row labelling
- Partial index `idx_client_documents_file_hash` on `(client_id, file_hash) WHERE file_hash IS NOT NULL` for O(1) duplicate detection without polluting index with NULL-hash historical rows
- Migration timestamp `20260225000001` correctly follows most recent migration `20260224100000_phase19_schema.sql`

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema migration — add OCR columns and file integrity columns to client_documents** - `3c21c98` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `supabase/migrations/20260225000001_phase21_ocr_columns.sql` - Adds 7 nullable columns (extracted_tax_year, extracted_employer, extracted_paye_ref, extraction_source, file_hash, file_size_bytes, page_count) and partial index to client_documents

## Decisions Made
- DEFAULT 'keyword' on extraction_source so historical documents show the classifier method that was in use when they were uploaded, not NULL — Phase 22 display reads this value to explain extraction provenance
- Partial index excludes NULL file_hash rows — historical uploads have no hash, so they should not appear in the duplicate detection index (they cannot match any hash equality query)
- All columns nullable with no NOT NULL constraints — historical rows are unaffected, zero migration risk

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript error in `app/(dashboard)/settings/components/settings-tabs.tsx` (untracked file, not part of this plan): `postmarkSettings.token` is `string | null` but `PostmarkSettingsCard.defaultToken` expects `string`. This error pre-exists Plan 21-01 and is unrelated to the migration file. The migration itself introduces no TypeScript files. Logged to deferred-items for resolution in a future settings-focused plan.

## User Setup Required

None - migration will be applied automatically on next `npx supabase db push` or via Supabase Dashboard SQL editor. No environment variables required for this plan.

## Next Phase Readiness
- `client_documents` schema now has all columns required for Phase 21 Plan 02 (OCR utilities: pdf-parse + regex extraction)
- `extraction_source` DEFAULT 'keyword' means Plan 02 can INSERT 'ocr' for new documents without backfilling old rows
- Duplicate detection via `idx_client_documents_file_hash` is ready for Plan 03 (upload handler wiring)
- Phase 22 can read all 7 columns once Plan 03 populates them

---
*Phase: 21-document-verification-ocr-classification-pipeline*
*Completed: 2026-02-25*

## Self-Check: PASSED

- FOUND: `supabase/migrations/20260225000001_phase21_ocr_columns.sql`
- FOUND: `.planning/phases/21-document-verification-ocr-classification-pipeline/21-01-SUMMARY.md`
- FOUND: commit `3c21c98` (feat(21-01): add OCR extraction + file integrity columns to client_documents)
