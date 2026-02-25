---
phase: 22-document-verification-portal-feedback-dashboard-summary
plan: "01"
subsystem: documents
tags: [schema-migration, integrity, portal-upload, ocr]
dependency_graph:
  requires: [21-03]
  provides: [extraction_source_manual_constraint, skipDuplicate_bypass, portal_ocr_response_fields]
  affects: [app/api/portal/[token]/upload/route.ts, lib/documents/integrity.ts]
tech_stack:
  added: []
  patterns: [optional-param-backward-compat, skipDuplicate-guard, extended-json-response]
key_files:
  created:
    - supabase/migrations/20260225000002_add_manual_extraction_source.sql
  modified:
    - lib/documents/integrity.ts
    - app/api/portal/[token]/upload/route.ts
decisions:
  - "[D-22-01-01] Migration history repair applied (20260210, 20260225204150, 20260225204246) — reverted via supabase migration repair then pushed with --include-all; consistent with D-15-01-04 pattern"
  - "[D-22-01-02] skipDuplicate guard wraps entire duplicate hash check block — when skipDuplicate=true the DB query is skipped entirely, not just the rejection logic; avoids unnecessary network round-trip"
metrics:
  duration: "~10 min"
  completed: "2026-02-25"
  tasks: 2
  files: 3
---

# Phase 22 Plan 01: Foundation — Schema Migration & Upload Route Extension Summary

**One-liner:** Schema migration adds 'manual' to extraction_source CHECK constraint; upload route extended with skipDuplicate bypass and OCR fields in response.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Schema migration — add 'manual' to extraction_source CHECK | 8ad1977 | supabase/migrations/20260225000002_add_manual_extraction_source.sql |
| 2 | Extend integrity.ts with skipDuplicate option and extend upload route response | 1e4ce67 | lib/documents/integrity.ts, app/api/portal/[token]/upload/route.ts |

## Verification

1. `supabase/migrations/20260225000002_add_manual_extraction_source.sql` exists and contains DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT with 4 values including 'manual' — PASSED
2. Migration applied to remote via `supabase db push --include-all` — PASSED (migration history repaired first)
3. `lib/documents/integrity.ts` runIntegrityChecks has optional 5th parameter `options?: { skipDuplicate?: boolean }`; duplicate check wrapped in `if (!options?.skipDuplicate)` guard — PASSED
4. `app/api/portal/[token]/upload/route.ts` reads `confirmDuplicate` from formData, passes `{ skipDuplicate: confirmDuplicate }` to runIntegrityChecks, returns `extractedTaxYear`/`extractedEmployer`/`extractedPayeRef`/`isImageOnly` in success response — PASSED
5. `npm run build` passes with no TypeScript errors (only pre-existing workspace root warning) — PASSED

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Migration history out of sync**
- **Found during:** Task 1
- **Issue:** `supabase db push` reported remote migration versions not found in local directory (versions 20260210, 20260225204150, 20260225204246)
- **Fix:** Ran `npx supabase migration repair --status reverted <versions>` to repair history, then `npx supabase db push --include-all` to apply all pending migrations
- **Files modified:** None (infrastructure fix)
- **Commit:** n/a (resolved before Task 1 commit)

## Self-Check: PASSED

- migration file: FOUND
- integrity.ts: FOUND
- upload route.ts: FOUND
- SUMMARY.md: FOUND
- commit 8ad1977: FOUND
- commit 1e4ce67: FOUND
