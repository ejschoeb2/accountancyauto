# SECTION 4: Client Detail Page QA Report
*Tested: 2026-03-03 | Tester: Antigravity QA Agent | App: http://localhost:3000/clients/[id]*

---

## ISSUES FOUND

| # | Severity | Section | Issue |
|---|----------|---------|-------|
| 1 | 🔴 HIGH | Document Loading | **`500 Internal Server Error` on all document fetch requests.** All `GET /api/clients/[id]/documents?filing_type_id=...` requests return 500. Document sections fail to load or are stuck in an empty/error state for every filing type. This is a backend API failure. |
| 2 | 🟡 MEDIUM | Audit Log | **Audit Log section is completely missing from the client detail page.** The task spec requires an audit log showing timestamped entries. It was not found anywhere on the page — not in a tab, section, or panel. |
| 3 | 🟡 MEDIUM | Pause Reminders | **"Pause Reminders" toggle is absent.** The toggle is listed as a required control on the client detail page but could not be found anywhere in the page layout. |
| 4 | 🟡 MEDIUM | Responsive (375px) | **Mobile layout has header nav overflow.** At 375px viewport, the navigation links (Dashboard, Clients, Reminder Schedules, Email Templates, Activity) overflow/clip the header — later nav items are cut off. |
| 5 | 🟡 MEDIUM | Responsive (375px) | **"Generate Upload Link" button is partially truncated on mobile.** At 375px, the button label is clipped and not fully readable. |
| 6 | 🟠 LOW | Editable Fields | **Escape key does not cancel edit mode.** Pressing `Esc` while a field is in edit mode does not cancel and restore the read-only view — users must manually click the "Cancel" button. |
| 7 | 🟠 LOW | Editable Fields | **No individual hover-state or pencil icon on editable fields.** Fields are only revealed as editable after clicking the global "Edit" button — there is no per-field affordance (hover border, pencil icon) to signal editability before entering edit mode. |
| 8 | 🟠 LOW | Checklist | **No visual distinction between mandatory and optional document types** in the "Configure" checklist section. All items appear the same regardless of requirement level. |

---

## SECTIONS VERIFIED

| Section | Check |
|---------|-------|
| **Header & Basic Info** | ✅ Client name displayed prominently as page header (e.g. "Acme Ltd") |
| **Header & Basic Info** | ✅ Client type badge visible (e.g. "Limited Company", "Partnership") |
| **Header & Basic Info** | ✅ "Go back" button correctly navigates to /clients list |
| **Header & Basic Info** | ✅ Contact email and phone fields displayed |
| **Header & Basic Info** | ✅ Key accounting dates shown: Year-End Date, VAT Stagger Group |
| **Editable Fields** | ✅ Global "Edit" button present and activates edit mode |
| **Editable Fields** | ✅ Fields become editable (inputs appear) after clicking Edit button |
| **Editable Fields** | ✅ "Cancel" button correctly exits edit mode without saving |
| **Editable Fields** | ✅ Client Type selector renders and opens dropdown with valid options |
| **Editable Fields** | ✅ VAT Scheme selector renders and opens dropdown with options |
| **Editable Fields** | ✅ Date fields (Year-End) render a date picker on click |
| **Filing Management** | ✅ Filing Management section renders with heading and description |
| **Filing Management** | ✅ Multiple filing types shown: Corporation Tax Payment, CT600 Filing, VAT Return, Companies House Accounts |
| **Filing Management** | ✅ Each filing shows: name, deadline date (e.g. "Deadline: 31 March 2027"), and status badge (Completed / Scheduled) |
| **Filing Management** | ✅ Document count progress shown (e.g. "0 of 8 documents received") |
| **Filing Management** | ✅ "Generate Upload Link", "Override Deadline", and "Configure" buttons present on each filing card |
| **Filing Management** | ✅ Empty state ("No documents yet — use Configure to set up a checklist.") renders cleanly |
| **Checklist Configuration** | ✅ "Configure" button opens an inline checklist view showing document types with on/off toggles |
| **Portal Link** | ✅ "Generate Upload Link" successfully generates a unique portal URL |
| **Portal Link** | ✅ Generated link displayed in a text input field for readability |
| **Portal Link** | ✅ Expiry info shown below the link ("Expires 10 March 2026. Generating a new link will revoke this one.") |
| **Portal Link** | ✅ Copy button present and triggers a "Portal link copied" toast notification |
| **Portal Link** | ✅ Generated token URL is a valid, long hash-based URL (not a plain ID) |
| **Email History** | ✅ "Email Log" section renders a table of upcoming/scheduled emails |
| **Email History** | ✅ "No sent emails yet" empty state renders correctly when no emails have been sent |
| **DSAR Export** | ✅ "Export all documents" button exists in the Compliance section at the bottom of the page |
| **Navigation** | ✅ Navigating back to /clients and opening a second client (Smith & Jones Partnership) loads correctly with different data |
| **Loading States** | ✅ Skeleton/loading states briefly visible during data fetch on page load |

---

## CONSOLE ERRORS

| Type | Detail | Severity |
|------|--------|----------|
| **500 Internal Server Error** | `GET http://localhost:3000/api/clients/[id]/documents?filing_type_id=<id>` — Recurring for all document categories / filing types | 🔴 HIGH |

No other JavaScript errors, React warnings, or failed network requests were observed beyond the document API failures.

---

## ADDITIONAL OBSERVATIONS

| # | Observation |
|---|-------------|
| 1 | **Page title is generic.** The browser tab always reads "Prompt" regardless of which client is open. Should ideally be "Acme Ltd \| Prompt" or similar for bookmarking and multi-tab usability. |
| 2 | **Filing statuses shown as "Completed" even when 0 documents received.** The status toggle on filing cards appears to be manually set — it does not automatically reflect document receipt progress. Worth confirming this is intentional (manual status) vs. a sync issue. |
| 3 | **Portal link expiry of ~7 days may be too short.** "Expires 10 March 2026" was shown when tested on 2026-03-03. Consider whether accountants need longer-lived links or a configurable expiry window. |
| 4 | **"Configure" checklist panel opens inline.** Clicking Configure expands a panel within the filing card rather than a modal — clean UX choice but may feel cramped with many document types. |
| 5 | **No "Add Note" or internal notes section visible.** Many CRM-style client detail pages include a notes section. Not necessarily a bug, but worth checking against product spec. |
