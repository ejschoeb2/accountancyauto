---
status: resolved
trigger: "UAT #28 - Environment variables configured: postmark server token, cron secret and accountant email all missing from .env.local.example"
created: 2026-02-07T00:00:00Z
updated: 2026-02-07T00:00:00Z
---

## Current Focus

hypothesis: POSTMARK_SERVER_TOKEN and ACCOUNTANT_EMAIL are missing from .env.local.example; CRON_SECRET is present
test: Read .env.local.example and compare to codebase usage
expecting: Confirm which variables are present vs absent
next_action: Report root cause

## Symptoms

expected: .env.local.example contains POSTMARK_SERVER_TOKEN, CRON_SECRET, and ACCOUNTANT_EMAIL placeholders
actual: CRON_SECRET is present but POSTMARK_SERVER_TOKEN and ACCOUNTANT_EMAIL are missing from example file
errors: UAT test #28 reported all three missing; only two are actually missing from the example
reproduction: Open .env.local.example and inspect contents
started: Since Phase 3 (Delivery & Dashboard) was implemented

## Eliminated

- hypothesis: All three variables are missing from .env.local.example
  evidence: CRON_SECRET=your-secret-here IS present on line 16 of .env.local.example
  timestamp: 2026-02-07

- hypothesis: Variables are not used in the codebase
  evidence: All three are actively consumed - POSTMARK_SERVER_TOKEN in lib/email/client.ts:11, CRON_SECRET in two cron routes, ACCOUNTANT_EMAIL in lib/email/sender.ts:50
  timestamp: 2026-02-07

## Evidence

- timestamp: 2026-02-07
  checked: .env.local.example contents
  found: |
    File contains 16 lines with these sections:
    - Supabase (3 vars): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
    - QuickBooks (4 vars): QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET, QUICKBOOKS_REDIRECT_URI, QUICKBOOKS_ENVIRONMENT
    - App (1 var): NEXT_PUBLIC_APP_URL
    - Cron (1 var): CRON_SECRET
    Missing: POSTMARK_SERVER_TOKEN, ACCOUNTANT_EMAIL
  implication: Phase 3 plan (03-01-PLAN.md) specified these should be added but they were never added to the example file

- timestamp: 2026-02-07
  checked: lib/email/client.ts
  found: Line 11 uses `process.env.POSTMARK_SERVER_TOKEN!` (non-null assertion, will crash at runtime if missing)
  implication: POSTMARK_SERVER_TOKEN is required for email sending to work at all

- timestamp: 2026-02-07
  checked: lib/email/sender.ts
  found: Line 50 uses `process.env.ACCOUNTANT_EMAIL || 'info@peninsulaaccounting.co.uk'` (has fallback)
  implication: ACCOUNTANT_EMAIL has a fallback so won't crash, but should still be documented

- timestamp: 2026-02-07
  checked: app/api/cron/send-emails/route.ts and app/api/cron/reminders/route.ts
  found: Both use `process.env.CRON_SECRET` for Bearer token auth validation
  implication: CRON_SECRET is already in .env.local.example - this part of the UAT report is incorrect

- timestamp: 2026-02-07
  checked: .planning/phases/03-delivery-dashboard/03-01-PLAN.md lines 17-21
  found: Plan explicitly lists POSTMARK_SERVER_TOKEN and ACCOUNTANT_EMAIL as environment variables to add
  implication: The plan required these to be added to .env.local.example but this step was missed during implementation

## Resolution

root_cause: |
  Two of three environment variables (POSTMARK_SERVER_TOKEN and ACCOUNTANT_EMAIL) were never added to
  .env.local.example during Phase 3 implementation. The Phase 3 plan (03-01-PLAN.md) specified these
  variables should be added, but the implementation step that updates .env.local.example was skipped.
  CRON_SECRET IS present (added during Phase 2), so the UAT report is partially incorrect about that one.

fix: Add POSTMARK_SERVER_TOKEN and ACCOUNTANT_EMAIL to .env.local.example under appropriate sections
verification: Read updated .env.local.example and confirm all three variables are present
files_changed:
  - .env.local.example
