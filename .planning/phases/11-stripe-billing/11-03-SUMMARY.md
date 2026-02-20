---
phase: 11-stripe-billing
plan: 03
subsystem: payments
tags: [stripe, checkout, portal, pricing, trial, cron, next.js]

# Dependency graph
requires:
  - phase: 11-01
    provides: Stripe SDK, plan tier config, billing utilities
  - phase: 10-01
    provides: organisations table with billing columns (stripe_customer_id, plan_tier, subscription_status, trial_ends_at)
provides:
  - Stripe Checkout session creation API route
  - Stripe Customer Portal session creation API route
  - Public pricing page with 4 plan tiers
  - Trial creation helper function
  - Daily trial-expiry cron job
affects: [11-04 (billing page), 11-05 (integration), 13-onboarding (trial setup)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Stripe Checkout redirect flow with org metadata in session + subscription"
    - "Admin-only billing routes via user_organisations role check"
    - "Trial provisioning pattern: Practice tier, 14-day expiry, cron-based expiration"

key-files:
  created:
    - app/api/stripe/create-checkout-session/route.ts
    - app/api/stripe/create-portal-session/route.ts
    - app/pricing/page.tsx
    - app/pricing/layout.tsx
    - lib/billing/trial.ts
    - app/api/cron/trial-expiry/route.ts
  modified: []

key-decisions:
  - "[D-11-03-01] Checkout route reuses existing stripe_customer_id or falls back to customer_email for new customers"
  - "[D-11-03-02] Practice tier highlighted as 'Popular' with primary ring indicator on pricing page"
  - "[D-11-03-03] Pricing page is a client component using browser Supabase client for auth state"
  - "[D-11-03-04] Trial-expiry cron uses batch .in() update rather than per-org sequential updates"

patterns-established:
  - "Stripe billing route pattern: authenticate via createClient(), verify admin role, call Stripe API, return { url }"
  - "Standalone page layout pattern: minimal header with logo + sign-in link, no dashboard nav"
  - "Cron expiry pattern: query for expired state, batch update, log each, return summary"

# Metrics
duration: 4min
completed: 2026-02-20
---

# Phase 11 Plan 03: Checkout, Portal, Pricing & Trial Summary

**Stripe Checkout + Customer Portal API routes, public pricing page with 4 tiers, 14-day Practice trial helper, and daily trial-expiry cron**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-20T23:49:20Z
- **Completed:** 2026-02-20T23:53:02Z
- **Tasks:** 2
- **Files created:** 6

## Accomplishments
- Checkout session creation endpoint embeds org_id in both session and subscription metadata for webhook provisioning
- Customer Portal session endpoint opens Stripe-hosted portal for subscription management (plan changes, payment methods, invoices)
- Both billing routes enforce admin-only access via user_organisations role check
- Public pricing page displays all 4 plan tiers (Lite, Sole Trader, Practice, Firm) with prices, limits, features, and CTA buttons
- Trial creation helper sets Practice tier with 14-day expiry and 150 client / 5 user limits
- Daily cron job transitions expired trials from 'trialing' to 'unpaid' status

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Stripe Checkout + Customer Portal API routes** - `07e8acf` (feat)
2. **Task 2: Create pricing page, trial logic, and trial-expiry cron** - `7d2ffbf` (feat)

## Files Created/Modified
- `app/api/stripe/create-checkout-session/route.ts` - POST handler creating Stripe Checkout Session with org metadata
- `app/api/stripe/create-portal-session/route.ts` - POST handler creating Stripe Customer Portal session
- `app/pricing/layout.tsx` - Standalone layout with minimal header (no dashboard nav)
- `app/pricing/page.tsx` - Client component displaying 4 plan cards with Stripe Checkout integration
- `lib/billing/trial.ts` - createTrialForOrg helper setting Practice tier trial with 14-day expiry
- `app/api/cron/trial-expiry/route.ts` - GET handler for daily cron that expires stale trials

## Decisions Made
- [D-11-03-01] Checkout route reuses existing stripe_customer_id when available, falls back to customer_email for first-time customers -- prevents duplicate Stripe customers
- [D-11-03-02] Practice tier marked as "Popular" with primary border ring and badge -- visual recommendation matching the trial tier
- [D-11-03-03] Pricing page uses client-side Supabase auth check for redirect logic (authenticated users go to Stripe, unauthenticated redirect to login)
- [D-11-03-04] Trial-expiry cron uses batch `.in()` update rather than sequential per-org updates -- more efficient for bulk expiration

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. Stripe Price IDs are already configured as env vars from Plan 11-01.

## Next Phase Readiness
- Checkout and portal routes ready for webhook handler (Plan 11-02) to complete the provisioning loop
- Pricing page CTA buttons will redirect to Stripe Checkout once Price IDs are set in environment
- Trial helper ready for onboarding flow (Phase 13) to call during org creation
- Trial-expiry cron needs to be added to Vercel cron schedule (vercel.json) in Plan 11-05

## Self-Check: PASSED

---
*Phase: 11-stripe-billing*
*Completed: 2026-02-20*
