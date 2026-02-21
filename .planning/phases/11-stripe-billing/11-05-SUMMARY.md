---
phase: 11-stripe-billing
plan: 05
subsystem: api
tags: [billing, stripe, enforcement, read-only, usage-limits, server-actions, dashboard-banner]

# Dependency graph
requires:
  - phase: 11-01
    provides: Plan tier config (PLAN_TIERS), usage-limits (checkClientLimit), read-only-mode (requireWriteAccess, isOrgReadOnly)
  - phase: 11-04
    provides: Billing dashboard page at /billing (banner links to it)
  - phase: 10-04
    provides: getOrgId/getOrgContext for org-scoped server actions
provides:
  - Client creation blocked at plan limit with upgrade link error
  - Read-only mode enforcement on all mutating server actions
  - Dashboard banner for lapsed subscription visibility
  - Billing nav link in dashboard navigation
affects: [12-subdomain-routing, 13-team-management, 14-production-hardening]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Write-guard pattern: requireWriteAccess(orgId) at top of mutating server actions"
    - "Limit-check pattern: checkClientLimit(orgId) before entity creation"
    - "Lazy Stripe init: Proxy-based initialization to defer SDK creation until first use"

key-files:
  created: []
  modified:
    - app/api/clients/route.ts
    - app/actions/send-adhoc-email.ts
    - app/actions/send-reply-email.ts
    - app/actions/clients.ts
    - app/actions/settings.ts
    - app/(dashboard)/layout.tsx
    - components/nav-links.tsx
    - lib/stripe/client.ts

key-decisions:
  - "[D-11-05-01] Stripe client uses lazy Proxy-based initialization to prevent build failures when STRIPE_SECRET_KEY is not set"

patterns-established:
  - "requireWriteAccess guard: call at top of every mutating server action to enforce read-only mode"
  - "checkClientLimit guard: call before entity creation to enforce plan tier limits"
  - "Conditional dashboard banner: server-side isOrgReadOnly check renders amber banner above content"

# Metrics
duration: 6min
completed: 2026-02-21
---

# Phase 11 Plan 05: Usage Enforcement + Read-Only Mode Summary

**Client limit enforcement and read-only mode guards integrated into all mutating server actions, with amber dashboard banner for lapsed subscriptions and billing nav link**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-21T00:04:00Z
- **Completed:** 2026-02-21T00:10:00Z
- **Tasks:** 2 (+ 1 checkpoint)
- **Files modified:** 8

## Accomplishments
- Client creation now checks both write access (subscription status) and client limit (plan tier) before insert, returning clear error messages with upgrade links
- All mutating server actions (send email, reply email, update/delete clients, update settings) blocked in read-only mode with descriptive errors
- Read operations (getClients, getSendHour, getEmailSettings) remain accessible during lapsed state -- data is visible, not locked away
- Amber warning banner conditionally rendered at top of dashboard layout when org subscription is lapsed, with "Update billing" link
- Billing nav link with CreditCard icon added to dashboard navigation

## Task Commits

Each task was committed atomically:

1. **Task 1: Integrate client limit enforcement + read-only mode into server actions** - `9e26a93` (feat)
2. **Task 2: Add read-only mode banner to dashboard layout + billing nav link** - `711fd6a` (feat)

## Files Created/Modified
- `app/api/clients/route.ts` - POST handler now calls requireWriteAccess + checkClientLimit before insert
- `app/actions/send-adhoc-email.ts` - requireWriteAccess guard at top of action
- `app/actions/send-reply-email.ts` - requireWriteAccess guard at top of action
- `app/actions/clients.ts` - requireWriteAccess guard on updateClientMetadata, bulkUpdateClients, deleteClients
- `app/actions/settings.ts` - requireWriteAccess guard on updateSendHour, updateEmailSettings, and other mutation functions
- `app/(dashboard)/layout.tsx` - Conditional amber read-only banner with "Update billing" link
- `components/nav-links.tsx` - Added "Billing" nav link with CreditCard icon pointing to /billing
- `lib/stripe/client.ts` - Switched from eager to lazy Proxy-based Stripe SDK initialization

## Decisions Made
- [D-11-05-01] Stripe client uses lazy Proxy-based initialization to prevent build failures when STRIPE_SECRET_KEY env var is not set at build time. The Proxy defers `new Stripe()` until the first property access at runtime.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Stripe client eager initialization caused build failure**
- **Found during:** Task 2 (dashboard layout + billing nav link)
- **Issue:** `lib/stripe/client.ts` called `new Stripe(process.env.STRIPE_SECRET_KEY!)` at module level. When imported (transitively via layout -> isOrgReadOnly -> billing helpers), Next.js build failed because the env var is not available at build time for server components.
- **Fix:** Replaced eager initialization with a Proxy-based lazy pattern that defers `new Stripe()` until the first property access at runtime, when env vars are available.
- **Files modified:** `lib/stripe/client.ts`
- **Verification:** `npm run build` passes
- **Committed in:** `711fd6a` (part of Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix for build to succeed. No scope creep.

## Issues Encountered

None beyond the Stripe client initialization issue documented above.

## User Setup Required

None - Stripe test API keys confirmed configured in .env.local.

## Next Phase Readiness
- Phase 11 (Stripe Billing) is now complete -- all 5 plans executed
- Full billing stack: database schema, webhook handler, checkout/portal routes, pricing page, billing dashboard, usage enforcement, read-only mode
- Ready for Phase 12 (Subdomain Routing) which will add per-org Postmark configuration
- Stripe end-to-end testing (checkout flow, webhooks, portal) can be done with the configured test API keys

## Self-Check: PASSED

---
*Phase: 11-stripe-billing*
*Completed: 2026-02-21*
