---
status: testing
phase: 15-per-accountant-config
source: 15-01-SUMMARY.md, 15-02-SUMMARY.md, 15-03-SUMMARY.md, 15-04-SUMMARY.md, 15-05-SUMMARY.md
started: 2026-02-25T00:00:00Z
updated: 2026-02-25T00:00:00Z
---

## Current Test

number: 1
name: Member Nav Access
expected: |
  Log in as a member (non-admin) user. Check the sidebar/nav. You should see
  "Reminder Schedules" and "Email Templates" links visible — the same links
  that admins see. (Previously these were hidden from members.)
awaiting: user response

## Tests

### 1. Member Nav Access
expected: Log in as a member (non-admin) user. "Reminder Schedules" and "Email Templates" should appear in the nav bar (same as admin). Previously these were hidden from members.
result: [pending]

### 2. Member Settings Page
expected: A member navigating to /settings should see a simplified page — a MemberSettingsCard (not the full admin settings view). It should NOT show billing, org settings, or other admin-only sections.
result: [pending]

### 3. Member Settings Form Fields
expected: The MemberSettingsCard on /settings contains: a send hour picker, sender name field, sender email field (local part), and reply-to email field. There is a single "Save" button (not auto-save).
result: [pending]

### 4. Member Settings Save & Persist
expected: Fill in the MemberSettingsCard fields (e.g., set a custom send hour and sender name), click Save. Reload the page. The values you entered should still be shown — they were saved as your personal settings.
result: [pending]

### 5. Admin Settings Unchanged
expected: Log in as an admin user and go to /settings. The full admin settings page should appear as before — org-level settings, billing section, all admin controls present and working normally.
result: [pending]

### 6. New Member Invite Seeding
expected: Invite a new user to the org and have them accept the invite. After accepting, log in as that new member and check /templates and /schedules. They should see pre-populated templates and schedules cloned from the org admin — not an empty list.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0

## Gaps

[none yet]
