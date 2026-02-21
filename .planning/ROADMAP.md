# Roadmap: Peninsula Accounting Client Reminder System

## Milestones

- **v1.0 MVP** - Phases 1-3 (shipped 2026-02-07)
- **v1.1 Template & Scheduling Redesign** - Phases 4-9 (shipped 2026-02-08)
- **v2.0 QOL & Platform Hardening** - (shipped 2026-02-14)
- **v3.0 Multi-Tenancy & SaaS Platform** - Phases 10-14 (in progress)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-3) - SHIPPED 2026-02-07</summary>

### Phase 1: Foundation
**Goal**: Project scaffolding, QuickBooks integration, client data model
**Plans**: 7 plans (complete)

### Phase 2: Reminder Engine
**Goal**: Template system, deadline calculators, queue builder, email delivery
**Plans**: 5 plans (complete)

### Phase 3: Delivery & Dashboard
**Goal**: Dashboard, audit logging, calendar, status tracking
**Plans**: 5 plans (complete)

</details>

<details>
<summary>v1.1 Template & Scheduling Redesign (Phases 4-9) - SHIPPED 2026-02-08</summary>

### Phase 4: Data Migration
**Goal**: Restructure database from JSONB-embedded templates to normalized tables
**Plans**: 2 plans (complete)

### Phase 5: Rich Text Editor & Templates
**Goal**: TipTap editor with placeholder autocomplete and template CRUD
**Plans**: 4 plans (complete)

### Phase 6: Email Rendering Pipeline
**Goal**: Convert TipTap JSON to email-safe HTML with inline styles
**Plans**: 1 plan (complete)

### Phase 7: Schedule Management
**Goal**: Schedule creation/editing UI with step management
**Plans**: 2 plans (complete)

### Phase 8: Ad-Hoc Sending
**Goal**: Select clients, pick template, preview, and send outside scheduled flow
**Plans**: 2 plans (complete)

### Phase 9: Queue Integration
**Goal**: Rewire cron queue builder to read from new normalized tables
**Plans**: 2 plans (complete)

</details>

<details>
<summary>v2.0 QOL & Platform Hardening (Phases n/a) - SHIPPED 2026-02-14</summary>

### v2.0 Overview
**Goal**: Quality-of-life improvements, auth modernization, filing management, and operational tooling

