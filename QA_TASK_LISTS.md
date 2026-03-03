# QA Deep-Dive Task Lists

Each section below is a self-contained task list designed to be given to a browser QA agent independently. Run them one at a time for thorough coverage.

Previous issues from QA_AUDIT_LOG.md are already being fixed — focus on finding NEW issues.

---

## REPORTING STANDARD

After completing any section, the QA agent MUST:
1. **Save a report** to `QA_REPORTS/section<N>_<slug>_qa_report.md` inside this project directory.
   - Example: `QA_REPORTS/section4_client_detail_qa_report.md`
   - The report must follow the standard format: Issues Found table, Sections Verified table, Console Errors table, Additional Observations table.
   - Severity labels: 🔴 HIGH, 🟡 MEDIUM, 🟠 LOW.
2. **Do not save reports** to Antigravity's artifact/brain directory — save them in the project folder so they stay with the codebase.
3. The Final Report block inside each section below already contains the required format — use it as the template.

---

## SECTION COMPLETION STATUS

| Section | Topic | Status | Report |
|---------|-------|--------|--------|
| Section 1 | Setup Wizard Deep Dive | ✅ COMPLETE | [section1_wizard_qa_report.md](QA_REPORTS/section1_wizard_qa_report.md) |
| Section 2 | Dashboard Deep Dive | ⬜ TODO | — |
| Section 3 | Clients List, Filters & Modals | ⬜ TODO | — |
| Section 4 | Client Detail Page Deep Dive | ✅ COMPLETE | [section4_client_detail_qa_report.md](QA_REPORTS/section4_client_detail_qa_report.md) |
| Section 5 | Email Logs / Activity Page | ⬜ TODO | — |
| Section 6 | Schedules & Templates | ⬜ TODO | — |
| Section 7 | Settings Page Deep Dive | ⬜ TODO | — |
| Section 8 | Client Portal Deep Dive | ⬜ TODO | — |
| Section 9 | Marketing & Public Pages | ⬜ TODO | — |
| Section 10 | Billing & Admin Pages | ⬜ TODO | — |

---

## SECTION 1: Setup Wizard Deep Dive

```
You are a QA testing agent. Your job is to systematically test the setup wizard
at http://localhost:3000/setup/wizard and log any errors, broken states, or
unexpected behavior.

IMPORTANT RULES:
- Do NOT submit any forms or click any destructive buttons.
- You ARE allowed to type into form fields, select options, and click
  navigation buttons (Next, Back) to test the wizard flow.
- Do NOT click "Create Organisation", "Complete Setup", or any final submit action.
- Log issues in this format:
    [ERROR] Step: <step name> | Action: <what you did> | Issue: <what went wrong>
    [OK] Step: <step name> | Check: <what you verified>

SETUP: Log in first at /login, then navigate to /setup/wizard.
If wizard is already completed, you may need to note that and skip to observable steps.

TASK LIST:

--- STEP 1: Firm Details ---
1. Does the firm name input render with proper label and placeholder?
2. Type a firm name. Does the URL slug auto-generate below it?
3. Does the slug availability checker fire after you stop typing? Does it show
   a loading spinner, then a success/error state?
4. Try typing special characters in the firm name (e.g. "O'Brien & Co.").
   Does the slug sanitise properly? Any JS errors?
5. Clear the firm name entirely. Is there a validation message or visual indicator?
6. Does the Back button do anything on Step 1? (It shouldn't — check for crashes.)
7. Click Next without filling in the firm name. Is the button disabled, or does
   validation fire? Is the error message clear?

--- STEP 2: Plan Selection ---
8. Do all plan tiers render? (Free, Solo, Starter, Practice, Firm)
9. Click each plan card. Does the selected state visually update (border, check, highlight)?
10. Is the current selection preserved if you click Back then Next again?
11. Does each plan card show: name, price, client limit, and feature list?
12. Are the prices formatted correctly (e.g. "£X/month")?
13. Does the "Free" plan show "£0" or "Free" consistently?
14. Is the Next button enabled only when a plan is selected?
15. Check for any layout issues — do all cards align properly at current viewport?
16. Resize the browser to mobile width (~375px). Do the plan cards stack vertically
    without overlapping or text truncation?

--- STEP 3: Import Clients (CSV) ---
17. Does the CSV import step show an upload area or drag-drop zone?
18. Is there a "Skip" or "Next" option to bypass import? It should be optional.
19. If a sample/template CSV download link exists, does it work?
20. Does the upload area show accepted file types (.csv)?
21. If you can upload a test CSV, does the preview table render with editable rows?
22. Are there clear column headers matching expected fields?
23. Is there an "Add Row" or similar control for manual entry?
24. Check the empty state — what shows if no file is uploaded and no rows added?

--- STEP 4: Email Setup ---
25. Does the email setup step render all sub-steps? (There should be multiple
    sub-steps for configuring the email identity.)
26. Is there a field for sender name and reply-to email?
27. Does the DNS/domain verification section show status indicators?
28. Are there clear instructions for what the user needs to do?
29. If domain setup is not yet complete, does the step show an appropriate
    pending/incomplete state?
30. Can you navigate sub-steps within this step without console errors?
31. Does the step handle the case where no Postmark credentials are configured?

--- STEP 5: Client Portal ---
32. Does the portal step render a clear enable/disable choice?
33. Is there explanatory text about what the portal does?
34. Does selecting "Enable" vs "Disable" visually update?
35. Does the choice persist if you navigate Back then return?

--- STEP 6: Storage Setup ---
36. Does the storage step show options for cloud storage providers?
37. Are Google Drive, OneDrive, and Dropbox all shown as options?
38. Does each provider show a connect button or status?
39. Is there a "Skip" option for users who don't want cloud storage?
40. Check that clicking a connect button does NOT crash the page.
    (OAuth buttons may redirect — just verify no JS errors before redirect.)

--- STEP 7: Completion ---
41. If you can reach the completion step, does it show a success message?
42. Is there a clear CTA to go to the dashboard?

--- CROSS-CUTTING WIZARD CHECKS ---
43. Does the stepper/progress indicator at the top accurately reflect the current step?
44. Does the stepper show step names or numbers?
45. Are completed steps visually distinct from upcoming steps?
46. Does the Back button work correctly on every step (returns to previous step,
    preserves entered data)?
47. Is keyboard navigation possible? Can you Tab through form fields?
48. Check the browser console on EVERY step transition for React errors,
    hydration warnings, or failed network requests.
49. Does the wizard layout look correct on mobile (375px width)?
50. Does the wizard layout look correct on tablet (768px width)?

--- FINAL REPORT ---
Produce a summary with:
  ISSUES FOUND: all [ERROR] entries with severity (HIGH/MEDIUM/LOW)
  STEPS VERIFIED: all [OK] entries
  CONSOLE ERRORS: any JS/React errors observed
  ADDITIONAL OBSERVATIONS: anything noteworthy that is not strictly a bug

Save the report to: QA_REPORTS/section1_wizard_qa_report.md
Use the standard format: Issues Found table | Sections Verified table | Console Errors table | Additional Observations table.
Mark Section 1 as ✅ COMPLETE in QA_TASK_LISTS.md.
```

