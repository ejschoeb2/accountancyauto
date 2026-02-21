---
phase: 12-subdomain-routing-access-gating
plan: 02
subsystem: email
tags: [postmark, email, multi-tenant, settings, ui]

# Dependency graph
requires:
  - phase: 10-org-data-model-rls-foundation
    provides: organisations table with postmark_server_token/postmark_sender_domain columns, getOrgId(), createAdminClient()
  - phase: 12-subdomain-routing-access-gating
    plan: 01
    provides: sendRichEmailForOrg with orgPostmarkToken param, sendRichEmail with optional orgPostmarkToken

provides:
  - Postmark settings UI card (token + sender domain, validate + save)
  - /api/settings/validate-postmark endpoint (already existed, unchanged)
  - getPostmarkSettings and updatePostmarkSettings server actions (already existed, unchanged)
  - Per-org Postmark token passed to sendRichEmail in ad-hoc and reply actions
  - Cron job skips orgs without postmark_server_token (no env var fallback)
  - Org name displayed in dashboard header next to logo

affects:
  - phase: 13-onboarding
  - phase: 14-super-admin

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-org Postmark token: fetched from organisations table via admin client, passed to sendRichEmail"
    - "Cron skip-without-token: guard clause before processOrgEmails, logs console.warn"
    - "Org name in header: fetched in layout server component alongside isOrgReadOnly"

key-files:
  created:
    - app/(dashboard)/settings/components/postmark-settings-card.tsx
  modified:
    - app/(dashboard)/settings/page.tsx
    - app/actions/send-adhoc-email.ts
    - app/actions/send-reply-email.ts
    - app/api/cron/send-emails/route.ts
    - app/(dashboard)/layout.tsx

key-decisions:
  - "[D-12-02-01] sendRichEmail accepts optional orgPostmarkToken; falls back to env var postmarkClient if not provided (backwards compatible for callers without org context)"
  - "[D-12-02-02] Cron skips tokenless orgs with console.warn and pushes skip entry to allResults — no exception thrown, processing continues to next org"
  - "[D-12-02-03] Ad-hoc and reply email server actions fetch org token via admin client; pass as optional param — if org has no token yet, sendRichEmail falls back to env var"

patterns-established:
  - "Postmark token access: use createAdminClient() to query organisations.postmark_server_token — never trust RLS-filtered client for this"
  - "Settings card pattern: icon + title + description + inputs + validate/save buttons with inline status feedback"

requirements-completed: [AUTH-05]

# Metrics
duration: 15min
completed: 2026-02-21
---

# Phase 12 Plan 02: Per-Org Postmark Configuration Summary

**Per-org Postmark server token settings UI with validate-then-save flow, cron skip guard for tokenless orgs, and org name display in dashboard header**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-02-21T08:46:22Z
- **Completed:** 2026-02-21T09:01:00Z
- **Tasks:** 2
- **Files modified:** 6 (1 created)

## Accomplishments

- Created PostmarkSettingsCard component with masked token input, Validate Token button (calls Postmark API), and Save button (calls server action)
- Updated settings page to include the Postmark configuration card between Email Settings and Inbound Checker
- Updated cron send-emails route to skip orgs without postmark_server_token with console.warn (no env var fallback = no cross-org leakage)
- Updated send-adhoc-email.ts and send-reply-email.ts to fetch and pass org's Postmark token to sendRichEmail
- Updated dashboard layout to fetch org name and display it next to the logo with a "/" separator

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Postmark settings card, validation endpoint, and server actions** - `306783d` (feat)
2. **Task 2: Update email sender, cron pipeline, and add org name to header** - `b01551d` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `app/(dashboard)/settings/components/postmark-settings-card.tsx` - Client component with token input (password), sender domain input, Validate Token + Save buttons, inline success/error feedback, "no token" warning state
- `app/(dashboard)/settings/page.tsx` - Added PostmarkSettingsCard import and render with getPostmarkSettings data
- `app/actions/send-adhoc-email.ts` - Added createAdminClient import, org token fetch, pass orgPostmarkToken to sendRichEmail
- `app/actions/send-reply-email.ts` - Added createAdminClient import, org token fetch, pass orgPostmarkToken to sendRichEmail
- `app/api/cron/send-emails/route.ts` - Added skip guard for tokenless orgs, added postmark_sender_domain to SELECT
- `app/(dashboard)/layout.tsx` - Added org name fetch alongside isOrgReadOnly, org name display in header branding div

## Decisions Made

- **[D-12-02-01]** `sendRichEmail` accepts optional `orgPostmarkToken`; falls back to env var `postmarkClient` if not provided. This keeps the function backwards compatible — callers without org context (or orgs not yet configured) won't break.
- **[D-12-02-02]** Cron skips tokenless orgs with `console.warn` and pushes a skip entry to `allResults` — no exception thrown, processing continues to next org normally.
- **[D-12-02-03]** Ad-hoc and reply email server actions fetch org token via admin client and pass as optional param. If org has no token configured yet, `sendRichEmail` falls back to the env var — this is intentional for the transition period before all orgs have tokens.

## Deviations from Plan

### Notes on Pre-existing Work

Several items planned in Task 1 were already implemented by Plan 12-01:
- `getPostmarkSettings` and `updatePostmarkSettings` server actions in `settings.ts` — already existed
- `/api/settings/validate-postmark` route — already existed
- `sendRichEmailForOrg` env var fallback already removed in 12-01
- `sendRichEmail` `orgPostmarkToken` param already added in 12-01

These were verified and confirmed correct; no re-implementation needed.

None — plan executed as written (pre-existing work noted above is not a deviation, it represents prior phase work).

## Issues Encountered

None — TypeScript compiled cleanly on both tasks.

## User Setup Required

None - no external service configuration required. Admin configures Postmark token directly in the Settings UI.

## Next Phase Readiness

- Per-org Postmark configuration is now fully functional end-to-end
- Settings page provides token entry, validation, and save
- Cron pipeline will skip unconfigured orgs cleanly
- Ad-hoc and reply emails route through org's Postmark server when configured
- Org name visible in header for identity context
- Ready for Phase 12 Plan 03 (access gating / subscription enforcement on subdomain routes)

---
*Phase: 12-subdomain-routing-access-gating*
*Completed: 2026-02-21*
