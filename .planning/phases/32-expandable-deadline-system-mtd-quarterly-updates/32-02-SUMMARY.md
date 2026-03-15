---
phase: 32-expandable-deadline-system-mtd-quarterly-updates
plan: "02"
subsystem: deadlines
tags: [queue-builder, wizard, onboarding, filing-types, org-selections]
dependency_graph:
  requires: ["32-01"]
  provides: ["QUEUE-RESPECTS-SELECTIONS", "WIZARD-DEADLINE-STEP", "SEED-DEFAULTS-ACTIVATION"]
  affects: [lib/reminders/queue-builder.ts, lib/onboarding/seed-defaults.ts, app/(auth)/setup/wizard]
tech_stack:
  added: []
  patterns:
    - "org_filing_type_selections filter at queue-build time (not send time)"
    - "DeadlineSelectionStep: checkbox UI with category groups, shadcn Checkbox"
    - "Wizard step inserted between email and portal via AdminStep union + getAdminSteps + adminStepToIndex"
key_files:
  created:
    - app/(auth)/setup/wizard/components/deadline-selection-step.tsx
  modified:
    - lib/reminders/queue-builder.ts
    - lib/onboarding/seed-defaults.ts
    - app/(auth)/setup/wizard/actions.ts
    - app/(auth)/setup/wizard/page.tsx
decisions:
  - "[D-32-02-01] activeTypeIds guard uses size > 0 check — if org has no selections yet (new org pre-seed), skip the filter rather than blocking all types"
  - "[D-32-02-02] saveOrgFilingTypeSelections upserts ALL filing types (active+inactive) in one call — ensures complete org selection state, not just additions"
  - "[D-32-02-03] DeadlineSelectionStep calls getFilingTypesForWizard on mount — server action, no prop drilling of all 14 types through wizard state"
  - "[D-32-02-04] collectCurrentState includes deadlineSelections for draft persistence across OAuth/Stripe redirects"
metrics:
  duration_seconds: 222
  completed_date: "2026-03-15"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 4
  files_created: 1
---

# Phase 32 Plan 02: Wire Deadline System into Queue Builder, Wizard, and Seeding Summary

Queue builder now filters by org-active filing types, wizard has a Deadlines step with grouped checkbox UI, and new orgs get default filing types activated via seedOrgDefaults.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Queue builder org-selection filter + seedOrgDefaults activation | a842724 | lib/reminders/queue-builder.ts, lib/onboarding/seed-defaults.ts |
| 2 | Wizard deadline selection step + page wiring + draft persistence | e738eec | actions.ts, deadline-selection-step.tsx, page.tsx |

## What Was Built

### Task 1: Queue Builder + Seed Defaults

**lib/reminders/queue-builder.ts:**
- `buildReminderQueue` fetches `org_filing_type_selections` for the org after loading assignments, builds an `activeTypeIds` Set, and skips any assignment whose `filing_type_id` is not in the active set. The guard is applied only at queue-build time — entries already in the queue are not disturbed.
- `rebuildQueueForClient` applies the same pattern using a separate `activeTypeIdsRebuild` Set scoped to the resolved org ID.
- Both functions skip the filter entirely if the org has no active selections yet (`activeTypeIds.size > 0` guard) — prevents blocking all queue entries for brand-new orgs before seeding runs.

**lib/onboarding/seed-defaults.ts:**
- `seedOrgDefaults` now has a Step 3 at the end: fetches all `filing_types` where `is_seeded_default = true`, then upserts into `org_filing_type_selections` with `is_active = true` and `onConflict: 'org_id,filing_type_id'` for idempotency.

### Task 2: Wizard Deadline Step

**app/(auth)/setup/wizard/actions.ts:**
- `SetupDraft` interface gains `deadlineSelections?: string[]`
- `getFilingTypesForWizard()` server action: fetches all filing types ordered by `sort_order`, returns lightweight shape (id, name, description, is_seeded_default, calculator_type, applicable_client_types)
- `saveOrgFilingTypeSelections(activeTypeIds)` server action: resolves org via admin client, fetches all filing types, upserts complete selection state (all types, active = whether in activeTypeIds set)

**app/(auth)/setup/wizard/components/deadline-selection-step.tsx:**
- New `"use client"` component with `DeadlineSelectionStepProps` (onComplete, onBack, initialSelection)
- On mount calls `getFilingTypesForWizard()`, shows loading spinner, then renders filing types grouped into four Card sections: Company Deadlines, VAT & MTD, Personal Tax, Payroll & Employment
- Default-checks seeded_default types (or restores from initialSelection if provided)
- Continue button calls `saveOrgFilingTypeSelections`, shows inline error on failure, calls `onComplete(selectedIds)` on success

**app/(auth)/setup/wizard/page.tsx:**
- `AdminStep` union adds `"deadlines"` between `"email"` and `"portal"`
- `getAdminSteps` inserts `{ label: "Deadlines" }` at index 5
- `adminStepToIndex`: portal-enabled map is now 10 steps (account=0 ... complete=9); portal-disabled is 8 steps (complete=7)
- `handleConfigComplete` now advances to `"deadlines"` instead of `"portal"` for new-admin users
- Portal step's `onBack` now calls `advanceToStep("deadlines")` instead of `advanceToStep("email")`
- `deadlineSelections` state added; hydrated in `hydrateFromDraft` from `draft.deadlineSelections`; included in `collectCurrentState`
- Deadlines step `onComplete` handler: updates `deadlineSelections` state, saves draft with `step: 'portal'` and `deadlineSelections`, then advances `adminStep` to `"portal"`
- Step-click navigation arrays updated to include `"deadlines"` at correct position

## Deviations from Plan

None — plan executed exactly as written, with one minor enhancement: the `activeTypeIds.size > 0` guard in the queue builder prevents inadvertently blocking all queue entries for orgs that have no `org_filing_type_selections` rows yet (e.g. new orgs before `seedOrgDefaults` runs). This is a correctness requirement, not a feature addition.

## Self-Check

Verified:
- `app/(auth)/setup/wizard/components/deadline-selection-step.tsx` created
- Commits a842724 and e738eec present in git log
- `npx tsc --noEmit` passes (no output = clean)
- `org_filing_type_selections` appears in queue-builder.ts
- `is_seeded_default` query appears in seed-defaults.ts
- `"deadlines"` step present in AdminStep union, getAdminSteps, adminStepToIndex, and render block