---

## SECTION 2: Dashboard Deep Dive

```
You are a QA testing agent. Thoroughly test the dashboard at
http://localhost:3000/dashboard.

IMPORTANT RULES:
- Do NOT click any destructive buttons or submit forms.
- You may click tabs, filters, and interactive elements to test them.
- Log issues in this format:
    [ERROR] Component: <name> | Action: <what you did> | Issue: <what went wrong>
    [OK] Component: <name> | Check: <what you verified>

SETUP: Log in at /login, then navigate to /dashboard.

TASK LIST:

--- SUMMARY CARDS ---
1. Do all summary metric cards render? Expected: overdue count, critical count,
   approaching count, emails sent today, etc.
2. Do the cards show numeric values (not "undefined", "NaN", or blank)?
3. Do the cards use the traffic light colour system? (Red for overdue,
   amber for approaching, green for on-track)
4. Click each summary card if they are clickable. Do they navigate somewhere
   sensible or show a tooltip? Any crashes?
5. Resize to mobile — do the cards stack/wrap without overlapping?

--- DASHBOARD TABS ---
6. Are there tabs on the dashboard? If so, list all tab names.
7. Click each tab. Does content switch without console errors?
8. Does the selected tab state persist visually (active highlight)?

--- UPCOMING DEADLINES ---
9. Does the upcoming deadlines section render a list or table?
10. Are deadline dates formatted correctly (UK format: DD/MM/YYYY or similar)?
11. Is there a sort control? Does sorting work without errors?
12. Does the empty state render cleanly if there are no upcoming deadlines?
13. Do deadline items show client name, filing type, and due date?
14. Are overdue deadlines visually distinguished (red text, badge, etc.)?

--- STATUS DISTRIBUTION ---
15. Is there a chart or visual showing client status distribution?
16. Does it render without errors? (Check console for canvas/SVG errors.)
17. Does hovering over chart segments show tooltips with values?

--- WORKLOAD FORECAST ---
18. Does the workload forecast section render?
19. Does it show future months with expected reminder volumes?
20. Is the chart/visual responsive on mobile?

--- ALERT FEED ---
21. Does the alert feed / recent activity section render?
22. Are entries timestamped with readable dates?
23. Does the empty state render gracefully?

--- AUDIT LOG CARD ---
24. Does the audit log card show recent actions?
25. Are log entries formatted with action type, timestamp, and context?

--- ROLLOVER WIDGET ---
26. Is there a tax year rollover widget? Does it render?
27. Does it show the current tax year and any rollover actions?
28. If rollover is not available, is there an appropriate disabled/info state?

--- HELP WIDGET ---
29. Is there a help widget or contextual help? Does it render?
30. Does clicking it open help content or link somewhere?

--- GENERAL CHECKS ---
31. Check the console for ANY errors on initial dashboard load.
32. Check for any network request failures (red entries in Network tab).
33. Resize to mobile (375px) — does the entire dashboard layout adapt?
34. Resize to tablet (768px) — any layout breaks?
35. Does the page load in a reasonable time (<3 seconds)?
36. Is there a loading/skeleton state shown while data fetches?

--- FINAL REPORT ---
Produce a summary with:
  ISSUES FOUND: all [ERROR] entries with severity (HIGH/MEDIUM/LOW)
  COMPONENTS VERIFIED: all [OK] entries
  CONSOLE ERRORS: any JS/React errors observed
  ADDITIONAL OBSERVATIONS: anything noteworthy that is not strictly a bug

Save the report to: QA_REPORTS/section2_dashboard_qa_report.md
Use the standard format: Issues Found table | Components Verified table | Console Errors table | Additional Observations table.
Mark Section 2 as ✅ COMPLETE in QA_TASK_LISTS.md.
```

