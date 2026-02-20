# Phase 11: Stripe Billing - Context

**Gathered:** 2026-02-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Connect each organisation to a Stripe subscription that determines plan tier and usage limits. Includes: Stripe Checkout integration, billing management page, webhook handling (provisioning + payment failure), usage limit enforcement (client count), and trial setup. Does NOT include: onboarding flow (Phase 13), subdomain routing (Phase 12), team invitation/user limit enforcement (Phase 13), or super-admin views (Phase 14).

</domain>

<decisions>
## Implementation Decisions

### Pricing & plan display
- Dedicated `/pricing` page (standalone route, not embedded in billing)
- Plan cards show: monthly price, client limit, user limit, and feature bullet points
- All 4 tiers are paid (lite, sole_trader, practice, firm) — no free tier
- Use sensible placeholder prices and limits — finalized before launch

### Billing management page
- Status overview style — current plan, subscription status, next billing date, usage bars (client count vs limit)
- "Manage billing" button opens Stripe Customer Portal for all changes (upgrade, downgrade, payment method, cancellation)
- Invoice history handled entirely by Stripe Portal — no in-app invoice list
- Org admins only — members cannot see billing page at all
- Plan changes (upgrade/downgrade) go through Stripe Customer Portal, not in-app

### Usage limits & enforcement
- Hard block when client limit reached — cannot add client, show error with "Upgrade your plan" link to /pricing
- 80% usage warning appears on billing page only (not dashboard banner)
- User (team member) limits deferred to Phase 13 — only client limits enforced in Phase 11
- Lapsed subscription (payment failed / cancelled) = read-only mode: data visible, but cannot send emails, add clients, or modify data

### Trial experience
- Trial orgs get Practice tier access (mid-range, not full unlock)
- Trial status shown on billing page only — no persistent banner during trial
- Trial expiry = same read-only mode as lapsed subscription
- Trial-ending email (NOTF-01, Phase 13 scope) should link directly to /pricing page

### Claude's Discretion
- Placeholder pricing amounts and limit numbers
- Billing page layout and component design
- Webhook endpoint structure and error handling
- Stripe Customer Portal configuration options
- Usage bar visual design

</decisions>

<specifics>
## Specific Ideas

- Stripe Hosted Checkout (redirect flow) — already decided, no client-side Stripe.js needed
- `checkout.session.completed` as sole provisioning trigger (not `subscription.created`) — avoids race condition
- Stripe API version pinned to `2026-01-28.clover`
- Package: `stripe@^20.3.1`
- Plan tiers enum already created in Phase 10: `('lite', 'sole_trader', 'practice', 'firm')`
- Read-only mode is the consistent degraded state for both trial expiry and payment lapse
- NOTF-02 (payment-failed email) is in scope for Phase 11 — link to Stripe Customer Portal

</specifics>

<deferred>
## Deferred Ideas

- NOTF-01 trial-ending email — Phase 13 (but decision captured: link to /pricing)
- User/team member limit enforcement — Phase 13
- Per-org Postmark credentials — Phase 12
- Annual billing option — v3.x backlog
- Metered/usage-based overage billing — v3.x backlog

</deferred>

---

*Phase: 11-stripe-billing*
*Context gathered: 2026-02-20*
