---
phase: 10
plan: 03
subsystem: cron-pipeline
tags: [multi-tenant, cron, org-scoping, postmark, email-sender]
dependency-graph:
  requires: [10-01]
  provides: [org-scoped-cron-pipeline, per-org-postmark, org-scoped-locks]
  affects: [10-04, 10-05, 12]
tech-stack:
  added: []
  patterns: [org-iteration-in-cron, per-org-postmark-client, org-scoped-distributed-locks]
key-files:
  created: []
  modified:
    - app/api/cron/reminders/route.ts
    - app/api/cron/send-emails/route.ts
    - lib/reminders/scheduler.ts
    - lib/reminders/queue-builder.ts
    - lib/email/sender.ts
    - app/api/reminders/rebuild-queue/route.ts
decisions:
  - id: D-10-03-01
    decision: "Sequential org iteration (not parallel) for cron jobs"
    rationale: "Simpler error handling, predictable Postmark rate limiting, sufficient for expected org counts"
  - id: D-10-03-02
    decision: "rebuildQueueForClient takes optional orgId param (falls back to client.org_id)"
    rationale: "Backwards compatible — existing callers from server actions don't need changes; cron can pass explicit org"
  - id: D-10-03-03
    decision: "cancelRemindersForReceivedRecords, restoreRemindersForUnreceivedRecords, handleUnpauseClient unchanged"
    rationale: "These operate on client_id which belongs to one org; RLS handles auth users, cron always goes through org-scoped paths"
  - id: D-10-03-04
    decision: "sendRichEmail kept unchanged alongside new sendRichEmailForOrg"
    rationale: "Server actions (ad-hoc send, reply) use env var Postmark client; cron uses per-org client"
metrics:
  duration: 7m 39s
  completed: 2026-02-19
---

# Phase 10 Plan 03: Cron Org Scoping Summary

**Refactored cron pipeline and email sender for multi-tenant org isolation with per-org Postmark credentials and org-scoped distributed locks**

## What Was Done

### Task 1: Reminders cron and scheduler org iteration
**Commit:** `4026c22`

Refactored the reminders cron pipeline (route -> scheduler -> queue builder) to iterate over organisations:

- **Cron route** (`app/api/cron/reminders/route.ts`): Fetches all active/trialing orgs, loops sequentially, aggregates per-org results. Error in one org caught and logged, processing continues to next org.
- **Scheduler** (`lib/reminders/scheduler.ts`): `processReminders(supabase, org)` now takes org parameter. Lock key is `cron_reminders_{org_id}`. Every query (app_settings, schedules, reminder_queue, email_templates, schedule_steps) includes `.eq('org_id', org.id)`. All log messages prefixed with `[org.name]`. Email_log inserts include org_id.
- **Queue builder** (`lib/reminders/queue-builder.ts`): `buildReminderQueue(supabase, org)` and `buildCustomScheduleQueue(supabase, org)` take org parameter. Every query (client_filing_assignments, schedules, schedule_steps, email_templates, client_deadline_overrides, schedule_client_exclusions) includes `.eq('org_id', org.id)`. All reminder_queue and email_log inserts include `org_id: org.id`. `logQueueWarning` helper updated to include org_id.
- **rebuildQueueForClient**: Signature changed to `(supabase, clientId, orgId?)` — orgId is optional, falls back to `client.org_id` for backwards compatibility with existing server action callers.
- **rebuild-queue API route** (`app/api/reminders/rebuild-queue/route.ts`): Updated to resolve user's org from `user_organisations` table.

### Task 2: Send-emails cron and email sender org iteration
**Commit:** `59d2f07`

Refactored the send-emails cron pipeline and email sender for per-org Postmark credentials:

- **Cron route** (`app/api/cron/send-emails/route.ts`): Same org iteration pattern as reminders cron. Each org gets org-scoped lock (`cron_send_emails_{org_id}`). Pending reminders queried with `.eq('org_id', org.id)`. Emails sent via `sendRichEmailForOrg` with org's Postmark token. All email_log inserts include org_id.
- **Email sender** (`lib/email/sender.ts`): New `sendRichEmailForOrg()` function accepts org Postmark token (falls back to env var). New `getEmailFromForOrg()` reads org's app_settings for email from/replyTo. New `getOrgPostmarkClient()` creates per-org ServerClient. Existing `sendRichEmail()` unchanged for backwards compatibility with server actions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed rebuild-queue API route missing org parameter**
- **Found during:** Task 1
- **Issue:** `app/api/reminders/rebuild-queue/route.ts` calls `buildReminderQueue(adminClient)` without org parameter — would fail to compile after signature change
- **Fix:** Updated to resolve user's org from `user_organisations` table (PostgREST FK workaround: separate queries for user_org and org data)
- **Files modified:** `app/api/reminders/rebuild-queue/route.ts`
- **Commit:** `4026c22`

## Decisions Made

| ID | Decision | Rationale |
|----|----------|-----------|
| D-10-03-01 | Sequential org iteration in cron jobs | Simpler error handling, predictable Postmark rate limiting |
| D-10-03-02 | rebuildQueueForClient takes optional orgId | Backwards compatible with existing server action callers |
| D-10-03-03 | cancel/restore/unpause helpers unchanged | Client_id already scopes to one org; RLS handles auth |
| D-10-03-04 | sendRichEmail kept alongside sendRichEmailForOrg | Server actions use env var client; cron uses per-org client |

## Task Commits

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Reminders cron + scheduler org iteration | `4026c22` | 4 files: route, scheduler, queue-builder, rebuild-queue |
| 2 | Send-emails cron + email sender org iteration | `59d2f07` | 2 files: route, sender |

## Verification Results

1. Both cron routes fetch organisations and iterate sequentially -- PASS
2. Every Supabase query in scheduler.ts includes .eq('org_id', org.id) -- PASS (10 occurrences)
3. Every Supabase query in queue-builder.ts includes .eq('org_id', org.id) -- PASS (27 occurrences)
4. Lock keys contain org.id: cron_reminders_{org_id} and cron_send_emails_{org_id} -- PASS
5. Email sender has sendRichEmailForOrg accepting org Postmark token -- PASS
6. All email_log inserts include org_id -- PASS
7. All reminder_queue inserts include org_id -- PASS
8. npx tsc --noEmit passes -- PASS
9. Error in one org's processing doesn't prevent other orgs from being processed -- PASS

## Next Phase Readiness

No blockers. All cron pipeline code is now org-scoped. Plan 04 (server action org scoping) and Plan 05 (verification) can proceed.

## Self-Check: PASSED