---

## SECTION 3: Clients List, Filters & Modals

```
You are a QA testing agent. Thoroughly test the clients list page at
http://localhost:3000/clients and all its interactive features.

IMPORTANT RULES:
- Do NOT submit any forms, delete clients, or make data changes.
- You ARE allowed to open modals, type in search/filter fields, select table rows,
  and interact with all read-only controls.
- Close any modal you open WITHOUT submitting it.
- Log issues in this format:
    [ERROR] Feature: <name> | Action: <what you did> | Issue: <what went wrong>
    [OK] Feature: <name> | Check: <what you verified>

SETUP: Log in at /login, then navigate to /clients.

TASK LIST:

--- TABLE RENDERING ---
1. Does the clients table render with data?
2. List all visible columns. Are headers clear and properly labelled?
3. Are all table cells populated (no "undefined", blank cells where data is expected)?
4. Does the table show a reasonable number of rows? Is there pagination?
5. If there are many clients, does scrolling work smoothly?

--- SORTING ---
6. Click each sortable column header. Does the sort indicator (arrow) appear?
7. Click the same header again — does it toggle between ascending and descending?
8. Does the data actually re-order correctly?
9. Are there any console errors when sorting?

--- FILTERING ---
10. Is there a search/filter input? Type a client name — does the list filter?
11. Clear the search — does the full list return?
12. Is there a status filter dropdown? Open it — list all available statuses.
13. Select a status filter — does the table filter correctly?
14. Select "Overdue" if available — does it show only overdue clients?
15. Click "Clear filters" if available — does it reset all filters?
16. Apply multiple filters together (search + status). Do they combine correctly?
17. Apply a filter that returns zero results. Is the empty state clear?

--- ROW SELECTION & BULK ACTIONS ---
18. Are there checkboxes on each row? Click one — does it select the row visually?
19. Is there a "Select All" checkbox in the header? Does it select all visible rows?
20. With rows selected, does a bulk actions toolbar appear at the bottom?
21. What actions are shown in the toolbar? List them. (Do NOT click destructive ones.)
22. Deselect all rows — does the toolbar disappear?

--- INLINE EDITING ---
23. Are there any editable cells in the table? (Look for cells that change
    appearance on hover — cursor change, border, pencil icon.)
24. Click an editable cell — does an input/editor appear inline?
25. Press Escape — does it cancel without saving?
26. Check for console errors during inline edit interactions.

--- CREATE CLIENT DIALOG ---
27. Find and click the "Add Client" or "New Client" button. Does a dialog open?
28. List all fields in the dialog. Are labels clear?
29. Are required fields marked with an asterisk or similar indicator?
30. Does the dialog have Cancel and Submit buttons?
31. Click Cancel — does the dialog close cleanly without console errors?
32. Re-open the dialog — are previous field entries cleared?

--- CSV IMPORT DIALOG ---
33. Find and click the "Import" or CSV import button. Does a dialog/modal open?
34. Does it show a file upload area?
35. Is there a template download link? Does it download a valid CSV file?
36. Close the dialog — does it close cleanly?

--- SEND EMAIL MODAL ---
37. If there's a "Send Email" or "Email" button (in bulk toolbar or row actions),
    click it. Does a modal open?
38. Does the modal show recipient info and a template selector?
39. Close the modal — does it close cleanly?

--- PAGE HEADER ---
40. Does the page header show "Clients" title and client count?
41. Are action buttons (Add, Import, etc.) visible and properly styled?

--- RESPONSIVE ---
42. Resize to mobile (375px). Does the table adapt? (Horizontal scroll, card view,
    or hidden columns?)
43. Are action buttons still accessible on mobile?
44. Resize to tablet (768px). Any layout issues?

--- GENERAL ---
45. Check the console for errors on initial page load.
46. Check for loading states — is there a skeleton/spinner while data loads?
47. Navigate away and back — does the page restore state (filters, sort)?

--- FINAL REPORT ---
Produce a summary with:
  ISSUES FOUND: all [ERROR] entries with severity (HIGH/MEDIUM/LOW)
  FEATURES VERIFIED: all [OK] entries
  CONSOLE ERRORS: any JS/React errors observed
  ADDITIONAL OBSERVATIONS: anything noteworthy that is not strictly a bug

Save the report to: QA_REPORTS/section3_clients_list_qa_report.md
Use the standard format: Issues Found table | Features Verified table | Console Errors table | Additional Observations table.
Mark Section 3 as ✅ COMPLETE in QA_TASK_LISTS.md.
```

---

## SECTION 4: Client Detail Page Deep Dive

