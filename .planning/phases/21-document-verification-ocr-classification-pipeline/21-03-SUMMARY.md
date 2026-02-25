---
phase: 21-document-verification-ocr-classification-pipeline
plan: 03
subsystem: api
tags: [ocr, pdf-parse, integrity, classification, documents, portal, postmark]

# Dependency graph
requires:
  - phase: 21-01
    provides: "Phase 21 schema columns (extracted_tax_year, extracted_employer, extracted_paye_ref, extraction_source, file_hash, file_size_bytes, page_count) on client_documents"
  - phase: 21-02
    provides: "runIntegrityChecks(), classifyDocument() with optional buffer param, extractPdfText(), extractFieldsForType()"
provides:
  - "Portal upload route with full Phase 21 wiring: integrity checks, duplicate rejection (409), corrupt PDF rejection (400), OCR classification, 7 new columns in INSERT"
  - "Postmark inbound route with OCR classification via buffer, corrupt PDF skip with continue, 7 new columns in INSERT"
affects: [22-document-verification-portal-feedback-dashboard-summary]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Integrity-before-storage: runIntegrityChecks runs before uploadDocument — early exit avoids writing corrupt/duplicate/oversized files to Storage"
    - "Corrupt-PDF-skip in fire-and-forget: isCorruptPdf check inside per-attachment try block uses continue, not throw — Postmark 200 response never broken"
    - "No runIntegrityChecks in inbound handler: inbound path is fire-and-forget with no user-facing rejection; integrity is portal-only"

key-files:
  created: []
  modified:
    - "app/api/portal/[token]/upload/route.ts"
    - "app/api/postmark/inbound/route.ts"

key-decisions:
  - "[D-21-03-01] runIntegrityChecks not called in inbound handler — inbound is fire-and-forget with no rejection path; portal is the only user-facing path where duplicate/size/page-count enforcement makes sense"
  - "[D-21-03-02] page_count is null for inbound attachments — integrity.ts page count is only populated via runIntegrityChecks (portal path); inbound skips integrity checks by design"
  - "[D-21-03-03] sha256Hash computed inline in inbound handler via crypto.createHash — avoids importing integrity.ts which would pull in runIntegrityChecks and imply enforcement"

patterns-established:
  - "Phase 21 column population: both upload paths now populate all 7 Phase 21 fields on every client_documents INSERT"
  - "Corrupt PDF guard: isCorruptPdf check placed after classifyDocument, before uploadDocument, in both handlers"

requirements-completed: []

# Metrics
duration: 14min
completed: 2026-02-25
---

# Phase 21 Plan 03: Upload Handler Wiring Summary

**Portal upload route gains integrity checks, duplicate rejection (409), and corrupt-PDF rejection (400); both upload paths now pass fileBuffer to classifyDocument and populate all 7 Phase 21 schema columns on every client_documents INSERT.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-02-25T21:17:37Z
- **Completed:** 2026-02-25T21:31:54Z
- **Tasks:** 2
- **Files modified:** 5 (2 plan files + 3 pre-existing TS fixes)

## Accomplishments
- Portal upload route now runs runIntegrityChecks before any storage write — size (>20MB), duplicate (409), and page count (>50) all enforced with early return
- Both upload paths pass fileBuffer to classifyDocument, enabling OCR field extraction (tax year, employer, PAYE ref) for P60/P45/SA302/P11D uploads
- Corrupt/password-protected PDFs: portal returns HTTP 400 with user-friendly message; inbound skips attachment with console.warn + continue (no storage write, 200 preserved)
- All 7 Phase 21 columns (extracted_tax_year, extracted_employer, extracted_paye_ref, extraction_source, file_hash, file_size_bytes, page_count) populated in both INSERT statements

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire OCR + integrity into the portal upload route** - `6aae718` (feat)
2. **Task 2: Wire OCR into the Postmark inbound attachment processor** - `806d717` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified
- `app/api/portal/[token]/upload/route.ts` - Added runIntegrityChecks, integrity/duplicate check before storage, classifyDocument with buffer, isCorruptPdf early return, 7 Phase 21 INSERT fields
- `app/api/postmark/inbound/route.ts` - Added crypto import, classifyDocument with buffer in processAttachments, isCorruptPdf continue, sha256Hash computation, 7 Phase 21 INSERT fields
- `app/(dashboard)/settings/components/settings-tabs.tsx` - Pre-existing TS fix: null coalesce on PostmarkSettingsCard props (Rule 3)
- `app/api/filing-types/route.ts` - Pre-existing TS fix: unknown cast on PostgREST FK join (Rule 3)
- `app/portal/[token]/components/checklist-item.tsx` - Pre-existing TS fix: removed condition_description (column does not exist in Phase 18 schema, per locked decision)

