# Roadmap: Prompt Client Reminder System

## Milestones

- **v1.0 MVP** - Phases 1-3 (shipped 2026-02-07)
- **v1.1 Template & Scheduling Redesign** - Phases 4-9 (shipped 2026-02-08)
- **v2.0 QOL & Platform Hardening** - (shipped 2026-02-14)
- **v3.0 Multi-Tenancy & SaaS Platform** - Phases 10-17 (shipped 2026-02-23)
- **v4.0 Document Collection** - Phases 18-19 (in progress)

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

## v3.0 Multi-Tenancy & SaaS Platform (Shipped 2026-02-23)

**Milestone Goal:** Transform the application from a single-firm tool into a fully-isolated multi-tenant SaaS platform serving multiple independent accounting practices — with org-scoped database isolation, Stripe subscription billing, subdomain routing, guided onboarding, team management, and super-admin visibility.

**Phases:** 10-17 (8 phases)
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

**Plans:** 3/3 plans executed

Plans:
- [x] 12-01-PLAN.md — Middleware subdomain routing with org validation and access gating
- [x] 12-02-PLAN.md — Per-org Postmark configuration, email sender updates, org name in header
- [x] 12-03-PLAN.md — Subdomain-aware auth flow (login + callback) + verification checkpoint

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

**Plans:** 4/4 plans complete

Plans:
- [x] 13-01-PLAN.md — Onboarding wizard (4-step signup: Account, Firm Details, Plan Selection, Trial Started) + middleware updates
- [x] 13-02-PLAN.md — Invite send + accept flow with cryptographic token security and seat limit enforcement
- [x] 13-03-PLAN.md — Role-based navigation filtering and admin-only route protection
- [x] 13-04-PLAN.md — Team management UI card on settings page + trial-ending-soon cron notification

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

**Plans:** 2/2 plans complete

Plans:
- [x] 14-01-PLAN.md — Middleware admin bypass, nav link, super-admin guard, org list page with sortable table
- [x] 14-02-PLAN.md — Org detail page with settings, member list, and Stripe info

---

### Phase 15: Per-Accountant Configuration

**Goal:** Templates, schedules, and email settings are per-accountant (owner_id-scoped) rather than org-level shared resources; each member manages their own reminder setup independently while admins retain full visibility.

**Depends on:** Phase 13 (team management, invite acceptance flow), Quick Task 5 (owner_id on clients, auth_org_role() helper)

**Requirements:** —

**Success Criteria** (what must be TRUE when this phase completes):
1. A member-role user can access `/templates` and `/schedules`, sees only their own resources, and can create/edit/delete them independently of other members or the admin.
2. The cron pipeline processes reminders per-user: each accountant's clients are matched against that accountant's schedules and templates, and emails are sent using that accountant's sender name and reply-to address.
3. A newly invited member who accepts an invite has starter templates and schedules seeded automatically, so they can begin configuring reminders immediately.
4. `app_settings` supports per-user overrides with org-level fallback: a member's `reminder_send_hour` takes precedence over the org default; deleting the user override reverts to the org default.
5. The admin settings page shows all members' configurations; a member's settings page shows only their own.

**Plans:** 5/5 plans complete

Plans:
- [x] 15-01-PLAN.md — Database migrations: owner_id on resource tables, user_id on app_settings, RLS rewrites
- [x] 15-02-PLAN.md — Nav visibility, settings actions per-user support, member settings card
- [x] 15-03-PLAN.md — Cron pipeline per-user inner loop (scheduler + queue-builder)
- [x] 15-04-PLAN.md — Send-emails cron per-user sender settings
- [x] 15-05-PLAN.md — New-user seeding on invite acceptance (clone admin resources)

### Phase 16: Member Setup Wizard

**Goal:** Invited members complete a mandatory two-step post-invite setup wizard (CSV client import + personal configuration) before accessing the dashboard; the wizard is gated so it cannot be skipped or re-entered after completion.

**Depends on:** Phase 15

**Requirements:** —

**Plans:** 4/4 plans complete

