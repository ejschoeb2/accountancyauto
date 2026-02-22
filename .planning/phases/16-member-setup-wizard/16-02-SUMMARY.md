---
phase: 16-member-setup-wizard
plan: 02
subsystem: ui
tags: [react, csv, xlsx, papaparse, client-component, wizard]

# Dependency graph
requires:
  - phase: 16-member-setup-wizard-plan-01
    provides: wizard directory structure, member setup complete flag
provides:
  - CsvImportStep full-page component at app/(auth)/setup/wizard/components/csv-import-step.tsx
  - Full CSV import state machine (upload -> mapping -> edit-data -> importing -> results) without Dialog wrapper
  - onComplete() prop pattern for wizard integration
affects:
  - 16-03 (wizard page that embeds this step)
  - 16-04 (any wizard orchestration that routes through CSV import)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Full-page extraction pattern: copy dialog logic into standalone component with div wrappers instead of Dialog/DialogContent"
    - "Wizard step interface: single onComplete() prop replacing open/onOpenChange; wizard controls mounting/unmounting"
    - "Skip-for-now pattern on upload state: ButtonBase variant=muted calls onComplete() to let user bypass optional import"

key-files:
  created:
    - app/(auth)/setup/wizard/components/csv-import-step.tsx
  modified: []

key-decisions:
  - "[D-16-02-01] CsvImportStep created as extraction (not shared component) — original dialog kept 100% unchanged because it serves different context (clients page vs wizard)"
  - "[D-16-02-02] Skip for now on upload state only — mapping/edit-data have Back navigation instead; users who progress past upload are committed to finishing the import flow"
  - "[D-16-02-03] Results state button reads 'Next: Configure' — contextual label tells user what comes next in the wizard rather than generic 'Done'"
  - "[D-16-02-04] EditableCell imported via @/ alias path from dashboard — reuses existing component rather than duplicating"

patterns-established:
  - "Dialog-to-page extraction: Replace DialogContent wrapper with <div className='space-y-6'>, DialogHeader with <div className='space-y-1'> h2+p, DialogFooter with <div className='flex justify-end gap-3'>"

requirements-completed:
  - SETUP-WIZARD

# Metrics
duration: 3min
completed: 2026-02-22
---

# Phase 16 Plan 02: CsvImportStep Full-Page Component Summary

**Full-page CSV import step component extracted from CsvImportDialog — runs upload/mapping/edit-data/importing/results state machine inside div wrappers with onComplete() exit prop**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-22T20:54:54Z
- **Completed:** 2026-02-22T20:57:54Z
- **Tasks:** 1
- **Files modified:** 1 (created)

## Accomplishments
- Created `CsvImportStep` at `app/(auth)/setup/wizard/components/csv-import-step.tsx` (990 lines)
- Duplicated all parsing, mapping, and import logic from `CsvImportDialog` without Dialog-specific imports
- Implemented wizard-specific UX: "Skip for now" on upload, no Cancel on mapping/edit-data, "Next: Configure" on results
- `csv-import-dialog.tsx` left completely unmodified

## Task Commits

Each task was committed atomically:

1. **Task 1: Create CsvImportStep component (full-page extraction from dialog)** - `5a6c1e1` (feat)

## Files Created/Modified
- `app/(auth)/setup/wizard/components/csv-import-step.tsx` - Full-page CSV import wizard step; CsvImportStep component with onComplete() prop; complete state machine upload/mapping/edit-data/importing/results; no Dialog imports

## Decisions Made
- EditableCell imported via `@/app/(dashboard)/clients/components/editable-cell` alias — reuses existing inline-editable cell component rather than duplicating
- Skip for now only on upload state — once user selects a file and advances, they use Back navigation to go backward; avoids data loss confusion
- "Next: Configure" button label on results state — contextual to wizard flow

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- CsvImportStep is ready to be embedded in the wizard page (Plan 03)
- Component accepts `onComplete: () => void` — wizard page calls next step after this resolves
- All imports use `@/` aliases — no relative path issues when consumed from wizard page

---
*Phase: 16-member-setup-wizard*
*Completed: 2026-02-22*
