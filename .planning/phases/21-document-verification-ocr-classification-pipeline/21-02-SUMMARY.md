---
phase: 21-document-verification-ocr-classification-pipeline
plan: 02
subsystem: api
tags: [pdf-parse, ocr, regex, vitest, tdd, classification, documents]

# Dependency graph
requires:
  - phase: 21-01
    provides: "7 nullable OCR/integrity columns on client_documents (extracted_tax_year, extracted_employer, extracted_paye_ref, extraction_source, is_corrupt_pdf, is_image_only, file_hash)"
  - phase: 19-01
    provides: "classifyDocument() keyword-based classifier in lib/documents/classify.ts"
provides:
  - "lib/documents/ocr.ts: extractPdfText() (pdf-parse + image-only detection) and extractFieldsForType() (regex field extraction for P60, P45, SA302, P11D)"
  - "lib/documents/integrity.ts: runIntegrityChecks() with file size, SHA-256 duplicate hash, and page count checks"
  - "lib/documents/classify.ts: extended ClassificationResult interface (7 Phase 21 fields) + optional buffer param for OCR path"
  - "lib/documents/classify.test.ts: 14 tests covering OCR path, image-only, corrupt PDF, keyword fallback, unclassified"
  - "types/pdf-parse-debugging-disabled.d.ts: local type declarations for the pdf-parse fork"
affects:
  - "21-03 — upload handler wiring; calls classifyDocument with buffer and runIntegrityChecks"
  - "22 — reads extracted_tax_year, extracted_employer, extraction_source for portal feedback UI"

# Tech tracking
tech-stack:
  added:
    - "pdf-parse-debugging-disabled (npm) — fork of pdf-parse that suppresses debug output in test environments"
    - "@types/pdf-parse (npm, dev) — installed but superseded by local types/pdf-parse-debugging-disabled.d.ts"
  patterns:
    - "TDD Red-Green-Refactor: failing test commit → implementation commit → cleanup commit"
    - "Optional buffer parameter for backward-compatible API extension"
    - "Lazy employer regex: lazy quantifier + lookahead for known HMRC field labels stops over-capture"
    - "HMRC_OCR_TYPES Set for O(1) code lookup before OCR branch"

key-files:
  created:
    - "lib/documents/ocr.ts"
    - "lib/documents/integrity.ts"
    - "lib/documents/classify.test.ts"
    - "types/pdf-parse-debugging-disabled.d.ts"
  modified:
    - "lib/documents/classify.ts"
    - "package.json"
    - "package-lock.json"

key-decisions:
  - "[D-21-02-01] Employer regex uses lazy quantifier + lookahead for PAYE/NI/National/Works labels — greedy pattern over-captures into following fields; lazy + lookahead is the correct approach for single-line normalised text"
  - "[D-21-02-02] Local d.ts in types/ for pdf-parse-debugging-disabled — @types/pdf-parse covers the original package, not the fork; local declaration is lightweight and correct"
  - "[D-21-02-03] KEYWORD_DEFAULTS const with satisfies — ensures all Phase 21 fields are populated for non-OCR paths without repeating field names at each return site"
  - "[D-21-02-04] integrity.ts catches pdf-parse throw during page count check and continues — corrupt PDF rejection happens in classifyDocument, not integrity; double-rejection would confuse callers"

patterns-established:
  - "Optional buffer for backward-compat API extension: add buffer?: Buffer as last param; all existing call sites without buffer continue to work"
  - "HMRC_OCR_TYPES = new Set([...]) for O(1) code-in-set check in classifyDocument OCR branch"

requirements-completed: []

# Metrics
duration: 15min
completed: 2026-02-25
---

# Phase 21 Plan 02: OCR Extraction + Integrity Utilities + Extended Classifier Summary

**pdf-parse + regex field extraction for P60/P45/SA302/P11D, file integrity checker (size/hash/pages), and backward-compatible extended classifyDocument() with optional buffer OCR path — all passing via TDD**

## Performance

- **Duration:** 15 min
- **Started:** 2026-02-25T21:00:00Z
- **Completed:** 2026-02-25T21:14:10Z
- **Tasks:** 3 (RED, GREEN, REFACTOR)
- **Files modified:** 7

## Accomplishments

- Created `lib/documents/ocr.ts` with `extractPdfText()` (pdf-parse wrapper with image-only threshold detection) and `extractFieldsForType()` (regex extraction for P60/P45/SA302/P11D tax year, employer name, PAYE reference)
- Created `lib/documents/integrity.ts` with `runIntegrityChecks()` running file size (20 MB), SHA-256 duplicate hash, and page count (50 pages) checks in order
- Extended `lib/documents/classify.ts` with 6 new Phase 21 fields on `ClassificationResult` and an optional `buffer` parameter; existing callers without buffer continue to work unchanged
- 14 tests passing in `classify.test.ts` covering all execution paths: OCR with extracted year (high confidence), keyword-only backward compat, corrupt PDF (isCorruptPdf=true), image-only PDF, generic PDF fallback, unclassified non-PDF

## Task Commits

Each task was committed atomically:

1. **RED: Failing test suite** - `5ac4526` (test)
2. **GREEN: Implementation** - `c244724` (feat)
3. **REFACTOR: Cleanup type casts** - `47f94c4` (refactor)