Plans:
- [x] 16-01-PLAN.md — Server actions (markMemberSetupComplete, getMemberSetupComplete) + middleware /setup exemption + invite accept redirect to wizard
- [x] 16-02-PLAN.md — CsvImportStep component (full-page extraction from csv-import-dialog, no dialog wrapper)
- [x] 16-03-PLAN.md — Setup layout gate + dashboard layout member gate + ConfigStep component (send hour + inbound mode + email identity)
- [x] 16-04-PLAN.md — Wizard page shell (WizardStepper + step orchestration + completion) + human verification checkpoint

### Phase 17: Marketing Landing Page

**Goal:** A public-facing marketing landing page converts visiting UK accountants into free trial signups, with hero particle effects, feature cards, pricing cards, and a bold footer CTA.

**Depends on:** Phase 16

**Requirements:** MKT-PARTICLES, MKT-SECTIONS, MKT-PAGE, MKT-ROUTING

**Plans:** 3/3 plans complete

Plans:
- [x] 17-01-PLAN.md — Particle physics foundation (framer-motion, useIsMobile, hero-particles, footer-particles)
- [x] 17-02-PLAN.md — Page sections (nav, hero, features, pricing, footer)
- [x] 17-03-PLAN.md — Page assembly, routing, and visual verification

---

## v4.0 Document Collection (In Progress)

**Milestone Goal:** Build the document collection infrastructure — backend schema, Supabase Storage, compliance framework, and the passive + active collection mechanisms — enabling accountants to receive and track client documents ahead of every UK filing deadline.

**Phases:** 18-19 (2 phases)
**Requirements:** 18 v4.0 requirements (DOCS-01 through DASH-03)
**Depth:** Standard

### Phase 18: Document Collection Foundation

**Goal:** Every artifact needed by the collection mechanisms exists and is verified: all five database tables, the private Storage bucket with org-scoped RLS, seed data covering HMRC document types, the portal token security model, core storage utilities, and the privacy policy deployed — making it legally and technically safe to store the first client document.

**Depends on:** Phase 17 (application at v3.0 stable state; `/privacy` page exists for policy amendments)

**Requirements:** DOCS-01, DOCS-02, DOCS-03, DOCS-04, DOCS-05, DOCS-06, COMP-01

**Success Criteria** (what must be TRUE when this phase completes):
1. A developer can upload a test PDF using an authenticated user JWT and confirm the file is stored at `orgs/{org_id}/clients/{client_id}/{filing_type}/{tax_year}/{uuid}.pdf`; attempting the same upload with a JWT from a different org returns a storage 403 error.
2. All five tables (`document_types`, `filing_document_requirements`, `client_documents`, `document_access_log`, `upload_portal_tokens`) exist in the production database with the correct schema; `client_documents` rows have non-nullable `tax_period_end_date` and `retention_hold` columns; `upload_portal_tokens` stores `token_hash` (SHA-256) and never the raw token.
3. `document_types` contains seeded rows covering the core HMRC document catalog (P60, P45, P11D, SA302, bank statement, dividend voucher) and `filing_document_requirements` maps them to SA100, CT600, VAT, and Companies House filing types with mandatory/conditional flags present.
4. The privacy policy at `/privacy` is live and contains all 7 identified amendments: financial documents as a data category, 6-year statutory retention carve-out with HMRC authority citation, broadened processing scope to include document storage, firm clients added as portal data subjects, Supabase file storage in the sub-processor list, and Terms Section 6 qualified to permit financial document types.
5. `lib/documents/storage.ts` exports working `uploadDocument`, `getSignedDownloadUrl` (300-second max expiry), and `deleteDocument` functions; `lib/documents/metadata.ts` exports a `calculateRetainUntil` function that correctly returns `tax_period_end_date + 6 years` for company filings and `january_31_deadline + 5 years` for individual filings.

**Plans:** 4/4 plans complete

Plans:
- [x] 18-01-PLAN.md — DB schema migration: all 5 tables + RLS policies + HMRC seed data (DOCS-01, DOCS-02, DOCS-03, DOCS-04, DOCS-06)
- [x] 18-02-PLAN.md — Storage utilities (lib/documents/storage.ts + metadata.ts TDD) + ENV_VARIABLES.md update (DOCS-05)
- [x] 18-03-PLAN.md — Privacy policy + Terms inline amendments, all 7 gaps (COMP-01)
- [x] 18-04-PLAN.md — Supabase Storage bucket creation (manual) + storage.objects RLS migration + full integration verification (DOCS-05)

