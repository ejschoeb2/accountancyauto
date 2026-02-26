# Pricing Strategy

## Pricing Philosophy

**Primary axis: client count.** Every client represents a set of deadlines tracked, reminders sent, and communications managed. Client count is the closest proxy for value delivered.

**Unlimited users on all plans.** There are no user seat limits. Every accountant in the firm can access the platform. Each accountant sees only their own clients (owner-scoped isolation), so the workspace scales naturally as the team grows without any seat-limit friction.

**Feature gating.** Document storage and AI features are reserved for mid-tier and above. This gives lower tiers a clear reason to upgrade as practices grow, while ensuring infrastructure costs are covered by the plans that use those features.

**Overage over hard cutoffs.** Firms that outgrow a tier are charged a modest overage rate rather than being hard-blocked. This is friendlier to growing practices and generates incremental revenue without forcing premature upgrades. Stripe Billing handles overage natively.

---

## Tiers

### Lite — £20/month

| Limit | Value |
|-------|-------|
| Clients | Up to 15 |

**Included features:**
- Full reminder engine (Corp Tax, CT600, Companies House, VAT, Self Assessment)
- Client dashboard
- Automated email delivery via Postmark
- Inbound email logging
- Email reply templates with client variable substitution

**Excluded:**
- Document storage
- AI agent interface
- HMRC API integration

**Who this is for:** A sole trader accountant just starting out, testing the product, or managing a very small book. The 15-client ceiling acts as a low-friction entry point and a natural conversion funnel to Sole Trader as the practice grows.

---

### Sole Trader — £39/month

| Limit | Value |
|-------|-------|
| Clients | Up to 40 |

**Included features:**
- Everything in Lite
- Overage: £15 per additional 50 clients beyond 40

**Excluded:**
- Document storage
- AI agent interface
- HMRC API integration

**Who this is for:** An established sole trader managing a full book. The 40-client ceiling reflects the realistic shape of a mature one-person practice.

---

### Practice — £89/month

| Limit | Value |
|-------|-------|
| Clients | Up to 150 |

**Included features:**
- Everything in Sole Trader
- Document storage (Supabase Storage, EU-region, signed URL access)
- Attachment extraction from inbound client emails
- Per-client document history with download
- AI agent interface (when built — Phase 5)
- Overage: £15 per additional 50 clients beyond 150

**Excluded:**
- HMRC API integration
- Priority support

**Who this is for:** A small firm with multiple accountants each managing their own client book. Document storage is the key upgrade unlock — it directly replaces the inbox-hunting workflow with a central document record per client.

---

### Firm — £159/month

| Limit | Value |
|-------|-------|
| Clients | Unlimited |

**Included features:**
- Everything in Practice
- HMRC API integration (when built — Phase 4)
  - MTD VAT return submission
  - MTD Income Tax Self Assessment (as it becomes mandatory)
  - OAuth 2.0 client authorisation (no credential storage)
- Priority support
- Overage: N/A (unlimited)

**Who this is for:** An established mid-size firm with multiple staff and a large client base. The HMRC API integration is the primary upgrade driver — submitting VAT returns directly from the dashboard rather than through the portal is the feature most likely to justify the price difference to a firm of this size, particularly as MTD mandation extends to Income Tax.

---

## Overage Pricing

| Tier | Included clients | Overage rate |
|------|-----------------|--------------|
| Lite | 15 | Not available — upgrade to Sole Trader |
| Sole Trader | 40 | £15 per additional 50 clients |
| Practice | 150 | £15 per additional 50 clients |
| Firm | Unlimited | N/A |

Lite does not support overage — a firm exceeding 15 clients should move to Sole Trader.

---

## Free Plan

A permanent free tier (up to 25 clients) is available with no card required. Users can upgrade to a paid plan at any time via Stripe Checkout. Firms on paid plans that lapse into `unpaid` / `past_due` are moved to a read-only state (data retained for 30 days, then deleted in line with the privacy policy).

---

## Feature Availability by Tier

| Feature | Lite | Sole Trader | Practice | Firm |
|---------|------|------------|----------|------|
| Reminder engine | Yes | Yes | Yes | Yes |
| Dashboard | Yes | Yes | Yes | Yes |
| Email delivery | Yes | Yes | Yes | Yes |
| Inbound email logging | Yes | Yes | Yes | Yes |
| Reply templates | Yes | Yes | Yes | Yes |
| Unlimited users | Yes | Yes | Yes | Yes |
| Document storage | No | No | Yes | Yes |
| AI agent interface | No | No | Yes | Yes |
| HMRC API integration | No | No | No | Yes |
| Priority support | No | No | No | Yes |

*AI agent and HMRC API integration are listed for completeness. Both are future phases — see ROADMAP.md.*

---

## Database Schema (organisations table additions)

```sql
plan_tier             text         -- 'lite' | 'sole_trader' | 'practice' | 'firm'
client_count_limit    integer      -- 15 / 40 / 150 / null (unlimited)
stripe_customer_id    text
stripe_subscription_id text
subscription_status   text         -- 'active' | 'trialling' | 'past_due' | 'cancelled'
trial_ends_at         timestamptz
```

Limit enforcement lives in application-layer server actions, not at the database level. Before adding a client, the server action checks current count against the limit and returns an upgrade prompt if exceeded.

---

## Rationale for Tier Pricing

**Why £20 for Lite?**
Low enough to remove price as a barrier for a sole trader evaluating the product. At this price point it is also clearly not the plan to stay on indefinitely — the natural ceiling of 15 clients creates organic upgrade pressure without any artificial friction.

**Why £39 for Sole Trader?**
The Lite tier anchors the bottom of the ladder. The 40-client ceiling reflects a mature one-person practice book.

**Why £89 for Practice?**
Document storage has real infrastructure costs (Supabase Storage, EU region). The modest increase covers this and positions Practice as a meaningfully different product from the lower tiers, not just a higher client limit.

**Why £159 for Firm?**
HMRC API integration, when live, is a substantial capability that larger firms will pay a premium for — particularly as MTD for Income Tax becomes mandatory from April 2026/2027. This price remains well below established practice management tools (Karbon, Iris, Digita) which typically charge per-user rates that reach £200-500+/month for a firm of this size.

---

## Notes for Review

- **Validate client count thresholds with the accountant.** The 15/40/150/unlimited bands are estimates based on general UK practice size data. If the accountant's experience suggests different natural breakpoints, adjust before committing these to the database schema and Stripe products.
- **Revisit pricing after first 10 paying customers.** Early pricing should be treated as a hypothesis. If conversion from trial is low, the issue is more likely messaging than price. If churn is high at a specific tier, investigate whether the client ceiling is the trigger.
- **Annual billing option.** Not modelled here but worth adding: two months free for annual upfront (effective ~17% discount). Improves cash flow and reduces churn. Simple to configure in Stripe.
