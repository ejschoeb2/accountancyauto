---
phase: 16-member-setup-wizard
plan: 03
subsystem: auth
tags: [next-js, server-components, wizard, routing, react]

# Dependency graph
requires:
  - phase: 16-member-setup-wizard
    plan: 01
    provides: "getMemberSetupComplete server action — reads per-user member_setup_complete flag from app_settings"

provides:
  - "app/(auth)/setup/layout.tsx — server component gate preventing wizard re-entry for completed members"
  - "app/(dashboard)/layout.tsx member wizard gate — dynamic-import check redirects incomplete members to /setup/wizard"
  - "app/(auth)/setup/wizard/components/config-step.tsx — Step 2 UI: send hour + inbound mode + email identity with Save & Continue"

affects: [16-member-setup-wizard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Setup layout gate mirrors onboarding layout.tsx pattern: getMemberSetupComplete → org slug resolution via admin client → conditional redirect"
    - "Dashboard wizard gate uses dynamic import inside try block to avoid top-level import cost on every layout render"
    - "ConfigStep saves three independent settings in sequence via useTransition; onComplete() only fires after all succeed"

key-files:
  created:
    - app/(auth)/setup/layout.tsx
    - app/(auth)/setup/wizard/components/config-step.tsx
  modified:
    - app/(dashboard)/layout.tsx

key-decisions:
  - "[D-16-03-01] Setup layout silently catches getMemberSetupComplete errors — no org context yet for fresh invitees; wizard must proceed without error"
  - "[D-16-03-02] Dashboard wizard gate uses dynamic import to avoid adding top-level import cost to all layout renders; import is cached by Node after first call"
  - "[D-16-03-03] ConfigStep uses ToggleGroup (not Select) for inbound mode — wizard context benefits from visual toggle over dropdown for binary choice"
  - "[D-16-03-04] ConfigStep always shows Save & Continue (not isDirty-conditional) — wizard requires explicit user action to advance even with default values"

patterns-established:
  - "Wizard layout gate: createClient + getUser → redirect /login if no user → getMemberSetupComplete in try/catch → redirect dashboard if complete → render"
  - "Wizard step component: three-action save sequence via useTransition → call onComplete() only after all succeed"

requirements-completed:
  - SETUP-WIZARD

# Metrics
duration: 6min
completed: 2026-02-23
---

# Phase 16 Plan 03: Wizard Gating and ConfigStep Summary

**Setup layout gate, dashboard layout member intercept, and ConfigStep UI component — three pieces that make the wizard mandatory for members**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-22T23:59:09Z
- **Completed:** 2026-02-23T00:05:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Created `app/(auth)/setup/layout.tsx` — server component that redirects unauthenticated users to /login, and already-complete members to their org dashboard (slug-resolved via admin client); catches getMemberSetupComplete errors silently to allow fresh invitees through
- Modified `app/(dashboard)/layout.tsx` — added member-only wizard gate inside the existing try block using dynamic import; redirects members without member_setup_complete flag to /setup/wizard; admins bypass entirely
- Created `app/(auth)/setup/wizard/components/config-step.tsx` (240 lines) — Step 2 wizard UI with send hour Select, inbound mode ToggleGroup (auto/recommend), and email identity fields; Save & Continue button saves all three settings in sequence and calls onComplete() only on full success

## Task Commits

Each task was committed atomically:

1. **Task 1: Create setup layout gate** - `beb2f29` (feat)
2. **Task 2: Add member wizard gate to dashboard layout** - `75a4de4` (feat)
3. **Task 3: Create ConfigStep component for wizard Step 2** - `bd57003` (feat)

## Files Created/Modified

- `app/(auth)/setup/layout.tsx` - Async server component; auth check + getMemberSetupComplete gate + branding layout matching onboarding
- `app/(dashboard)/layout.tsx` - Added member wizard gate (9 lines) inside existing try block using dynamic import
- `app/(auth)/setup/wizard/components/config-step.tsx` - Step 2 "Configure Your Settings" card: send hour, inbound mode toggle, email identity (sender name, sender email split-input, reply-to)

## Decisions Made

- Setup layout silently catches getMemberSetupComplete errors — fresh invitees have no org context yet (JWT claims not yet populated); catching lets the wizard proceed without a 500 error.
- Dashboard wizard gate uses `await import(...)` (dynamic import) to avoid adding getMemberSetupComplete to every dashboard layout render's import graph. The check only runs for members, and the module is cached by Node after the first call.
- ConfigStep uses ToggleGroup for inbound mode rather than Select — the binary auto/recommend choice benefits from visual toggle affordance in a wizard context.
- Save & Continue is always visible (not isDirty-conditional) — even if a member keeps all defaults, they must explicitly confirm and advance.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The `.next/dev/types/validator.ts` stale cache warning (`Type '"/setup"' is not assignable to type 'LayoutRoutes'`) is a pre-existing artifact from the route type manifest not yet including the new `/setup` layout. It resolves on the next `next build` or `next dev` run and does not indicate any source-level error.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wizard gating is complete: the full enforcement loop is wired (invite → /setup/wizard, dashboard intercept for incomplete members, wizard layout prevents re-entry)
- ConfigStep is ready to be wired into the wizard page.tsx (Plan 04 will create the wizard page itself and call markMemberSetupComplete after onComplete() fires)
- All three server actions consumed by ConfigStep (updateUserSendHour, updateUserEmailSettings, updateInboundCheckerMode) are already implemented and tested in Phase 15

## Self-Check: PASSED

All files exist and commits confirmed present:
- FOUND: app/(auth)/setup/layout.tsx
- FOUND: app/(dashboard)/layout.tsx
- FOUND: app/(auth)/setup/wizard/components/config-step.tsx
- FOUND: beb2f29 (Task 1 commit)
- FOUND: 75a4de4 (Task 2 commit)
- FOUND: bd57003 (Task 3 commit)

---
*Phase: 16-member-setup-wizard*
*Completed: 2026-02-23*
