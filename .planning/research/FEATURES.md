# Feature Landscape: v3.0 Multi-Tenancy & SaaS Platform

**Domain:** B2B SaaS platform features for accounting practice management — onboarding, billing, team management, super-admin
**Researched:** 2026-02-19
**Confidence:** HIGH (onboarding/billing patterns well-established; UK-specific requirements verified against Stripe and HMRC sources)

---

## Context

This document covers the SaaS *platform* features being added in v3.0. The core product (client management, deadline tracking, reminder engine, email templates) is already built and validated. This research focuses entirely on the new infrastructure layer:

1. Onboarding flow (account creation → org setup → plan selection → trial)
2. Billing management page (plan display, usage meters, upgrade/downgrade)
3. Team invite system (email-based invites, role assignment, accept flow)
4. Super-admin dashboard (tenant list, subscription status, usage monitoring)

---

## Table Stakes

Features users expect. Missing = product feels broken or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Multi-step onboarding wizard** | Standard SaaS pattern; single form creates too much friction | MEDIUM | Account → Org details → Plan → Trial. Max 4 steps — completion rates drop significantly beyond this (verified: product tours with >4 steps have below-average completion). |
| **14-day trial, no card required** | Opt-in trials are now baseline expectation for B2B SaaS; card-required creates abandonment | LOW | Conversion rate 18-25% for no-card trials (benchmarked 2025). Requires trial expiry logic and conversion email sequence. |
| **Trial countdown + expiry banner** | Users need constant awareness of trial status to motivate conversion | LOW | Show days remaining prominently. Show "Trial expired — choose a plan" gate on expiry. |
| **Stripe checkout for plan selection** | Industry standard; users expect Stripe-hosted checkout, not custom payment forms | MEDIUM | Use Stripe Checkout (hosted page) or Payment Element. Handles PCI compliance, 3DS2 (required in UK), card storage. |
| **Current plan display on billing page** | Users need to know what they're on at a glance | LOW | Show: plan name, price, renewal date, included limits (seats, clients). |
| **Usage meters on billing page** | Users on seat/client limited plans expect to see how much of their limit they've used | LOW | "3 of 5 users", "247 of 300 clients". Progress bar UI. Critical for plans with overages. |
| **Upgrade / downgrade self-service** | Users expect to change plans without contacting support | MEDIUM | Link to Stripe customer portal or custom plan change flow. Proration must be handled correctly. |
| **Invoice history** | B2B users need invoices for their own bookkeeping (especially accountants — they will notice if this is missing) | LOW | Stripe customer portal provides this out of the box. |
| **Cancel subscription self-service** | GDPR and UK consumer expectations require accessible cancellation | LOW | Stripe customer portal handles this. Optional: cancellation survey. |
| **Email invite for team members** | Standard since Slack popularised it — invite by email, recipient clicks link to join | LOW | Invite includes org name, sender name, role. Token-based accept link with expiry (72h recommended). |
| **Role-based access (Admin / Member)** | B2B tools need at least two roles; without this, all users have destructive permissions | LOW | Admin: manage team, billing, settings. Member: client/reminder work only. |
| **Pending invite management** | Admin needs to see who's been invited but hasn't accepted; resend or cancel | LOW | Invite list with status: Pending / Accepted / Expired. |
| **Org settings page** | Every SaaS has this — firm name, timezone, notification preferences | LOW | Firm name, email domain, VAT number field (for their own invoicing needs), timezone. |
| **User profile / password management** | Basic account hygiene — change password, update name/email | LOW | Handled largely by Supabase Auth. |
| **VAT number collection on checkout** | UK B2B accountants are VAT-registered; they need their VAT number on invoices | LOW | Stripe supports GB VAT number collection. HMRC auto-validates. Include in Stripe Tax config. |
| **VAT on SaaS subscription invoices** | UK law requires 20% VAT charged on SaaS subscriptions to UK B2B customers | LOW | Standard rate 20%. Stripe Tax handles calculation. Reverse charge applies only for non-UK B2B. |
| **Super-admin tenant list** | Internal tool to monitor all orgs | LOW | Table: org name, plan tier, subscription status, client count, user count, signup date. |
| **Super-admin subscription status** | Need to know which orgs are trialling, active, past-due, cancelled | LOW | Sync from Stripe webhooks. Statuses: trialing / active / past_due / canceled. |