## Decisions Made
- `runIntegrityChecks` deliberately not called in inbound handler — inbound is fire-and-forget; the portal is the only path where duplicate/size/page-count enforcement can be surfaced to a user
- `page_count` is `null` for inbound attachments — it is only computed in `runIntegrityChecks` which is portal-only by design
- SHA-256 hash computed inline in the inbound handler via `crypto.createHash` rather than importing integrity.ts — avoids false implication that full integrity enforcement runs on inbound

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed pre-existing TypeScript error in settings-tabs.tsx**
- **Found during:** Task 1 build verification (npm run build)
- **Issue:** `PostmarkSettingsCard` expects `defaultToken: string` but `postmarkSettings.token` is `string | null`
- **Fix:** Added null coalesce `?? ''` on both `defaultToken` and `defaultSenderDomain` props
- **Files modified:** `app/(dashboard)/settings/components/settings-tabs.tsx`
- **Verification:** Build passed after fix
- **Committed in:** `6aae718` (Task 1 commit)

**2. [Rule 3 - Blocking] Fixed pre-existing TypeScript error in filing-types route**
- **Found during:** Task 1 build verification (second build attempt after fix 1)
- **Issue:** PostgREST FK join for `document_types` inferred as array by Supabase SDK but cast as single object — Conversion type error
- **Fix:** Added `unknown` intermediate cast (`as unknown as { id: string; label: string } | null`) per MEMORY.md pattern D-19-03-02
- **Files modified:** `app/api/filing-types/route.ts`
- **Verification:** Build passed after fix
- **Committed in:** `6aae718` (Task 1 commit)

**3. [Rule 3 - Blocking] Fixed pre-existing TypeScript error in portal checklist-item component**
- **Found during:** Task 1 build verification (third build attempt after fixes 1 and 2)
- **Issue:** `item.condition_description` referenced but `condition_description` is not in `ChecklistItem` interface (column does not exist in Phase 18 schema — per locked decision from Phase 19)
- **Fix:** Removed the `condition_description` JSX block from the component
- **Files modified:** `app/portal/[token]/components/checklist-item.tsx`
- **Verification:** Build passed after fix; no visible UI regression (column was never populated)
- **Committed in:** `6aae718` (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 3 - Blocking: pre-existing TS errors preventing build verification)
**Impact on plan:** All fixes are pre-existing issues in unrelated files that blocked `npm run build` verification. None affect Phase 21 scope or introduce new behaviour.

## Issues Encountered
- Three stacked TypeScript build errors in pre-existing untracked files: each was discovered only after fixing the previous one (compiler stops at first error). All three fixes were trivial (null coalesce, unknown cast, removed dead reference). Build clean after all three applied.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 22 (Document Verification - Portal Feedback & Dashboard Summary) can now read all 7 Phase 21 fields from `client_documents` rows
- Every new document uploaded after Phase 21 deployment will have `extraction_source`, `file_hash`, `file_size_bytes` populated; HMRC document types (P60/P45/SA302/P11D) will also have `extracted_tax_year`, `extracted_employer`, `extracted_paye_ref`
- Historical rows (pre-Phase 21) will have NULLs — Phase 22 display must handle NULL gracefully (already a locked decision from 21-01)

---
*Phase: 21-document-verification-ocr-classification-pipeline*
*Completed: 2026-02-25*
