# Requirements: Peninsula Accounting v3.0 — Multi-Tenancy & SaaS Platform

**Defined:** 2026-02-19
**Core Value:** Automate the hours accountants spend manually chasing clients for records and documents, while keeping the accountant in full control of messaging and timing.

---

## v3.0 Requirements

### ORG — Org Data Model & Multi-Tenant Database

- [ ] **ORG-01**: `organisations` table exists with: id (uuid), name, slug (unique, URL-safe), plan_tier, client_count_limit, user_count_limit, stripe_customer_id, stripe_subscription_id, subscription_status, trial_ends_at, postmark_server_token, postmark_sender_domain
- [ ] **ORG-02**: `user_organisations` junction table links users to orgs with role (admin | member)
- [ ] **ORG-03**: `invitations` table stores pending team invites: org_id, email, role, token (hashed), expires_at, accepted_at
- [ ] **ORG-04**: All data tables gain `org_id` FK: clients, email_templates, schedules, schedule_steps, schedule_client_exclusions, client_email_overrides, client_schedule_overrides, client_filing_assignments, client_deadline_overrides, client_filing_status_overrides, reminder_queue, email_log, inbound_emails, app_settings, locks
- [ ] **ORG-05**: `app_settings` unique constraint changes from `(key)` to `(org_id, key)`
- [ ] **ORG-06**: `filing_types` and `bank_holidays_cache` remain global (no org_id — shared reference data)
- [ ] **ORG-07**: Existing single-tenant data is migrated to a first org row with zero data loss; existing user assigned as admin of that org
- [ ] **ORG-08**: Supabase Custom Access Token Hook writes `org_id` and `org_role` into JWT `app_metadata` at login; all RLS policies use JWT claim, not table subquery
- [ ] **ORG-09**: RLS policies on all data tables scope reads/writes to `org_id = (auth.jwt() ->> 'org_id')::uuid`
- [ ] **ORG-10**: Both cron jobs (reminders + send-emails) iterate over active `organisations` and apply `.eq('org_id', org.id)` to every query; lock keys are org-scoped

### AUTH — Authentication, Session & Subdomain Routing

- [ ] **AUTH-01**: Next.js middleware extracts `orgSlug` from the `host` header and rewrites requests to org-scoped routes
- [ ] **AUTH-02**: `getCurrentOrg()` server utility resolves slug → org_id via Supabase with `React.cache()` deduplication (one DB call per request)
- [ ] **AUTH-03**: Users logging in at the wrong org's subdomain see a clear error and are not granted access to that org's data
- [ ] **AUTH-04**: Middleware enforces access gating: orgs with expired trial or cancelled subscription are redirected to `/billing` except for the billing page itself
- [ ] **AUTH-05**: Per-org Postmark credentials (`postmark_server_token`, `postmark_sender_domain`) are read from `organisations` table; `lib/email/sender.ts` accepts a `serverToken` parameter replacing the env var

### BILL — Stripe Billing

