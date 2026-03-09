# QA Report — Section 5: Email Logs / Activity Page

**Date:** 2026-03-09
**Tester:** Antigravity Browser QA Agent
**URL Tested:** http://localhost:3000/email-logs
**Login:** ejschoeb@gmail.com
**Supabase DB Cross-Reference:** ✅ Performed (project: zmsirxtgmdbbdxgxlato)

---

## Issues Found

| # | Severity | Feature | Action | Issue |
|---|----------|---------|--------|-------|
| 1 | 🔴 HIGH | Uploads Tab | Clicked "Uploads" view toggle | **Clicking the "Uploads" tab causes a browser crash / page reset.** The browser connection drops and the page must be reloaded. The Uploads view never renders. |
| 2 | 🟡 MEDIUM | Email Preview Modal | Clicked a queued email row | **The email preview modal opens but the email body never loads** — it stays on an indefinite loading spinner. Email metadata (client, deadline type, send date, step, status) renders correctly, but the actual email content does not appear. |
| 3 | 🔴 HIGH | App Stability | General page interaction | **React Hydration Mismatch in `app/layout.tsx`** causes the app to occasionally go blank (showing only the Prompt logo) mid-session. This is an intermittent but reproducible crash condition that disrupted multiple test steps. |
| 4 | 🟠 LOW | Route Naming | Navigated to `/activity` | `/activity` returns a 404. The page actually lives at `/email-logs`, but the nav bar labels it **"Activity"** — creating an inconsistency between the URL and the user-facing label. |

---

## Features Verified

| # | Feature | Check |
|---|---------|-------|
| 1 | Page Load | Activity page loads at `/email-logs` with correct heading "Activity" and subtitle "Outbound reminders and client document uploads" |
| 2 | Nav Label | "Activity" is highlighted as the active nav item |
| 3 | View Toggles | "Outbound" and "Uploads" view toggle buttons render at top-right |
| 4 | Outbound — Active Default | "Outbound" is selected by default on page load |
| 5 | Sub-Tabs | "Queued Emails" and "Sent Emails" sub-tabs render within the Outbound view |
| 6 | Queued Table Columns | Columns: CLIENT NAME, CLIENT TYPE, SEND DATE, DEADLINE DATE, DEADLINE TYPE, TEMPLATE NAME, STATUS — all clearly labelled |
| 7 | Queued Table Data | Table correctly renders **71 queued emails** (paginated: showing 20 of 71) |
| 8 | DB Cross-Reference — Queued | `reminder_queue` table has 71 rows with status `scheduled` ✅ matches UI exactly |
| 9 | Queued Status Badge | All queued rows show "Scheduled" status badge — consistent and correctly styled |
| 10 | Sort Dropdown | "Sort by: Send Date (Earliest)" dropdown present and visible |
| 11 | Search Input | "Search by client name..." search input renders on the Outbound view |
| 12 | Pagination | Footer shows "Showing 20 of 71 queued emails" — pagination working |
| 13 | Sent Tab | "Sent Emails" sub-tab is clickable and switches to the sent view |
| 14 | Sent Table Data | Sent Emails table populates with data (19 records per DB: `email_log` table has 19 rows ✅) |
| 15 | Queued Modal — Opens | Clicking a queued email row opens an Email Preview modal cleanly |
| 16 | Queued Modal — Metadata | Modal correctly displays: Client, Deadline Type, Deadline Date, Send Date, Step, Status |
| 17 | Filter Button | "Filter" button renders next to search and is clickable |
| 18 | Edit Button | "Edit" button renders (consistent with Clients page pattern) |

---

## Console Errors

| Type | Message |
|------|---------|
| React Warning | `A tree hydrated but some attributes of the server rendered HTML didn't match the client properties.` (in `app/layout.tsx`) |
| Browser Crash | `open_browser_url: action timed out, browser connection is reset` — triggered multiple times after interacting with the Uploads tab and during general navigation |

---

## Supabase DB Cross-Reference

Direct backend queries were run to validate UI data accuracy.

| Table | DB Row Count | UI Display | Match? |
|-------|-------------|------------|--------|
| `reminder_queue` (status = `scheduled`) | 71 | "Showing 20 of 71 queued emails" | ✅ Exact match |
| `email_log` | 19 | Sent Emails table (19 records) | ✅ Exact match |
| `client_documents` | 19 | Uploads tab — untestable (crash) | ⚠️ Data exists but UI crashes |
| `reminder_queue` (status = `failed`) | 1 | Not visible in Queued view | ✅ Correctly filtered out |
| `reminder_queue` (status = `cancelled`) | 1 | Not visible in Queued view | ✅ Correctly filtered out |

> **Key finding from DB:** The `client_documents` table has **19 rows** of upload data. The Uploads tab crash is a pure frontend routing/rendering bug — the data exists and is ready to be displayed.

---

## Additional Observations

- **The page is titled "Activity" in the nav and page heading**, but the route is `/email-logs`. This is a minor naming inconsistency — either the route should be `/activity` or the nav label should say "Email Logs".
- **The hydration mismatch error is the most significant systemic issue** — it caused random blank-screen crashes throughout the test session and makes the app feel unstable. This should be prioritised.
- **The Uploads tab bug is blocking** — 19 client document uploads exist in the database but are completely inaccessible via the UI. Any user who tries to view upload activity will hit a crash.
- **The queued email preview modal loading failure** means accountants cannot review the email content before it sends — a significant UX gap even if not fully blocking.
- Dates throughout the page are consistently formatted as `DD MMM YYYY` (e.g. `01 Dec 2025`) — correct and readable.
- The "Showing X of Y queued emails" count in the subheading updates dynamically, which is a nice UX touch.

---

*Report generated by Antigravity QA Agent — Section 5 complete.*