---

### Phase 19: Collection Mechanisms

**Goal:** Documents arrive through both channels — passively from Postmark email attachments and actively via the token-based client upload portal — are classified, surfaced inline on the client detail page, and trigger accountant notifications; retention enforcement runs automatically and DSAR export is available on demand.

**Depends on:** Phase 18 (all five tables, Storage bucket + RLS policies, seed data, core storage utilities, privacy policy deployed)

**Requirements:** PASS-01, PASS-02, ACTV-01, ACTV-02, ACTV-03, ACTV-04, DASH-01, DASH-02, DASH-03, COMP-02, COMP-03

**Success Criteria** (what must be TRUE when this phase completes):
1. Sending an email with a PDF attachment to the Postmark inbound address results in a `client_documents` row with `source = inbound_email` and the file stored in Supabase Storage; the Postmark webhook returns 200 even when the Storage upload fails (non-blocking); duplicate message IDs do not create duplicate documents.
2. An accountant generates a portal link from the client detail page; clicking the link in an incognito browser (no auth session) shows the Prompt-branded portal page with the filing-type-specific document checklist; the page includes `<meta name="referrer" content="no-referrer">`; an expired or revoked token shows a clear expiry message instead of the portal.
3. A client uploads two files against checklist items on the portal; the progress indicator updates to "2 of Y items provided"; each file is stored in Supabase Storage via signed upload URL (the file bytes never pass through the Next.js server); a `client_documents` row is created for each file with `classification_confidence` set and `source = portal_upload`; the accountant receives an in-app notification showing the client name and outstanding items count.
4. The filing type card on the client detail page shows the document count and most recent submission date; expanding the card lists all documents with filename, document type label, confidence badge, received date, source, and a download button; clicking download generates a signed URL with 300-second expiry, logs the access in `document_access_log`, and does not expose the raw storage path.
5. The weekly retention cron sets `retention_flagged = true` on `client_documents` rows where `retain_until < NOW()` and `retention_hold = false`; it does not auto-delete any documents; it sends the org admin an email listing newly flagged documents; running the cron a second time does not re-flag already-flagged documents or send duplicate notification emails.

**Plans:** 4 plans in 2 waves

Plans:
- [ ] 19-01-PLAN.md — Phase 19 schema migration (revoked_at, checklist customisations, Realtime) + classifyDocument utility + Postmark attachment extraction (PASS-01, PASS-02)
- [ ] 19-02-PLAN.md — Active portal: token generation, /portal/[token] page, upload API, checklist customisation UI (ACTV-01, ACTV-02, ACTV-03, ACTV-04)
- [ ] 19-03-PLAN.md — Document card on client page + live activity feed + Realtime notification hook (DASH-01, DASH-02, DASH-03)
- [ ] 19-04-PLAN.md — Retention enforcement cron + DSAR export ZIP download (COMP-02, COMP-03)

---

## Phase Details

### Phase 18: Document Collection Foundation
**Goal**: Every artifact needed by the collection mechanisms exists and is verified: all five database tables, the private Storage bucket with org-scoped RLS, seed data covering HMRC document types, the portal token security model, core storage utilities, and the privacy policy deployed — making it legally and technically safe to store the first client document.
**Depends on**: Phase 17
**Requirements**: DOCS-01, DOCS-02, DOCS-03, DOCS-04, DOCS-05, DOCS-06, COMP-01
**Success Criteria** (what must be TRUE):
  1. A developer can upload a test PDF using an authenticated user JWT and confirm the file is stored at `orgs/{org_id}/clients/{client_id}/{filing_type}/{tax_year}/{uuid}.pdf`; attempting the same upload with a JWT from a different org returns a storage 403 error.
  2. All five tables (`document_types`, `filing_document_requirements`, `client_documents`, `document_access_log`, `upload_portal_tokens`) exist in the production database with the correct schema; `client_documents` rows have non-nullable `tax_period_end_date` and `retention_hold` columns; `upload_portal_tokens` stores `token_hash` (SHA-256) and never the raw token.
  3. `document_types` contains seeded rows covering the core HMRC document catalog (P60, P45, P11D, SA302, bank statement, dividend voucher) and `filing_document_requirements` maps them to SA100, CT600, VAT, and Companies House filing types with mandatory/conditional flags present.
  4. The privacy policy at `/privacy` is live and contains all 7 identified amendments: financial documents as a data category, 6-year statutory retention carve-out with HMRC authority citation, broadened processing scope to include document storage, firm clients added as portal data subjects, Supabase file storage in the sub-processor list, and Terms Section 6 qualified to permit financial document types.
  5. `lib/documents/storage.ts` exports working `uploadDocument`, `getSignedDownloadUrl` (300-second max expiry), and `deleteDocument` functions; `lib/documents/metadata.ts` exports a `calculateRetainUntil` function that correctly returns `tax_period_end_date + 6 years` for company filings and `january_31_deadline + 5 years` for individual filings.
