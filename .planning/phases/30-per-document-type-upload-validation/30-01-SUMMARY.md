---
phase: 30-per-document-type-upload-validation
plan: 01
subsystem: api
tags: [validation, documents, ocr, xlsx, sheetjs, bank-statement, vat, p60, p45, sa302, supabase, migration]

# Dependency graph
requires:
  - phase: 21-document-ocr-classification
    provides: "extractPdfText() in lib/documents/ocr.ts; extractedTaxYear from classify.ts"
  - phase: 22-portal-feedback-dashboard-summary
    provides: "Portal upload route pattern; integrity check pipeline"
provides:
  - "runValidation() function in lib/documents/validate.ts — advisory per-type validation"
  - "ValidationWarning and ValidationResult types for Plan 02 integration"
  - "needs_review BOOLEAN and validation_warnings JSONB columns on client_documents"
  - "text/csv accepted in upload route ALLOWED_MIME and BANK_STATEMENT expected_mime_types"
affects:
  - 30-02-upload-route-integration
  - 30-03-accountant-facing-ui

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Advisory validation module: runValidation() returns warnings array, never rejects"
    - "SheetJS imported inside function body (not module level) to avoid App Router CJS/ESM issues"
    - "Structured period marker regex — only match explicit markers, not arbitrary dates"
    - "normalisePortalTaxYear() handles both YYYY and YYYY-YY portal tax year formats"

key-files:
  created:
    - lib/documents/validate.ts
    - supabase/migrations/20260303013719_add_validation_columns_to_client_documents.sql
  modified:
    - app/api/portal/[token]/upload/route.ts

key-decisions:
  - "SheetJS require() inside function body (not ES import at module level) — avoids App Router bundler CJS/ESM issues (Pitfall 1)"
  - "Bank statement PDF check only fires on structured period markers (Statement Period, From/To, Period) — NOT arbitrary dates (Pitfall 3)"
  - "VAT period check uses loose +-1 year plausibility vs portal tax year — does NOT require exact stagger group alignment (Pitfall 4)"
  - "normalisePortalTaxYear() handles both YYYY and YYYY-YY formats defensively — both formats documented in research open questions"
  - "text/csv added to both server ALLOWED_MIME AND BANK_STATEMENT expected_mime_types in DB — both required per research open question 4"

patterns-established:
  - "Validation pattern: standalone module receives primitive parameters (not ClassificationResult) — keeps validate.ts independent of classify.ts"
  - "Warning stacking: all warnings that fire are collected and returned, not just first match"
  - "Absence-is-not-a-warning: if no period markers found in bank statement PDF, no warning raised"

requirements-completed: []

# Metrics
duration: 3min
completed: 2026-03-03
---

# Phase 30 Plan 01: Per-Document-Type Validation Module and Schema Migration Summary

**Standalone advisory validation module (lib/documents/validate.ts) with per-type checks for top-5 document types, needs_review/validation_warnings DB columns, and CSV MIME fix**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-03T01:37:22Z
- **Completed:** 2026-03-03T01:40:32Z
- **Tasks:** 1
- **Files modified:** 3 (1 created, 1 created migration, 1 modified)

## Accomplishments

- Created `lib/documents/validate.ts` with `runValidation()` handling all 5 document types with correct warning codes and stacking behaviour
- Applied schema migration adding `needs_review BOOLEAN DEFAULT false` and `validation_warnings JSONB DEFAULT NULL` to `client_documents`, plus `text/csv` in `BANK_STATEMENT.expected_mime_types`
- Fixed CSV bank statement uploads: `text/csv` added to `ALLOWED_MIME` in upload route

## Task Commits

Each task was committed atomically:

1. **Task 1: Create validation module and apply schema migration** - `e9f5608` (feat)

**Plan metadata:** to be added by gsd-tools

## Files Created/Modified

- `lib/documents/validate.ts` — `ValidationWarning`, `ValidationResult`, `runValidation()` with per-type logic for BANK_STATEMENT (PDF period + spreadsheet dates), VAT_RETURN_WORKINGS (plausibility), P60/P45/SA302 (year match)
- `supabase/migrations/20260303013719_add_validation_columns_to_client_documents.sql` — `needs_review` + `validation_warnings` columns + `text/csv` in BANK_STATEMENT expected MIME types
- `app/api/portal/[token]/upload/route.ts` — `text/csv` added to `ALLOWED_MIME` array; error message updated

## Decisions Made

- `require('xlsx')` inside function body rather than top-level ES import — avoids Next.js App Router CJS/ESM bundler conflict (research Pitfall 1)
- Bank statement PDF check only triggers on structured period markers (`Statement Period:`, `From: ... To:`, `For the period: ... to`) — not any date found in text — prevents false positives on print dates and transaction dates (research Pitfall 3)
- VAT period plausibility is ±1 year from portal tax year, not exact stagger group alignment — avoids false positives for all 3 HMRC stagger groups (research Pitfall 4)
- `normalisePortalTaxYear()` handles both `"2024"` (4-digit) and `"2024-25"` (2-digit suffix) formats defensively, extracting terminal year in both cases
- `text/csv` added to both server `ALLOWED_MIME` (upload route) AND `BANK_STATEMENT.expected_mime_types` (DB) — server-only fix insufficient because client-side dropzone reads `expected_mime_types` from DB

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The TypeScript project-wide type check returns one pre-existing error (`validator.ts` referencing a deleted `postmark/inbound/route.ts`). This is not caused by our changes. `lib/documents/validate.ts` type-checks cleanly in isolation.

## User Setup Required

The schema migration `20260303013719_add_validation_columns_to_client_documents.sql` must be applied to the Supabase database. Run via `supabase db push` or apply via the Supabase Dashboard SQL editor.

## Next Phase Readiness

- `runValidation()` is fully standalone and ready for integration in Plan 02
- Plan 02 integrates `runValidation()` into the upload route after classification, adds `needs_review` + `validation_warnings` to the INSERT, and extends the JSON response with `validationWarnings`
- Portal amber card (replacing green confirmation card when warnings exist) is also a Plan 02 deliverable
- No blockers

---
*Phase: 30-per-document-type-upload-validation*
*Completed: 2026-03-03*