---

## Differentiators

Features that are not universally expected but create competitive advantage for this product and audience. UK accounting practices are the target — they are detail-oriented, compliance-conscious, and will compare Peninsula to TaxDome, Karbon, Pixie.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Contextual upgrade prompts at the right moment** | Upgrade shown when user hits 80% of client or user limit, not at random — feels helpful not pushy | LOW | "You've added 32 of 40 clients — upgrade to Sole Trader for 100." Timing: 80% threshold triggers in-app banner. Evidence: usage milestone prompts increase upgrade rates 32% (Mixpanel data, cited in 2025 research). |
| **Soft limit enforcement with grace period** | Blocking users the moment they hit a limit causes frustration; soft limits allow overage with a clear upgrade prompt | LOW | Allow adding 1-3 clients/users over limit before hard block. Show persistent warning. Evidence: soft-limit SaaS companies see 12% upsell revenue increase with zero access complaints. |
| **Onboarding checklist / progress bar** | Guides new accounts to their first value moment (adding a client, setting up a reminder) within trial | MEDIUM | Checklist: Add first client → Set reminder schedule → Preview email template → Send test reminder. Completion drives activation. Target: value moment within 10 minutes of signup. |
| **Welcome email with next steps** | Trial users who don't activate within 24h are at highest churn risk | LOW | Automated Postmark email: personalised to firm name, links to checklist items. Sequence: Day 0 welcome, Day 3 "have you added clients?", Day 10 trial expiry warning. |
| **Firm name on all outbound reminder emails** | Accountants are sending reminders to their clients; the email must represent the firm, not "Peninsula Accounting" | LOW | Onboarding step captures firm name, email sender name, reply-to address. Used in Postmark sender config per org. |
| **Plan comparison table in upgrade flow** | Accountants evaluate cost carefully; showing plan features side-by-side reduces upgrade abandonment | LOW | Show all 4 plans with feature highlights. Highlight current plan. Recommend upgrade based on current usage. |
| **Seat/client overage pricing transparency** | Overage charges cause bill shock and churn; transparent pricing builds trust | LOW | Show overage rate on billing page: "£15 per 50 clients over your plan limit." This is unusual clarity — most SaaS buries this. |
| **Super-admin impersonation / act-as** | When a customer has a support issue, fastest resolution is viewing their account as them | HIGH | Difficult to implement securely with RLS. Defer to v3.x but design tenant isolation with this in mind. Note in PITFALLS. |
| **Trial-to-paid conversion email sequence** | Most SaaS tools rely on in-app only; email sequence significantly improves no-card trial conversion | MEDIUM | Day 0, 3, 10, 13, 14 (expiry). Content: value reminder, feature spotlight, urgency. Use Postmark. |
| **UK-specific plan naming** | "Sole Trader" and "Practice" resonate with UK accounting market; generic "Starter/Pro/Business" does not | LOW | Already in spec. Reinforce: these names signal the product understands the UK market. Pixie and other UK tools use similar naming. |
| **VAT invoice download on billing page** | Accountants will want proper UK VAT invoices for their own accounts; this audience will notice if they're wrong | LOW | Stripe generates compliant VAT invoices automatically when VAT number is collected and Stripe Tax is configured. Surface this prominently — accountants care about this more than typical SaaS customers. |

---

## Anti-Features

Features to explicitly NOT build in v3.0. These are commonly built prematurely, creating scope creep, complexity, or a poor product.