**Plans**: TBD

### Phase 19: Collection Mechanisms
**Goal**: Documents arrive through both channels — passively from Postmark email attachments and actively via the token-based client upload portal — are classified, surfaced inline on the client detail page, and trigger accountant notifications; retention enforcement runs automatically and DSAR export is available on demand.
**Depends on**: Phase 18
**Requirements**: PASS-01, PASS-02, ACTV-01, ACTV-02, ACTV-03, ACTV-04, DASH-01, DASH-02, DASH-03, COMP-02, COMP-03
**Success Criteria** (what must be TRUE):
  1. Sending an email with a PDF attachment to the Postmark inbound address results in a `client_documents` row with `source = inbound_email` and the file stored in Supabase Storage; the Postmark webhook returns 200 even when the Storage upload fails (non-blocking); duplicate message IDs do not create duplicate documents.
  2. An accountant generates a portal link from the client detail page; clicking the link in an incognito browser (no auth session) shows the Prompt-branded portal page with the filing-type-specific document checklist; the page includes `<meta name="referrer" content="no-referrer">`; an expired or revoked token shows a clear expiry message instead of the portal.
  3. A client uploads two files against checklist items on the portal; the progress indicator updates to "2 of Y items provided"; each file is stored in Supabase Storage via signed upload URL (the file bytes never pass through the Next.js server); a `client_documents` row is created for each file with `classification_confidence` set and `source = portal_upload`; the accountant receives an in-app notification showing the client name and outstanding items count.
  4. The filing type card on the client detail page shows the document count and most recent submission date; expanding the card lists all documents with filename, document type label, confidence badge, received date, source, and a download button; clicking download generates a signed URL with 300-second expiry, logs the access in `document_access_log`, and does not expose the raw storage path.
  5. The weekly retention cron sets `retention_flagged = true` on `client_documents` rows where `retain_until < NOW()` and `retention_hold = false`; it does not auto-delete any documents; it sends the org admin an email listing newly flagged documents; running the cron a second time does not re-flag already-flagged documents or send duplicate notification emails.
**Plans**: 4 plans in 2 waves

---

## Progress

**Execution Order:**
Phases execute in numeric order: 18 -> 19
(Phase 18 is a hard prerequisite for Phase 19 — no Phase 19 work begins until Phase 18 is deployed and verified)

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
| 12. Subdomain Routing & Access Gating | v3.0 | 3/3 | Complete | 2026-02-21 |
| 13. Onboarding Flow & Team Management | v3.0 | 4/4 | Complete | 2026-02-21 |
| 14. Super-Admin Dashboard | v3.0 | 2/2 | Complete | 2026-02-21 |
| 15. Per-Accountant Configuration | v3.0 | 5/5 | Complete | 2026-02-22 |
| 16. Member Setup Wizard | v3.0 | 4/4 | Complete | 2026-02-23 |
| 17. Marketing Landing Page | v3.0 | 3/3 | Complete | 2026-02-23 |
| 18. Document Collection Foundation | v4.0 | Complete    | 2026-02-23 | 2026-02-23 |
| 19. Collection Mechanisms | v4.0 | 0/TBD | Not started | - |
