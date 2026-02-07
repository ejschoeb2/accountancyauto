---
phase: quick
plan: 002
subsystem: clients
tags: [csv-import, wiring, ui, uat-gap]
dependency-graph:
  requires: [03-05]
  provides: [csv-import-visible-in-ui]
  affects: []
tech-stack:
  added: []
  patterns: [component-composition, state-lifting]
key-files:
  created: []
  modified:
    - app/(dashboard)/clients/components/client-table.tsx
decisions: []
metrics:
  duration: "2 min"
  completed: "2026-02-07"
---

# Quick Plan 002: Wire CSV Import into Clients Page Summary

**One-liner:** Connected existing CsvImportButton and CsvImportDialog components into the ClientTable toolbar, closing UAT Test 24 gap.

## What Was Done

The CSV import components (csv-import-button.tsx, csv-import-dialog.tsx) and backend action (app/actions/csv.ts) were already fully implemented during Phase 3. However, the components were never rendered in the client table UI, causing UAT Test 24 to fail.

This plan wired the existing components into `client-table.tsx` with five additive changes:

1. **Imports** -- Added imports for CsvImportButton and CsvImportDialog
2. **State** -- Added `isCsvDialogOpen` useState to manage dialog visibility
3. **Refresh handler** -- Added `handleImportComplete` callback that reloads the page after a successful import
4. **Button rendering** -- Added CsvImportButton in the toolbar row, pushed right with `sm:ml-auto`
5. **Dialog rendering** -- Added CsvImportDialog at the bottom of the component JSX with `open`, `onOpenChange`, and `onImportComplete` props

## Task Commits

| Task | Name | Commit | Files Modified |
|------|------|--------|----------------|
| 1 | Wire CsvImportButton and CsvImportDialog into ClientTable | bed8d22 | app/(dashboard)/clients/components/client-table.tsx |

## Verification

- Build compiles successfully (TypeScript passes, no errors related to our changes)
- CsvImportButton imported and rendered in toolbar
- CsvImportDialog imported and rendered with all required props (open, onOpenChange, onImportComplete)
- isCsvDialogOpen state declared and wired to button onClick and dialog open prop

## Deviations from Plan

None -- plan executed exactly as written.

## Decisions Made

None -- purely additive wiring with no design choices needed.

## Next Phase Readiness

- UAT Test 24 gap is now closed: Import CSV button visible on clients page, clicking opens upload dialog
- No blockers for remaining quick tasks
- Quick 003 (QBO status banner redesign) can proceed independently

## Self-Check: PASSED