| Anti-Feature | Why Requested | Why to Avoid in v3.0 | What to Do Instead |
|--------------|---------------|----------------------|-------------------|
| **Usage-based / metered billing (per-email)** | "Charge per reminder sent feels fairer" | Adds billing complexity with Stripe metered billing; accountants on fixed pricing prefer predictability; creates anxiety about sending reminders | Flat-rate tiers with seat+client limits. Overage only on clients/seats. |
| **In-app subscription management UI (custom-built)** | "More control than Stripe portal" | Stripe Customer Portal already handles plan changes, invoices, payment methods, cancellation with proper 3DS2/SCA compliance. Building this from scratch is a security and maintenance burden. | Redirect to Stripe Customer Portal for all billing self-service. Build a thin wrapper page that shows current plan + links to portal. |
| **Single sign-on (SSO / SAML)** | Larger firms want SSO | Enterprise feature; adds significant complexity; not needed for sole trader to 15-person target market | Supabase email/password + magic link covers the market. Document SSO as v4+ roadmap item. |
| **Fine-grained permissions (beyond Admin/Member)** | "We want view-only for junior staff" | Complex RBAC with role editor creates confusion; most small firms don't need it; support burden | Two roles (Admin, Member) cover 95% of use cases for 1-15 person firms. |
| **Public API / webhooks for customers** | "We want to integrate with our other tools" | Significant API surface area, versioning, documentation, API key management — months of work | Not needed for initial SaaS launch. Document as future milestone. |
| **White-labelling / custom domain** | "Our firm wants clients to see our domain" | Complex multi-domain routing; SSL cert management; outside current scope | This is a product extension, not a platform feature. Defer post product-market fit. |
| **Automated dunning / recovery emails** | "Chase failed payments automatically" | Stripe Billing already handles dunning (smart retries, failed payment emails). Don't duplicate. | Configure Stripe Billing dunning settings. Enable "Customer emails" for failed payment events. |
| **Referral / affiliate program** | "Give discounts for referrals" | Growth mechanism, not a core platform feature; distracts from v3.0 scope | Post-launch, when MRR is established. |
| **Reseller / agency accounts** | "Allow accountants to manage multiple firms" | Multi-level multi-tenancy is complex; different product than B2B SaaS | Out of scope. Current model is one org per subscription. |
| **Mobile app** | "Accountants want to check on their phone" | Web-first; responsive design covers mobile use; native app is a separate product | Ensure dashboard is mobile-responsive. No native app in v3.0. |
| **Super-admin impersonation in v3.0** | Essential for support | True impersonation with Supabase RLS requires careful implementation to avoid tenant isolation breaks | Build "view as" read-only mode in v3.x after RLS architecture is validated. |

---

## Feature Dependencies

```
[Account creation (Supabase Auth)]
    └──required by──> [Organisation creation]
                          └──required by──> [All tenant-scoped features]

[Organisation creation]
    └──required by──> [Team invites]
    └──required by──> [Billing page]
    └──required by──> [Trial logic]

[Stripe customer creation]
    └──required by──> [Checkout / plan selection]
    └──required by──> [Billing management page]
    └──required by──> [Invoice history]
    └──created at──> [Onboarding step: choose plan]

[Trial logic (14-day, no card)]
    └──requires──> [trial_ends_at field on organisations table]
    └──requires──> [Stripe trial period configuration on subscription]
    └──drives──> [Trial conversion email sequence]
    └──drives──> [Trial expiry gate]

[Plan limits enforcement]
    └──requires──> [plan tier stored on organisation]
    └──requires──> [client count query]
    └──requires──> [user count query]
    └──drives──> [Upgrade prompts at 80% threshold]
    └──drives──> [Hard block at limit + grace]

[Team invites]
    └──requires──> [Organisation exists]
    └──requires──> [Postmark transactional email]
    └──requires──> [invite_tokens table with expiry]
    └──drives──> [Role assignment (Admin/Member)]

[Stripe Customer Portal]
    └──requires──> [Stripe customer ID on organisation]
    └──provides──> [Plan upgrade/downgrade, invoice history, cancel, payment methods]
    └──replaces──> [Custom billing management UI]

[Super-admin dashboard]
    └──requires──> [Stripe webhook sync to organisations table]
    └──requires──> [Super-admin role separate from org Admin role]
    └──reads──> [All organisations (bypasses RLS)]
```

---

## MVP Definition (v3.0 Launch)

