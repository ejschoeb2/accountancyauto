---
phase: 16-member-setup-wizard
plan: 01
subsystem: auth
tags: [supabase, server-actions, middleware, next-js]

# Dependency graph
requires:
  - phase: 15-per-accountant-config
    provides: "app_settings with NULLS NOT DISTINCT unique constraint (org_id, user_id, key)"
provides:
  - "getMemberSetupComplete server action — reads per-user member_setup_complete flag from app_settings"
  - "markMemberSetupComplete server action — upserts per-user flag in app_settings"
  - "/setup route exemption in enforceSubscription middleware"
  - "Invite accept redirects to /setup/wizard (dev + prod URL patterns)"
affects: [16-member-setup-wizard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-user app_settings flag pattern: user_id = user.id (not null), key = snake_case_flag_name, value = 'true'"
    - "Wizard routes exempt from billing gate: pathname.startsWith('/setup') in enforceSubscription allow-through"

key-files:
  created: []
  modified:
    - app/actions/settings.ts
    - lib/middleware/access-gating.ts
    - app/(auth)/invite/accept/page.tsx

key-decisions:
  - "[D-16-01-01] markMemberSetupComplete omits requireWriteAccess — wizard runs before subscription enforcement; writing a completion flag must not be blocked by billing gate"
  - "[D-16-01-02] member_setup_complete is per-user (user_id = user.id), NOT org-level (user_id IS NULL) — each member completes setup independently"
  - "[D-16-01-03] /setup exemption added to enforceSubscription allow-through to prevent redirect loop for new members on expired-trial orgs"

patterns-established:
  - "Per-user completion flags: upsert with {org_id, user_id: user.id, key: 'flag_name', value: 'true'}, onConflict: 'org_id,user_id,key'"

requirements-completed:
  - SETUP-WIZARD

# Metrics
duration: 2min
completed: 2026-02-22
---

# Phase 16 Plan 01: Member Setup Wizard Foundation Summary

**Per-user setup completion flag in app_settings, /setup middleware exemption, and invite-accept redirect to /setup/wizard**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-22T20:53:58Z
- **Completed:** 2026-02-22T20:56:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Added `getMemberSetupComplete` and `markMemberSetupComplete` server actions with correct per-user semantics (user_id = user.id, not null)
- Added `/setup` to enforceSubscription allow-through block, preventing redirect loop for new members on expired-trial orgs
- Changed invite accept redirect from `/` to `/setup/wizard` (both dev and prod URL patterns) so new members land in the wizard after accepting

## Task Commits

Each task was committed atomically:

1. **Task 1: Add member_setup_complete server actions** - `ef3cf0c` (feat)
2. **Task 2: Add /setup exemption to enforceSubscription** - `53b9a70` (feat)
3. **Task 3: Redirect invite accept to /setup/wizard** - `6a08d1f` (feat)

## Files Created/Modified

- `app/actions/settings.ts` - Added getMemberSetupComplete and markMemberSetupComplete exports at end of file (before Postmark Settings section)
- `lib/middleware/access-gating.ts` - Added pathname.startsWith('/setup') to allow-through block; updated inline comment
- `app/(auth)/invite/accept/page.tsx` - Changed handleAccept redirect from / to /setup/wizard?org= (dev) and /setup/wizard (prod)

## Decisions Made

- `markMemberSetupComplete` deliberately omits `requireWriteAccess(orgId)` — the wizard must be completable even on an org with a lapsed trial. Writing a boolean flag does not change any billing-restricted data.
- `member_setup_complete` is a per-user flag (user_id = user.id), not org-level. Each member completes their own setup independently. This is the key distinction from org-level flags like `onboarding_complete` (which use user_id: null).
- `/setup` exemption in enforceSubscription prevents an unbreakable redirect loop: new member invited to org with expired trial → without exemption, /setup would redirect to /billing which redirects to /setup which redirects to /billing.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Foundation layer complete: server actions ready for Plans 03 and 04 to consume for wizard gating logic
- Middleware exemption live: /setup/* routes won't be blocked by billing enforcement
- Entry point wired: new members accepting invites will land at /setup/wizard

---
*Phase: 16-member-setup-wizard*
*Completed: 2026-02-22*
