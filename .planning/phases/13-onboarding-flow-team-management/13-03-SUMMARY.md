---
phase: 13-onboarding-flow-team-management
plan: 03
subsystem: ui
tags: [next.js, rbac, navigation, role-based-access, server-components]

# Dependency graph
requires:
  - phase: 13-onboarding-flow-team-management
    provides: org creation with role assignment (admin role on org creator)
  - phase: 10-org-data-model-rls-foundation
    provides: getOrgContext() returning orgId + orgRole from JWT app_metadata
provides:
  - Role-filtered navigation: members see Dashboard, Clients, Email Activity only
  - SettingsLink hidden entirely for member-role users
  - /settings server-side redirect for member-role users
  - /billing server-side redirect for member-role users (already existed pre-plan)
affects:
  - 13-04 (trial-reminder cron, no nav dependency)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ADMIN_ONLY_HREFS Set for O(1) nav item filtering in NavLinks"
    - "orgRole default to 'member' (safe default: restrict rather than over-permit)"
    - "Server-side role check at top of page component before expensive data fetching"

key-files:
  created: []
  modified:
    - app/(dashboard)/layout.tsx
    - components/nav-links.tsx
    - components/settings-link.tsx
    - app/(dashboard)/settings/page.tsx

key-decisions:
  - "[D-13-03-01] orgRole defaults to 'member' in NavLinks and SettingsLink client components — safe default restricts access if prop is missing rather than over-permitting"
  - "[D-13-03-02] /schedules and /templates hidden from member nav but no server-side redirect added — nav hiding is primary UX control; belt-and-suspenders for /settings and /billing only (highest-risk routes)"
  - "[D-13-03-03] layout.tsx catches getOrgContext() errors and defaults orgRole to 'member' — prevents layout crash for users in no-org state (e.g., mid-onboarding)"

patterns-established:
  - "Role gate pattern: const { orgRole } = await getOrgContext(); if (orgRole !== 'admin') { redirect('/dashboard'); } — at top of server component before data fetching"
  - "Client nav filtering: ADMIN_ONLY_HREFS Set + filter at render time — no adminOnly flag on each item"

requirements-completed: [TEAM-04, TEAM-05]

# Metrics
duration: 2min
completed: 2026-02-21
---

# Phase 13 Plan 03: Role-Based Navigation Summary

**Member-role navigation filtering via ADMIN_ONLY_HREFS Set in NavLinks, hidden SettingsLink, and server-side redirect guards on /settings and /billing pages**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-21T10:37:09Z
- **Completed:** 2026-02-21T10:39:17Z
- **Tasks:** 1
- **Files modified:** 4

## Accomplishments
- NavLinks now filters `/schedules`, `/templates`, and `/billing` from the nav for member-role users using a `ADMIN_ONLY_HREFS` Set
- SettingsLink (gear icon) returns `null` for member-role users — completely hidden from the header
- Settings page has server-side role guard: `getOrgContext()` + `redirect('/dashboard')` for non-admins
- Billing page already had the same guard pattern from prior Phase 11 work — no changes needed
- Dashboard layout now uses `getOrgContext()` (replaces `getOrgId()`) and passes `orgRole` to both nav components
- TypeScript passes with no errors; `npm run build` succeeds

## Task Commits

Each task was committed atomically:

1. **Task 1: Role-based navigation filtering and route protection** - `405591d` (feat)

**Plan metadata:** (docs commit — see final_commit)

## Files Created/Modified
- `app/(dashboard)/layout.tsx` - Changed from `getOrgId()` to `getOrgContext()`, extracts `orgRole`, passes to `NavLinks` and `SettingsLink`. Note: The Phase 14 agent had already made these exact changes in commit `05c490e` — no net diff.
- `components/nav-links.tsx` - Added `ADMIN_ONLY_HREFS` Set + filter logic + `orgRole` prop. Note: Also already applied by Phase 14 agent in `05c490e`.
- `components/settings-link.tsx` - Added `orgRole` prop; returns `null` for non-admin users
- `app/(dashboard)/settings/page.tsx` - Added `getOrgContext()` check + `redirect('/dashboard')` for member-role users

## Decisions Made
- [D-13-03-01] `orgRole` defaults to `'member'` in NavLinks and SettingsLink client components — safe default restricts access if prop is accidentally missing rather than over-permitting.
- [D-13-03-02] `/schedules` and `/templates` are hidden from member nav but have no server-side redirect — nav hiding is the primary UX control per the plan's scope decision; only `/settings` and `/billing` get belt-and-suspenders server protection.
- [D-13-03-03] `layout.tsx` try/catch defaults `orgRole` to `'member'` when `getOrgContext()` throws (e.g., user mid-onboarding with no org) — prevents layout crash while maintaining restrictive default.

## Deviations from Plan

None — plan executed exactly as written.

The billing page (`app/(dashboard)/billing/page.tsx`) already contained the `orgRole !== "admin"` redirect guard added during Phase 11 plan 04 execution. The plan's note to "check the file first and apply the appropriate pattern" was followed; no additional changes were required.

The Phase 14 agent (which ran immediately before this plan) had already applied the `layout.tsx` and `nav-links.tsx` changes as "linter-applied improvements" in commit `05c490e`. Those changes were therefore already present when this task ran, resulting in no net diff for those two files. The remaining two files (`settings-link.tsx` and `settings/page.tsx`) were not touched by Phase 14 and were updated by this task's commit.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Role-based navigation complete — admin sees all features, member sees Dashboard, Clients, Email Activity only
- Route protection in place for `/settings` and `/billing`
- Phase 13-04 (trial-reminder cron) can proceed — no nav dependencies

---
*Phase: 13-onboarding-flow-team-management*
*Completed: 2026-02-21*

## Self-Check: PASSED

- FOUND: `app/(dashboard)/layout.tsx` (modified — getOrgContext + orgRole prop)
- FOUND: `components/nav-links.tsx` (modified — ADMIN_ONLY_HREFS filter)
- FOUND: `components/settings-link.tsx` (modified — orgRole prop, returns null for members)
- FOUND: `app/(dashboard)/settings/page.tsx` (modified — role guard + redirect)
- FOUND commit: `405591d` (feat(13-03): role-based navigation filtering and route protection)