### Must Ship (SaaS Platform Viable)

These features are required before any external customer can use the product as a multi-tenant SaaS.

| Feature | Why It's Required |
|---------|------------------|
| Multi-step onboarding wizard | Entry point; without it, no one can create an account |
| Organisation creation with tenant isolation | Data isolation is a safety requirement, not a feature |
| 14-day trial logic (no card) | Differentiator from competitors; conversion baseline |
| Trial expiry gate + conversion prompt | Without this, trials are free forever |
| Stripe subscription creation | Revenue collection; required for commercial launch |
| Plan limit enforcement (soft + hard) | Without limits, Lite plan holders consume unlimited resources |
| Billing management page (current plan + usage) | Users need to see what they're paying for |
| Stripe Customer Portal link | Self-service billing; reduces support burden |
| UK VAT on subscription invoices | Legal requirement for UK SaaS selling to UK businesses |
| VAT number collection at checkout | Required for proper B2B invoices (accountants will notice) |
| Team invite by email | Multi-user plans (Sole Trader, Practice, Firm) require this |
| Role-based access (Admin / Member) | Without roles, all invited users are admins by default |
| Super-admin tenant list | Minimum internal visibility for operations |
| Super-admin subscription status | Need to know who's trialling vs paying vs lapsed |

### Defer to v3.x (Post-Launch)

| Feature | Why to Defer | Trigger to Build |
|---------|-------------|------------------|
| Trial conversion email sequence | Valuable but not blocking; can do manual outreach initially | When trial-to-paid conversion <15% |
| Onboarding checklist / progress bar | Nice to have; track activation metric first | When 14-day activation rate <60% |
| Upgrade prompt at 80% threshold | Build after usage patterns are observed | When upgrade requests come in via support |
| Plan comparison table in upgrade flow | Can be simple redirect to pricing page initially | When users ask "which plan should I choose?" |
| Invite link (shareable, not email-based) | Email invite covers most cases; link needed for bulk invites | When org admins invite >5 people at once |
| Pending invite resend/cancel UI | Basic invite list first; resend can be manual initially | When support gets "I didn't get my invite" tickets |
| Super-admin impersonation | Complex RLS implications | When support burden exceeds 2h/week on account issues |

---

## Onboarding Flow Detail

### Step Sequence (Evidence-Based)

Research confirms: max 4 steps to complete onboarding; users abandon longer flows. Each step should take under 60 seconds.

```
Step 1: Create Account
  - Email + password (or magic link option)
  - "By signing up, you agree to Terms of Service and Privacy Policy"
  - No firm details yet — reduce friction to get past step 1

Step 2: Firm Details
  - Firm/practice name (required — used in reminder email sender)
  - Your name (required)
  - Phone (optional)
  - Time zone (defaulted to Europe/London, editable)

Step 3: Choose Plan
  - Show all 4 plans in comparison layout
  - Pre-select Sole Trader (most common profile)
  - "Start 14-day free trial" CTA — no card required
  - Note: Stripe subscription created with trial period; no charge until day 15

Step 4: You're in
  - "Your trial has started. 14 days free."
  - Show the checklist: Add first client / Set reminder schedule / Preview template
  - Primary CTA: "Add your first client" → goes to clients page
```

### Conversion: Trial to Paid

The "aha moment" for an accounting practice tool is **sending their first automated reminder and seeing a client reply handled**. Onboarding should route users to that outcome as fast as possible.

- Day 0: Welcome email from Postmark ("Your 14-day trial has started")
- Day 3: Nudge email ("Have you added your clients yet?")
- Day 10: Feature spotlight ("Here's what happened for firms like yours in their trial")
- Day 13: Urgency email ("1 day left — choose your plan to keep going")
- Day 14 (expiry): Gate — cannot access app until plan chosen

No-card trial conversion benchmark: 18-25%. With activation (user completes core workflow during trial), conversion rises to 35-45%.

---

## Billing Page UX Patterns

### What to Show

