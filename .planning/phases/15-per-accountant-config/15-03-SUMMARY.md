---
phase: 15-per-accountant-config
plan: 03
subsystem: reminders-cron
tags: [cron, reminders, scheduler, queue-builder, per-user, owner-scoping]

# Dependency graph
requires:
  - phase: 15-01
    provides: "owner_id on email_templates, schedules, schedule_steps, schedule_client_exclusions; user_id on app_settings"
  - phase: 15-02
    provides: "user-aware settings CRUD, member settings card, per-user send hour and sender name storage"
provides:
  - "processRemindersForUser function with full per-user resource scoping"
  - "Per-user inner loop in cron entry point (user_organisations iteration)"
  - "buildReminderQueue and buildCustomScheduleQueue with optional ownerId parameter"
  - "Owner-scoped queue building: schedules, steps, templates, clients, exclusions all filtered by owner_id"
  - "Per-user send hour with org-level fallback pattern in scheduler"
  - "Per-user accountant_name resolved from email_sender_name with org fallback"
affects:
  - 15-04 (send-emails cron — reads per-user sender settings from reminder_queue)
  - 15-05 (new user seeding — user needs schedules/templates for queue to build correctly)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-user per-org lock key: cron_reminders_{org_id}_{userId} prevents parallel processing of same user"
    - "Dual-query fallback for app_settings: user row (.eq user_id) then org default (.is user_id null)"
    - "PostgREST nested filter: clients.owner_id = userId on reminder_queue join to scope by client ownership"
    - "Optional ownerId parameter pattern: pass for cron context, omit for server action context (RLS handles)"

key-files:
  created: []
  modified:
    - app/api/cron/reminders/route.ts
    - lib/reminders/scheduler.ts
    - lib/reminders/queue-builder.ts

key-decisions:
  - "[D-15-03-01] Per-user per-org lock key — prevents two cron invocations processing the same user in the same org simultaneously; org-level lock would block all members while one is processing"
  - "[D-15-03-02] processReminders kept as deprecated wrapper — backwards compatibility; calls processRemindersForUser for each org member; new cron entry point calls processRemindersForUser directly"
  - "[D-15-03-03] ownerId optional not required in queue-builder — preserves backwards compatibility for rebuildQueueForClient from server actions where RLS already handles scoping"
  - "[D-15-03-04] accountant_name resolved from user email_sender_name setting — replaces hardcoded 'PhaseTwo'; dual-query fallback (user row first, then org default)"
  - "[D-15-03-05] orgSkippedWrongHour starts true and becomes false when any member processes — correct semantics: org is 'skipped' only if ALL members skipped the wrong hour"

requirements-completed: []

# Metrics
duration: 15min
completed: 2026-02-22
---

# Phase 15 Plan 03: Cron Pipeline Per-User Refactor Summary

**Per-user inner loop added to reminders cron: cron now iterates org members independently, each using their own schedules, templates, send hour setting, and clients**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-02-22T01:45:52Z
- **Completed:** 2026-02-22T02:01:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Refactored `app/api/cron/reminders/route.ts` to fetch `user_organisations` inside the org loop and process each member via `processRemindersForUser`
- Renamed `processReminders` to `processRemindersForUser` with a `userId: string` parameter; kept deprecated `processReminders` wrapper for backwards compatibility
- Changed lock key from `cron_reminders_{org_id}` to `cron_reminders_{org_id}_{userId}` for per-user per-org locking
- Replaced org-level send hour read with user-specific + org-default fallback pattern (two-query approach against `app_settings`)
- Custom schedule hour check scoped to `owner_id = userId` so only this user's schedules are checked
- Due reminders fetched with `clients.owner_id = userId` filter — no cross-user leakage possible
- All template rendering queries (schedule, steps, email_template) now include `eq('owner_id', userId)` — each user's reminders rendered with their own templates
- Rollover past deadline query also scoped to `clients.owner_id = userId`
- `accountant_name` for template context resolved from user's `email_sender_name` setting (with org fallback) — replaces hardcoded `'PhaseTwo'`
- Added `buildReminderQueue(..., ownerId?)` and `buildCustomScheduleQueue(..., ownerId?)` signatures — all five resource queries (assignments via client join, schedules, steps, templates, exclusions) filtered by `owner_id` when provided
- Custom schedules now fire only for the schedule owner's clients (per-accountant correctness)

## Task Commits

Each task was committed atomically:

1. **Task 1: Per-user inner loop in cron entry point and scheduler** - `39e4068` (feat)
2. **Task 2: owner_id scoping in queue-builder functions** - `b9a6a2b` (feat)

## Files Created/Modified

- `app/api/cron/reminders/route.ts` - Updated cron entry point with per-user member loop, `users_processed` field, calls `processRemindersForUser` per member
- `lib/reminders/scheduler.ts` - New `processRemindersForUser(supabase, org, userId)` function; per-user lock, dual-query send hour, owner-scoped reminders and template rendering; deprecated `processReminders` wrapper retained
- `lib/reminders/queue-builder.ts` - `buildReminderQueue` and `buildCustomScheduleQueue` both accept optional `ownerId`; when provided, all resource queries scoped by owner_id; backwards compatible when omitted

## Decisions Made

- Per-user per-org lock key prevents one user's slow processing from blocking other users in the same org
- `processReminders` deprecated wrapper retained so any existing direct callers are not broken
- `ownerId` is optional (not required) in queue-builder to preserve backwards compatibility with `rebuildQueueForClient` which is called from server actions where RLS handles the scoping automatically
- `accountant_name` now dynamic from user's `email_sender_name` setting, eliminating the hardcoded 'PhaseTwo' placeholder

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

All modified files verified:
- `app/api/cron/reminders/route.ts` — FOUND, contains `processRemindersForUser` import and member loop
- `lib/reminders/scheduler.ts` — FOUND, contains `processRemindersForUser` export and `userId` parameter
- `lib/reminders/queue-builder.ts` — FOUND, contains `ownerId?` parameters on both export functions
- Commit `39e4068` — FOUND
- Commit `b9a6a2b` — FOUND
- TypeScript compilation: PASSED (zero errors)

## Next Phase Readiness

- Cron pipeline now processes each accountant's clients with their own templates and schedules
- Ready for Phase 15-04: send-emails cron per-user sender settings (needs owner_id on reminder_queue rows — already being tracked by 15-04)
- Ready for Phase 15-05: new user seeding (users now need their own schedules/templates to get queue entries)

---
*Phase: 15-per-accountant-config*
*Completed: 2026-02-22*
