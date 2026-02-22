---
phase: 15-per-accountant-config
plan: 04
subsystem: email-pipeline
tags: [email, cron, per-user, sender-settings, postmark]

# Dependency graph
requires:
  - phase: 15-01
    provides: "user_id column on app_settings with NULLS NOT DISTINCT unique constraint"
  - phase: 15-02
    provides: "org-level settings reads updated to .is('user_id', null)"
  - phase: 15-03
    provides: "MemberSettingsCard saving user-specific app_settings rows (email_sender_name, email_sender_address, email_reply_to)"
  - phase: quick-5-accountant-scoped-client-isolation
    provides: "owner_id on clients table (backfilled)"
provides:
  - "getEmailFromForUser function in sender.ts for per-user sender resolution with org-level fallback"
  - "send-emails cron resolves owner_id from clients join and passes to sendRichEmailForOrg"
  - "Each reminder email bears the owning accountant's personal sender name and reply-to"
affects:
  - 15-05 (new user seeding — user now gets personal sender settings from day one)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-user settings resolution: query user-specific rows first, merge over org-level defaults"
    - "owner_id join pattern: derive accountant identity at send time from clients.owner_id"

key-files:
  created: []
  modified:
    - lib/email/sender.ts
    - app/api/cron/send-emails/route.ts

key-decisions:
  - "[D-15-04-01] owner_id derived at send time from clients.owner_id JOIN (no schema change to reminder_queue) — owner is a property of the client, not the queued reminder; deriving at send time is simpler and always correct"
  - "[D-15-04-02] getEmailFromForUser does two separate queries (user rows + org rows) and merges in application code — avoids complex SQL for a 3-key lookup; org rows serve as fallback for keys not set by user"
  - "[D-15-04-03] Postmark server token stays org-level — only From name and Reply-To are per-user; token is infrastructure, not identity"

patterns-established:
  - "Per-user email sender pattern: getEmailFromForUser queries user_id = userId rows first, then merges org defaults (user_id IS NULL); user rows win"

requirements-completed: []

# Metrics
duration: 5min
completed: 2026-02-22
---

# Phase 15 Plan 04: Per-User Sender Settings in Send-Emails Cron Summary

**`getEmailFromForUser` added to sender.ts and send-emails cron updated to pass clients.owner_id so each reminder email uses the owning accountant's personal sender name and reply-to with org-level fallback**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-22T01:45:17Z
- **Completed:** 2026-02-22T01:50:00Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Added `getEmailFromForUser(supabase, orgId, userId)` to `lib/email/sender.ts` that reads user-specific `app_settings` rows first, then falls back to org-level defaults (user_id IS NULL), merging in application code so user rows win
- Added optional `userId?: string` to `SendRichEmailForOrgParams` interface; `sendRichEmailForOrg` calls `getEmailFromForUser` when `userId` provided, `getEmailFromForOrg` otherwise
- Updated `send-emails` cron to include `owner_id` in the `clients!inner(...)` select
- Cast client join result to typed object with `owner_id: string` and passed `client.owner_id` as `userId` to `sendRichEmailForOrg`
- TypeScript compilation passes with no errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Add getEmailFromForUser and update send-emails cron** - `c56cd55` (feat)

## Files Created/Modified
- `lib/email/sender.ts` - Added `getEmailFromForUser` function (lines 53-89), added `userId?` to `SendRichEmailForOrgParams`, updated `sendRichEmailForOrg` to branch on userId
- `app/api/cron/send-emails/route.ts` - Added `owner_id` to clients select, typed client object, passed `userId: client.owner_id` to `sendRichEmailForOrg`

## Decisions Made
- Owner identity derived at send time from `clients.owner_id` JOIN — no schema change to `reminder_queue` needed; the owner is a client property that is always correct at send time (backfilled by Quick Task 5)
- Two separate Supabase queries in `getEmailFromForUser` (user rows + org rows) merged in application code — simple, avoids complex SQL COALESCE for a 3-key lookup; consistent with the settings fallback pattern established in 15-02
- Postmark server token remains org-level — only `email_sender_name` and `email_reply_to` are per-user; token is infrastructure config, not accountant identity

## Deviations from Plan

None - plan executed exactly as written.

## User Setup Required

None - no external service configuration required. The feature activates automatically for all users who have saved personal email settings via the MemberSettingsCard (Plan 15-03). Users without personal settings receive org-level defaults transparently.

## Self-Check: PASSED

All modified files verified and commit confirmed:
- `lib/email/sender.ts` - FOUND, contains `getEmailFromForUser` and `userId?` in interface
- `app/api/cron/send-emails/route.ts` - FOUND, contains `owner_id` in select and `userId: client.owner_id` in sendRichEmailForOrg call
- Commit `c56cd55` - FOUND

## Next Phase Readiness
- Per-user email pipeline complete: accountants' clients receive emails with the accountant's personal sender name and reply-to
- Org-level Postmark token preserved — no cross-org leakage
- Ready for Phase 15-05: new user seeding (owner_id required on all resource rows when admin creates new org member)

---
*Phase: 15-per-accountant-config*
*Completed: 2026-02-22*
