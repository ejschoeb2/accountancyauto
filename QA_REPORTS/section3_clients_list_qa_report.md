# QA Report — Section 3: Clients List, Filters & Modals

**Date:** 2026-03-09  
**Tester:** Antigravity Browser QA Agent  
**URL Tested:** http://localhost:3000/clients  
**Login:** ejschoeb@gmail.com  

---

## Issues Found

| # | Severity | Feature | Action | Issue |
|---|----------|---------|--------|-------|
| 1 | 🟠 LOW | Sorting | Clicked column headers | Column headers are **not clickable for sorting**. Sorting is only available via the "Sort by" dropdown — no inline click-to-sort on table columns. |
| 2 | 🟠 LOW | Inline Editing | Pressed Escape in Edit Mode | Pressing Escape while in Edit Mode does **not exit** the edit mode — it only closes any open dropdowns. The user must click "Done" to exit. |
| 3 | 🟠 LOW | General (State) | Navigated away and back | **Row selection state (checkboxes) is not preserved** when navigating away from and back to `/clients`. |
| 4 | 🟠 LOW | General (Console) | Initial page load | **React Hydration Mismatch** warning in browser console: `A tree hydrated but some attributes of the server rendered HTML didn't match the client properties.` |

---

## Features Verified

| # | Feature | Check |
|---|---------|-------|
| 1 | Table Rendering | Clients table renders correctly with all 15 clients displayed |
| 2 | Table Columns | Columns visible: CLIENT NAME, CLIENT TYPE, VAT REGISTERED, VAT STAGGER, YEAR END, NEXT DEADLINE, DEADLINE TYPE, REMINDERS, STATUS — all clearly labelled |
| 3 | Table Data | All cells populated correctly; non-VAT clients show "—" for VAT-specific fields |
| 4 | Pagination / Count | "Showing 15 of 15 clients" header count is accurate and up to date |
| 5 | Sorting (Dropdown) | "Sort by" dropdown works — tested Name (A-Z) and Name (Z-A); data re-orders correctly |
| 6 | Search Filter | Search input correctly filters clients by company name in real time |
| 7 | Clear Search | Clearing the search input restores the full list |
| 8 | Status Filter | "Filter" button opens a status filter panel listing available statuses (Overdue, Critical, Approaching, Scheduled, Records Received, etc.) |
| 9 | Status Filter — Overdue | Filtering by "Overdue" shows only overdue clients correctly |
| 10 | Clear Filters | "Clear all filters" resets the table to its full unfiltered state |
| 11 | Combined Filters | Search + status filters combine correctly and return the correct results |
| 12 | Empty State | Filtering with no matches returns a clear empty-state message |
| 13 | Row Checkboxes | Individual row checkboxes select rows with clear visual highlight |
| 14 | Select All | "Select All" checkbox in header selects all visible rows |
| 15 | Bulk Actions Toolbar | Bulk actions toolbar appears at the bottom when rows are selected; shows: **Send Bulk Email**, **Delete Clients**, **Clear** |
| 16 | Deselect / Clear | Clicking "Clear" in the toolbar deselects all rows and hides the toolbar |
| 17 | Edit Mode | "Edit" button toggles the table into Edit Mode with inline inputs and comboboxes |
| 18 | Edit Mode — Exit | "Done" button exits Edit Mode cleanly |
| 19 | Inline Edit Inputs | Inline status comboboxes and other editable cells render correctly in Edit Mode |
| 20 | Add Client Dialog | "Add Client" button opens a dialog with clearly labelled, required fields (marked with *) and functional Cancel/Submit buttons |
| 21 | Add Client — Cancel | Cancel closes the dialog cleanly; no console errors |
| 22 | Add Client — Reopen | Re-opening the dialog after cancel shows cleared fields |
| 23 | CSV Import Dialog | "Import CSV" button opens a dialog with a file upload area |
| 24 | CSV Template Download | "Download template" link is present in the Import CSV dialog |
| 25 | CSV Dialog — Close | Import CSV dialog closes cleanly |
| 26 | Send Bulk Email Modal | "Send Bulk Email" (from bulk toolbar) opens a modal showing recipient count and a template selector |
| 27 | Send Email — Close | Email modal closes cleanly |
| 28 | Page Header | Shows "Clients" title and "Showing 15 of 15 clients" count accurately |
| 29 | Action Buttons | Add Client, Import CSV, Edit, Filter, Sort By — all buttons visible and properly styled |
| 30 | Responsive — Mobile | At 375px width, table adapts using horizontal scrolling; navigation collapses to hamburger menu |
| 31 | Responsive — Tablet | At 768px, layout adapts without major issues |
| 32 | Navigation State | Navigating away and back preserves filters and sort (search/filter dropdowns) but not row selection |

---

## Console Errors

| Type | Message |
|------|---------|
| React Warning | `A tree hydrated but some attributes of the server rendered HTML didn't match the client properties.` (Hydration Mismatch) |

---

## Additional Observations

| # | Observation |
|---|-------------|
| 1 | The initial login process displayed a persistent "Signing in..." state for an extended period. The session was established, but the UX delay is notable. |
| 2 | A **"1 Issue" / "2 Issues"** red notification pill (bottom-left corner) appeared during edit mode interactions — likely representing validation warnings for specific client records (e.g., missing required fields). This is a useful signal but its origin and contents could be more obvious to the user. |
| 3 | The table has two distinct views toggled at the top-right: **Client Data** and **Client Deadlines** — a useful organisation that separates client information from deadline management. |
| 4 | Status badges use a clear colour-coded system: Overdue (red), Approaching (amber), Scheduled (blue), Records Received (purple) — good traffic-light UX. |
| 5 | Column sorting is only available via the dropdown, not by clicking column headers. This deviates from the standard table UX pattern users expect. While not technically broken, it may reduce discoverability. |

---

*Report generated by Antigravity QA Agent — Section 3 complete.*