```
You are a QA testing agent. Thoroughly test the client detail page at
http://localhost:3000/clients/[id]. Pick the first client from /clients.

IMPORTANT RULES:
- Do NOT save any changes, delete anything, or trigger emails.
- You ARE allowed to open editable fields, click tabs, and interact with controls
  to observe their behavior — just don't submit.
- Log issues in this format:
    [ERROR] Section: <name> | Action: <what you did> | Issue: <what went wrong>
    [OK] Section: <name> | Check: <what you verified>

SETUP: Log in at /login, navigate to /clients, click the first client.

TASK LIST:

--- HEADER & BASIC INFO ---
1. Does the page load with the client name displayed prominently?
2. Is there a back link/button to return to the clients list?
3. Is the client type displayed (e.g. "Limited Company", "Sole Trader")?
4. Are contact details (email, phone) shown?
5. Is the company name/trading name shown?

--- EDITABLE FIELDS ---
6. Look for inline editable fields (company name, contact info, etc.).
   Are they clearly marked as editable (hover state, pencil icon)?
7. Click an editable field — does an input appear?
8. Press Escape — does it cancel cleanly?
9. Check for any client type selector. Does the dropdown open and show options?
10. Check for a VAT scheme selector. Does it open and show options?
11. Look for date fields (filing dates, year-end, etc.). Do date pickers render?

--- FILING MANAGEMENT ---
12. Is there a filing management section? Does it render?
13. Does it show filing types with deadlines?
14. Are deadline dates formatted correctly?
15. Do filing items show status (overdue, upcoming, etc.) with correct colours?
16. If there are actions on filings (mark complete, etc.), note them but don't click.
17. Does the empty state render if the client has no filings?

--- CHECKLIST CUSTOMISATION ---
18. Is there a checklist customisation section?
19. Does it show document types with toggles or checkboxes?
20. Are mandatory vs optional items clearly distinguished?
21. Don't change any toggles — just verify the UI renders without errors.

--- DOCUMENT CARDS ---
22. Is there a documents section? Does it render?
23. If documents exist, do document cards show: file name, upload date, type, status?
24. Do document cards show validation status (needs_review badge, warnings)?
25. Does the "needs_review" badge render correctly if present?
26. Does each card have a "Clear" or review action button?
27. What does the empty state look like if no documents are uploaded?
28. Is there a loading state while documents fetch? (Check for skeleton loaders.)

--- EMAIL HISTORY ---
29. Is there an email history section or tab?
30. Does it show a table of sent emails?
31. Are entries timestamped and show subject/status?
32. Does clicking an email entry open a detail view?
33. Does the empty state render if no emails have been sent?

--- AUDIT LOG ---
34. Is there an audit log section?
35. Does it show timestamped entries?
36. Are action types clearly labelled?
37. Does the empty state render?

--- PORTAL LINK ---
38. Is there a "Generate Portal Link" button or section?
39. Does clicking it show a link or a modal? (Don't submit — just observe.)
40. If a link already exists, is it displayed with a copy button?
41. Does the copy button work?

--- PAUSE REMINDERS TOGGLE ---
42. Is there a "Pause Reminders" toggle visible?
43. Note its current state but do NOT toggle it.
44. Is the toggle clearly labelled with what it does?

--- DSAR EXPORT ---
45. Is there a DSAR (data export) button somewhere on the page?
46. Does it render? Note its location but do NOT click it.

--- RESPONSIVE ---
47. Resize to mobile (375px). Does the layout adapt?
48. Are all sections still accessible via scrolling?
49. Are editable fields usable on mobile?

--- GENERAL ---
50. Check the console for errors on page load.
51. Check for loading/skeleton states while data fetches.
52. Is the page title/breadcrumb correct?
53. Navigate to a second client (go back, pick another). Does the page load
    correctly with different data?

--- FINAL REPORT ---
Produce a summary with:
  ISSUES FOUND: all [ERROR] entries with severity (HIGH/MEDIUM/LOW)
  SECTIONS VERIFIED: all [OK] entries
  CONSOLE ERRORS: any JS/React errors observed
  ADDITIONAL OBSERVATIONS: anything noteworthy that is not strictly a bug

Save the report to: QA_REPORTS/section4_client_detail_qa_report.md
Use the standard format: Issues Found table | Sections Verified table | Console Errors table | Additional Observations table.
Mark Section 4 as ✅ COMPLETE in QA_TASK_LISTS.md.
```

---

## SECTION 5: Email Logs / Activity Page