```
Current Plan: Practice — £89/month
Renewal: 15 March 2026
Next invoice: £106.80 (includes VAT at 20%)

Usage:
  Users:   ████████░░  4 of 5 included
  Clients: ████░░░░░░  147 of 300 included

[Manage Billing →]  (opens Stripe Customer Portal)
[View Invoices →]   (opens Stripe Customer Portal — invoice list)
```

### Upgrade Prompt (at 80% threshold)

```
[Warning banner, amber]
You've added 241 of 300 clients on your Practice plan.
When you reach 300, you'll be charged £15 per 50 additional clients.
[Upgrade to Firm — 750 clients, £159/mo →]
```

### Plan Change Handling

- Upgrades: Immediate, prorated. User pays difference for remaining days.
- Downgrades: Effective at end of billing period. Show "Downgrade scheduled" state.
- Cancellation: Effective at end of billing period. Data retained for 30 days post-cancellation.

These are all handled by Stripe Billing with correct UK SCA/3DS2 compliance.

---

## Team Invite UX Patterns

### Admin Invite Flow

```
Settings → Team → Invite Member

[Email address field]      [Role: Admin / Member ▼]      [Send Invite]

Pending Invites:
  jane@smithaccounting.co.uk    Member    Sent 2h ago    [Resend] [Cancel]

Active Members:
  john@smithaccounting.co.uk    Admin    Since Jan 2026
  kate@smithaccounting.co.uk    Member   Since Feb 2026
```

### Invite Email (Postmark)

Sender name: "John Smith via Peninsula Accounting" (not just "Peninsula Accounting")
Subject: "John Smith invited you to join Smith Accounting on Peninsula"
Body: Clear CTA button "Accept Invite", expiry notice ("Link expires in 72 hours"), brief description of what the platform does.

### Invited User Onboarding

When an invited user clicks the accept link:
- If they have no account: Set password screen, then lands directly in the org.
- If they already have an account: Confirmation screen "Join [Firm Name]?", then join.
- Do NOT show invited users the full onboarding wizard (plan selection, org setup). They are joining an existing org.

### Security

- Invite tokens: UUID v4, stored in `invite_tokens` table, expires 72h.
- One token per email per org (re-sending cancels previous token).
- Token is single-use (deleted on accept).
- Invites cannot exceed plan seat limit (check at send time, not just accept time).

---

## Super-Admin Dashboard Requirements

### Tenant List View

| Column | Source | Notes |
|--------|--------|-------|
| Org name | organisations table | |
| Plan tier | organisations.plan_tier | Lite / Sole Trader / Practice / Firm |
| Status | Stripe subscription.status | trialing / active / past_due / canceled |
| Clients | COUNT(clients) per org | Query across tenants — admin bypasses RLS |
| Users | COUNT(profiles) per org | |
| Trial ends / renewal | organisations.trial_ends_at or Stripe period_end | |
| Signed up | organisations.created_at | |

### Filters / Search

- Filter by plan tier
- Filter by subscription status (especially: past_due — these need attention)
- Search by org name

### Actions (Minimal for v3.0)

- View org details (read-only)
- Link to Stripe dashboard for that customer (use Stripe customer ID)
- No impersonation in v3.0 (see anti-features)

### Access Control

Super-admin is a platform-level role, not an org-level role. Implemented as a flag on the user profile (`is_super_admin: boolean`). Super-admin queries bypass Supabase RLS via service role key (server-side only). Never expose service role key to client.

---

## UK-Specific Considerations

