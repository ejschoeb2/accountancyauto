---
phase: 08-ad-hoc-sending
plan: 01
subsystem: email
tags: [postmark, tiptap, email-sending, server-actions]

# Dependency graph
requires:
  - phase: 06-template-rendering
    provides: renderTipTapEmail() for converting TipTap JSON to email HTML
  - phase: 06-template-rendering
    provides: sendRichEmail() for Postmark email sending
provides:
  - Ad-hoc email sending via sendAdhocEmail() server action
  - send_type column on email_log table to distinguish scheduled vs ad-hoc sends
  - Delivery log UI showing ad-hoc badge for ad-hoc sends
affects: [09-queue-generation]

# Tech tracking
tech-stack:
  added: []
  patterns: [send_type discriminator column for email log types]

key-files:
  created:
    - supabase/migrations/20260208141423_add_email_log_send_type.sql
    - app/actions/send-adhoc-email.ts
  modified:
    - app/actions/audit-log.ts
    - app/(dashboard)/delivery-log/components/delivery-log-table.tsx

key-decisions:
  - "send_type column uses DEFAULT 'scheduled' for backwards compatibility with existing rows"
  - "Ad-hoc sends use placeholder defaults (filing_type='Ad-hoc', deadline=now) since no real filing context"
  - "Ad-hoc sends logged with reminder_queue_id=null and filing_type_id=null to indicate manual send"
  - "Delivery log shows ad-hoc badge with accent styling, scheduled as plain text"

patterns-established:
  - "send_type discriminator pattern for email_log (extensible for future send types)"
  - "Server action error handling: catch all errors, return {success, error} instead of throwing"

# Metrics
duration: 2min
completed: 2026-02-08
---

# Phase 08 Plan 01: Ad-Hoc Sending Summary

**Ad-hoc email sending with template rendering, Postmark delivery, and delivery log badge display**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-08T14:14:19Z
- **Completed:** 2026-02-08T14:15:58Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added send_type column to email_log with 'scheduled' | 'ad-hoc' values
- Created sendAdhocEmail server action to render templates and send via Postmark
- Updated delivery log table to display ad-hoc badge for ad-hoc sends
- Preserved backwards compatibility with DEFAULT 'scheduled' for existing rows

## Task Commits

Each task was committed atomically:

1. **Task 1: Add send_type column and sendAdhocEmail server action** - `3d53136` (feat)
2. **Task 2: Display ad-hoc badge in delivery log** - `67a8c7f` (feat)

## Files Created/Modified
- `supabase/migrations/20260208141423_add_email_log_send_type.sql` - Adds send_type column with CHECK constraint
- `app/actions/send-adhoc-email.ts` - Server action to render template, send via Postmark, log to email_log
- `app/actions/audit-log.ts` - Added send_type to AuditEntry interface and query
- `app/(dashboard)/delivery-log/components/delivery-log-table.tsx` - Added Type column with ad-hoc/scheduled display

## Decisions Made

**1. send_type DEFAULT strategy**
Used DEFAULT 'scheduled' to make migration non-breaking. All existing rows automatically get 'scheduled' value without requiring data backfill.

**2. Placeholder context for ad-hoc sends**
Ad-hoc sends don't have a filing type or deadline, so used defaults (filing_type='Ad-hoc', deadline=now). This allows template variables to resolve without errors.

**3. NULL foreign keys for ad-hoc sends**
Set reminder_queue_id=null and filing_type_id=null to indicate manual send. This distinguishes ad-hoc from scheduled queue-driven sends.

**4. Badge styling for ad-hoc**
Used accent color badge with outline variant for ad-hoc sends to make them visually distinct. Scheduled sends show as plain text in muted-foreground.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all existing infrastructure (renderTipTapEmail, sendRichEmail, email_log table) worked as expected.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for Phase 8 Plan 2 (UI for ad-hoc sending).

Infrastructure complete:
- Migration applied (send_type column)
- Server action ready for UI consumption
- Delivery log updated to display ad-hoc sends

Blockers: None

## Self-Check: PASSED

All files created and commits verified:
- ✓ supabase/migrations/20260208141423_add_email_log_send_type.sql
- ✓ app/actions/send-adhoc-email.ts
- ✓ 3d53136 (Task 1 commit)
- ✓ 67a8c7f (Task 2 commit)

---
*Phase: 08-ad-hoc-sending*
*Completed: 2026-02-08*