```
You are a QA testing agent. Thoroughly test the email logs / activity page at
http://localhost:3000/email-logs.

IMPORTANT RULES:
- Do NOT trigger any email sends, delete logs, or modify data.
- You ARE allowed to click tabs, filters, and open detail modals.
- Log issues in this format:
    [ERROR] Feature: <name> | Action: <what you did> | Issue: <what went wrong>
    [OK] Feature: <name> | Check: <what you verified>

SETUP: Log in at /login, navigate to /email-logs.

TASK LIST:

--- VIEW TOGGLES ---
1. Does the page render with a view toggle? (Expected: "Outbound" and "Uploads")
2. Click "Outbound" — does the outbound email view render?
3. Click "Uploads" — does the uploads view render?
4. Switch between them rapidly — any console errors or flickering?

--- OUTBOUND: QUEUED vs SENT ---
5. Within the outbound view, is there a sub-toggle for "Queued" vs "Sent"?
6. Click "Queued Emails" — does the queued table render?
7. Click "Sent Emails" — does the sent table render?
8. Switch between them — any console errors?

--- QUEUED EMAILS TABLE ---
9. Does the queued table show columns: recipient, subject, scheduled time, status?
10. Are dates formatted correctly?
11. Is the empty state clear if no emails are queued?
12. Click a queued email row — does a preview modal open?
13. Does the preview modal show: recipient, subject, body preview?
14. Close the modal — does it close cleanly?

--- SENT EMAILS TABLE ---
15. Does the sent table show columns: recipient, subject, sent time, delivery status?
16. Are delivery statuses shown with appropriate badges (delivered, bounced, etc.)?
17. Click a sent email row — does a detail modal open?
18. Does the detail modal show the full email body rendered as HTML?
19. Does the detail modal show delivery tracking info (opened, clicked, bounced)?
20. Close the modal — does it close cleanly?

--- UPLOADS TABLE ---
21. Does the uploads table show: client name, file name, upload time, document type?
22. Does it show validation status for each upload?
23. Click an upload row — does a validation detail modal open?
24. Does the validation modal show warnings/issues if any?
25. Close the modal — does it close cleanly?
26. Is the empty state clear if no uploads exist?

--- FILTERS ---
27. Are there any date range filters? Test selecting a date range.
28. Are there status filters? Test selecting a status.
29. Is there a search input? Test typing a client name or email.
30. Apply a filter that returns zero results — is the empty state appropriate?
31. Clear all filters — does the full list return?

--- PAGINATION ---
32. If there are many entries, is there pagination or infinite scroll?
33. Navigate between pages — does it work without errors?

--- RESPONSIVE ---
34. Resize to mobile (375px). Does the table adapt?
35. Do modals render correctly on mobile?

--- GENERAL ---
36. Check the console for errors on page load.
37. Check for loading states while data fetches.
38. Is the page title correct?

--- FINAL REPORT ---
Produce a summary with:
  ISSUES FOUND: all [ERROR] entries with severity (HIGH/MEDIUM/LOW)
  FEATURES VERIFIED: all [OK] entries
  CONSOLE ERRORS: any JS/React errors observed
  ADDITIONAL OBSERVATIONS: anything noteworthy that is not strictly a bug

Save the report to: QA_REPORTS/section5_email_logs_qa_report.md
Use the standard format: Issues Found table | Features Verified table | Console Errors table | Additional Observations table.
Mark Section 5 as ✅ COMPLETE in QA_TASK_LISTS.md.
```

---

## SECTION 6: Schedules & Templates

```
You are a QA testing agent. Thoroughly test the schedules and templates pages.

IMPORTANT RULES:
- Do NOT create, edit, save, or delete any schedules or templates.
- You ARE allowed to navigate to pages, open editors, and observe UI state.
- Log issues in this format:
    [ERROR] Page: <page> | Action: <what you did> | Issue: <what went wrong>
    [OK] Page: <page> | Check: <what you verified>

SETUP: Log in at /login.

TASK LIST:

--- SCHEDULES LIST (/schedules) ---
1. Navigate to /schedules. Does the page load?
2. Does it show a list of reminder schedules?
3. Does each schedule show: name, number of steps, assigned filing types?
4. Is there a "Create Schedule" button?
5. Is the empty state clear if no schedules exist?
6. Are schedules clickable to view/edit?

--- SCHEDULE EDITOR (/schedules/[id]/edit) ---
7. Click a schedule to open the editor. Does it load?
8. Does the editor show the schedule name?
9. Are the schedule steps rendered in a list/timeline?
10. Does each step show: days before deadline, email template, action type?
11. Is the step editor UI functional? (Can you see Add Step, Remove Step controls?)
    Note them but do NOT click Add or Remove.
12. Is there a filing type selector? Does it show available filing types?
13. Is there a client selector/exclusion section?
14. Does the page have Save and Cancel buttons?
15. Click Cancel or Back — does it navigate back without errors?
16. Check console for errors throughout.

--- TEMPLATES LIST (/templates) ---
17. Navigate to /templates. Does the page load?
18. Does it show a list/grid of email templates?
19. Does each template card show: name, subject line, preview?
20. Is there a "Create Template" button?
21. Is the empty state clear if no templates exist?

--- TEMPLATE EDITOR (/templates/[id]/edit) ---
22. Click a template to open the editor. Does it load?
23. Does the editor show: subject line editor, body editor, live preview?
24. Does the subject line editor support placeholder insertion?
25. Does the body editor have a toolbar with formatting options?
26. Is there a placeholder dropdown/menu? Open it — list available placeholders.
27. Does the live preview update as you type? (Type a character and check.)
28. Press Ctrl+Z to undo — does it work?
29. Does the page have Save and Cancel buttons?
30. Navigate back without saving — any unsaved changes warning?

--- NEW TEMPLATE (/templates/new) ---
31. Navigate to /templates/new. Does the blank editor load?
32. Are all editor features functional (toolbar, placeholders, preview)?
33. Navigate back without saving — does it navigate cleanly?

--- RESPONSIVE ---
34. Check schedule editor on mobile (375px) — usable?
35. Check template editor on mobile (375px) — usable?

--- GENERAL ---
36. Check the console for errors on every page.
37. Check for loading states on every page.

--- FINAL REPORT ---
Produce a summary with:
  ISSUES FOUND: all [ERROR] entries with severity (HIGH/MEDIUM/LOW)
  PAGES VERIFIED: all [OK] entries
  CONSOLE ERRORS: any JS/React errors observed
  ADDITIONAL OBSERVATIONS: anything noteworthy that is not strictly a bug

Save the report to: QA_REPORTS/section6_schedules_templates_qa_report.md
Use the standard format: Issues Found table | Pages Verified table | Console Errors table | Additional Observations table.
Mark Section 6 as ✅ COMPLETE in QA_TASK_LISTS.md.
```

