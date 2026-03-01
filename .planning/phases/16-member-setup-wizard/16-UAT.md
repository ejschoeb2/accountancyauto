---
status: testing
phase: 16-member-setup-wizard
source: 16-01-SUMMARY.md, 16-02-SUMMARY.md, 16-03-SUMMARY.md, 16-04-SUMMARY.md
started: 2026-02-26T00:00:00Z
updated: 2026-02-26T00:00:00Z
---

## Current Test

number: 1
name: Invite Accept Redirect
expected: |
  After accepting an org invite, the new member should land at /setup/wizard
  (not the dashboard). The wizard page should load with a stepper showing
  two steps: "Import Clients" and "Configuration".
awaiting: user response

## Tests

### 1. Invite Accept Redirect
expected: After accepting an org invite, the new member lands at /setup/wizard with a stepper showing two steps — "Import Clients" and "Configuration".
result: [pending]

### 2. Wizard Step 1 — CSV Import UI
expected: Step 1 shows a file upload area for CSV/XLSX import. A "Skip for now" option is visible so the member can bypass the import step.
result: [pending]

### 3. Skip CSV Import
expected: Clicking "Skip for now" on Step 1 advances to Step 2 without requiring a file upload. The stepper updates to show Step 2 as active.
result: [pending]

### 4. Wizard Step 2 — Configuration Fields
expected: Step 2 shows a "Configure Your Settings" card with: send hour picker, inbound mode toggle (auto/recommend), sender name, sender email (local part), and reply-to email. A "Save & Continue" button is present.
result: [pending]

### 5. Wizard Completion & Redirect
expected: Clicking "Save & Continue" on Step 2 saves the settings and redirects the member to the dashboard. The wizard is no longer shown.
result: [pending]

### 6. Dashboard Gate for Incomplete Members
expected: A member who has NOT completed the wizard and tries to navigate directly to /dashboard is redirected back to /setup/wizard.
result: [pending]

### 7. Wizard Re-entry Prevention
expected: A member who has already completed the wizard and navigates to /setup/wizard is redirected to the dashboard — they cannot re-enter the wizard.
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0

## Gaps

[none yet]