| Consideration | Detail | Confidence |
|---------------|--------|------------|
| **20% VAT on SaaS subscriptions** | UK B2B: charge 20% VAT. Stripe Tax auto-calculates. Non-UK B2B: reverse charge applies (no UK VAT). | HIGH — verified against Stripe UK docs and HMRC guidance |
| **GB VAT number collection** | Stripe validates GB VAT numbers with HMRC automatically. Collect at checkout for B2B. Show on invoices. | HIGH — verified against Stripe Tax/Invoicing docs |
| **HMRC e-invoicing mandate (2029)** | UK mandatory B2B e-invoicing from April 2029. Stripe-generated invoices are electronic. Not an immediate concern, but Stripe compliance is future-proof. | MEDIUM — verified from vatcalc.com and vatupdate.com |
| **Strong Customer Authentication (SCA/3DS2)** | UK requires SCA for card payments. Stripe Checkout and Payment Element handle this automatically. Custom card forms without Stripe JS will fail. | HIGH — Stripe documentation |
| **ICO / GDPR for tenant data** | UK GDPR (retained post-Brexit). Data retention policies, privacy policy, right to erasure. Cancellation → 30-day data retention before deletion is standard practice. | MEDIUM — standard UK GDPR practice |
| **Trial duration norms** | UK accounting SaaS: 14-day trials are standard (verified: Accountancy Manager, Finexer, others). 30-day trials also exist but 14-day is common. | MEDIUM — from UK accounting SaaS competitor research |
| **Pricing in GBP** | Obvious but worth stating: all pricing in GBP, all invoices in GBP. Stripe supports GBP natively. | HIGH |
| **Plan naming resonance** | "Sole Trader" and "Practice" are UK business structure terms that resonate. Confirmed: Pixie, Cone, and other UK tools use similar terminology. | MEDIUM — confirmed via competitor research |

---

## Competitor Gap Analysis

What Peninsula v3.0 does that competitors don't:

| Capability | Karbon | TaxDome | Pixie | Peninsula v3.0 |
|------------|--------|---------|-------|----------------|
| UK-focused pricing names | No | No | Yes | Yes |
| Self-serve trial (no card) | No (demo required) | Demo | Yes | Yes |
| Transparent overage pricing | No | No | No | Yes (£15/50 clients) |
| VAT-compliant invoicing | Via integration | No | No | Yes (Stripe Tax) |
| Price point for sole traders | Not viable (£49+/user) | Not ideal | Yes (£19/mo) | Yes (£20 Lite) |

Key insight from competitor analysis: Karbon targets 5+ person firms. TaxDome is US-first with UK presence. Pixie is the closest UK competitor for small firms but lacks billing sophistication. Peninsula can differentiate on transparent pricing and self-serve trial.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Onboarding wizard | HIGH | MEDIUM | P1 — v3.0 |
| Tenant isolation (org creation) | HIGH | MEDIUM | P1 — v3.0 |
| Trial logic (14-day, no card) | HIGH | LOW | P1 — v3.0 |
| Trial expiry gate | HIGH | LOW | P1 — v3.0 |
| Stripe subscription creation | HIGH | MEDIUM | P1 — v3.0 |
| Plan limit enforcement | HIGH | MEDIUM | P1 — v3.0 |
| Billing management page | HIGH | LOW | P1 — v3.0 |
| Stripe Customer Portal link | HIGH | LOW | P1 — v3.0 |
| UK VAT (Stripe Tax) | HIGH | LOW | P1 — v3.0 |
| VAT number collection | MEDIUM | LOW | P1 — v3.0 |
| Team invite by email | HIGH | MEDIUM | P1 — v3.0 |
| Role-based access | HIGH | MEDIUM | P1 — v3.0 |
| Super-admin tenant list | MEDIUM | LOW | P1 — v3.0 |
| Super-admin subscription status | MEDIUM | LOW | P1 — v3.0 |
| Trial conversion email sequence | HIGH | MEDIUM | P2 — v3.x |
| Onboarding checklist | MEDIUM | MEDIUM | P2 — v3.x |
| Upgrade prompt at 80% | HIGH | LOW | P2 — v3.x |
| Plan comparison table | MEDIUM | LOW | P2 — v3.x |
| Pending invite management | MEDIUM | LOW | P2 — v3.x |
| Super-admin impersonation | HIGH | HIGH | P3 — v4+ |
| SSO/SAML | LOW (for target market) | HIGH | Out of scope |
| Public API | LOW | HIGH | Out of scope |

**Priority key:**
- P1: Required for v3.0 SaaS launch
- P2: Add in v3.x after validating launch
- P3: Future milestone
- Out of scope: Explicitly not building

---

## Sources