---

## SECTION 7: Settings Page Deep Dive

```
You are a QA testing agent. Thoroughly test the settings page at
http://localhost:3000/settings.

IMPORTANT RULES:
- Do NOT save settings, disconnect integrations, remove team members, or make changes.
- You ARE allowed to click tabs, open dropdowns, and interact with controls to
  observe their behavior — just don't save.
- Log issues in this format:
    [ERROR] Tab: <tab> | Component: <name> | Issue: <what went wrong>
    [OK] Tab: <tab> | Component: <name> | Check: <what you verified>

SETUP: Log in at /login, navigate to /settings.

TASK LIST:

--- TAB NAVIGATION ---
1. List all visible tabs on the settings page.
2. Click each tab — does it switch content without errors?
3. Does the active tab have a visual indicator (highlight, underline)?
4. Switch tabs rapidly back and forth — any console errors?

--- GENERAL TAB ---
5. Does the General tab render all expected cards?

6. CLIENT PORTAL CARD:
   - Does it show the portal enable/disable state?
   - Is there a toggle or button to change the state?
   - Is there explanatory text about what the portal does?

7. STORAGE CARD:
   - Does it show the connected storage provider (or "Not connected")?
   - If connected, does it show the provider name and connection status?
   - Are there Connect/Disconnect buttons for each provider?
   - Don't click Disconnect — just verify it's there.

8. SEND HOUR PICKER:
   - Does it show the current send hour?
   - Is there a time picker or dropdown?
   - Open the picker — does it show valid hour options?
   - Close without changing — no errors?

9. TEAM CARD:
   - Does it show current team members?
   - Does it show member count and plan limit?
   - Are member roles displayed (admin, member)?
   - Is there an "Invite" button? Does clicking it show an invite form/modal?
   - Close the invite form without submitting.
   - Are there "Remove" buttons next to members? Note them but do NOT click.

10. SIGN OUT CARD:
    - Is there a sign-out option? Does it render?
    - Don't click it.

--- EMAIL TAB ---
11. Does the Email tab render?

12. EMAIL SETTINGS CARD:
    - Does it show current Postmark configuration status?
    - Does it show the sender email address?
    - If credentials are configured, is there a "Verified" or status badge?
    - If credentials are NOT configured, is there a clear setup CTA?

13. DOMAIN SETUP CARD:
    - Does it show DNS records that need to be configured?
    - Are DNS record values displayed in a copyable format?
    - Does it show verification status (verified/pending) for each record?
    - Is the overall domain status clearly communicated?

--- BILLING TAB ---
14. Does the Billing tab render?

15. BILLING STATUS:
    - Does it show the current plan name?
    - Does it show billing period and next payment date?
    - Is the plan tier clearly displayed?

16. USAGE BARS:
    - Are there usage indicators (e.g. "5 of 50 clients used")?
    - Are usage bars visually correct (proportional fill)?
    - What happens when usage is at 0%? 100%? Near limit?

17. MANAGE BILLING BUTTON:
    - Is there a "Manage Billing" or "Stripe Portal" button?
    - Does clicking it redirect to Stripe? (Note the redirect, don't proceed.)

18. UPGRADE SECTION:
    - Is there an upgrade CTA if on a lower-tier plan?
    - Does it show available plan tiers with pricing?
    - Are plan features compared clearly?

--- MEMBER-SPECIFIC SETTINGS ---
19. If logged in as a non-admin member, does the settings page show
    a different/reduced view?
20. Does the member settings card show personal email preferences?

--- RESPONSIVE ---
21. Resize to mobile (375px) — do all tabs and cards render correctly?
22. Do cards stack vertically without overlap?
23. Are all controls accessible on mobile?

--- GENERAL ---
24. Check the console for errors on every tab switch.
25. Check for loading states when switching tabs.
26. Are card headings, descriptions, and labels all properly visible?

--- FINAL REPORT ---
Produce a summary with:
  ISSUES FOUND: all [ERROR] entries with severity (HIGH/MEDIUM/LOW)
  TABS/COMPONENTS VERIFIED: all [OK] entries
  CONSOLE ERRORS: any JS/React errors observed
  ADDITIONAL OBSERVATIONS: anything noteworthy that is not strictly a bug

Save the report to: QA_REPORTS/section7_settings_qa_report.md
Use the standard format: Issues Found table | Tabs/Components Verified table | Console Errors table | Additional Observations table.
Mark Section 7 as ✅ COMPLETE in QA_TASK_LISTS.md.
```

---

## SECTION 8: Client Portal Deep Dive

