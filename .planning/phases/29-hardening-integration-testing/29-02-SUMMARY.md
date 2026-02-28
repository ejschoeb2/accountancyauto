---
phase: 29-hardening-integration-testing
plan: 02
subsystem: api
tags: [postmark, inbound-email, idempotency, supabase, postgres, webhook]

# Dependency graph
requires:
  - phase: 29-01
    provides: hardening foundation research
  - phase: 25-google-drive-integration
    provides: processAttachments with resolveProvider routing
  - phase: 21-document-verification
    provides: SHA-256 file_hash on client_documents rows
provides:
  - Idempotency guard on inbound_emails: postmark_message_id unique constraint + 23505 early return
  - Idempotency guard on client_documents: maybeSingle check on (client_id, file_hash, source)
  - 25 MB attachment size guard with structured logging
  - Improved catch block logging with backend context
affects: [phase-29-03, postmark-inbound-handler, client-documents]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Postmark retry idempotency: UNIQUE(org_id, postmark_message_id) with 23505 early-return 200"
    - "Attachment dedup: maybeSingle on (client_id, file_hash, source) before upload"
    - "Size guard before idempotency check: skip oversized files with structured log"

key-files:
  created:
    - supabase/migrations/20260228200000_inbound_emails_idempotency.sql
  modified:
    - app/api/postmark/inbound/route.ts

key-decisions:
  - "NULLS DISTINCT (standard Postgres default) instead of NULLS NOT DISTINCT for unique constraint — existing rows all have NULL postmark_message_id; NULLS NOT DISTINCT would treat them as duplicates and fail constraint creation"
  - "Size guard placed before idempotency check — no point checking DB for a file that cannot be stored anyway"
  - "Idempotency guard keyed on (client_id, file_hash, source='inbound_email') — file_hash (SHA-256) is stable across retries; source scoping prevents cross-source false positives"

patterns-established:
  - "Postmark retry guard pattern: unique DB constraint + 23505 code check returning 200 with duplicate:true"

requirements-completed: [HRDN-02]

# Metrics
duration: 18min
completed: 2026-02-28
---

# Phase 29 Plan 02: Postmark Inbound Idempotency Summary

**Two-layer idempotency added to Postmark inbound webhook: UNIQUE(org_id, postmark_message_id) constraint prevents duplicate inbound_emails rows, and maybeSingle() attachment check on (client_id, file_hash, source) prevents duplicate client_documents rows on delivery retries**

## Performance

- **Duration:** 18 min
- **Started:** 2026-02-28T18:50:11Z
- **Completed:** 2026-02-28T19:08:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added `postmark_message_id TEXT` column to `inbound_emails` with UNIQUE(org_id, postmark_message_id) constraint — prevents second delivery from inserting duplicate row
- Handler returns 200 with `{ duplicate: true }` on 23505 constraint violation — Postmark won't retry, no duplicate processAttachments call
- Added 25 MB size guard in processAttachments — oversized attachments are logged and skipped cleanly
- Added pre-upload idempotency check in processAttachments keyed on (client_id, file_hash, source='inbound_email') — duplicate attachment on retry is skipped not re-stored
- Improved catch block logging to include `orgStorageBackend` for easier incident diagnosis

## Task Commits

Each task was committed atomically:

1. **Task 1: Add postmark_message_id column and unique constraint** - `d0b07e1` (chore)
2. **Task 2: Add two-layer idempotency guard to inbound handler** - `98825a0` (feat)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified

- `supabase/migrations/20260228200000_inbound_emails_idempotency.sql` — Adds postmark_message_id TEXT column and UNIQUE(org_id, postmark_message_id) constraint; applied to remote
- `app/api/postmark/inbound/route.ts` — Idempotency guard on insert (23505 early return), size guard (25 MB) and duplicate check (maybeSingle) in processAttachments, improved catch logging

## Decisions Made

- **NULLS DISTINCT over NULLS NOT DISTINCT:** Migration initially used `NULLS NOT DISTINCT` per plan spec, but this caused constraint creation to fail (existing rows all have NULL postmark_message_id — NULLS NOT DISTINCT treats same-org NULLs as duplicates). Standard `UNIQUE (org_id, postmark_message_id)` with implicit NULLS DISTINCT is correct: each NULL is treated as unique, so historical rows don't conflict, but new rows with the same non-null MessageID per org do.
- **Size guard before idempotency check:** Ordered size guard first in processAttachments loop — no DB round-trip needed if the file exceeds the limit anyway.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed NULLS NOT DISTINCT causing unique constraint creation failure**
- **Found during:** Task 1 (Add postmark_message_id column and unique constraint)
- **Issue:** `UNIQUE NULLS NOT DISTINCT (org_id, postmark_message_id)` failed with `ERROR: could not create unique index "uq_inbound_emails_org_message_id" (SQLSTATE 23505) — Key (org_id, postmark_message_id)=(ec357cb3..., null) is duplicated.` Multiple existing rows in `inbound_emails` share the same org_id with NULL postmark_message_id. NULLS NOT DISTINCT treats these as duplicates, preventing index creation.
- **Fix:** Switched to standard `UNIQUE (org_id, postmark_message_id)` (implicit NULLS DISTINCT). With NULLS DISTINCT, each NULL is treated as unique from every other NULL — existing historical rows do not conflict. Only rows where both org_id matches AND a non-NULL postmark_message_id matches will violate the constraint, which is the desired deduplication behavior.
- **Files modified:** `supabase/migrations/20260228200000_inbound_emails_idempotency.sql`
- **Verification:** `npx supabase db push --include-all` succeeded; `migration list` shows 20260228200000 applied on both sides
- **Committed in:** `d0b07e1` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Auto-fix necessary for correctness — existing data in production prevented the original constraint. The corrected constraint still provides full idempotency for all new rows with non-null MessageIDs. No scope creep.

## Issues Encountered

- Supabase migration history had an out-of-order entry (`20260210`) requiring `supabase migration repair --status reverted 20260210` before push — standard pattern per D-15-01-04 (required twice due to migration retry after fix).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- HRDN-02 complete: Postmark inbound handler is now idempotent against delivery retries
- Both idempotency layers active: inbound_emails (DB constraint) and client_documents (application-level hash check)
- Ready for Plan 29-03 (if any further hardening work)

---
*Phase: 29-hardening-integration-testing*
*Completed: 2026-02-28*
