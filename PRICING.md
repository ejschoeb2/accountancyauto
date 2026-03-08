# Pricing Strategy

## Pricing Philosophy

**Primary axis: client count.** Every client represents a set of deadlines tracked, reminders sent, and communications managed. Client count is the closest proxy for value delivered.

**Unlimited users on all plans.** There are no user seat limits. Every accountant in the firm can access the platform. Each accountant sees only their own clients (owner-scoped isolation), so the workspace scales naturally as the team grows without any seat-limit friction.

**Feature gating.** Document storage and AI features are reserved for mid-tier and above. This gives lower tiers a clear reason to upgrade as practices grow, while ensuring infrastructure costs are covered by the plans that use those features.

**Overage over hard cutoffs.** Firms that outgrow a tier are charged a modest overage rate rather than being hard-blocked. This is friendlier to growing practices and generates incremental revenue without forcing premature upgrades. Stripe Billing handles overage natively.

---

## Tiers

### Free — £0/month

| Limit | Value |
|-------|-------|
| Clients | Up to 10 |

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

**Who this is for:** Anyone evaluating the product. The 10-client ceiling is enough to try it out but not enough to run a real practice on — creating a natural upgrade path.

---

### Solo — £19/month

| Limit | Value |
|-------|-------|
| Clients | 11 – 40 |

**Included features:**
- Everything in Free
- Cloud storage integration

**Excluded:**
- Custom templates
- AI agent interface
- HMRC API integration

**Who this is for:** A sole trader accountant managing a small client list. The 40-client ceiling reflects a typical one-person practice book.

---

### Starter — £39/month

| Limit | Value |
|-------|-------|
| Clients | 41 – 80 |

**Included features:**
- Everything in Solo
- Custom templates

**Excluded:**
- AI agent interface
- HMRC API integration

**Who this is for:** An independent accountant or small practice that has outgrown the solo tier.

---

### Practice — £69/month

| Limit | Value |
|-------|-------|
| Clients | 81 – 200 |

**Included features:**
- Everything in Starter
- Priority support
- Overage: metered billing above 200 clients (£0.60/client)

**Who this is for:** A growing practice managing a wide range of deadlines across multiple accountants.

---

### Firm — £109/month

| Limit | Value |
|-------|-------|
| Clients | 201 – 400 |

**Included features:**
- Everything in Practice
- Priority support

**Who this is for:** An established firm with a broad portfolio of clients.

---

### Enterprise — Custom pricing

| Limit | Value |
|-------|-------|
| Clients | Unlimited |

**Included features:**
- Everything in Firm
- Dedicated account manager
- Custom integrations

**Who this is for:** Large firms requiring bespoke solutions.

---

## Database Schema (organisations table)

```sql
plan_tier             text         -- 'free' | 'solo' | 'starter' | 'practice' | 'firm' | 'enterprise'
client_count_limit    integer      -- 10 / 40 / 80 / 200 / 400 / null (unlimited)
stripe_customer_id    text
stripe_subscription_id text
stripe_price_id       text
subscription_status   text         -- 'active' | 'trialing' | 'past_due' | 'cancelled' | 'unpaid'
trial_ends_at         timestamptz
```

Limit enforcement lives in application-layer server actions, not at the database level. Before adding a client, the server action checks current count against the limit and returns an upgrade prompt if exceeded.

---

## Free Plan

A permanent free tier (up to 10 clients) is available with no card required. Users can upgrade to a paid plan at any time via Stripe Checkout. Firms on paid plans that lapse into `unpaid` / `past_due` are moved to a read-only state.

---

## Feature Availability by Tier

| Feature | Free | Solo | Starter | Practice | Firm | Enterprise |
|---------|------|------|---------|----------|------|------------|
| Reminder engine | Yes | Yes | Yes | Yes | Yes | Yes |
| Dashboard | Yes | Yes | Yes | Yes | Yes | Yes |
| Email delivery | Yes | Yes | Yes | Yes | Yes | Yes |
| Inbound email logging | Yes | Yes | Yes | Yes | Yes | Yes |
| Reply templates | Yes | Yes | Yes | Yes | Yes | Yes |
| Unlimited users | Yes | Yes | Yes | Yes | Yes | Yes |
| Cloud storage | No | Yes | Yes | Yes | Yes | Yes |
| Custom templates | No | No | Yes | Yes | Yes | Yes |
| Priority support | No | No | No | Yes | Yes | Yes |
| Dedicated account manager | No | No | No | No | No | Yes |
| Custom integrations | No | No | No | No | No | Yes |

---

## Notes for Review

- **Validate client count thresholds with the accountant.** The 10/40/80/200/400 bands are estimates based on general UK practice size data.
- **Revisit pricing after first 10 paying customers.** Early pricing should be treated as a hypothesis.
- **Annual billing option.** Not modelled here but worth adding: two months free for annual upfront (~17% discount).