**Key Features:**
- **Auth Refactor**: Replaced QuickBooks OAuth with magic link authentication
- **Onboarding Wizard**: Streamlined 3-step onboarding flow
- **Email Logs**: Redesigned full-width table with advanced filtering, sorting, and dropdowns
- **Filing Management**: Filing status badges, status dropdown, filing status API
- **Bulk Operations**: Bulk edit status modal with multi-client status updates
- **CSV Import**: Improved validation and template generation
- **Rollover System**: Year-end rollover detector, executor, and dashboard page
- **Help Widget**: In-app help widget on dashboard
- **Reminder Queue API**: API endpoint for reminder queue processing
- **Email Queue**: Email queue action handlers
- **UI Components**: Separator, toggle group components
- **Database Migrations**: Records received status, rescheduled status, filing status overrides
- **Migration Scripts**: Tooling for applying constraint fixes and status migrations
- **Quick Tasks**: Custom schedules (#001), demo client creation (#002), auth & multi-practice (#003), onboarding wizard (#004)

</details>

---

## v3.0 Multi-Tenancy & SaaS Platform (In Progress)

**Milestone Goal:** Transform the application from a single-firm tool into a fully-isolated multi-tenant SaaS platform serving multiple independent accounting practices — with org-scoped database isolation, Stripe subscription billing, subdomain routing, guided onboarding, team management, and super-admin visibility.

**Phases:** 10-14 (5 phases)
**Requirements:** 43 v3.0 requirements
**Depth:** Standard

### Phase 10: Org Data Model & RLS Foundation

**Goal:** All data in the database is owned by exactly one organisation, isolated by RLS, with both cron jobs org-scoped so no tenant's data leaks to another.

**Depends on:** Phase 9 (existing cron and email pipeline)

**Requirements:** ORG-01, ORG-02, ORG-03, ORG-04, ORG-05, ORG-06, ORG-07, ORG-08, ORG-09, ORG-10

**Success Criteria** (what must be TRUE when this phase completes):
1. An `organisations` row exists for the founding firm; all existing clients, templates, schedules, queue entries, and email logs have their `org_id` set to that row's id and no NULL `org_id` values exist on any data table.
2. A new Supabase session decoded via `SELECT auth.jwt()` contains `org_id` and `org_role` in `app_metadata`; removing the JWT hook causes RLS to deny all data access, confirming the hook is the sole authority.
3. Running `SELECT * FROM clients` as an authenticated user returns only that user's org's clients, even if the database contains rows belonging to a different `org_id`.
4. A manual test run of both cron jobs (reminders + send-emails) against a two-org dataset sends each org's emails only to that org's clients; no cross-tenant delivery occurs.
5. The `app_settings` table rejects a duplicate `(org_id, key)` pair with a unique constraint violation; the old single-key uniqueness is gone.

**Plans:** 5 plans in 4 waves

Plans:
- [x] 10-01-PLAN.md — Database schema: organisations, user_organisations, invitations tables + org_id on all data tables + backfill
- [x] 10-02-PLAN.md — JWT Custom Access Token Hook + org-scoped RLS policies
- [x] 10-03-PLAN.md — Cron job org-scoping (reminders + send-emails) + per-org Postmark
- [x] 10-04-PLAN.md — Server action updates for org-scoped operations
- [x] 10-05-PLAN.md — Integration verification with test org + human verification checkpoint

---

### Phase 11: Stripe Billing

**Goal:** Each organisation has a Stripe subscription (or active trial) that determines its plan tier and usage limits; failed payments trigger an admin notification and restrict access.

**Depends on:** Phase 10 (organisations table, org_id on all tables)

**Requirements:** BILL-01, BILL-02, BILL-03, BILL-04, BILL-05, BILL-06, BILL-07, BILL-08, BILL-09, BILL-10, NOTF-02

**Success Criteria** (what must be TRUE when this phase completes):
1. Initiating a Stripe Checkout for the Practice plan (£89/mo) redirects to a Stripe-hosted payment page; completing it updates the org's `stripe_subscription_id`, `subscription_status`, and `plan_tier` without any manual intervention.
2. The billing management page shows the org's current plan name, client count vs limit, user count vs limit, and a "Manage billing" link that opens the Stripe Customer Portal pre-authenticated for that org.
3. Adding a client when the org is at its plan limit is blocked with a clear error message; a warning banner appears when the org reaches 80% of its client limit.
4. An `invoice.payment_failed` Stripe webhook event results in a payment-failed email to the org admin containing a link to the Stripe Customer Portal; re-delivering the same webhook event does not send a second email (idempotency enforced).
5. An org created with the "Start free trial" option has `trial_ends_at` set 14 days in the future; the org can create clients and send emails immediately without entering payment details.

**Plans:** 5 plans in 4 waves

Plans:
- [x] 11-01-PLAN.md — Database migration + Stripe SDK + plan config + billing utilities
- [x] 11-02-PLAN.md — Webhook handler with idempotency + payment-failed email (NOTF-02)
- [x] 11-03-PLAN.md — Checkout + portal API routes + pricing page + trial logic + trial-expiry cron
- [x] 11-04-PLAN.md — Billing management page with status overview, usage bars, manage button
- [x] 11-05-PLAN.md — Usage enforcement + read-only mode integration + dashboard banner + verification

---

### Phase 12: Subdomain Routing & Access Gating

**Goal:** Each org's dashboard is served at its own subdomain; users cannot access another org's data via a wrong subdomain; orgs with expired trials or cancelled subscriptions are blocked from core features.

**Depends on:** Phase 10 (organisations table with slug, org_id isolation), Phase 11 (subscription_status and trial_ends_at populated)

**Requirements:** AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05

**Success Criteria** (what must be TRUE when this phase completes):
1. Navigating to `acme.app.domain.com/dashboard` serves the Acme org's dashboard; the browser URL does not change; a request header `x-org-slug: acme` is present in server components confirming middleware injection.
2. A user authenticated in the Acme org who navigates to `rival.app.domain.com` sees an access-denied error and cannot view or modify any of Rival's data.
3. An org whose trial has expired is redirected to `/billing` on every route except `/billing` itself; once a valid subscription is activated, all routes become accessible again.
4. Each org's outbound reminder emails are sent using that org's `postmark_server_token` and `postmark_sender_domain` from the `organisations` table; no org's emails use another org's Postmark credentials or the global environment variable.

**Plans:** 3 plans in 2 waves

Plans:
- [ ] 12-01-PLAN.md — Middleware subdomain routing with org validation and access gating
- [ ] 12-02-PLAN.md — Per-org Postmark configuration, email sender updates, org name in header
- [ ] 12-03-PLAN.md — Subdomain-aware auth flow (login + callback) + verification checkpoint

---

### Phase 13: Onboarding Flow & Team Management

**Goal:** A new firm can sign up, configure their practice, choose a plan, and invite team members — all without manual admin intervention; role-based access controls what each member can do.

**Depends on:** Phase 10 (organisations and user_organisations tables), Phase 11 (Stripe checkout for plan selection), Phase 12 (subdomain redirect after onboarding)

**Requirements:** ONBD-01, ONBD-02, ONBD-03, ONBD-04, ONBD-05, ONBD-06, TEAM-01, TEAM-02, TEAM-03, TEAM-04, TEAM-05, TEAM-06, NOTF-01

**Success Criteria** (what must be TRUE when this phase completes):
1. A new user completing the 4-step onboarding wizard (Account, Firm Details, Plan, Trial Started) ends up at `theirslug.app.domain.com/dashboard` with a fully configured org row, `trial_ends_at` set, and their account marked as org admin — without any manual database intervention.
2. Attempting to re-enter the onboarding flow after it is complete redirects the user to their dashboard; a second org cannot be created for the same account via the onboarding route.
3. An admin inviting a team member by email results in a tokenised invite link being sent; clicking the link creates or logs in the recipient's account and adds them to the org; the same link cannot be used a second time.
4. A member-role user sees only the clients and dashboard navigation tabs; billing, settings, and team management tabs are absent from their view and their routes return a 403 if accessed directly.
5. Attempting to remove the last admin from an org returns an error and leaves the admin assignment unchanged.
6. A daily cron check sends a "trial ending soon" email to the org admin exactly 3 days before `trial_ends_at`; the email is not re-sent on subsequent cron runs for the same org.

**Plans:** TBD

Plans:
- [ ] 13-01: TBD

---

### Phase 14: Super-Admin Dashboard

**Goal:** The platform operator can see all tenants at a glance — their plan, subscription status, usage, and health — without accessing the production database directly.

**Depends on:** Phase 10 (organisations table), Phase 11 (subscription status synced from Stripe)

**Requirements:** ADMN-01, ADMN-02, ADMN-03, ADMN-04

**Success Criteria** (what must be TRUE when this phase completes):
1. A user with `app_metadata.is_super_admin = true` can access `/admin`; a regular org user or unauthenticated visitor attempting the same route is redirected to their own dashboard or login.
2. The super-admin org list displays every organisation with name, slug, plan tier, subscription status, trial expiry, client count, and user count; the list is sortable by plan and subscription status.
3. Clicking any org in the list opens a detail view showing its full settings, member list with roles, and Stripe subscription ID; no data modification actions are exposed in this view.
4. The `is_super_admin` flag cannot be set by any user action through the application UI or client-callable API; setting it requires direct service-role access to Supabase Auth `app_metadata`.

**Plans:** TBD

Plans:
- [ ] 14-01: TBD

---

## Progress

**Execution Order:**
Phases execute in numeric order: 10 -> 11 -> 12 -> 13 -> 14
(Phase 12 can begin in parallel with Phase 11 if needed; both must complete before Phase 13)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 7/7 | Complete | 2026-02-06 |
| 2. Reminder Engine | v1.0 | 5/5 | Complete | 2026-02-07 |
| 3. Delivery & Dashboard | v1.0 | 5/5 | Complete | 2026-02-07 |
| 4. Data Migration | v1.1 | 2/2 | Complete | 2026-02-08 |
| 5. Rich Text Editor & Templates | v1.1 | 4/4 | Complete | 2026-02-08 |
| 6. Email Rendering Pipeline | v1.1 | 1/1 | Complete | 2026-02-08 |
| 7. Schedule Management | v1.1 | 2/2 | Complete | 2026-02-08 |
| 8. Ad-Hoc Sending | v1.1 | 2/2 | Complete | 2026-02-08 |
| 9. Queue Integration | v1.1 | 2/2 | Complete | 2026-02-08 |
| -- v2.0 QOL & Platform Hardening | v2.0 | n/a | Complete | 2026-02-14 |
| 10. Org Data Model & RLS Foundation | v3.0 | 5/5 | Complete | 2026-02-20 |
| 11. Stripe Billing | v3.0 | 5/5 | Complete | 2026-02-21 |
| 12. Subdomain Routing & Access Gating | v3.0 | 0/? | Not started | - |
| 13. Onboarding Flow & Team Management | v3.0 | 0/? | Not started | - |
| 14. Super-Admin Dashboard | v3.0 | 0/? | Not started | - |
