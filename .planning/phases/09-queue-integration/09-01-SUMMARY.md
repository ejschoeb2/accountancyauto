---
phase: 09-queue-integration
plan: 01
subsystem: automation
tags: [tiptap, supabase, cron, email, rendering]

# Dependency graph
requires:
  - phase: 04-data-migration
    provides: schedules, schedule_steps, email_templates normalized tables
  - phase: 05-rich-text-editor
    provides: TipTap PlaceholderNode and email template body_json format
  - phase: 06-email-rendering
    provides: renderTipTapEmail() function for v1.1 HTML rendering
  - phase: 07-schedule-management
    provides: Active schedules and steps configured via UI
provides:
  - v1.1 queue builder reading from normalized tables (schedules, schedule_steps, email_templates)
  - v1.1 scheduler using renderTipTapEmail() to render rich HTML content
  - v1.1 send-emails cron using sendRichEmail() for delivery
  - html_body column on reminder_queue for storing rendered HTML
  - Graceful error handling: missing schedules/templates logged to email_log and skipped
affects: [09-02-cleanup, ad-hoc-sending, future-reminder-customization]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PostgREST FK workaround: fetch reference tables separately, build lookup maps in app code"
    - "Queue builder logs warnings to email_log for missing schedules/templates"
    - "Scheduler wraps renderTipTapEmail in try/catch, logs render failures to email_log"
    - "Send-emails cron keeps Postmark failures as 'pending' for retry (no missed emails)"

key-files:
  created:
    - supabase/migrations/20260208100001_add_html_body_to_reminder_queue.sql
  modified:
    - lib/types/database.ts
    - lib/reminders/queue-builder.ts
    - lib/reminders/scheduler.ts
    - app/api/cron/send-emails/route.ts

key-decisions:
  - "Remove ALL per-client override processing from queue builder (per user decision from Phase 7 - no overrides in v1.1)"
  - "Use step.step_number for step_index in reminder_queue (not array index)"
  - "Set template_id to schedule.id (points to schedule, not old reminder_templates)"
  - "Postmark failures marked as 'pending' for retry (not 'failed') - ensures no missed emails"
  - "Missing templates/schedules logged to email_log with 'failed' status for visibility"

patterns-established:
  - "logQueueWarning() helper for logging queue builder issues to email_log"
  - "Rendering failures caught and logged, continue processing remaining reminders"
  - "Application-level FK resolution: fetch tables separately, build Maps for joins"

# Metrics
duration: 5min
completed: 2026-02-08
---

# Phase 09 Plan 01: Queue Integration Summary

**Automated reminder cron system rewired to read from v1.1 normalized tables (schedules, schedule_steps, email_templates) and render rich HTML emails via TipTap pipeline**

## Performance

- **Duration:** 5 min 16 sec
- **Started:** 2026-02-08T14:16:13Z
- **Completed:** 2026-02-08T14:21:28Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Queue builder reads from schedules, schedule_steps, email_templates (v1.1 normalized tables)
- Scheduler renders emails using renderTipTapEmail() and stores html_body in reminder_queue
- Send-emails cron sends rich HTML via sendRichEmail() with Postmark failure retry
- All v1.0 references removed: no reminder_templates, no ClientTemplateOverride, no resolveTemplateForClient, no lib/templates/inheritance
- Graceful error handling: missing schedules/templates logged to email_log and skipped without disrupting queue

## Task Commits

Each task was committed atomically:

1. **Task 1: Add html_body column and rewrite queue builder** - `829627a` (feat)
2. **Task 2: Rewrite scheduler and send-emails cron for v1.1 rendering** - `3386d51` (feat)

## Files Created/Modified
- `supabase/migrations/20260208100001_add_html_body_to_reminder_queue.sql` - Adds html_body TEXT column to reminder_queue for v1.1 rich HTML content
- `lib/types/database.ts` - Added html_body field to ReminderQueueItem interface
- `lib/reminders/queue-builder.ts` - Complete rewrite to read from schedules/schedule_steps/email_templates, removed all v1.0 references, added logQueueWarning() helper
- `lib/reminders/scheduler.ts` - Rewritten Step 6 to use renderTipTapEmail() instead of substituteVariables, fetches from v1.1 tables, wraps rendering in try/catch
- `app/api/cron/send-emails/route.ts` - Uses sendRichEmail() instead of sendReminderEmail(), checks for html_body, marks Postmark failures as 'pending' for retry

## Decisions Made

1. **Remove ALL per-client override processing** - Per user decision from Phase 7, v1.1 has no client-specific template or schedule overrides. Only deadline overrides remain (separate concern).

2. **Use step.step_number for step_index** - Instead of array index (v1.0 pattern), use the explicit step_number field from schedule_steps table.

3. **Set template_id to schedule.id** - In reminder_queue, template_id now points to the schedule (not the old reminder_templates table).

4. **Postmark failures kept as 'pending'** - Per user decision: no missed emails. Failed sends are retried on next cron run (every 10 minutes) instead of marking as 'failed'.

5. **Missing schedules/templates logged to email_log** - Warnings inserted with delivery_status: 'failed' and bounce_description: '[QUEUE] message' for visibility in delivery log.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - TypeScript compilation passed, all verification checks passed, no blocking issues during implementation.

## Next Phase Readiness

**Ready for Phase 09-02 (Cleanup):**
- v1.1 queue builder, scheduler, and send-emails cron are fully operational
- All v1.0 code references removed from lib/reminders/ directory
- html_body column exists and is populated by scheduler
- Send-emails cron uses html_body for rich HTML delivery
- Missing templates/schedules handled gracefully with logging

**Blocker for 09-02:**
- None - old v1.0 reminder_templates table can now be safely dropped
- Old v1.0 client_template_overrides table can be dropped (overrides removed from v1.1 scope)
- Old lib/templates/inheritance.ts can be deleted (no longer imported)

**Known risks:**
- Until 09-02 completes, both v1.0 and v1.1 code exists in codebase (some files still reference old tables)
- Existing reminder_queue entries with NULL html_body will be skipped by send-emails cron (expected - only v1.1 reminders have html_body)

## Self-Check: PASSED

All created files exist:
- supabase/migrations/20260208100001_add_html_body_to_reminder_queue.sql
- lib/types/database.ts (modified)
- lib/reminders/queue-builder.ts (modified)
- lib/reminders/scheduler.ts (modified)
- app/api/cron/send-emails/route.ts (modified)

All commits exist:
- 829627a (Task 1)
- 3386d51 (Task 2)

---
*Phase: 09-queue-integration*
*Completed: 2026-02-08*
