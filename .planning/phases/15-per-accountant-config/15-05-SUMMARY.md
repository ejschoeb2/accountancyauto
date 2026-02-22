---
phase: 15-per-accountant-config
plan: 05
subsystem: seeding
tags: [seeding, invite, onboarding, email-templates, schedules]

# Dependency graph
requires:
  - phase: 15-01-per-accountant-config-db-foundation
    provides: "owner_id NOT NULL on email_templates, schedules, schedule_steps — required for per-user INSERT"
  - phase: 13-02-invite-flow
    provides: "acceptInvite server action and invite acceptance flow"
provides:
  - "seedNewUserDefaults function that clones admin resources for new org members"
  - "New members receive working templates, schedules, and schedule steps from day one"
affects:
  - "app/(auth)/invite/accept/actions.ts — seeding triggered on every successful new member join"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Non-fatal fire-and-forget seeding pattern — try/catch in utility, caller awaits but seeding failure never bubbles up"
    - "Old-to-new ID mapping for FK remapping during bulk resource cloning"
    - "One-by-one INSERT to capture returned IDs before bulk FK-dependent cloning"

key-files:
  created:
    - lib/seeding/seed-new-user.ts
  modified:
    - app/(auth)/invite/accept/actions.ts

key-decisions:
  - "Templates and schedules cloned one-by-one (not bulk) to capture generated IDs for schedule_steps FK remapping"
  - "schedule_client_exclusions NOT cloned — new user has no clients; exclusions are created per-client after assignment"
  - "app_settings NOT cloned — settings fallback pattern (user row -> org default) covers new users automatically"
  - "Seeding placed between user_organisations INSERT and invite accepted_at update — user is in org regardless of seeding outcome"

# Metrics
duration: 5min
completed: 2026-02-22
---

# Phase 15 Plan 05: New User Seeding on Invite Acceptance Summary

**New lib/seeding/seed-new-user.ts utility that clones the org admin's email templates, schedules, and schedule steps for new members with correctly remapped foreign keys, wired into the invite acceptance flow as a non-fatal post-INSERT call**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-02-22T01:52:24Z
- **Completed:** 2026-02-22T01:58:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created `lib/seeding/seed-new-user.ts` with `seedNewUserDefaults` function that clones admin's email_templates, schedules, and schedule_steps for a new member
- Built old-to-new ID maps so schedule_steps FK references (schedule_id, email_template_id) are remapped to the new user's cloned copies rather than pointing at admin's originals
- Skips schedule_client_exclusions (new user has no clients) and app_settings (org defaults via fallback pattern)
- Updated `app/(auth)/invite/accept/actions.ts` to call seeding after successful user_organisations INSERT; seeding failure is non-fatal and never blocks the user from joining

## Task Commits

Each task was committed atomically:

1. **Task 1: Create seedNewUserDefaults utility** - `4c62d0f` (feat)
2. **Task 2: Call seedNewUserDefaults from invite acceptance flow** - `9ac8b4a` (feat)

## Files Created/Modified

- `lib/seeding/seed-new-user.ts` - New seeding utility with admin-client-based resource cloning and FK remapping
- `app/(auth)/invite/accept/actions.ts` - Added import and `await seedNewUserDefaults(user.id, invite.org_id)` call

## Decisions Made

- Templates inserted one-by-one (not bulk) to capture the Postgres-generated UUID for each, enabling the FK remap Map for schedule_steps
- schedule_client_exclusions intentionally excluded from cloning — new member has no clients assigned yet; exclusions are added as clients get assigned
- app_settings intentionally excluded from cloning — the settings fallback pattern (read user-specific row, fall back to org default with user_id IS NULL) covers new users automatically without any seeding
- Seeding call placed after the user_organisations INSERT succeeds and before marking invite as accepted — ensures user is fully in the org before seeding runs, and invite is always marked accepted regardless of seeding outcome

## Deviations from Plan

None - plan executed exactly as written.

## User Setup Required

None — no external service configuration required.

## Self-Check: PASSED

All created/modified files exist and commits verified:
- `lib/seeding/seed-new-user.ts` - FOUND
- `app/(auth)/invite/accept/actions.ts` - FOUND
- Commit `4c62d0f` - FOUND
- Commit `9ac8b4a` - FOUND

## Phase 15 Completion

This is the final plan in Phase 15 (Per-Accountant Configuration). All 5 plans complete:
- 15-01: DB foundation (owner_id on resource tables, user_id on app_settings, owner-scoped RLS)
- 15-02: Nav/settings access (members can access their own templates/schedules, member settings card)
- 15-03: Cron pipeline refactor (per-user inner loop, per-user locks, accountant_name resolution)
- 15-04: Send-emails cron per-user sender settings (From name and Reply-To per user)
- 15-05: New user seeding (clone admin resources on invite acceptance)

Per-accountant configuration is fully implemented. Each accountant in an org sees and manages their own templates, schedules, and settings, with the cron pipeline sending emails with their identity.

---
*Phase: 15-per-accountant-config*
*Completed: 2026-02-22*
