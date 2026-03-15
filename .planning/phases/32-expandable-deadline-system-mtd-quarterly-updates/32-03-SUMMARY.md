---
phase: 32-expandable-deadline-system-mtd-quarterly-updates
plan: 03
subsystem: ui
tags: [react, supabase, server-actions, sheet, checkbox, filing-types]

requires:
  - phase: 32-01
    provides: org_filing_type_selections table, FilingTypeId union (14 IDs), OrgFilingTypeSelection interface

provides:
  - getOrgFilingTypeSelections server action (returns active/inactive rows per org)
  - getAllFilingTypes server action (returns all 14 filing types ordered by sort_order)
  - updateOrgFilingTypeSelections server action (admin-only upsert + revalidatePath)
  - ManageFilingTypesSheet component (Sheet with 4 category groups, Checkbox per type, useTransition save)
  - Deadlines page filtered to org-active types only
  - Manage Filing Types button in deadlines page header

affects:
  - 32-04 (wizard deadline-selection step — will use getAllFilingTypes + active type pattern)

tech-stack:
  added: []
  patterns:
    - Server action exports (getOrgFilingTypeSelections, getAllFilingTypes, updateOrgFilingTypeSelections) in app/actions/deadlines.ts
    - Page-level active-type filtering via orgSelections fallback pattern (show all if no selections yet)
    - ManageFilingTypesSheet: Sheet + grouped Checkbox UI + useTransition server action invocation

key-files:
  created:
    - app/actions/deadlines.ts
    - app/(dashboard)/deadlines/components/manage-filing-types-sheet.tsx
  modified:
    - app/(dashboard)/deadlines/page.tsx

key-decisions:
  - "Fallback to all types when orgSelections is empty — migration backfills defaults, but empty array means fresh org with no rows yet; showing all is safer than showing nothing"
  - "updateOrgFilingTypeSelections uses adminClient to fetch all filing_types — ensures complete list even if RLS on filing_types somehow limits rows; matches plan spec"
  - "ManageFilingTypesSheet resets selected state on each open — stale checkbox state from a previous aborted save would be confusing"

patterns-established:
  - "ManageFilingTypesSheet: Sheet component pattern for admin configuration modals — SheetTrigger inline button, SheetContent with flex-col layout, footer Save/Cancel pair"

requirements-completed:
  - DEADLINES-PAGE-MANAGE
  - ACTIVE-TYPES-DISPLAY

duration: 8min
completed: "2026-03-15"
---

# Phase 32 Plan 03: Filing Type Management — Summary

**Org-scoped filing type filtering on the Deadlines page with a Sheet-based management UI allowing admins to activate/deactivate any of the 14 filing types via grouped checkboxes.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-15T17:00:00Z
- **Completed:** 2026-03-15T17:08:00Z
- **Tasks:** 2
- **Files modified:** 3 (1 created server actions, 1 created sheet component, 1 updated page)

## Accomplishments

- Three server actions in `app/actions/deadlines.ts`: fetch selections, fetch all types, admin upsert with revalidation
- `ManageFilingTypesSheet` component with 4 category groups (Company Deadlines, VAT & MTD, Personal Tax, Payroll & Employment), checkboxes, useTransition save, inline error display
- Deadlines page filters to org-active types only; falls back to all types if no selection rows exist yet

## Task Commits

1. **Task 1: Server actions for org filing type selections** - `173de5e` (feat)
2. **Task 2: Deadlines page filtering + Manage Filing Types sheet** - `3f52099` (feat)

## Files Created/Modified

- `app/actions/deadlines.ts` — Three server actions: getOrgFilingTypeSelections, getAllFilingTypes, updateOrgFilingTypeSelections
- `app/(dashboard)/deadlines/components/manage-filing-types-sheet.tsx` — Sheet-based filing type management UI with grouped checkboxes
- `app/(dashboard)/deadlines/page.tsx` — Updated to fetch org selections, filter types, render ManageFilingTypesSheet

## Decisions Made

- Fallback to all types when orgSelections is empty — backfill migration covers existing orgs, but a fresh org with no rows should see all types rather than an empty page
- `updateOrgFilingTypeSelections` uses adminClient for the `filing_types` fetch — ensures the full catalogue is always available regardless of RLS state
- ManageFilingTypesSheet resets selected state whenever the sheet opens — prevents stale UI from a prior aborted save

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All server actions are exported and ready for the wizard's deadline-selection step (Plan 04/05)
- `ManageFilingTypesSheet` pattern can be replicated or extended in the wizard
- `activeTypeIds` derivation logic in `page.tsx` is the canonical reference for how to determine which types an org has enabled

---
*Phase: 32-expandable-deadline-system-mtd-quarterly-updates*
*Completed: 2026-03-15*