```
You are a QA testing agent. Thoroughly test the client upload portal.

IMPORTANT RULES:
- Do NOT upload any files or submit any forms.
- You ARE allowed to interact with the UI (drag over drop zones, open file pickers
  then cancel, etc.) to test behavior.
- Log issues in this format:
    [ERROR] Component: <name> | Action: <what you did> | Issue: <what went wrong>
    [OK] Component: <name> | Check: <what you verified>

TASK LIST:

--- INVALID TOKEN ---
1. Visit /portal/INVALID-TOKEN-12345. Does it show a clear error state?
2. Does the error page say "expired" or "invalid" — not a crash/500?
3. Is the error page styled consistently with the rest of the app?
4. Does the error page have a way to contact support or go back?
5. Visit /portal/ (no token). What happens? 404 or redirect?
6. Visit /portal/null. Does it handle gracefully?
7. Visit /portal/<very-long-string-of-200-chars>. Any crash?

--- VALID PORTAL (find a token from the app) ---
First, log in at /login, go to /clients, open a client, and generate or find
an existing portal link. Copy the token from the URL. Then open an incognito/
new window and visit that portal URL.

8. Does the portal page load with the client's name displayed?
9. Is there a progress bar showing completion percentage?
10. Does the progress bar show 0% or appropriate value?

--- CHECKLIST RENDERING ---
11. Does the checklist show document types required?
12. Are items grouped or categorised by filing type?
13. Does each item show: document name, required/optional badge, status?
14. Are mandatory items visually distinct from optional items?
15. Count the checklist items — does the count match what's shown in the app's
    checklist customisation for this client?
16. Are there any already-uploaded documents shown with a completed state?

--- UPLOAD INTERACTION (observe only) ---
17. Does each checklist item have an upload button or drop zone?
18. Hover over a drop zone — does it show a visual hover state?
19. Click the upload button — does a file picker dialog open?
20. Cancel the file picker — does the UI return to normal without errors?
21. Is there an "Ad-hoc" or "Other documents" upload section for uncategorised files?

--- VALIDATION WARNING CARD ---
22. If any uploaded documents have validation warnings, does a
    ValidationWarningCard render?
23. Does it show the warning message clearly?
24. Is the warning styled appropriately (yellow/amber for warnings, red for errors)?
25. If no warnings exist, is the card hidden (not showing an empty state)?

--- UPLOAD CONFIRMATION ---
26. If any documents were previously uploaded, does an UploadConfirmationCard show?
27. Does it display the file name, upload time, and status?

--- BRANDING & STYLING ---
28. Does the portal show the firm's name/branding?
29. Is the portal styled consistently (not a plain/unstyled page)?
30. Is there a footer or attribution?

--- RESPONSIVE ---
31. Resize to mobile (375px). Does the checklist adapt?
32. Are upload buttons/zones usable on mobile?
33. Does the progress bar display correctly on mobile?
34. Resize to tablet (768px). Any layout issues?

--- EXPIRED TOKEN ---
35. If you can find or create an expired portal token, visit it.
36. Does it show an appropriate "Link expired" message?
37. Is the expired state distinct from the invalid token state?

--- GENERAL ---
38. Check the console for errors on portal page load.
39. Check for any failed network requests.
40. Is the page accessible without logging in? (Portal should be public/token-based.)

--- FINAL REPORT ---
Produce a summary with:
  ISSUES FOUND: all [ERROR] entries with severity (HIGH/MEDIUM/LOW)
  COMPONENTS VERIFIED: all [OK] entries
  CONSOLE ERRORS: any JS/React errors observed
  ADDITIONAL OBSERVATIONS: anything noteworthy that is not strictly a bug

Save the report to: QA_REPORTS/section8_client_portal_qa_report.md
Use the standard format: Issues Found table | Components Verified table | Console Errors table | Additional Observations table.
Mark Section 8 as ✅ COMPLETE in QA_TASK_LISTS.md.
```

---

## SECTION 9: Marketing & Public Pages

