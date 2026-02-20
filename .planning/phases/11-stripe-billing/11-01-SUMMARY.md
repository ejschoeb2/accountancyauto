---
phase: 11-stripe-billing
plan: 01
subsystem: payments
tags: [stripe, billing, database, migration, usage-limits, read-only-mode]

# Dependency graph
requires:
  - phase: 10-org-data-model-rls-foundation
    provides: organisations table with plan_tier, subscription_status, trial_ends_at, stripe_customer_id columns
provides:
  - processed_webhook_events table for idempotent webhook processing
  - stripe_price_id column on organisations
  - Stripe SDK singleton client (pinned API version)
  - Plan tier configuration with env-var price IDs and placeholder limits
  - checkClientLimit and getUsageStats billing utilities
  - isOrgReadOnly and requireWriteAccess enforcement functions
affects: [11-02 webhook handler, 11-03 checkout, 11-04 billing page, 11-05 enforcement middleware]

# Tech tracking
tech-stack:
  added: [stripe@20.3.1]
  patterns: [env-var Stripe price IDs for test/prod, singleton SDK client, read-only mode for lapsed subscriptions]

key-files:
  created:
    - supabase/migrations/20260220234124_stripe_billing_tables.sql
    - lib/stripe/client.ts
    - lib/stripe/plans.ts
    - lib/billing/usage-limits.ts
    - lib/billing/read-only-mode.ts
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "Stripe API version pinned to 2026-01-28.clover for consistent behavior"
  - "Price IDs loaded from env vars (STRIPE_PRICE_LITE etc.) for test vs production flexibility"
  - "processed_webhook_events uses service_role-only RLS (no authenticated access needed)"
  - "Read-only mode defaults to true for unknown/missing orgs (safe default)"
  - "Usage percentage rounded to nearest integer for display"

patterns-established:
  - "Stripe client import: import { stripe } from '@/lib/stripe/client'"
  - "Plan lookup: getPlanByTier(tier) for config, getPlanByPriceId(priceId) for webhook resolution"
  - "Write guard: await requireWriteAccess(orgId) at top of mutating server actions"
  - "Read-only evaluation: active = writable, trialing + valid trial_ends_at = writable, all else = read-only"

# Metrics
duration: 5min
completed: 2026-02-20
---

# Phase 11 Plan 01: Stripe Billing Foundation Summary

**Stripe SDK with pinned API version, 4-tier plan config with env-var price IDs, webhook idempotency table, and billing enforcement utilities (usage limits + read-only mode)**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-20T23:39:45Z
- **Completed:** 2026-02-20T23:44:33Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- Installed Stripe SDK (stripe@20.3.1) and created database migration with processed_webhook_events table and stripe_price_id column on organisations
- Created singleton Stripe client with pinned API version and 4-tier plan configuration with env-var-based price IDs
- Built billing enforcement utilities: client limit checking with usage stats and read-only mode determination for lapsed/expired subscriptions

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Stripe SDK + create database migration** - `87aa612` (chore)
2. **Task 2: Create Stripe client + plan tier configuration** - `87facec` (feat)
3. **Task 3: Create billing utility functions** - `d0e5fac` (feat)

## Files Created/Modified
- `supabase/migrations/20260220234124_stripe_billing_tables.sql` - processed_webhook_events table, stripe_price_id column, stripe_customer_id index
- `lib/stripe/client.ts` - Stripe SDK singleton with pinned API version 2026-01-28.clover
- `lib/stripe/plans.ts` - PLAN_TIERS config for lite/sole_trader/practice/firm with env-var price IDs
- `lib/billing/usage-limits.ts` - checkClientLimit and getUsageStats functions
- `lib/billing/read-only-mode.ts` - isOrgReadOnly and requireWriteAccess functions
- `package.json` - Added stripe@^20.3.1 dependency
- `package-lock.json` - Updated lock file

## Decisions Made
- **Stripe API version pinned:** Using `2026-01-28.clover` as decided in project planning
- **Price IDs from env vars:** `STRIPE_PRICE_LITE`, `STRIPE_PRICE_SOLE_TRADER`, `STRIPE_PRICE_PRACTICE`, `STRIPE_PRICE_FIRM` allow different Stripe accounts for test vs production
- **processed_webhook_events RLS:** Service-role only -- webhook handler uses admin client, no authenticated access needed
- **Safe defaults:** isOrgReadOnly returns true (read-only) when org not found or query fails
- **Placeholder prices confirmed:** Lite £20, Sole Trader £39, Practice £89, Firm £159 per month (to be finalised before launch)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

Environment variables must be configured (per 11-CONTEXT.md Pre-Execution Setup):
- `STRIPE_SECRET_KEY` - Stripe test/production secret key
- `STRIPE_PRICE_LITE`, `STRIPE_PRICE_SOLE_TRADER`, `STRIPE_PRICE_PRACTICE`, `STRIPE_PRICE_FIRM` - Stripe Price IDs for each tier
- `STRIPE_WEBHOOK_SECRET` - Pending (created after Plan 11-02 deploys webhook endpoint)
- `STRIPE_TAX_ENABLED` - Whether to collect UK VAT at checkout

## Next Phase Readiness
- All Plan 02 dependencies satisfied: processed_webhook_events table, Stripe client, plan tier config
- All Plan 03 dependencies satisfied: Stripe client for checkout session creation, plan tiers for pricing
- All Plan 04-05 dependencies satisfied: usage-limits and read-only-mode functions ready for enforcement
- Migration file ready to apply via `supabase db push` or dashboard migration

## Self-Check: PASSED

---
*Phase: 11-stripe-billing*
*Completed: 2026-02-20*
