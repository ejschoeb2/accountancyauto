---
phase: 15-per-accountant-config
plan: "02"
subsystem: ui
tags: [next.js, supabase, settings, rls, role-based-access]

# Dependency graph
requires:
  - phase: 15-per-accountant-config plan 01
    provides: user_id column on app_settings with NULLS NOT DISTINCT unique constraint
  - phase: quick-5
    provides: auth_org_role() helper and owner_id on clients
provides:
  - Members can access /schedules and /templates via nav bar
  - Members can access /settings and configure their own send hour and email identity
  - MemberSettingsCard component for member-facing settings UI
  - User-aware settings CRUD with org-level fallback in app/actions/settings.ts
affects:
  - 15-per-accountant-config plan 03 (cron pipeline needs getUserSendHour per user)
  - 15-per-accountant-config plan 05 (new user seeding writes to app_settings with user_id)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "User-specific settings with org-level fallback: read user row first, fall back to .is('user_id', null) row"
    - "Role-conditional server component rendering: early return for member path, admin path below"
    - "All app_settings upserts use onConflict: 'org_id,user_id,key' with explicit user_id: null for org-level rows"

key-files:
  created:
    - app/(dashboard)/settings/components/member-settings-card.tsx
  modified:
    - components/nav-links.tsx
    - app/actions/settings.ts
    - app/(dashboard)/settings/page.tsx

key-decisions:
  - "[D-15-02-01] ADMIN_ONLY_HREFS now contains only /billing — schedules and templates visible to all roles (RLS handles scoping)"
  - "[D-15-02-02] Org-level reads updated to .is('user_id', null) filter — prevents accidentally reading user-specific rows as org defaults after migration"
  - "[D-15-02-03] Member settings page uses early-return pattern (no redirect) — members access /settings with simplified view"
  - "[D-15-02-04] MemberSettingsCard saves send hour and email settings in a single Save action (not auto-save like SendHourPicker)"

patterns-established:
  - "User-aware settings fallback: .eq('user_id', user.id) first, .is('user_id', null) fallback — applied per-key for email settings"
  - "Role-conditional server page: if orgRole !== 'admin' early return with member view; admin view continues below"

requirements-completed: []

# Metrics
duration: 5min
completed: 2026-02-22
---

# Phase 15 Plan 02: Per-Accountant Config UI/UX Summary

**Nav visibility opened to members for schedules and templates; settings page is now role-aware with a dedicated MemberSettingsCard for personal send hour and email identity configuration**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-22T01:34:39Z
- **Completed:** 2026-02-22T01:39:44Z
- **Tasks:** 2
- **Files modified:** 4 (3 modified, 1 created)

## Accomplishments
- Removed `/schedules` and `/templates` from `ADMIN_ONLY_HREFS` — members now see Reminder Schedules and Email Templates in the nav bar (RLS from Plan 01 handles per-user data scoping)
- Added `getUserSendHour()` and `getUserEmailSettings()` with user-row-first, org-default-fallback pattern using `.is('user_id', null)` for org-level reads
- Added `updateUserSendHour()` and `updateUserEmailSettings()` upserts targeting the new `UNIQUE NULLS NOT DISTINCT (org_id, user_id, key)` constraint
- Updated all existing admin upserts to include `user_id: null` and `onConflict: 'org_id,user_id,key'` — critical for compatibility with Plan 01's migration
- Created `MemberSettingsCard` — combines send hour picker and email identity fields (sender name, sender email local part, reply-to) in a single save action
- Settings page now renders a member view (MemberSettingsCard + SignOutCard) for non-admins instead of redirecting to `/dashboard`

## Task Commits

Each task was committed atomically:

1. **Task 1: Update nav visibility and settings actions for per-user support** - `83e7858` (feat)
2. **Task 2: Settings page role-conditional rendering and member settings card** - `78eab71` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified
- `components/nav-links.tsx` - ADMIN_ONLY_HREFS reduced to `["/billing"]`
- `app/actions/settings.ts` - Added getUserSendHour, updateUserSendHour, getUserEmailSettings, updateUserEmailSettings; updated all admin upserts to new conflict target
- `app/(dashboard)/settings/components/member-settings-card.tsx` - New member-facing settings card with send hour + email identity
- `app/(dashboard)/settings/page.tsx` - Role-conditional rendering: member early return with MemberSettingsCard, admin path unchanged

## Decisions Made
- `ADMIN_ONLY_HREFS` now only contains `/billing` — schedules and templates are accessible to all roles after Plan 01 RLS changes scope the data to each user's own resources
- All org-level reads in `settings.ts` updated to use `.is('user_id', null)` — required after the `user_id` column is added to `app_settings` (otherwise queries could accidentally match user-specific rows)
- `updateUserSendHour` and `updateUserEmailSettings` use `onConflict: 'org_id,user_id,key'` matching the new `UNIQUE NULLS NOT DISTINCT` constraint from Plan 01 migration 2
- `MemberSettingsCard` uses a single Save button (not auto-save like `SendHourPicker`) — member changes multiple fields at once, explicit save is clearer UX

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused `redirect` import from settings page**
- **Found during:** Task 2 (settings page update)
- **Issue:** The `redirect` import from next/navigation was left in the import list after removing the admin-only redirect. TypeScript passes but it's dead code.
- **Fix:** Removed the unused import line
- **Files modified:** `app/(dashboard)/settings/page.tsx`
- **Verification:** TypeScript compilation passes with no errors
- **Committed in:** `78eab71` (Task 2 commit)

**2. [Rule 1 - Bug] Updated org-level reads to use `.is('user_id', null)` filter**
- **Found during:** Task 1 (settings actions update)
- **Issue:** After Plan 01 adds `user_id` column to `app_settings`, the existing `getSendHour()`, `getEmailSettings()`, `getSetupMode()`, `getOnboardingComplete()`, and `getInboundCheckerMode()` reads would return both org-level and user-specific rows without filtering. `.single()` would fail with "multiple rows" error.
- **Fix:** Added `.is('user_id', null)` filter to all org-level reads and changed `.single()` to `.maybeSingle()` for safety
- **Files modified:** `app/actions/settings.ts`
- **Verification:** TypeScript compilation passes, logic correct for org-level reads
- **Committed in:** `83e7858` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for correctness after the database schema change in Plan 01. No scope creep.

## Issues Encountered
None — plan executed without unexpected blockers.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Nav and settings UI complete for per-accountant model
- `getUserSendHour()` and `getUserEmailSettings()` ready for use by the cron pipeline refactor (Plan 03)
- All app_settings upserts use the new conflict target — no compatibility issues after Plan 01 migration is applied
- Plan 03 (cron pipeline) can now build on the per-user send hour resolution

## Self-Check: PASSED

All created/modified files present. Both task commits verified in git history.

---
*Phase: 15-per-accountant-config*
*Completed: 2026-02-22*
