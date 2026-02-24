---
phase: 20-document-integration-document-aware-reminders
plan: 03
subsystem: api
tags: [supabase, date-fns, crypto, reminder-scheduler, template-variables, document-checklist]

# Dependency graph
requires:
  - phase: 18-document-collection-foundation
    provides: filing_document_requirements, document_types, client_document_checklist_customisations, upload_portal_tokens tables and seed data
  - phase: 19-collection-mechanisms
    provides: client_documents table with classification_confidence; upload portal and checklist customisation infrastructure
  - phase: 15-per-accountant-config
    provides: processRemindersForUser and scheduler.ts pipeline that this plan extends
provides:
  - resolveEffectiveChecklist utility (global requirements + per-client customisations merged)
  - resolveDocumentsRequired utility (outstanding mandatory docs as HTML fragment)
  - TemplateContext extended with documents_required and portal_link optional fields
  - AVAILABLE_PLACEHOLDERS extended to 8 entries
  - Scheduler Step 7 resolves both document variables before renderTipTapEmail
  - Per-reminder additive portal token generation (no revocation of existing tokens)
affects:
  - 20-document-integration-document-aware-reminders (plan 04 onwards — auto Records Received trigger)
  - any future plan that consumes TemplateContext or renderTipTapEmail

# Tech tracking
tech-stack:
  added: []
  patterns:
    - PostgREST FK join array normalisation — document_types join returns array; normalised to single object inline with Array.isArray guard and comment
    - Catch-and-continue error handling in scheduler — both document variable resolutions wrapped in try/catch; errors pushed to result.errors; reminder not aborted
    - Additive INSERT pattern for portal tokens — fresh token per send, old tokens not revoked, no DELETE or UPSERT
    - Token expiry matching next step delay — nextStep.delay_days used with 30-day fallback for last step

key-files:
  created:
    - lib/documents/checklist.ts
  modified:
    - lib/templates/variables.ts
    - lib/reminders/scheduler.ts

key-decisions:
  - "resolveDocumentsRequired catches errors and returns empty string — reminder email is not aborted if document DB query fails"
  - "Portal token INSERT is additive only (no revoke, no UPSERT) — matches CONTEXT.md locked decision; old tokens remain valid"
  - "Token expiry = daysToNextStep from next schedule_step; 30-day fallback when on last step"
  - "documents_required and portal_link both default to empty string — templates that include these variables still render correctly for custom (non-filing) reminders"
  - "Tax year derived from reminder.deadline_date.getFullYear() — simple year extraction for upload_portal_tokens.tax_year TEXT column"

patterns-established:
  - "Document variable resolution: resolve before renderTipTapEmail, guard on reminder.filing_type_id, catch-and-continue on error"
  - "Portal token generation: crypto.randomBytes(32) raw token, SHA-256 hash stored, raw token used in URL (shown once, not stored)"

requirements-completed: [INT-VARS-01, INT-VARS-02]

# Metrics
duration: 12min
completed: 2026-02-24
---

# Phase 20 Plan 03: Document-Aware Template Variables Summary

**resolveDocumentsRequired utility and portal token generation wired into scheduler Step 7; TemplateContext extended with documents_required and portal_link variables now available to all reminder templates**

## Performance

- **Duration:** 12 min
- **Started:** 2026-02-24T12:54:45Z
- **Completed:** 2026-02-24T13:06:30Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- Created `lib/documents/checklist.ts` with two exported utilities: `resolveEffectiveChecklist` (merges global requirements with per-client customisations) and `resolveDocumentsRequired` (returns HTML `<ul><li>` fragment of outstanding mandatory items)
- Extended `TemplateContext` interface and `AVAILABLE_PLACEHOLDERS` (6 → 8 entries) in `variables.ts`; `substituteVariables()` now handles both new variables via the existing regex without modification
- Updated `scheduler.ts` Step 7 to resolve `documents_required` and generate a fresh portal token per filing reminder before calling `renderTipTapEmail()`, with additive INSERT into `upload_portal_tokens` and catch-and-continue error handling

## Task Commits

Each task was committed atomically:

1. **Task 1: Create lib/documents/checklist.ts** - `3e86d34` (feat)
2. **Task 2: Extend variables.ts and wire into scheduler.ts Step 7** - `6b52f52` (feat)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified
- `lib/documents/checklist.ts` - resolveEffectiveChecklist and resolveDocumentsRequired utilities; PostgREST FK join array normalisation applied
- `lib/templates/variables.ts` - TemplateContext extended with documents_required and portal_link; AVAILABLE_PLACEHOLDERS extended to 8 entries; accountant_name description corrected to 'Accountant or practice name'
- `lib/reminders/scheduler.ts` - addDays, crypto, resolveDocumentsRequired imported; Step 7 loop resolves both document variables before renderTipTapEmail(); additive portal token INSERT with expiry matching next step

## Decisions Made
- **resolveDocumentsRequired catch-and-continue:** If the document DB query throws, the error is pushed to result.errors and documentsRequired stays `''`. The reminder is not aborted — accountants should receive the email without the list rather than get no email at all.
- **Portal token additive INSERT:** Per CONTEXT.md locked decision, each reminder send generates a new token. Old tokens are not revoked. The portal link in a reminder email stays valid until the next reminder arrives with a fresh one.
- **Token expiry = next step delay_days with 30-day fallback:** If the reminder is the last step in the schedule (no next step), the token expires in 30 days. This ensures the client's upload link stays valid for a reasonable window even after the final reminder.
- **Tax year from deadline year only:** `new Date(reminder.deadline_date).getFullYear().toString()` is used for `upload_portal_tokens.tax_year`. This is a simple year extraction consistent with how tax_year TEXT is used elsewhere in the system.
- **documents_required and portal_link default to `''` for custom reminders:** Custom schedule reminders (no `filing_type_id`) skip both resolutions. Templates using these variables still render correctly — the variables simply substitute to empty string.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript errors in `settings-tabs.tsx` and `portal/[token]/components/checklist-item.tsx` (4 errors) were present before this plan and are out of scope per deviation scope boundary rules. All three files modified in this plan compile cleanly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `{{documents_required}}` and `{{portal_link}}` are live in the template variable engine and will appear in the template editor's variable picker
- Scheduler now inserts a row into `upload_portal_tokens` per filing reminder send — verify in Supabase Dashboard after the next cron run
- Phase 20 Plan 04 (auto Records Received trigger on upload) can proceed — all prerequisites from this plan are in place

## Self-Check: PASSED

- lib/documents/checklist.ts: FOUND
- lib/templates/variables.ts: FOUND
- lib/reminders/scheduler.ts: FOUND
- 20-03-SUMMARY.md: FOUND
- Commit 3e86d34 (Task 1): FOUND
- Commit 6b52f52 (Task 2): FOUND

---
*Phase: 20-document-integration-document-aware-reminders*
*Completed: 2026-02-24*
