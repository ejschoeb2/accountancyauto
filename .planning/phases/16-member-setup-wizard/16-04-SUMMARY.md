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
  - "Phase 16 complete — full end-to-end member setup wizard verified"

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
  - "[D-16-04-03] window.location.href = '/' for final redirect — forces full page load and middleware re-evaluation, ensuring the member_setup_complete flag is picked up correctly; router.push would not force session reload"

requirements-completed:
  - SETUP-WIZARD

# Metrics
duration: 15min
completed: 2026-02-23
---

# Phase 16 Plan 04: Wizard Page Shell Summary

**Wizard orchestration shell wiring CsvImportStep + ConfigStep under WizardStepper, with Promise.all prefetch and markMemberSetupComplete on completion — full end-to-end flow human-verified**

## Performance

- **Duration:** 15 min
- **Started:** 2026-02-23T00:09:14Z
- **Completed:** 2026-02-23T00:24:00Z
- **Tasks:** 2 (1 auto + 1 human-verify checkpoint — approved)
- **Files modified:** 3 (1 created, 2 modified via bug fix)

## Accomplishments

- Created `app/(auth)/setup/wizard/page.tsx` (106 lines) — "use client" wizard shell
- WizardStepper with 2 steps: "Import Clients" and "Configuration"
- Step 0 renders CsvImportStep; Step 1 renders ConfigStep with prefetched defaults
- On mount, calls getUserSendHour + getUserEmailSettings + getInboundCheckerMode in parallel via Promise.all so Step 2 defaults are ready before the user finishes Step 1
- Loading spinner shown on Step 1 while defaults are still fetching (edge case for very fast clicks)
- handleStep2Complete calls markMemberSetupComplete; on error shows inline error and does NOT redirect; on success uses window.location.href = "/" for full session reload
- Human verification approved: full wizard flow tested end-to-end (invite accept → CSV import → config → dashboard redirect)
- Bug found and fixed during verification: xlsx files kept original filename when reconstructed as CSV, failing the server action's .csv extension check

## Task Commits

1. **Task 1: Create wizard page shell** - `cbb79f1` (feat)
2. **Bug fix during verification: xlsx filename** - `9fd2b7b` (fix)

## Files Created/Modified

- `app/(auth)/setup/wizard/page.tsx` — Wizard orchestration shell; WizardStepper with 2 steps; CsvImportStep (Step 0) and ConfigStep (Step 1) with prefetched defaults; markMemberSetupComplete on Step 2 completion then window.location.href redirect
- `app/(auth)/setup/wizard/components/csv-import-step.tsx` — Fixed to always use `.csv` filename when reconstructing File object from xlsx content
- `components/csv-import-dialog.tsx` — Same xlsx filename fix applied to the shared dialog component for consistency

## Decisions Made

- Promise.all prefetch on mount for three settings actions — defaults are ready by the time user advances from Step 1, so Step 2 loads instantly without a spinner in the normal case
- Error inline on markMemberSetupComplete failure — user can retry; wizard stays on Step 1 display until success
- window.location.href = "/" for final redirect — forces full page load and middleware re-evaluation, ensuring the member_setup_complete flag is picked up correctly; router.push would not force session reload

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed xlsx filename causing .csv extension check failure**
- **Found during:** Task 2 (human verification checkpoint — csv import with xlsx file)
- **Issue:** When the CsvImportStep (and csv-import-dialog) reconstructs an xlsx file as CSV for the server action, it was using `file.name` as the filename, which retained the `.xlsx` extension. The server action checks for `.csv` extension and was rejecting the file.
- **Fix:** Always force the reconstructed File object's name to end in `.csv` (e.g., replacing the extension) in both `CsvImportStep` and `CsvImportDialog`.
- **Files modified:** `app/(auth)/setup/wizard/components/csv-import-step.tsx`, `components/csv-import-dialog.tsx`
- **Verification:** Verified xlsx upload succeeded through full import flow during verification
- **Committed in:** `9fd2b7b` (fix(16-04))

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Bug fix required for correct xlsx import support. No scope creep — both components share the same import pipeline; applying the fix to both ensures consistent behaviour.

## Issues Encountered

The `.next/dev/types/validator.ts` stale cache warning (`Type '"/setup"' is not assignable to type 'LayoutRoutes'`) appeared in TypeScript output — this is the same pre-existing artifact documented in the 16-03 SUMMARY. No source-level errors. The warning resolves on the next `next build` or `next dev` run.

## User Setup Required

None — the wizard is fully functional and human-verified. No external service configuration required.

## Self-Check: PASSED

- FOUND: `app/(auth)/setup/wizard/page.tsx`
- FOUND: commit `cbb79f1` (feat - wizard page shell)
- FOUND: commit `9fd2b7b` (fix - xlsx filename)

---
*Phase: 16-member-setup-wizard*
*Completed: 2026-02-23*
