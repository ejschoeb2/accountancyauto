---
phase: 23-unified-pricing-experience-with-slider-calculator-and-upgrade-prompts
plan: "03"
subsystem: billing
tags: [stripe, metered-billing, practice-tier, cron, usage-reporting]
dependency_graph:
  requires: ["23-01"]
  provides: ["metered-billing-utility", "usage-reporting-cron"]
  affects: ["lib/stripe/plans.ts", "lib/stripe/webhook-handlers.ts", "vercel.json"]
tech_stack:
  added: []
  patterns:
    - "Stripe Billing Meter Events API (stripe.billing.meterEvents.create) for usage reporting"
    - "Dynamic import in webhook handler for non-blocking initial usage report"
    - "CRON_SECRET bearer token auth for cron-only POST routes"
key_files:
  created:
    - lib/stripe/metered-billing.ts
    - app/api/stripe/report-usage/route.ts
  modified:
    - lib/stripe/plans.ts
    - app/api/stripe/create-checkout-session/route.ts
    - lib/stripe/webhook-handlers.ts
    - vercel.json
decisions:
  - "[D-23-03-01] Stripe Billing Meter Events API used instead of legacy subscriptionItems.createUsageRecord — the stripe@20.x SDK (API version 2026-01-28.clover) has fully removed the old metered usage record API; new API requires a Billing Meter with event_name configured in Stripe Dashboard"
  - "[D-23-03-02] PRACTICE_METER_EVENT_NAME env var added to plans.ts — meter event name must match Stripe Billing Meter event_name; defaults to 'practice_overage_clients' if not set"
  - "[D-23-03-03] Usage reporting queries stripe_customer_id (not stripe_subscription_id) — Billing Meter Events map to customers, not subscription items; consistent with new API design"
  - "[D-23-03-04] Initial usage report in webhook handler uses dynamic import — avoids pulling metered-billing module into all non-Practice checkout event paths"
  - "[D-23-03-05] reportUsageForAllPracticeOrgs queries by stripe_customer_id IS NOT NULL — ensures only orgs with Stripe customers (active subscriptions) are reported"
metrics:
  duration: "~15 minutes"
  completed: "2026-02-27"
  tasks_completed: 2
  files_changed: 6
---

# Phase 23 Plan 03: Stripe Metered Billing Infrastructure Summary

**One-liner:** Stripe Billing Meter Events-based overage reporting for Practice tier: checkout dual line items, daily cron route, and webhook-triggered initial report using stripe@20.x new API.

## What Was Built

Practice tier metered billing infrastructure enabling £89/mo base + £0.60/client overage billing above 300 clients:

1. **`lib/stripe/plans.ts`** — Added `PRACTICE_OVERAGE_PRICE_ID` (reads `STRIPE_PRICE_PRACTICE_OVERAGE`) and `PRACTICE_METER_EVENT_NAME` (reads `STRIPE_METER_EVENT_NAME`, defaults to `practice_overage_clients`) exports.

2. **`app/api/stripe/create-checkout-session/route.ts`** — Practice checkout now builds two line items: the flat-rate £89/mo price + the metered overage price (when `PRACTICE_OVERAGE_PRICE_ID` is set). Starter and other tiers unchanged.

3. **`lib/stripe/metered-billing.ts`** — New utility module with three exports:
   - `getOverageClientCount(totalClients)` — pure function, returns `max(0, clients - 300)`
   - `reportUsageForOrg(orgId)` — fetches org client count, creates a Stripe Billing Meter event for the overage amount
   - `reportUsageForAllPracticeOrgs()` — iterates all Practice orgs with Stripe customers, calls `reportUsageForOrg` for each, returns `{processed, reported, errors}` summary

4. **`app/api/stripe/report-usage/route.ts`** — POST handler protected by `Authorization: Bearer {CRON_SECRET}`, calls `reportUsageForAllPracticeOrgs()` and returns the result JSON.

5. **`lib/stripe/webhook-handlers.ts`** — After successful Practice checkout provisioning, dynamically imports and calls `reportUsageForOrg(orgId)` so the first billing period starts with accurate overage data. Non-blocking (errors are logged, not thrown).

6. **`vercel.json`** — Added `{ path: "/api/stripe/report-usage", schedule: "0 3 * * *" }` cron entry (3 AM UTC daily).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Adapted metered billing to use Stripe Billing Meter Events API**
- **Found during:** Task 2 — reviewing Stripe SDK type definitions
- **Issue:** Plan specified `stripe.subscriptionItems.createUsageRecord(meteredItem.id, { quantity, action: 'set', timestamp })` but this method does not exist in `stripe@20.x` (API version `2026-01-28.clover`). Stripe removed the legacy metered billing API and replaced it with the Billing Meters + Meter Events system.
- **Fix:** `reportUsageForOrg` now uses `stripe.billing.meterEvents.create({ event_name, payload: { stripe_customer_id, value }, timestamp })`. The meter event approach maps usage to a customer (via `stripe_customer_id`) rather than a subscription item, which is the correct pattern for the current Stripe API version.
- **Impact:** The `PRACTICE_METER_EVENT_NAME` export was added to `plans.ts` to supply the meter event name. The Stripe Billing Meter must be created in the Dashboard with `event_name` matching this value. The `STRIPE_METER_EVENT_NAME` env var is documented for this purpose.
- **Files modified:** `lib/stripe/metered-billing.ts`, `lib/stripe/plans.ts`
- **Commits:** a7fc550, 2de16d4

## Stripe Dashboard Setup Required (not code)

Before metered billing goes live, a Stripe Billing Meter must be created:
- **Event name:** value of `STRIPE_METER_EVENT_NAME` env var (default: `practice_overage_clients`)
- **Customer mapping:** `by_id` using `stripe_customer_id` key
- **Value settings:** `event_payload_key = "value"`
- **Aggregation:** `last` (reports current snapshot, not cumulative sum)

The `STRIPE_PRICE_PRACTICE_OVERAGE` Stripe Price must be configured as a metered price attached to the above meter.

## Self-Check: PASSED

- [x] `lib/stripe/metered-billing.ts` exists with correct exports
- [x] `app/api/stripe/report-usage/route.ts` exists with POST handler
- [x] `PRACTICE_OVERAGE_PRICE_ID` exported from `lib/stripe/plans.ts`
- [x] `PRACTICE_METER_EVENT_NAME` exported from `lib/stripe/plans.ts`
- [x] Practice checkout includes conditional metered line item
- [x] `vercel.json` includes `report-usage` cron (3 AM UTC daily)
- [x] `npx tsc --noEmit` passes cleanly
- [x] Commits: a7fc550, 2de16d4