- [ ] **BILL-01**: 4 Stripe products created in GBP: Lite (£20/mo), Sole Trader (£39/mo), Practice (£89/mo), Firm (£159/mo)
- [ ] **BILL-02**: Stripe Hosted Checkout is initiated from plan selection during onboarding; no client-side Stripe.js required
- [ ] **BILL-03**: Stripe webhook handler with idempotency table (`processed_webhook_events`) handles: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- [ ] **BILL-04**: `organisations` row is updated with `stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, `plan_tier`, and limit fields on webhook events
- [ ] **BILL-05**: Billing management page shows: current plan name, client count vs limit, user count vs limit, trial expiry (if active), and a link to Stripe Customer Portal for payment method / invoice management
- [ ] **BILL-06**: Client count enforced: adding a client is blocked when at or over limit; a warning banner appears at 80% of limit with an upgrade prompt
- [ ] **BILL-07**: User (seat) count enforced: inviting a team member is blocked when at or over the plan's user_count_limit
- [ ] **BILL-08**: Lite tier has no overage — firm must upgrade to Sole Trader once 40-client limit is reached
- [ ] **BILL-09**: Stripe Tax enabled for UK VAT (20%) on all subscriptions; plan prices are exclusive of VAT
- [ ] **BILL-10**: 14-day free trial tracked via `trial_ends_at` in `organisations`; trial can be started without a payment method

### ONBD — Onboarding Flow

- [ ] **ONBD-01**: Sign-up page: new user creates a Supabase Auth account (email + password); no existing account required
- [ ] **ONBD-02**: Org creation step: user enters firm name and org slug (auto-suggested, editable, unique, validated against reserved slug list); creates `organisations` and `user_organisations` (admin) rows
- [ ] **ONBD-03**: Firm details step: sender name and email (pre-fills Postmark per-org config); Postmark server token field (optional — can be configured later in Settings)
- [ ] **ONBD-04**: Plan selection step: all 4 tiers shown with feature comparison and pricing; selecting a paid plan launches Stripe Checkout; "Start free trial" option begins 14-day trial and skips Stripe Checkout
- [ ] **ONBD-05**: After completing onboarding, user is redirected to their org subdomain dashboard (`orgslug.app.domain.com/dashboard`)
- [ ] **ONBD-06**: Already-onboarded orgs cannot re-enter the onboarding flow; `setup_complete` flag in `app_settings` prevents this

### TEAM — Team Management & Invites

- [ ] **TEAM-01**: Admin can invite team members by email from the Settings page; invite email is sent via Postmark with a tokenized accept link (expires 7 days)
- [ ] **TEAM-02**: Accept invite flow: recipient clicks link → creates Supabase Auth account if new, or logs in if existing → is added to the org via `user_organisations`
- [ ] **TEAM-03**: Settings page shows current team: member name, email, role, joined date; admin can remove members and change roles
- [ ] **TEAM-04**: Admin role has full access: clients, dashboard, templates, schedules, email logs, settings, billing, team management
- [ ] **TEAM-05**: Member role has restricted access: clients and dashboard only; billing and team management tabs are hidden/blocked
- [ ] **TEAM-06**: An org must always retain at least one admin; removing the last admin is prevented with an error

### ADMN — Super-Admin Dashboard

- [ ] **ADMN-01**: Super-admin flag stored in Supabase Auth `app_metadata.is_super_admin`; writable only via service role (not by any user action)
- [ ] **ADMN-02**: `/admin` route requires `is_super_admin = true`; non-super-admin users are redirected to their dashboard
- [ ] **ADMN-03**: Super-admin org list shows: org name, slug, plan_tier, subscription_status, trial_ends_at, client count, user count — sortable by plan and status
- [ ] **ADMN-04**: Clicking an org shows its detail: full org settings, member list, Stripe subscription ID for manual lookup

### NOTF — System Notification Emails

- [ ] **NOTF-01**: Trial-ending-soon email sent to org admin 3 days before `trial_ends_at`; triggered by a daily cron check (not Stripe webhook)
- [ ] **NOTF-02**: Payment-failed email sent to org admin when `invoice.payment_failed` webhook is received; includes link to Stripe Customer Portal to update payment method

---

## Future Requirements (v3.x and later roadmap phases)

### Billing Enhancements

- **BILL-EXT-01**: Stripe metered/usage-based overage billing (£15/50 clients beyond tier limit) — deferred; soft-cap warnings handle overages in v3.0
- **BILL-EXT-02**: Annual billing option (2 months free) — simple Stripe config; defer until monthly billing is stable

### Communication

- **NOTF-EXT-01**: Subscription-cancelled confirmation email with data retention notice
- **NOTF-EXT-02**: Plan-upgrade/downgrade confirmation email
- **NOTF-EXT-03**: New team member welcome email (sent to invited user on accept)

### Admin Tooling

- **ADMN-EXT-01**: Super-admin impersonation (log in as any org user) — significant RLS security implications; v3.x only
- **ADMN-EXT-02**: Super-admin manual plan override without Stripe (for trials, discounts)

### Future Strategic Phases (from ROADMAP.md)

- Inbound email intelligence — deferred from original v3.0 plan; revisit after multi-tenancy is stable
- Document storage (Supabase Storage) — ROADMAP.md Phase 3
- HMRC API integration (MTD VAT/ITSA) — ROADMAP.md Phase 4
- AI agent interface — ROADMAP.md Phase 5

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Stripe metered overage billing | Complexity for v3.0; soft-cap + upgrade prompt is sufficient initially |
| SSO / OAuth login (Google, Microsoft) | Email/password sufficient for UK accounting SaaS at this scale |
| Multi-org membership (one user in multiple orgs) | Edge case; subdomain model handles it via separate logins |
| White-label / custom domain per org | Requires wildcard cert per org; defer until there is demand |
| org-level analytics / reporting | No user request; not in ROADMAP.md |
| Mobile app | Web dashboard only |
| Real-time collaborative editing | Solo/small team; not applicable |
| Document upload from clients | Out of scope until Phase 3 of strategic roadmap |
| iXBRL CT600 filing | Aspirational; see ROADMAP.md Phase 6 |
| Super-admin impersonation in v3.0 | RLS security implications require careful design; v3.x |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ORG-01 | Phase 10 | Complete |
| ORG-02 | Phase 10 | Complete |
| ORG-03 | Phase 10 | Complete |
| ORG-04 | Phase 10 | Complete |
| ORG-05 | Phase 10 | Complete |
| ORG-06 | Phase 10 | Complete |
| ORG-07 | Phase 10 | Complete |
| ORG-08 | Phase 10 | Complete |
| ORG-09 | Phase 10 | Complete |
| ORG-10 | Phase 10 | Complete |
| AUTH-01 | Phase 12 | Pending |
| AUTH-02 | Phase 12 | Pending |
| AUTH-03 | Phase 12 | Pending |
| AUTH-04 | Phase 12 | Pending |
| AUTH-05 | Phase 12 | Pending |
| BILL-01 | Phase 11 | Complete |
| BILL-02 | Phase 11 | Complete |
| BILL-03 | Phase 11 | Complete |
| BILL-04 | Phase 11 | Complete |
| BILL-05 | Phase 11 | Complete |
| BILL-06 | Phase 11 | Complete |
| BILL-07 | Phase 11 | Complete |
| BILL-08 | Phase 11 | Complete |
| BILL-09 | Phase 11 | Complete |
| BILL-10 | Phase 11 | Complete |
| ONBD-01 | Phase 13 | Pending |
| ONBD-02 | Phase 13 | Pending |
| ONBD-03 | Phase 13 | Pending |
| ONBD-04 | Phase 13 | Pending |
| ONBD-05 | Phase 13 | Pending |
| ONBD-06 | Phase 13 | Pending |
| TEAM-01 | Phase 13 | Pending |
| TEAM-02 | Phase 13 | Pending |
| TEAM-03 | Phase 13 | Pending |
| TEAM-04 | Phase 13 | Pending |
| TEAM-05 | Phase 13 | Pending |
| TEAM-06 | Phase 13 | Pending |
| ADMN-01 | Phase 14 | Pending |
| ADMN-02 | Phase 14 | Pending |
| ADMN-03 | Phase 14 | Pending |
| ADMN-04 | Phase 14 | Pending |
| NOTF-01 | Phase 13 | Pending |
| NOTF-02 | Phase 11 | Complete |

**Coverage:**
- v3.0 requirements: 43 total
- Mapped to phases: 43
- Unmapped: 0

---

*Requirements defined: 2026-02-19*
*Last updated: 2026-02-19 — traceability populated after roadmap creation*
