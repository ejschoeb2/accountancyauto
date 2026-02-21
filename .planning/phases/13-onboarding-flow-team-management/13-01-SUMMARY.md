---
phase: 13-onboarding-flow-team-management
plan: 01
subsystem: auth
tags: [supabase, next.js, magic-link, onboarding, org-creation, stripe, trial]

# Dependency graph
requires:
  - phase: 12-subdomain-routing-access-gating
    provides: middleware PUBLIC_ROUTES pattern, auth callback redirect, subdomain routing
  - phase: 11-stripe-billing
    provides: PLAN_TIERS config, createTrialForOrg, PlanTier enum
  - phase: 10-org-data-model-rls-foundation
    provides: organisations table, user_organisations table, app_settings table, admin client pattern
provides:
  - 4-step onboarding wizard at /onboarding (Account, Firm Details, Plan Selection, Trial Started)
  - checkSlugAvailable server action (format validation, reserved slug check, DB uniqueness check)
  - createOrgAndJoinAsAdmin server action (creates org + user_org + trial + onboarding_complete flag)
  - sendOnboardingMagicLink server action (OTP via /auth/callback)
  - Already-onboarded redirect in layout (ONBD-06)
  - /onboarding and /invite/accept added to PUBLIC_ROUTES
  - Authenticated no-org middleware fallback redirects to /onboarding instead of marketing site
affects:
  - 13-02 (invite flow needs /invite/accept in PUBLIC_ROUTES — already done)
  - 13-03 (role-gated nav needs org created before roles can be tested)
  - 13-04 (trial-reminder cron needs trial_ends_at set during onboarding — now set)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Admin client for all DB writes during onboarding (user has no org_id in JWT yet)
    - refreshSession() before subdomain redirect to get org_id in JWT app_metadata
    - Debounced slug availability check (500ms) with real-time visual feedback
    - slugifyFirmName() auto-suggest: lowercase, hyphens for spaces, remove special chars
    - isCheckingAuth state to prevent wizard flash before auth detection on mount

key-files:
  created:
    - app/(auth)/onboarding/actions.ts
  modified:
    - app/(auth)/onboarding/page.tsx
    - app/(auth)/onboarding/layout.tsx
    - lib/supabase/middleware.ts

key-decisions:
  - "[D-13-01-01] emailRedirectTo for onboarding magic link goes to /auth/callback (not /onboarding directly); middleware no-org fallback now redirects to /onboarding to complete the loop"
  - "[D-13-01-02] Already-onboarded redirect in layout.tsx (server-side) not middleware, to keep redirect logic close to the feature and avoid middleware DB query overhead on every request"
  - "[D-13-01-03] Admin client used for all org/user_org INSERT during onboarding — user has no org_id in JWT until after createOrgAndJoinAsAdmin + refreshSession()"
  - "[D-13-01-04] createOrgAndJoinAsAdmin checks for existing user_organisations row to prevent double-create idempotency"

patterns-established:
  - "Onboarding no-org pattern: use admin client for provisioning, then refreshSession() before subdomain redirect"
  - "WizardStepper reuse: pass { label: string }[] steps array and 0-indexed currentStep"

requirements-completed: [ONBD-01, ONBD-02, ONBD-04, ONBD-05, ONBD-06]

# Metrics
duration: 9min
completed: 2026-02-21
---

# Phase 13 Plan 01: Onboarding Wizard Summary

**4-step onboarding wizard at /onboarding using magic link auth, org creation with admin client, plan selection with 14-day trial provisioning, and subdomain redirect after JWT refresh**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-02-21T10:24:38Z
- **Completed:** 2026-02-21T10:33:08Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- `/onboarding` and `/invite/accept` added to `PUBLIC_ROUTES` — accessible without authentication
- Authenticated users with no org now redirect to `/onboarding` instead of marketing site (middleware Step 5 fallback)
- Layout rewritten to allow unauthenticated access with server-side already-onboarded redirect (ONBD-06)
- Full 4-step wizard: Account (magic link) → Firm Details (name + slug) → Plan Selection (trial) → Trial Started (dashboard redirect)
- `checkSlugAvailable` validates format, reserved slugs, and DB uniqueness with real-time debounced feedback
- `createOrgAndJoinAsAdmin` creates org, user_org (admin), trial (createTrialForOrg), and onboarding_complete app_setting
- Step 4 "Go to Dashboard" calls `refreshSession()` before redirect to ensure JWT has org_id from hook

