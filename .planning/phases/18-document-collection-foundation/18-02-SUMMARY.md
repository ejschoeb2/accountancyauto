---
phase: 18-document-collection-foundation
plan: 02
subsystem: infra
tags: [supabase-storage, date-fns, tdd, vitest, retention, hmrc, documents]

# Dependency graph
requires:
  - phase: 18-01
    provides: database schema (client_documents, upload_portal_tokens) with filing_type_id and tax_period_end_date columns
provides:
  - lib/documents/storage.ts — uploadDocument, getSignedDownloadUrl, deleteDocument using admin client
  - lib/documents/metadata.ts — calculateRetainUntil with correct SA100 and company retention logic
  - lib/documents/metadata.test.ts — 6 vitest tests verifying all retention rules
  - ENV_VARIABLES.md SUPABASE_STORAGE_BUCKET_DOCUMENTS section
affects:
  - 18-03 (storage RLS migration needs BUCKET_NAME constant from storage.ts)
  - 19 (all Phase 19 collection mechanisms call these storage utilities directly)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Admin client for storage operations: use createAdminClient() for all server-side storage uploads and deletes — bypasses RLS correctly without the createSignedUploadUrl owner=null bug"
    - "300-second signed URL cap: getSignedDownloadUrl hardcodes 300s expiry — never parameterise or increase"
    - "Retention anchor: calculateRetainUntil takes taxPeriodEndDate (not received_at) — HMRC compliance"
    - "SA100 Jan 31 derivation: getFullYear()+1, month index 0 (January) — avoids off-by-one"

key-files:
  created:
    - lib/documents/storage.ts
    - lib/documents/metadata.ts
    - lib/documents/metadata.test.ts
  modified:
    - ENV_VARIABLES.md

key-decisions:
  - "[D-18-02-01] vitest used instead of jest — project test runner is vitest (not jest as plan specified); auto-fixed via Rule 3"
  - "[D-18-02-02] BUCKET_NAME as module-level constant reading SUPABASE_STORAGE_BUCKET_DOCUMENTS env var with 'prompt-documents' fallback — single source of truth for bucket name in storage module"
  - "[D-18-02-03] createSignedUploadUrl explicitly NOT used — comment documents the bug; only createSignedUrl (downloads) is safe with admin client"

patterns-established:
  - "lib/documents/ module: storage.ts for I/O, metadata.ts for business logic — separation of concerns"
  - "TDD RED commit before GREEN commit: test(18-02) → feat(18-02)"

requirements-completed: [DOCS-05]

# Metrics
duration: 12min
completed: 2026-02-23
---

# Phase 18 Plan 02: Storage Utilities and Retention Calculator Summary

**HMRC-compliant calculateRetainUntil (SA100: Jan 31+5yr, company: period end+6yr) and admin-client storage utilities (upload, signed download URL at 300s max, delete) via TDD with vitest**

## Performance

- **Duration:** 12 min
- **Started:** 2026-02-23T14:06:17Z
- **Completed:** 2026-02-23T14:08:33Z
- **Tasks:** 2 (Task 1 has 2 commits: RED + GREEN)
- **Files modified:** 4

## Accomplishments

- TDD-driven calculateRetainUntil: 6 tests written first (RED), implementation added (GREEN), all 6 pass including the critical SA100 2025-04-05 → 2031-01-31 edge case
- Storage utilities encapsulate the admin client upload pattern and the 300-second signed URL cap — Phase 19 collection code calls these directly without re-implementing the constraints
- ENV_VARIABLES.md updated with full SUPABASE_STORAGE_BUCKET_DOCUMENTS documentation including Dashboard setup steps

## Task Commits

Each task was committed atomically (TDD tasks have two commits):

1. **Task 1 RED: calculateRetainUntil failing tests** - `a77123c` (test)
2. **Task 1 GREEN: calculateRetainUntil implementation** - `123234c` (feat)
3. **Task 2: Storage utilities + ENV_VARIABLES.md** - `7bdeb13` (feat)

**Plan metadata:** (see final commit below)

_Note: Task 1 is TDD — test commit (RED) and implementation commit (GREEN) are separate._

## Files Created/Modified

- `lib/documents/metadata.test.ts` — 6 vitest tests for calculateRetainUntil covering SA100 and all company filing types
- `lib/documents/metadata.ts` — calculateRetainUntil using date-fns addYears; SA100 derives Jan 31 deadline as getFullYear()+1/month 0
- `lib/documents/storage.ts` — uploadDocument (admin client, UUID path), getSignedDownloadUrl (300s expiry), deleteDocument (remove array)
- `ENV_VARIABLES.md` — SUPABASE_STORAGE_BUCKET_DOCUMENTS section added with setup guide and multi-tenant notes

## Decisions Made

- [D-18-02-01] vitest used instead of `npx jest` (plan specified jest, project uses vitest) — auto-fixed Rule 3
- [D-18-02-02] BUCKET_NAME as module-level const with env var fallback — single source of truth; bucket name change requires only env var update
- [D-18-02-03] createSignedUploadUrl explicitly NOT called — documented in comments to warn future developers of the storage-js #186 bug

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Used vitest instead of jest**
- **Found during:** Task 1 (RED phase setup)
- **Issue:** Plan specified `npx jest lib/documents/metadata.test.ts --no-coverage` but the project uses vitest (not jest) — `package.json` has `"test": "vitest run"` and existing test files import from 'vitest'
- **Fix:** Used `npx vitest run lib/documents/metadata.test.ts` for all test runs; test file imports from 'vitest' matching project convention
- **Files modified:** lib/documents/metadata.test.ts (imports from 'vitest' not 'jest')
- **Verification:** 6/6 tests pass with vitest
- **Committed in:** a77123c (Task 1 RED commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — wrong test runner)
**Impact on plan:** Auto-fix was necessary for tests to run at all. No scope creep.

## Issues Encountered

None beyond the vitest/jest runner deviation noted above.

## User Setup Required

**Storage bucket must be created manually before Phase 19 testing begins:**

1. Open Supabase Dashboard → Storage → New bucket
2. Name: `prompt-documents`
3. Access: **Private** (NOT Public)
4. Confirm region matches your project (EU West recommended for UK data residency)
5. Add `SUPABASE_STORAGE_BUCKET_DOCUMENTS=prompt-documents` to `.env.local` (optional — falls back automatically)

See `ENV_VARIABLES.md` for full setup guide.

## Next Phase Readiness

- calculateRetainUntil ready for direct import by Phase 19 collection code
- uploadDocument, getSignedDownloadUrl, deleteDocument ready for Phase 19 portal and email attachment handlers
- Storage RLS policies (Phase 18-03 or 18-04) must be written and tested before Phase 19 begins — otherwise authenticated SDK calls will receive 403

---
*Phase: 18-document-collection-foundation*
*Completed: 2026-02-23*
