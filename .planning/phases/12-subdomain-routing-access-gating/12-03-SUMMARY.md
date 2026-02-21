---
phase: 12-subdomain-routing-access-gating
plan: 03
subsystem: auth
tags: [supabase, magic-link, subdomain, postmark, next.js, middleware]

# Dependency graph
requires:
  - phase: 12-01-subdomain-routing-access-gating
    provides: "Middleware subdomain routing with org validation; ?org= param dev pattern"
  - phase: 12-02-subdomain-routing-access-gating
    provides: "Per-org Postmark token; sendRichEmail updated to accept optional org token"
  - phase: 10-02-org-data-model-rls-foundation
    provides: "JWT Custom Access Token Hook; org_id in app_metadata; organisations table"
provides:
  - "sendMagicLink accepts optional orgSlug; constructs subdomain callback URL in production"
  - "Login page extracts org slug from subdomain (prod) or ?org= query param (dev)"
  - "Auth callback resolves user's org via JWT app_metadata.org_id and redirects to org subdomain"
  - "Reminders cron skips orgs without postmark_server_token (consistent with send-emails cron)"
affects: [13-onboarding, 14-super-admin]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Subdomain extraction from window.location.hostname in client component; ?org= fallback for localhost"
    - "emailRedirectTo dynamically set to org subdomain in production for correct cookie scoping"
    - "Auth callback resolves slug from JWT app_metadata.org_id (fast path) before DB fallback"
    - "Cron skip guard: if !org.postmark_server_token — consistent across reminders and send-emails crtons"

key-files:
  created: []
  modified:
    - app/(auth)/login/actions.ts
    - app/(auth)/login/page.tsx
    - app/(auth)/auth/callback/route.ts
    - app/api/cron/reminders/route.ts

key-decisions:
  - "D-12-03-01: Magic link emailRedirectTo uses org subdomain URL in production; falls back to NEXT_PUBLIC_APP_URL/auth/callback in dev — cookie scoping is correct for both environments"
  - "D-12-03-02: Auth callback resolves org slug from JWT app_metadata.org_id (fast path) to avoid extra DB query for post-hook sessions"
  - "D-12-03-03: Dev redirect from callback appends ?org= param rather than subdomain (consistent with middleware dev pattern from 12-01)"

patterns-established:
  - "Org slug extraction pattern: window.location.hostname in prod (subdomain extraction), URLSearchParams in dev (?org= param)"
  - "Cron tokenless-org skip guard: if (!org.postmark_server_token) { console.warn; continue; } — applied to both reminders and send-emails crtons"

requirements-completed: [AUTH-01, AUTH-03, AUTH-05]

# Metrics
duration: 30min
completed: 2026-02-21
---

# Phase 12 Plan 03: Subdomain-Aware Auth Flow Summary

**Magic link emailRedirectTo and auth callback redirect updated for subdomain cookie scoping, with reminders cron skip guard for tokenless orgs**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-02-21T08:50:00Z
- **Completed:** 2026-02-21T09:30:00Z
- **Tasks:** 1 auto task + 1 human-verify checkpoint (approved)
- **Files modified:** 4

## Accomplishments

- `sendMagicLink` now accepts an optional `orgSlug` and constructs the emailRedirectTo URL as the org's subdomain callback in production, ensuring the auth session cookie is set on the correct subdomain
- Login page extracts the org slug from the current URL (hostname subdomain in production, `?org=` query param in development) and passes it to `sendMagicLink`
- Auth callback resolves the authenticated user's org via JWT `app_metadata.org_id`, then redirects to the org's subdomain in production or appends `?org=` in development
- Reminders cron now skips orgs without a `postmark_server_token`, consistent with the send-emails cron guard added in plan 12-02

## Task Commits

Each task was committed atomically:

1. **Task 1: Update auth flow for subdomain-aware login and callback** - `7c5c5cc` (feat)

**Plan metadata:** (docs commit follows this summary creation)

## Files Created/Modified

- `app/(auth)/login/actions.ts` - `sendMagicLink` updated to accept optional `orgSlug`; constructs subdomain callback URL in production
- `app/(auth)/login/page.tsx` - Added `getOrgSlugFromUrl()` helper to extract slug from hostname or `?org=` param; passes slug to `sendMagicLink`
- `app/(auth)/auth/callback/route.ts` - After code exchange, resolves user's org slug from JWT `app_metadata.org_id`; redirects to org subdomain (prod) or `?org=` param (dev)
- `app/api/cron/reminders/route.ts` - Added `postmark_server_token` to org SELECT query; added skip guard for orgs without token

## Decisions Made

- `emailRedirectTo` uses `https://{slug}.app.phasetwo.uk/auth/callback` in production so the cookie is scoped to the org's subdomain; in development it falls back to `${NEXT_PUBLIC_APP_URL}/auth/callback` since localhost doesn't use subdomains
- Auth callback uses JWT `app_metadata.org_id` as a fast path to resolve the org slug without an extra DB query for sessions issued after the JWT hook was enabled
- Dev redirect from auth callback appends `?org={slug}` to origin URL, consistent with the middleware's dev-mode pattern established in plan 12-01

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Human verification approved all steps:
- `localhost?org=acme` redirected to phasetwo.uk (correct behavior — "acme" slug does not exist in the DB; only "acme-test" does)
- `localhost?org=acme-test` loaded the dashboard correctly
- Settings page Email Configuration card confirmed working
- Org name displayed in header
- Read-only banner step skipped (no lapsed-subscription org available for testing)
- `npx tsc --noEmit` passed
- `npm run build` succeeded

## User Setup Required

None - no external service configuration required. Subdomain auth flow changes are transparent to end users and require no dashboard or environment variable updates beyond what was already configured in Phase 12 plans 01 and 02.

## Next Phase Readiness

Phase 12 is now complete (all 3 plans executed). The full subdomain routing system is operational:
- Middleware routes requests by org subdomain with membership validation and access gating (12-01)
- Per-org Postmark credentials are stored and used for email delivery (12-02)
- Auth flow is subdomain-aware: magic link callback URL and post-auth redirect both handle org subdomain correctly (12-03)

Phase 13 (Onboarding Flow & Team Management) can proceed. It depends on organisations and user_organisations tables (Phase 10), Stripe checkout (Phase 11), and subdomain redirect after onboarding (Phase 12) — all now complete.

---
*Phase: 12-subdomain-routing-access-gating*
*Completed: 2026-02-21*
