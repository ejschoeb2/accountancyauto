---
phase: 16-member-setup-wizard
plan: 04
subsystem: auth
tags: [next-js, react, wizard, client-component, routing]

# Dependency graph
requires:
  - phase: 16-member-setup-wizard
    plan: 02
    provides: "CsvImportStep component with onComplete() prop"
  - phase: 16-member-setup-wizard
    plan: 03
    provides: "ConfigStep component, setup layout gate, dashboard wizard gate"

provides:
  - "app/(auth)/setup/wizard/page.tsx — wizard orchestration shell with WizardStepper, step routing, and completion logic"

affects:
  - "End-to-end member setup wizard flow (Phase 16 complete)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wizard shell pattern: useState step index + WizardStepper + conditional step rendering"
    - "Promise.all prefetch on mount: load Step 2 defaults while user completes Step 1 for instant transition"
    - "window.location.href for post-setup redirect: forces full session reload so middleware re-evaluates flags"

key-files:
  created:
    - app/(auth)/setup/wizard/page.tsx
  modified: []

key-decisions:
  - "[D-16-04-01] Promise.all prefetch on mount for Step 2 defaults — all three settings fetched in parallel while user is on Step 1; Step 2 renders instantly without loading state in the common case"
  - "[D-16-04-02] Error state on markMemberSetupComplete failure shown inline without redirect — user can retry Save & Continue; wizard does not advance on error"
  - "[D-16-04-03] useTransition removed from handleStep2Complete — async/await with explicit isCompleting state is simpler; ConfigStep's own useTransition handles the save sequence"

requirements-completed:
  - SETUP-WIZARD

# Metrics
duration: 2min
completed: 2026-02-23
---

# Phase 16 Plan 04: Wizard Page Shell Summary

**Wizard orchestration shell that wires CsvImportStep + ConfigStep under WizardStepper, prefetches Step 2 defaults on mount, and calls markMemberSetupComplete before redirecting to the dashboard**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-23T00:09:14Z
- **Completed:** 2026-02-23T00:11:00Z
- **Tasks:** 1 (Task 2 is a human-verify checkpoint)
- **Files modified:** 1 (created)

## Accomplishments

- Created `app/(auth)/setup/wizard/page.tsx` (106 lines) — "use client" wizard shell
- WizardStepper with 2 steps: "Import Clients" and "Configuration"
- Step 0 renders CsvImportStep; Step 1 renders ConfigStep with prefetched defaults
- On mount, calls getUserSendHour + getUserEmailSettings + getInboundCheckerMode in parallel via Promise.all to have Step 2 defaults ready before the user finishes Step 1
- Loading spinner shown on Step 1 while defaults are still fetching (edge case for very fast clicks)
- handleStep2Complete calls markMemberSetupComplete; on error shows inline error and does NOT redirect; on success uses window.location.href = "/" for full session reload

## Task Commits

1. **Task 1: Create wizard page shell** - `cbb79f1` (feat)

## Files Created/Modified

- `app/(auth)/setup/wizard/page.tsx` - Wizard orchestration shell; WizardStepper with 2 steps; CsvImportStep (Step 0) and ConfigStep (Step 1) with prefetched defaults; markMemberSetupComplete on Step 2 completion then window.location.href redirect

## Decisions Made

- Promise.all prefetch on mount for three settings actions — defaults are ready by the time user advances from Step 1, so Step 2 loads instantly without a spinner in the normal case
- Error inline on markMemberSetupComplete failure — user can retry; wizard stays on Step 1 display until success
- window.location.href = "/" for final redirect — forces full page load and middleware re-evaluation, ensuring the member_setup_complete flag is picked up correctly; router.push would not force session reload

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

The `.next/dev/types/validator.ts` stale cache warning (`Type '"/setup"' is not assignable to type 'LayoutRoutes'`) appeared in TypeScript output — this is the same pre-existing artifact documented in the 16-03 SUMMARY. No source-level errors. The warning resolves on the next `next build` or `next dev` run.

## User Setup Required

Task 2 (checkpoint:human-verify) is pending — the human verification step requires the user to run the full wizard flow end-to-end in their dev environment.

## Self-Check: PASSED

- FOUND: `app/(auth)/setup/wizard/page.tsx`
- FOUND: commit `cbb79f1` (feat - wizard page shell)

---
*Phase: 16-member-setup-wizard*
*Completed: 2026-02-23*
