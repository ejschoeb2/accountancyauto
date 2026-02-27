# Phase 23: Unified Pricing Experience with Slider Calculator and Upgrade Prompts - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace static pricing cards on `/pricing` page and setup wizard with the shared slider calculator from the marketing landing page. Remove the Firm tier and implement Stripe metered/usage-based overage billing on Practice. Add client-limit upgrade modal. Lead with "Start Free" messaging everywhere.

</domain>

<decisions>
## Implementation Decisions

### Slider & Layout
- Extract the marketing slider calculator (`components/marketing/pricing-section.tsx`) into a shared component reusable on `/pricing`, the setup wizard, and the marketing page
- Identical component on all three pages — same layout, animations, tier card, and slider behavior
- Full-width layout in the setup wizard (not a compact variant)
- `/pricing` page uses slider only — no static tier cards or comparison grid alongside it
- Default slider position: 1 client (deep in the Free zone), not 50 like marketing currently uses
- Marketing page default can stay at 50 or be aligned to 1 — Claude's discretion

### Plan Selection Flow
- Wizard step shows the slider calculator with the ability to optionally checkout for a paid tier
- Free zone CTA: "Start Free"
- Paid tier CTA: "Subscribe & Continue" (redirects to Stripe Checkout, returns to wizard)
- Subtle note below the slider: "You can upgrade or downgrade anytime from Settings." (or similar reassurance text)
- Everyone can start free without friction — no pressure to pick a paid plan

### Upgrade Prompt
- Modal dialog triggered when a user tries to add a client at/over their plan limit
- Modal shows: current usage (e.g. "25/25 clients used"), the next tier up (name, price, new limit), and an "Upgrade" button linking to Stripe checkout for that tier
- Only triggered on action (trying to add a client) — no proactive warnings at 90% etc.
- CSV import: if import would exceed limit, show warning that only N of M clients will be imported (up to limit). Offer upgrade option to import all. Allow partial import without upgrading.
- Modal does NOT appear — only the upgrade modal for when they actively try to add

### Pricing Model & Tier Structure
- **Firm tier removed entirely** — from Stripe, from `lib/stripe/plans.ts`, from all UI
- New tier structure:
  - **Free:** £0, up to 25 clients
  - **Starter:** £39/mo, 26–100 clients
  - **Practice:** £89/mo base, 101–300 clients
  - **Practice + overage:** £89/mo + £0.60 per client above 300 (metered billing)
  - **Enterprise:** Custom pricing, unlimited clients
- Stripe metered/usage-based billing fully implemented for overage above 300 clients on Practice tier
- Overage pricing displayed consistently everywhere (slider shows the £89 + overage breakdown)
- All references to Firm tier cleaned up across codebase (env vars, webhook handler, billing page, etc.)

### Claude's Discretion
- Marketing page slider default position (keep 50 or align to 1)
- Exact wording of the "upgrade anytime" note in the wizard
- Upgrade modal visual design (within project's existing design patterns)
- How to handle existing Firm tier subscribers during migration (grace period, auto-migrate to Practice + overage, etc.)
- Stripe metered billing implementation details (usage record reporting frequency, invoice line item structure)

</decisions>

<specifics>
## Specific Ideas

- The slider on the marketing page already has the overage pricing logic for Firm tier — this becomes the canonical display for Practice overage
- The slider already handles tier detection, animated transitions, and overage calculation — extraction should preserve all of this
- Upgrade modal should feel native to the app (not a marketing popup) — use existing Dialog/modal patterns from the codebase

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 23-unified-pricing-experience-with-slider-calculator-and-upgrade-prompts*
*Context gathered: 2026-02-27*
