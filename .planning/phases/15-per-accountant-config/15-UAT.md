---
status: diagnosed
phase: 15-per-accountant-config
source: 15-01-SUMMARY.md, 15-02-SUMMARY.md, 15-03-SUMMARY.md, 15-04-SUMMARY.md, 15-05-SUMMARY.md
started: 2026-02-25T00:00:00Z
updated: 2026-02-26T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Member Nav Access
expected: Log in as a member (non-admin) user. "Reminder Schedules" and "Email Templates" should appear in the nav bar (same as admin). Previously these were hidden from members.
result: pass

### 2. Member Settings Page
expected: A member navigating to /settings should see a simplified page — a MemberSettingsCard (not the full admin settings view). It should NOT show billing, org settings, or other admin-only sections.
result: pass

### 3. Member Settings Form Fields
expected: The MemberSettingsCard on /settings contains: a send hour picker, sender name field, sender email field (local part), and reply-to email field. There is a single "Save" button (not auto-save).
result: pass

### 4. Member Settings Save & Persist
expected: Fill in the MemberSettingsCard fields (e.g., set a custom send hour and sender name), click Save. Reload the page. The values you entered should still be shown — they were saved as your personal settings.
result: pass

### 5. Admin Settings Unchanged
expected: Log in as an admin user and go to /settings. The full admin settings page should appear as before — org-level settings, billing section, all admin controls present and working normally.
result: pass

### 6. New Member Invite Seeding
expected: Invite a new user to the org and have them accept the invite. After accepting, log in as that new member and check /templates and /schedules. They should see pre-populated templates and schedules cloned from the org admin — not an empty list.
result: issue
reported: "no there are no set email templates or schedules for the new user despite the org admin having them"
severity: major

## Summary

total: 6
passed: 5
issues: 1
pending: 0
skipped: 0

## Gaps

- truth: "New member sees pre-populated templates and schedules cloned from org admin after accepting invite"
  status: failed
  reason: "User reported: no there are no set email templates or schedules for the new user despite the org admin having them"
  severity: major
  test: 6
  root_cause: "POST routes for email-templates and schedules omit owner_id from INSERT bodies; NOT NULL constraint causes all post-Phase-15 template/schedule creation to fail silently, so admin has 0 resources for seedNewUserDefaults to clone"
  artifacts:
    - path: "app/api/email-templates/route.ts"
      issue: "POST handler does not set owner_id in INSERT body"
    - path: "app/api/schedules/route.ts"
      issue: "POST handler does not set owner_id in INSERT body"
  missing:
    - "Add owner_id: user.id to email-templates POST INSERT body"
    - "Add owner_id: user.id to schedules POST INSERT body"
    - "Add owner_id: user.id to schedule_steps INSERT body"
  debug_session: ".planning/debug/invite-member-seeding-empty.md"
