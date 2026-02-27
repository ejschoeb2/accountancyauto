---
phase: 23-unified-pricing-experience-with-slider-calculator-and-upgrade-prompts
plan: 02
subsystem: ui
tags: [react, framer-motion, pricing, stripe, wizard]

# Dependency graph
requires:
  - phase: 23-01
    provides: "PlanTier type, PAID_PLAN_TIERS, PRACTICE_OVERAGE_THRESHOLD/RATE_PENCE constants from lib/stripe/plans.ts"
provides:
  - "Shared PricingSlider component (components/pricing-slider.tsx) with tier detection, animated card, and configurable CTA callbacks"
  - "Marketing PricingSection simplified to thin wrapper around PricingSlider"
  - "Pricing page replaced with slider-only layout + Stripe Checkout integration"
  - "Setup wizard plan step replaced with PricingSlider using wizard-specific CTA labels"
affects:
  - "23-03 (metered billing upgrade prompt — may embed PricingSlider for upgrade flow)"
  - "23-04 (client-limit upgrade prompt — same component)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared pricing component with configurable CTA mode: href (marketing) or callback (wizard/pricing page)"
    - "loadingTier prop pattern: spinner shown only on the currently active tier's CTA button"
    - "Practice overage (301+ clients) expressed as base + per-client breakdown within the same tier key"

key-files:
  created:
    - components/pricing-slider.tsx
  modified:
    - components/marketing/pricing-section.tsx
    - app/pricing/page.tsx
    - app/(auth)/setup/wizard/page.tsx

key-decisions:
  - "[D-23-02-01] Practice overage card animates when overageClients changes (key includes -overage suffix) — prevents stale card when user drags from 300 to 301+"
  - "[D-23-02-02] onSelectTier callback takes precedence over ctaHrefs — <button> rendered when callback provided, <a> rendered otherwise; prevents double navigation"
  - "[D-23-02-03] Sparkles import removed from wizard; PLAN_TIERS/PAID_PLAN_TIERS removed (PricingSlider owns tier logic); formatPrice helper removed (unused)"
  - "[D-23-02-04] Marketing PricingSection keeps section wrapper with id=pricing for anchor nav — only the inline slider logic moved into shared component"

patterns-established:
  - "Shared slider component pattern: defaultClients, onSelectTier, ctaLabels, ctaHrefs, showUpgradeNote, isLoading/loadingTier"

requirements-completed: []

# Metrics
duration: 4min
completed: 2026-02-27
---

# Phase 23 Plan 02: Slider Calculator Extraction Summary

**Shared PricingSlider component extracted from marketing page, deployed across marketing, /pricing, and setup wizard — Firm tier removed, Practice overage (301+ clients) rendered as £89 + N x £0.60 breakdown within the same Practice tier card**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-02-27T01:49:33Z
- **Completed:** 2026-02-27T01:53:07Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Created `components/pricing-slider.tsx` — shared component with full API (defaultClients, onSelectTier callback, ctaLabels, ctaHrefs, showUpgradeNote, isLoading/loadingTier)
- Replaced marketing section inline slider with thin PricingSection wrapper (defaultClients=50)
- Replaced static 5-column Card grid on /pricing with PricingSlider (defaultClients=1) + Stripe Checkout integration
- Replaced 4-column plan Card grid in setup wizard with PricingSlider (ctaLabels: "Start Free"/"Subscribe & Continue", showUpgradeNote=true)
- Firm tier completely removed from all slider logic; Practice handles 101-499 clients with overage above 300

## Task Commits

Each task was committed atomically:

1. **Task 1: Create shared PricingSlider component** - `ad23bc7` (feat)
2. **Task 2: Replace marketing section, /pricing page, and wizard plan step with shared PricingSlider** - `bfdaca2` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `components/pricing-slider.tsx` — New shared component; exports PricingSlider; tier detection (Free/Starter/Practice/Enterprise); animated card with AnimatePresence; dual CTA mode (href vs callback); loading spinner support
- `components/marketing/pricing-section.tsx` — Reduced from 266 lines to 10 lines; wraps PricingSlider with defaultClients=50 inside section#pricing
- `app/pricing/page.tsx` — Replaced static Card grid with PricingSlider; Stripe Checkout handler preserved; free/enterprise tier handled via redirect; error display preserved
- `app/(auth)/setup/wizard/page.tsx` — Plan step block replaced with PricingSlider; removed Sparkles, PLAN_TIERS, PAID_PLAN_TIERS imports; removed formatPrice helper; enterprise routes to mailto

## Decisions Made

- **[D-23-02-01]** Practice overage card uses key `practice-overage` (vs `practice`) in AnimatePresence — triggers animation when user crosses the 300 threshold, making the overage breakdown visually appear as a card transition rather than an in-place text change.
- **[D-23-02-02]** `onSelectTier` callback takes precedence and renders a `<button>` element; absence of callback renders an `<a>` tag. This prevents the wizard from triggering both a callback and a navigation event simultaneously.
- **[D-23-02-03]** `Sparkles`, `PLAN_TIERS`, `PAID_PLAN_TIERS`, and `formatPrice` all removed from wizard — now that tier selection logic lives in PricingSlider, the wizard page no longer needs them. Verified no other wizard code referenced them.
- **[D-23-02-04]** Marketing `PricingSection` keeps `<section id="pricing" className="py-20 lg:py-28">` wrapper — anchor nav from the marketing page header (`#pricing`) must continue to work.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- PricingSlider component available at `components/pricing-slider.tsx` for use in Phase 23 Plans 03/04 (upgrade prompts)
- Tier detection logic centralised — any future tier changes only need updating in one place
- Marketing page, /pricing, and setup wizard all use identical slider UI

## Self-Check: PASSED

All created/modified files verified present on disk.
All task commits verified in git log (ad23bc7, bfdaca2).

---
*Phase: 23-unified-pricing-experience-with-slider-calculator-and-upgrade-prompts*
*Completed: 2026-02-27*
