---
phase: quick
plan: 002
type: execute
wave: 1
depends_on: []
files_modified:
  - app/(dashboard)/clients/components/client-table.tsx
autonomous: true
gap_closure: true

must_haves:
  truths:
    - "Import CSV button is visible on the clients page toolbar"
    - "Clicking Import CSV opens a dialog with file upload, drag-drop, and template download"
    - "After successful import, client table data refreshes to show updates"
  artifacts:
    - path: "app/(dashboard)/clients/components/client-table.tsx"
      provides: "CSV import button and dialog wiring"
      contains: "CsvImportButton"
  key_links:
    - from: "app/(dashboard)/clients/components/client-table.tsx"
      to: "app/(dashboard)/clients/components/csv-import-button.tsx"
      via: "import and render"
      pattern: "CsvImportButton"
    - from: "app/(dashboard)/clients/components/client-table.tsx"
      to: "app/(dashboard)/clients/components/csv-import-dialog.tsx"
      via: "import and render with state"
      pattern: "CsvImportDialog"
---

<objective>
Wire up the existing CsvImportButton and CsvImportDialog components into the clients page.

Purpose: UAT Test 24 failed because the CSV import components were built but never rendered.
The components (csv-import-button.tsx, csv-import-dialog.tsx) and backend (app/actions/csv.ts)
are fully implemented. Only the final wiring in client-table.tsx is missing.

Output: Import CSV button visible in the clients page toolbar, functional dialog, data refresh on import.
</objective>

<execution_context>
@C:\Users\ejsch\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\ejsch\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/debug/csv-import-btn-not-visible.md
@app/(dashboard)/clients/components/client-table.tsx
@app/(dashboard)/clients/components/csv-import-button.tsx
@app/(dashboard)/clients/components/csv-import-dialog.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Wire CsvImportButton and CsvImportDialog into ClientTable</name>
  <files>app/(dashboard)/clients/components/client-table.tsx</files>
  <action>
    In client-table.tsx, make these changes:

    1. ADD IMPORTS at the top (after existing component imports):
       ```
       import { CsvImportButton } from "./csv-import-button";
       import { CsvImportDialog } from "./csv-import-dialog";
       ```

    2. ADD STATE for CSV dialog (inside the ClientTable component, near the other useState calls):
       ```
       const [isCsvDialogOpen, setIsCsvDialogOpen] = useState(false);
       ```

    3. ADD DATA REFRESH HANDLER (after handleBulkUpdate, before columns definition):
       ```
       const handleImportComplete = useCallback(() => {
         // Refresh page data by reloading - server component will refetch
         window.location.reload();
       }, []);
       ```

    4. RENDER BUTTON in the toolbar area. In the "Search and Filters" div (the flex container on line ~343),
       add the CsvImportButton AFTER the clear filters button, at the end of the flex row, pushed to the right:
       ```
       {/* CSV Import */}
       <div className="sm:ml-auto">
         <CsvImportButton onClick={() => setIsCsvDialogOpen(true)} />
       </div>
       ```

    5. RENDER DIALOG at the bottom of the component JSX, after the BulkEditModal:
       ```
       {/* CSV Import Dialog */}
       <CsvImportDialog
         open={isCsvDialogOpen}
         onOpenChange={setIsCsvDialogOpen}
         onImportComplete={handleImportComplete}
       />
       ```

    Keep all existing code untouched. This is purely additive - import, state, render.
  </action>
  <verify>
    Run `npx next build` (or `npm run build`) and confirm no TypeScript errors.
    Visually confirm by checking the compiled output includes CsvImportButton and CsvImportDialog references.
  </verify>
  <done>
    - "Import CSV" button is visible in the clients page toolbar
    - Clicking the button opens the CSV import dialog
    - Dialog has file upload, drag-drop, template download
    - After successful import, page refreshes to show updated data
    - Build passes with no errors
  </done>
</task>

</tasks>

<verification>
1. `npm run build` completes without errors
2. In client-table.tsx: CsvImportButton is imported and rendered
3. In client-table.tsx: CsvImportDialog is imported and rendered with open/onOpenChange/onImportComplete props
4. In client-table.tsx: isCsvDialogOpen state exists
</verification>

<success_criteria>
UAT Test 24 passes: Import CSV button visible on clients page, clicking it opens the upload dialog.
</success_criteria>

<output>
After completion, create `.planning/quick/002-csv-import-wiring/002-SUMMARY.md`
</output>