```
You are a QA testing agent. Thoroughly test all public/marketing pages.

IMPORTANT RULES:
- These are read-only pages. Do not submit any forms.
- Log issues in this format:
    [ERROR] Page: <url> | Issue: <what went wrong>
    [OK] Page: <url> | Check: <what you verified>

TASK LIST:

--- LANDING PAGE (/) ---
1. Visit /. Does the hero section render with heading and CTA?
2. Do hero animations play? (Word-by-word spring entrance, particles, etc.)
3. Is the heading text fully visible (not clipped or overflowing)?
4. Does the CTA button link to /signup or /login?
5. Scroll down — do all sections load? List all visible sections.
6. Do feature illustration components render? (Deadline tracking, email management,
   client portal, document storage, automated reminders, document-aware emails)
7. Do "How It Works" illustrations render?
8. Is there a pricing preview section? Does it show plan tiers?
9. Is there a FAQ section? Do accordion items expand/collapse?
10. Does the footer render with links and attribution?
11. Check all footer links — do they navigate to valid pages? (Don't check external links.)
12. Check the navigation header — are all nav links present and working?

--- PRICING PAGE (/pricing) ---
13. Visit /pricing. Does the page load?
14. Does it show all plan tiers with prices?
15. Are prices in GBP (£)?
16. Does each plan show: name, price, client limit, feature list?
17. Are there CTA buttons (e.g. "Get Started", "Contact Us")?
18. Do CTA buttons link to appropriate pages?
19. Is the pricing responsive on mobile?

--- HELP PAGE (/help) ---
20. Visit /help. Does the page load?
21. Are help topics/sections listed?
22. Do help illustrations render alongside content?
23. Is the content readable and properly formatted?
24. Are there any broken images or missing illustration components?
25. If there's a search function, does it work?

--- NEWS/BLOG (/news) ---
26. Visit /news. Does the page load?
27. Does it show a list of blog posts/news items?
28. Does each item show: title, date, excerpt?
29. Click a news item — does the detail page (/news/[slug]) load?
30. Does the detail page render the full article?
31. Is the back navigation working from the article page?
32. Is the empty state handled if no news items exist?

--- CHANGELOG (/changelog) ---
33. Visit /changelog. Does the page load?
34. Does it show a list of changelog entries?
35. Are entries dated and categorised?
36. Is the empty state handled?

--- LEGAL PAGES ---
37. Visit /terms. Does it load with content?
38. Visit /privacy. Does it load with content?
39. Are legal pages properly formatted (headings, paragraphs)?

--- AUTH PAGES (observe only, don't submit) ---
40. Visit /login. Does the form render?
41. Does the login form have: email input, password input, submit button?
42. Is there a "Forgot Password" link?
43. Visit /signup. Does the form render?
44. Visit /forgot-password. Does the form render?
45. Check for consistent styling across all auth pages.

--- CROSS-CUTTING CHECKS ---
46. On every page, check the console for JS errors.
47. On every page, check for broken images or missing assets.
48. On every page, check for Framer Motion animation warnings.
49. Test every page at mobile width (375px).
50. Check that the navigation header is consistent across all pages.
51. Verify that the logo/brand name links back to /.

--- FINAL REPORT ---
Produce a summary with:
  ISSUES FOUND: all [ERROR] entries with severity (HIGH/MEDIUM/LOW)
  PAGES VERIFIED: all [OK] entries
  CONSOLE ERRORS: any JS/React errors observed
  ADDITIONAL OBSERVATIONS: anything noteworthy that is not strictly a bug

Save the report to: QA_REPORTS/section9_marketing_pages_qa_report.md
Use the standard format: Issues Found table | Pages Verified table | Console Errors table | Additional Observations table.
Mark Section 9 as ✅ COMPLETE in QA_TASK_LISTS.md.
```

---

## SECTION 10: Billing & Admin Pages

```
You are a QA testing agent. Test the billing and admin pages.

IMPORTANT RULES:
- Do NOT make any purchases, change plans, or modify billing.
- Do NOT make any admin changes.
- Log issues in this format:
    [ERROR] Page: <url> | Action: <what you did> | Issue: <what went wrong>
    [OK] Page: <url> | Check: <what you verified>

SETUP: Log in at /login as an admin user.

TASK LIST:

--- BILLING PAGE (/billing) ---
1. Navigate to /billing. Does the page load?
2. Does it show the current subscription plan?
3. Is the plan name and tier clearly displayed?
4. Does it show billing period (monthly/annual)?
5. Is there a usage section showing client count vs plan limit?
6. Are usage bars proportionally correct?
7. Is there a "Manage Billing" button linking to Stripe?
8. Is there an upgrade section showing other plan tiers?
9. Does the upgrade section show prices in GBP?
10. If on the highest plan, is the upgrade section hidden or shows "Current plan"?

--- ROLLOVER PAGE (/rollover) ---
11. Navigate to /rollover. Does the page load?
12. Does it show the current and next tax year?
13. Is there a rollover action or explanation?
14. Is the page functional or a placeholder?
15. Check console for errors.

--- ADMIN PAGE (/admin) ---
16. Navigate to /admin. Does the page load?
17. If it requires specific admin credentials, note the access restriction.
18. What admin tools/features are shown?
19. Are there any copyable text fields? Do they have copy buttons?
20. Check console for errors.

--- INVITE FLOW (/invite/accept) ---
21. Visit /invite/accept without a valid invite token.
22. Does it show an appropriate error state?
23. Is the error styled consistently?

--- RESPONSIVE ---
24. Check billing page at mobile (375px).
25. Check admin page at mobile (375px).

--- GENERAL ---
26. Check console for errors on all pages.
27. Verify navigation works correctly between these pages and the main dashboard.

--- FINAL REPORT ---
Produce a summary with:
  ISSUES FOUND: all [ERROR] entries with severity (HIGH/MEDIUM/LOW)
  PAGES VERIFIED: all [OK] entries
  CONSOLE ERRORS: any JS/React errors observed
  ADDITIONAL OBSERVATIONS: anything noteworthy that is not strictly a bug

Save the report to: QA_REPORTS/section10_billing_admin_qa_report.md
Use the standard format: Issues Found table | Pages Verified table | Console Errors table | Additional Observations table.
Mark Section 10 as ✅ COMPLETE in QA_TASK_LISTS.md.
```

---

## Usage Notes

- **Run one section at a time** — each is designed to be a complete, self-contained session.
- **Recommended order**: Sections 1, 4, 3, 5, 7, 8, 2, 6, 9, 10 (highest value first).
- **Each section takes ~5-15 minutes** for a browser agent depending on app complexity.
- **Save reports** to `QA_REPORTS/section<N>_<slug>_qa_report.md` inside this project directory — NOT the Antigravity brain/artifact folder.
- **Mark the section** as ✅ COMPLETE in the SECTION COMPLETION STATUS table at the top of this file after saving the report.
- **Append significant findings** to QA_AUDIT_LOG.md under a new dated section for high-level tracking.
