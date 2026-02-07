---
phase: 02-reminder-engine
plan: 08
subsystem: automation
tags: [vercel-cron, reminder-queue, scheduling, background-jobs, supabase-admin, date-fns-tz, working-days]

# Dependency graph
requires:
  - phase: 02-01
    provides: Deadline calculators with rollover logic
  - phase: 02-02
    provides: Working day adjustment and bank holiday handling
  - phase: 02-03
    provides: Template inheritance and variable substitution
provides:
  - Daily cron job that processes reminder queue at 9am UK time
  - Queue builder that creates reminder entries from templates and deadlines
  - Pause/unpause and records-received handlers that sync queue with client status
  - Distributed lock to prevent concurrent cron runs
  - Automatic rollover when deadlines pass
affects: [03-email-delivery, reminder-system]

# Tech tracking
tech-stack:
  added: [date-fns-tz, vercel-cron]
  patterns: [queue-pattern, distributed-locking, background-jobs, idempotent-inserts]

key-files:
  created:
    - lib/reminders/queue-builder.ts
    - lib/reminders/scheduler.ts
    - app/api/cron/reminders/route.ts
    - app/api/reminders/rebuild-queue/route.ts
    - app/(dashboard)/clients/[id]/components/records-received.tsx
    - vercel.json
  modified:
    - app/api/clients/[id]/route.ts
    - app/(dashboard)/clients/[id]/page.tsx

key-decisions:
  - "Run cron at both 8 and 9 UTC, check inside for UK 9am to handle BST/GMT transitions"
  - "Use queue pattern: cron marks reminders as pending, email delivery processes separately"
  - "Distributed lock using locks table prevents concurrent cron runs"
  - "Idempotent queue builder checks for existing entries before inserting"
  - "Auto-cancel all remaining reminders when records received (no confirmation)"
  - "Unpause skips missed reminders, resumes from next due step"

patterns-established:
  - "Queue builder pattern: buildReminderQueue() creates entries, rebuildQueueForClient() handles updates"
  - "Status transitions: scheduled → pending → sent/cancelled"
  - "Admin client pattern: queue operations require service-role access"
  - "Working day adjustment: shift send dates off weekends/bank holidays"

# Metrics
duration: 12min
completed: 2026-02-07
---

# Phase 02 Plan 08: Cron Job and Reminder Queue Summary

**Daily 9am UK cron job with queue builder, pause/unpause handlers, and records-received auto-cancellation**

## Performance

- **Duration:** 12 min
- **Started:** 2026-02-07T08:30:11Z
- **Completed:** 2026-02-07T08:42:33Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Daily cron job processes reminder queue at exactly 9am UK time (handles BST/GMT)
- Queue builder creates reminder entries from templates, deadlines, and overrides
- Pause/unpause and records-received UI with automatic queue synchronization
- Distributed lock prevents concurrent cron runs
- Idempotent queue operations prevent duplicates

## Task Commits

Each task was committed atomically:

1. **Task 1: Reminder queue builder** - `7e4623e` (feat)
2. **Task 2: Cron job endpoint and scheduler** - `3286ad8` (feat)
3. **Task 3: Wire records-received and pause/unpause to queue** - `3b1fd70` (feat)

**Plan metadata:** (pending final commit)

## Files Created/Modified

**Created:**
- `lib/reminders/queue-builder.ts` - Builds reminder queue from templates and deadlines, handles pause/unpause and records-received
- `lib/reminders/scheduler.ts` - Cron job logic: acquires lock, checks UK time, marks due reminders as pending, resolves variables
- `app/api/cron/reminders/route.ts` - Vercel Cron endpoint with CRON_SECRET validation and 5-minute timeout
- `app/api/reminders/rebuild-queue/route.ts` - Manual queue rebuild endpoint for initial setup and debugging
- `app/(dashboard)/clients/[id]/components/records-received.tsx` - UI for marking records received and pausing/unpausing reminders
- `vercel.json` - Cron configuration: runs at both 8 and 9 UTC to ensure 9am UK time in GMT and BST

**Modified:**
- `app/api/clients/[id]/route.ts` - Extended PATCH handler to call queue operations when reminders_paused or records_received_for changes
- `app/(dashboard)/clients/[id]/page.tsx` - Added RecordsReceived component to client detail page

## Decisions Made

1. **BST/GMT handling:** Run cron at both 8 and 9 UTC, check inside function for UK 9am. This ensures correct timing regardless of daylight saving.

2. **Queue pattern:** Cron job marks reminders as 'pending' instead of sending directly. Email delivery system (Phase 3) will process pending reminders. Avoids Vercel 5-minute timeout.

3. **Auto-cancel on records received:** When user marks records as received, all remaining scheduled reminders for that filing type are cancelled immediately. No confirmation prompt (per user decision in research).

4. **Skip-ahead on unpause:** When unpausing a client, all missed reminders (send_date < today) are cancelled. Reminders resume from next due step (per user decision in research).

5. **Idempotent inserts:** Queue builder checks if reminder already exists (client + filing type + step + deadline) before inserting. Prevents duplicates on multiple rebuilds.

6. **Distributed lock:** Use existing `locks` table to prevent concurrent cron runs (if Vercel triggers multiple instances).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all systems integrated cleanly.

## User Setup Required

**Environment variable required for cron endpoint:**

Add to `.env.local`:
```
CRON_SECRET=your-random-secret-here
```

**Vercel deployment configuration:**

1. Set `CRON_SECRET` in Vercel project settings (Environment Variables)
2. Vercel automatically picks up `vercel.json` cron configuration on deployment
3. Cron job will run daily at 8am and 9am UTC (one will execute at 9am UK time)

**Initial queue population:**

After deployment, trigger initial queue build:
```bash
curl -X POST https://your-domain.vercel.app/api/reminders/rebuild-queue
```

## Next Phase Readiness

**Ready for Phase 3 (Email Delivery):**
- Reminder queue is populated and maintained
- Cron job marks due reminders as 'pending'
- Template variables are resolved in pending reminders
- Client status (paused, records received) synced with queue

**Phase 3 will build:**
- Email delivery system that processes 'pending' reminders
- Resend integration for actual email sending
- Rate limiting and batch processing
- Sent/failed status tracking

## Self-Check: PASSED

All created files verified:
- lib/reminders/queue-builder.ts ✓
- lib/reminders/scheduler.ts ✓
- app/api/cron/reminders/route.ts ✓
- app/api/reminders/rebuild-queue/route.ts ✓
- app/(dashboard)/clients/[id]/components/records-received.tsx ✓
- vercel.json ✓

All task commits verified:
- 7e4623e (Task 1) ✓
- 3286ad8 (Task 2) ✓
- 3b1fd70 (Task 3) ✓

---
*Phase: 02-reminder-engine*
*Completed: 2026-02-07*
