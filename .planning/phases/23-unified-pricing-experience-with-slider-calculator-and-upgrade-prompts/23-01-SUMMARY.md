---
phase: 23-unified-pricing-experience-with-slider-calculator-and-upgrade-prompts
plan: "01"
subsystem: billing
tags: [stripe, plans, tiers, billing, metered-overage]
dependency_graph:
  requires: []
  provides:
    - lib/stripe/plans.ts restructured with 4 tiers (no firm)
    - PRACTICE_OVERAGE_THRESHOLD and PRACTICE_OVERAGE_RATE_PENCE exported
    - Legacy firm -> practice mapping in billing page
  affects:
    - All files importing from lib/stripe/plans.ts
    - Billing page display for legacy firm orgs
    - Upgrade section UI (now 2 tiers)
tech_stack:
  added: []
  patterns:
    - getEffectivePlanTier() helper for legacy tier migration
    - PRACTICE_OVERAGE_THRESHOLD/RATE_PENCE exported constants for downstream use
key_files:
  created: []
  modified:
    - lib/stripe/plans.ts
    - ENV_VARIABLES.md
    - app/pricing/page.tsx
    - lib/stripe/webhook-handlers.ts
    - app/(dashboard)/billing/components/upgrade-plan-section.tsx
    - app/(dashboard)/billing/page.tsx
decisions:
  - "Practice.clientLimit set to null — overage billing handles capacity, not hard limits"
  - "getEffectivePlanTier() maps legacy firm -> practice for display without DB migration"
  - "PRACTICE_OVERAGE_THRESHOLD=300, PRACTICE_OVERAGE_RATE_PENCE=60 — exported as named constants"
  - "STRIPE_PRICE_PRACTICE_OVERAGE documented in ENV_VARIABLES.md but not wired yet (Plan 03)"
metrics:
  duration: "~8 min"
  completed: "2026-02-27T01:46:50Z"
  tasks_completed: 2
  files_modified: 6
---

# Phase 23 Plan 01: Remove Firm Tier and Restructure Plan Configuration Summary

Firm tier removed from entire billing stack; Practice tier restructured to unlimited clients with metered overage model (£0.60/client above 300). All backend references updated — `lib/stripe/plans.ts` as single source of truth, billing page handles legacy firm orgs gracefully, upgrade section now shows 2 paid tiers.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Restructure plan tier configuration and remove Firm | 5204420 | lib/stripe/plans.ts, ENV_VARIABLES.md, app/pricing/page.tsx |
| 2 | Update webhook handlers, checkout route, and billing components | b793972 | lib/stripe/webhook-handlers.ts, upgrade-plan-section.tsx, billing/page.tsx |

## What Was Built

`lib/stripe/plans.ts` is now the clean single source of truth for the new 4-tier model: Free (25 clients), Starter (100 clients), Practice (unlimited + metered overage), Enterprise (custom). The Firm tier is gone from both the type definition and the `PLAN_TIERS` record. Two new constants — `PRACTICE_OVERAGE_THRESHOLD = 300` and `PRACTICE_OVERAGE_RATE_PENCE = 60` — are exported for use by the slider calculator (Plan 02) and metered billing implementation (Plan 03).

The billing page adds a `getEffectivePlanTier()` helper that maps legacy `'firm'` to `'practice'` for display, preventing a runtime throw if an existing org still has `plan_tier = 'firm'` in the database.

The upgrade section now renders only Starter and Practice cards in a 2-column grid, with a small overage note under the Practice price: "Base price. £0.60/client above 300."

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed TypeScript error in app/pricing/page.tsx**
- **Found during:** Task 1 verification (`npx tsc --noEmit`)
- **Issue:** `TIER_ORDER` array contained `"firm"` which is no longer assignable to `PlanTier` after the type was narrowed. This blocked TypeScript compilation.
- **Fix:** Removed `"firm"` from `TIER_ORDER`; updated grid from `lg:grid-cols-5` to `lg:grid-cols-4` to match the now-4-tier layout.
- **Files modified:** `app/pricing/page.tsx`
- **Commit:** 5204420
- **Note:** The plan mentioned `app/pricing/page.tsx` would be "handled in Plan 02" but the TypeScript error was blocking and needed immediate resolution. Plan 02 will still rework the pricing page with the slider calculator.

## Verification

- `npx tsc --noEmit` — zero errors
- `grep -r '"firm"' lib/stripe/ app/(dashboard)/billing/` — only match is the legacy mapping comment in `getEffectivePlanTier()` (not a tier value reference)
- `lib/stripe/plans.ts` exports exactly 4 tiers: free, starter, practice, enterprise
- `PAID_PLAN_TIERS` contains exactly `["starter", "practice"]`
- Practice tier has `clientLimit: null`

## Self-Check: PASSED

All key files exist. Both task commits (5204420, b793972) confirmed in git log.