## Task Commits

Each task was committed atomically:

1. **Task 1: Update middleware PUBLIC_ROUTES and rewrite onboarding layout** - `6874d11` (feat)
2. **Task 1 fix: Redirect to /onboarding when authenticated user has no org** - `1692dae` (fix)
3. **Task 2: Build 4-step onboarding wizard page and server actions** - `66a8e24` (feat)

**Plan metadata:** (docs commit — see final_commit)

## Files Created/Modified
- `app/(auth)/onboarding/actions.ts` - New: `checkSlugAvailable`, `createOrgAndJoinAsAdmin`, `sendOnboardingMagicLink` server actions
- `app/(auth)/onboarding/page.tsx` - Replaced: 4-step wizard client component with auth detection, debounced slug check, plan cards, JWT refresh
- `app/(auth)/onboarding/layout.tsx` - Rewritten: removed auth guard, added already-onboarded redirect via admin client
- `lib/supabase/middleware.ts` - Modified: added /onboarding and /invite/accept to PUBLIC_ROUTES; changed no-org fallback to redirect to /onboarding

## Decisions Made
- [D-13-01-01] Magic link `emailRedirectTo` goes to `/auth/callback` (not `/onboarding` directly). After code exchange, if user has no org, the middleware's no-org authenticated fallback now redirects to `/onboarding`. This keeps the auth callback unchanged and avoids client-side code exchange.
- [D-13-01-02] Already-onboarded redirect lives in `layout.tsx` (server component), not middleware. The middleware would need an extra DB query per request; the layout only runs when someone navigates to `/onboarding`.
- [D-13-01-03] All org creation writes use admin (service-role) client — RLS would block INSERT with `org_id = auth_org_id()` when the user has no org_id in their JWT yet.
- [D-13-01-04] `createOrgAndJoinAsAdmin` idempotency: checks `user_organisations` for existing row and returns existing org if found, preventing duplicate orgs if the action is called twice.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Separate commit needed for middleware no-org redirect change**
- **Found during:** Task 1 (middleware update)
- **Issue:** A linter/formatter ran after the first commit and reverted the `no-org → /onboarding` redirect change while keeping other changes (the admin route bypass added by Phase 14 work in progress). The change had to be re-applied in a second commit.
- **Fix:** Re-applied the fallback redirect change in a dedicated fix commit.
- **Files modified:** `lib/supabase/middleware.ts`
- **Verification:** Grep confirmed `/onboarding` redirect is in the file after fix commit.
- **Committed in:** `1692dae`

---

**Total deviations:** 1 auto-fixed (1 blocking — linter revert)
**Impact on plan:** Minimal. An extra commit was required but the change is correct and verified.

## Issues Encountered
- The Next.js build failed on first attempt due to a `.next/lock` file (dev server was running). Removed the lock file and re-ran build successfully.
- Pre-existing TypeScript error in `app/(dashboard)/admin/page.tsx` (Phase 14 WIP — missing `./components/org-table` module) was identified as out-of-scope and not fixed.

## User Setup Required
None - no external service configuration required for this plan. Supabase, Postmark, and Stripe are already configured.

## Next Phase Readiness
- Onboarding wizard complete and buildable
- `/invite/accept` is already in `PUBLIC_ROUTES` — Phase 13-02 (invite flow) can proceed immediately
- `trial_ends_at` is set during onboarding — Phase 13-04 (trial-reminder cron) can query against it
- ONBD-03 requirement (sender name/email): satisfied per plan decision — Postmark config available in Settings page post-onboarding

---
*Phase: 13-onboarding-flow-team-management*
*Completed: 2026-02-21*

## Self-Check: PASSED

- FOUND: `app/(auth)/onboarding/actions.ts`
- FOUND: `app/(auth)/onboarding/page.tsx`
- FOUND: `app/(auth)/onboarding/layout.tsx`
- FOUND: `lib/supabase/middleware.ts`
- FOUND commit: `6874d11` (feat: middleware + layout)
- FOUND commit: `1692dae` (fix: redirect to /onboarding)
- FOUND commit: `66a8e24` (feat: wizard + actions)