**Onboarding UX & Conversion:**
- [B2B SaaS Onboarding - Complete Product Manager's Guide](https://productfruits.com/blog/b2b-saas-onboarding)
- [User Onboarding Strategies in B2B SaaS — WorkOS](https://workos.com/blog/b2b-saas-onboarding-organizations-users)
- [SaaS Onboarding: Get Users to Aha Moment in 3 Minutes](https://www.sanjaydey.com/saas-onboarding-get-users-to-aha-moment-in-3-minutes/)
- [Free Trial Conversion Benchmarks 2025 — 1Capture](https://www.1capture.io/blog/free-trial-conversion-benchmarks-2025)
- [SaaS Free Trial Conversion Rate Benchmarks — First Page Sage](https://firstpagesage.com/seo-blog/saas-free-trial-conversion-rate-benchmarks/)

**Team Invites & User Flows:**
- [How to Onboard Invited Users to your SaaS Product — Userpilot](https://userpilot.com/blog/onboard-invited-users-saas/)
- [Designing an intuitive user flow for inviting teammates — PageFlows](https://pageflows.com/resources/invite-teammates-user-flow/)
- [User Onboarding Strategies in a B2B SaaS Application — Auth0](https://auth0.com/blog/user-onboarding-strategies-b2b-saas/)

**Billing, Plan Limits, Upgrade Prompts:**
- [Integrate the Stripe Customer Portal](https://docs.stripe.com/customer-management/integrate-customer-portal)
- [Best practices for SaaS billing — Stripe](https://stripe.com/resources/more/best-practices-for-saas-billing)
- [Soft Limits in Software Licensing — 10Duke](https://www.10duke.com/blog/soft-limits-software-licensing/)
- [How freemium SaaS products convert users with upgrade prompts — Appcues](https://www.appcues.com/blog/best-freemium-upgrade-prompts)
- [Dealing with plan limits in Vue.js SaaS frontend — Checkly](https://www.checklyhq.com/blog/how-we-deal-with-plan-limits-in-the-frontend-of-our-saas-app/)

**UK VAT & Invoicing Requirements:**
- [VAT On Software And SaaS In The UK — Sprintlaw UK](https://sprintlaw.co.uk/articles/vat-on-software-and-saas-in-the-uk/)
- [HMRC Invoicing Requirements for UK — Stripe](https://stripe.com/guides/invoicing-best-practices-for-the-united-kingdom)
- [Customer Tax IDs — Stripe Documentation](https://docs.stripe.com/billing/customer/tax-ids)
- [Collect tax in the United Kingdom — Stripe Documentation](https://docs.stripe.com/tax/supported-countries/europe/united-kingdom)
- [UK April 2029 Mandatory B2B E-Invoicing — vatcalc.com](https://www.vatcalc.com/united-kingdom/uk-2029-mandatory-b2b-e-invoicing/)

**Competitor Research:**
- [Best accounting practice management software UK — Karbon](https://karbonhq.com/resources/best-accounting-practice-management-software-uk/)
- [Best accounting practice management software UK — Cone](https://www.getcone.io/blog/best-accounting-practice-management-software-uk)
- [Digital Onboarding Software for UK Accounting Firms — Finexer](https://blog.finexer.com/digital-onboarding-software/)
- [Top Practice Management Software for UK Accountants — LinkMyBooks](https://linkmybooks.com/blog/practice-management-softwares-for-uk-accountants)

**Super-Admin & Multi-Tenancy Patterns:**
- [Developer's Guide to SaaS Multi-Tenant Architecture — WorkOS](https://workos.com/blog/developers-guide-saas-multi-tenant-architecture)
- [How to Design a Multi-Tenant SaaS Architecture — Clerk](https://clerk.com/blog/how-to-design-multitenant-saas-architecture)

---
*Feature research for: v3.0 Multi-Tenancy & SaaS Platform — Peninsula Accounting*
*Researched: 2026-02-19*
*Confidence: HIGH for table stakes and UK-specific requirements (verified against Stripe docs, HMRC guidance); MEDIUM for competitor analysis and conversion benchmarks (WebSearch with multiple corroborating sources)*