_Note: TDD plan — 3 commits per Red-Green-Refactor cycle_

## Files Created/Modified

- `lib/documents/ocr.ts` - extractPdfText() + extractFieldsForType() for HMRC doc types
- `lib/documents/integrity.ts` - runIntegrityChecks() with size/hash/page rules
- `lib/documents/classify.ts` - Extended ClassificationResult interface + OCR path in classifyDocument()
- `lib/documents/classify.test.ts` - 14 test cases covering all paths via vitest mocking
- `types/pdf-parse-debugging-disabled.d.ts` - Local type declarations for pdf-parse fork
- `package.json` + `package-lock.json` - Added pdf-parse-debugging-disabled + @types/pdf-parse

## Decisions Made

- [D-21-02-01] Employer regex uses lazy quantifier + lookahead for PAYE/NI/National/Works labels. Greedy pattern `[A-Za-z0-9 &.,'-]{2,80}` over-captured into following HMRC field text; lazy `{2,60}?` + lookahead `\s+(?:PAYE|NI |National|Works|\d{3}\/)` is the correct approach for single-line normalised text.
- [D-21-02-02] Created `types/pdf-parse-debugging-disabled.d.ts` rather than relying on `@types/pdf-parse`. The types package covers the original `pdf-parse` module, not the fork's module name, so TypeScript raised TS7016 "could not find declaration file". A lightweight local declaration resolves this correctly.
- [D-21-02-03] `KEYWORD_DEFAULTS` const with `satisfies` ensures all 6 Phase 21 fields are populated for non-OCR return sites without repeating field names. Reduces error surface when adding future fields.
- [D-21-02-04] `integrity.ts` catches pdf-parse throws during page count check and sets `pageCount=null` rather than rejecting. Corrupt PDF rejection is the classifier's responsibility (isCorruptPdf=true); the integrity checker must not double-reject for this condition.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed greedy employer regex over-capturing into PAYE reference field**
- **Found during:** Task 2 (GREEN implementation)
- **Issue:** Employer name pattern `[A-Za-z0-9 &.,'-]{2,80}` was greedy, consuming "Acme Ltd PAYE reference 123" instead of stopping at "Acme Ltd". Tests for employer extraction failed.
- **Fix:** Switched to lazy quantifier `{2,60}?` with lookahead for known HMRC field labels that follow the employer name (`PAYE`, `NI`, `National`, `Works`, `\d{3}/`)
- **Files modified:** `lib/documents/ocr.ts`
- **Verification:** `extractFieldsForType('P60', text)` returns `employer='Acme Ltd'` exactly; all 14 tests pass
- **Committed in:** `c244724` (feat(21-02) commit, inline fix before task commit)

**2. [Rule 3 - Blocking] Created local type declarations for pdf-parse-debugging-disabled fork**
- **Found during:** Task 2 (GREEN — TypeScript check)
- **Issue:** `@types/pdf-parse` covers the `pdf-parse` module name, not `pdf-parse-debugging-disabled`. TypeScript raised TS7016 on both `ocr.ts` and `classify.test.ts`.
- **Fix:** Created `types/pdf-parse-debugging-disabled.d.ts` with `PDFData`, `PDFParseOptions`, `PDFInfo`, `PDFMetadata` interfaces and a typed `pdfParse()` export
- **Files modified:** `types/pdf-parse-debugging-disabled.d.ts` (created)
- **Verification:** `npx tsc --noEmit` shows no errors in `lib/documents/ocr.ts` or `lib/documents/classify.test.ts`
- **Committed in:** `c244724` (feat(21-02) commit)

---

**Total deviations:** 2 auto-fixed (1 regex bug, 1 blocking TypeScript issue)
**Impact on plan:** Both fixes necessary for correctness and compilation. No scope creep.

## Issues Encountered

- Pre-existing TypeScript errors in unrelated files (`settings-tabs.tsx`, `filing-types/route.ts`, `checklist-item.tsx`, `hero-section.tsx`) caused `npm run build` to fail. These are out-of-scope pre-existing issues documented in `deferred-items.md`.
- Pre-existing test failure in `variables.test.ts` (known tech debt #4 in STATE.md — test expects "Peninsula Accounting" but code returns "PhaseTwo" after branding rename).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `classifyDocument()` and `runIntegrityChecks()` are ready to wire into portal upload handler (`app/api/portal/[token]/upload/route.ts`) and Postmark inbound handler — that is Plan 03.
- Both functions accept the same supabase client pattern used throughout the codebase.
- `ClassificationResult` now includes `isCorruptPdf` which Plan 03 uses to return a client-facing rejection message.

## Self-Check

- `lib/documents/ocr.ts` exists: FOUND
- `lib/documents/integrity.ts` exists: FOUND
- `lib/documents/classify.ts` modified with ClassificationResult Phase 21 fields: FOUND
- `lib/documents/classify.test.ts` exists with 14 tests: FOUND
- All 14 classify tests pass: CONFIRMED (npm test output)
- Pre-existing 1 failure (variables.test.ts): unchanged from baseline

---
*Phase: 21-document-verification-ocr-classification-pipeline*
*Completed: 2026-02-25*
