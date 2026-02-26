# Architecture Reference

This document describes how the Prompt backend is structured and how all the pieces connect. It is intended to give full context to any agent or developer working on the codebase without needing to re-analyse the setup.

For environment variable details, see `ENV_VARIABLES.md`.

---

## High-Level Overview

```
                         Vercel (Next.js App Router)
                    ┌──────────────────────────────────────┐
                    │                                      │
  Browser ────────► │  Middleware (auth + org resolution)   │
                    │         │                            │
                    │    ┌────▼──────────────────────────┐ │
                    │    │  (dashboard) pages             │ │
                    │    │  - /dashboard                  │ │
                    │    │  - /clients                    │ │
                    │    │  - /templates                  │ │
                    │    │  - /schedules                  │ │
                    │    │  - /email-logs                 │ │
                    │    │  - /settings                   │ │
                    │    │  - /billing                    │ │
                    │    │  - /admin                      │ │
                    │    └──────────────────────────────┘ │
                    │                                      │
                    │    ┌──────────────────────────────┐  │
  Public ─────────► │    │  (marketing) pages            │  │
                    │    │  - / (landing)                │  │
                    │    │  - /pricing                   │  │
                    │    └──────────────────────────────┘  │
                    │                                      │
                    │    ┌──────────────────────────────┐  │
  Client ─────────► │    │  /portal/[token]              │  │
  (no auth)         │    │  (public upload portal)       │  │
                    │    └──────────────────────────────┘  │
                    │                                      │
                    │    ┌──────────────────────────────┐  │
  Vercel Cron ────► │    │  /api/cron/*                  │  │
                    │    │  (CRON_SECRET auth)            │  │
                    │    └──────────────────────────────┘  │
                    │                                      │
  Postmark ───────► │    │  /api/postmark/inbound         │  │
  (inbound)         │    │  /api/webhooks/postmark        │  │
                    │    └──────────────────────────────┘  │
                    │                                      │
  Stripe ─────────► │    │  /api/stripe/webhook           │  │
                    │    └──────────────────────────────┘  │
                    └──────┬───────────────┬───────────────┘
                           │               │
                   ┌───────▼──────┐  ┌─────▼──────┐
                   │   Supabase   │  │  Postmark   │
                   │  (Postgres   │  │  (Outbound  │
                   │  + Auth      │  │   Email)    │
                   │  + Storage)  │  └────────────┘
                   └──────────────┘
```

---

## Tenancy Model

**Multi-tenant, single deployment.** All accounting firms share one Vercel deployment and one Supabase project. Tenant isolation is enforced entirely through Row Level Security (RLS).

### Organisations

Every firm is an `organisations` row. All data in the system is owned by exactly one organisation via an `org_id` column present on every core table.

### User–Org Membership

Users join organisations through the `user_organisations` junction table with a `role` of either `admin` or `member`:

- **admin** — sees all resources in the org (all clients, templates, schedules)
- **member** — sees only the resources they personally created (`owner_id = auth.uid()`)

### JWT Custom Access Token Hook

A Supabase Custom Access Token Hook (`supabase/functions/custom-access-token-hook/`) runs on every sign-in and injects `org_id` and `org_role` into the user's JWT. This makes org context available inside RLS policies without extra queries.

### RLS Pattern

Three-layer isolation:

```
Layer 1 — Org isolation:   org_id = auth_org_id()
Layer 2 — Owner scoping:   owner_id = auth.uid()  (members only)
Layer 3 — Role escalation: admins bypass layer 2, see all org rows
```

`auth_org_id()` is a Postgres function that reads `org_id` from the JWT claim. All RLS policies use this instead of querying `user_organisations` at runtime.

**Important:** The `supabase_auth_admin` role (used by the JWT hook) runs as a special Postgres role. If RLS is enabled on tables the hook reads, an explicit `USING (true)` policy for `supabase_auth_admin` is required — `GRANT SELECT` alone does not bypass RLS. See migration `20260220220355`.

### Subdomain Routing

Each org is served at its own subdomain (`{slug}.getprompt.app`). The middleware resolves the org from the subdomain and validates session + subscription status on every request.

---

## Supabase Clients

There are 5 Supabase client wrappers, all pointing at the same project via env vars:

| File | Type | Auth Level | Used By |
|------|------|------------|---------|
| `lib/supabase/client.ts` | Browser (`createBrowserClient`) | Anon key, cookie session | Client components |
| `lib/supabase/server.ts` | Server (`createServerClient`) | Anon key, cookie session | Server components, server actions |
| `lib/supabase/middleware.ts` | Middleware (`createServerClient`) | Anon key, cookie session | `middleware.ts` session refresh |
| `lib/supabase/admin.ts` | Admin (`createClient`) | Service role key, bypasses RLS | Cron jobs, admin operations |
| `lib/supabase/service.ts` | Service (`createClient`) | Service role key, bypasses RLS | Webhooks (Postmark inbound, Stripe) |

`admin.ts` and `service.ts` are functionally identical — both create a service-role client that bypasses RLS. They exist as separate files for semantic clarity (admin operations vs webhook handlers).

---

## Authentication

- **Provider:** Supabase Auth (email/password)
- **Middleware:** `middleware.ts` delegates to `lib/supabase/middleware.ts` which refreshes the session cookie and resolves org context on every request
- **Public routes:** `/login`, `/auth/callback`, `/portal/*`, `/`, `/pricing`
- **Excluded from middleware:** `/api/webhooks/*`, `/api/cron/*`, `/api/stripe/webhook` (these use their own secret-based auth)
- **Org context:** `lib/auth/org-context.ts` exposes `getOrgId()` and `getOrgRole()` helpers for use in server components and actions
- **Access gating:** Orgs with `subscription_status` of `cancelled` or `unpaid` are restricted from core features; the middleware redirects to `/billing`

---

## Database Schema

All tables live in a single Supabase Postgres database. Migrations are in `supabase/migrations/` using `<timestamp>_name.sql` naming.

### Multi-Tenancy & Auth

| Table | Purpose |
|-------|---------|
| `organisations` | Root tenant entity — plan tier, Stripe subscription, trial dates, per-org Postmark config |
| `user_organisations` | User-to-org membership with `role` (admin/member) |
| `invitations` | Pending org membership invitations (token + expiry) |

Key columns on `organisations`:
- `slug` — subdomain identifier
- `plan_tier` — enum: `sole_trader` / `practice` / `firm`
- `client_count_limit` — int, null = unlimited
- `stripe_customer_id`, `stripe_subscription_id`, `stripe_price_id`
- `subscription_status` — enum: `trialing` / `active` / `past_due` / `cancelled` / `unpaid`
- `trial_ends_at`
- `postmark_server_token`, `postmark_sender_domain` — org-specific Postmark config (fallback to env vars)

### Core Business Tables

| Table | Purpose |
|-------|---------|
| `clients` | Accounting firm's client list — `org_id`, `owner_id`, name, email, year_end_date, vat_stagger_group, metadata (records_received_for, completed_for) |
| `filing_types` | Reference data: 5 HMRC filing types (seeded, immutable) |
| `client_filing_assignments` | Which filing types are assigned to which client |
| `client_deadline_overrides` | Per-client deadline date overrides |
| `client_filing_status_overrides` | Manual traffic light status overrides per client/filing |

All five tables carry `org_id`. `clients` additionally carries `owner_id` for per-accountant isolation.

### Email Templates & Schedules

| Table | Purpose |
|-------|---------|
| `email_templates` | Reusable email template content (TipTap JSON) — `org_id`, `owner_id` |
| `schedules` | One reminder schedule per filing type (or custom) — `org_id`, `owner_id` |
| `schedule_steps` | Ordered steps within a schedule (days before deadline, template link) — `owner_id` |
| `schedule_client_exclusions` | Opt specific clients out of a schedule — `owner_id` |

### Email Pipeline

| Table | Purpose |
|-------|---------|
| `reminder_queue` | Scheduled reminders pending send (populated by cron, consumed by send-emails cron) |
| `email_log` | Outbound email delivery history (Postmark message ID, status, timestamps) |
| `inbound_emails` | Incoming emails received via Postmark inbound webhook |

### Document Collection

| Table | Purpose |
|-------|---------|
| `document_types` | Global reference — document type names (P60, bank statements, etc.), seeded |
| `filing_document_requirements` | Global reference — which document types are required per filing type |
| `client_documents` | Per-org document metadata with retention tracking (see below) |
| `document_access_log` | Audit trail for document downloads (org-scoped) |
| `upload_portal_tokens` | Shareable upload links for clients — token, expiry, `revoked_at` |
| `client_document_checklist_customisations` | Per-client overrides to the default document checklist |

Key columns on `client_documents`:
- `storage_path` — Supabase Storage object path
- `tax_period_end_date` — NOT NULL; HMRC compliance anchor for retention
- `retain_until` — derived: `tax_period_end_date` + statutory retention period per filing type
- `retention_hold` — boolean; prevents flagging during HMRC enquiry
- `retention_flagged` — set by weekly retention cron when `retain_until < NOW()`
- `classification_confidence` — `high` / `medium` / `low` / `unclassified`
- `source` — `inbound_email` / `portal_upload` / `manual`
- `uploader_user_id` — null for inbound email

### System & Billing

| Table | Purpose |
|-------|---------|
| `app_settings` | Key/value config (sender name, send hour); `user_id` column allows per-user overrides |
| `bank_holidays_cache` | Gov.uk bank holiday data for deadline calculations |
| `locks` | Distributed lock table for cron job safety |
| `processed_webhook_events` | Idempotent Stripe webhook tracking (event ID deduplication) |
| `oauth_tokens` | QuickBooks OAuth tokens (legacy, unused) |

### Storage

Private Supabase Storage bucket: `prompt-documents` (env var `SUPABASE_STORAGE_BUCKET_DOCUMENTS`).

Path structure: `orgs/{org_id}/clients/{client_id}/{filing_type_id}/{tax_year}/{uuid}.ext`

RLS on `storage.objects` is org-scoped — users can only access files within their own org's path prefix.

---

## API Routes

All routes live under `app/api/`. They fall into four categories:

### CRUD Routes (session-scoped)

These use `createClient()` from `lib/supabase/server.ts` and require an authenticated session cookie. All routes validate org membership and enforce `requireWriteAccess(orgId)` on mutations to block writes when subscription is inactive.

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/clients` | GET, POST | List/create clients (POST checks client count limit) |
| `/api/clients/[id]` | GET, PUT, DELETE | Single client CRUD |
| `/api/clients/[id]/filings` | GET, PUT | Client filing assignments; GET includes `doc_count` + `last_received_at` |
| `/api/clients/[id]/filing-status` | PUT | Update filing status override |
| `/api/clients/[id]/documents` | GET, POST | List/upload documents for a client |
| `/api/clients/[id]/documents/dsar` | GET | DSAR data export (all documents as zip) |
| `/api/clients/[id]/portal-token` | POST | Generate a document upload portal token |
| `/api/clients/bulk` | POST | Bulk client operations |
| `/api/clients/bulk-status-update` | POST | Bulk status updates |
| `/api/email-templates` | GET, POST | List/create templates |
| `/api/email-templates/[id]` | GET, PUT, DELETE | Single template CRUD |
| `/api/filing-types` | GET | List filing types |
| `/api/schedules` | GET, POST | List/create schedules |
| `/api/schedules/[id]` | GET, PUT, DELETE | Single schedule CRUD |
| `/api/schedules/[id]/exclusions` | GET, PUT | Schedule client exclusions |
| `/api/reminder-queue/update-status` | POST | Update queue item status |
| `/api/reminders/rebuild-queue` | POST | Rebuild the reminder queue |
| `/api/unsubscribe` | GET | Process email unsubscribe |
| `/api/settings/validate-postmark` | POST | Validate org's Postmark server token |

### Public Routes (no session required)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/portal/[token]` | GET | Fetch portal data for a given upload token |
| `/api/portal/[token]/upload` | POST | Accept file uploads from clients via signed Storage URL |

### Cron Routes (secret-scoped)

These use `createAdminClient()` (service role, bypasses RLS) and verify `CRON_SECRET` via Bearer token. All have `maxDuration = 300`.

| Route | Schedule | Purpose |
|-------|----------|---------|
| `/api/cron/reminders` | Every hour at :00 | Scans clients + schedules per org, populates `reminder_queue` |
| `/api/cron/send-emails` | Every hour at :10 | Reads pending queue entries, sends via Postmark (per-org token), logs to `email_log` |
| `/api/cron/trial-expiry` | Daily | Transitions orgs past `trial_ends_at` from `trialing` to `unpaid` |
| `/api/cron/trial-reminder` | Daily | Sends trial-expiring-soon emails to org admins |
| `/api/cron/retention` | Weekly | Flags `client_documents` where `retain_until < NOW()` and `retention_hold = false`; notifies org admin |

The reminders cron runs first; send-emails runs 10 minutes later to process what was queued. The send hour is configurable per org via `app_settings`.

### Webhook Routes (token/signature-scoped)

| Route | Auth Method | Purpose |
|-------|-------------|---------|
| `/api/webhooks/postmark` | Postmark signature verification | Delivery status updates (bounces, opens, clicks) |
| `/api/postmark/inbound` | `?token=POSTMARK_WEBHOOK_SECRET` query param | Receives inbound emails, runs keyword detection, optionally auto-updates records received |
| `/api/stripe/webhook` | Stripe signature verification | Handles subscription lifecycle events (created, updated, deleted, payment failed) |

### Billing Routes (session-scoped)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/stripe/create-checkout-session` | POST | Initiates Stripe checkout for a plan |
| `/api/stripe/create-portal-session` | POST | Generates a Stripe customer portal link |

---

## Server Actions

All server actions use `createClient()` (session-scoped) and live in `app/actions/`:

| File | Purpose |
|------|---------|
| `clients.ts` | Full CRUD on clients, filing assignments, status overrides (owner-scoped for members) |
| `settings.ts` | Read/write `app_settings` (email config, send hour, onboarding state; user-scoped where applicable) |
| `send-adhoc-email.ts` | Send one-off emails outside the schedule system |
| `send-reply-email.ts` | Send replies to inbound emails |
| `email-queue.ts` | Manage reminder queue entries |
| `csv.ts` | Bulk import clients from CSV |
| `audit-log.ts` | Audit logging |
| `inbound-emails.ts` | Query and manage inbound emails |
| `team.ts` | Org membership management (invite, role change, remove member) |

---

## Billing & Subscription

### Plan Tiers

| Tier | Client Limit | Monthly Price | Stripe |
|------|-------------|---------------|--------|
| `free` | 25 | £0 | None |
| `starter` | 100 | £39/mo | `STRIPE_PRICE_STARTER` |
| `practice` | 300 | £89/mo | `STRIPE_PRICE_PRACTICE` |
| `firm` | 500 | £159/mo | `STRIPE_PRICE_FIRM` |
| `enterprise` | Unlimited | Custom | None (contact sales) |

Price IDs come from env vars so test-mode and production accounts can differ. Free and Enterprise tiers have no Stripe product — free orgs are provisioned directly, enterprise uses a `mailto:` CTA.

### Subscription Lifecycle

```
Sign up → trialing (14 days)
             ↓ trial_ends_at passes (cron/trial-expiry)
          unpaid ←──── payment_failed (Stripe webhook)
             ↑                ↓
          active ←────── checkout completed
             ↓
          past_due → cancelled
```

`subscription_status` on `organisations` is the source of truth. The Stripe webhook handler syncs it on every relevant Stripe event. `processed_webhook_events` prevents duplicate processing.

### Access Enforcement

- **`requireWriteAccess(orgId)`** — called at the top of all mutation routes; throws 402 when `subscription_status` is `cancelled` or `unpaid`
- **`checkClientLimit(orgId)`** — called before client creation; throws 402 when `client_count_limit` is reached
- Both helpers live in `lib/billing/`

---

## Reminder Pipeline

The core business logic flows through a two-stage pipeline:

```
1. QUEUE STAGE (cron/reminders) — runs per org, per accountant
   For each org:
     For each accountant (user_organisations member):
       → Load their clients (owner_id scoped)
       → Check assigned filing types
       → Calculate deadline dates (lib/deadlines/)
       → Walk schedule steps
       → If a step is due today → insert into reminder_queue

2. SEND STAGE (cron/send-emails) — runs per org
   For each pending queue entry:
     → Render email template (lib/email/render-tiptap.ts)
     → Replace template variables ({{client_name}}, {{deadline_date}},
       {{documents_required}}, {{portal_link}}, etc.)
     → Send via Postmark API using org-specific token (lib/email/sender.ts)
     → Log result to email_log
     → Mark queue entry as sent/failed
```

### Deadline Calculation

All deadline logic lives in `lib/deadlines/`. Formulas are UK HMRC-specific:

- **Corporation Tax:** year_end + 9 months + 1 day
- **CT600:** year_end + 12 months
- **Companies House:** year_end + 9 months
- **VAT:** quarter_end + 1 month + 7 days (3 stagger groups supported)
- **Self Assessment:** January 31st

### Traffic Light Status System

Clients are assigned a colour-coded status per filing type (`lib/dashboard/traffic-light.ts`):

| Status | Meaning |
|--------|---------|
| `red` | Overdue (past deadline) |
| `orange` | Critical (within 7 days) |
| `amber` | Approaching (within 30 days) |
| `blue` | Scheduled (more than 30 days) |
| `violet` | Records received (client confirmed, accountant not yet complete) |
| `green` | Completed (both records received and accountant marked complete) |
| `grey` | Inactive / not assigned |

Status can be manually overridden via `client_filing_status_overrides`.

---

## Document Collection

### Overview

Clients submit HMRC documents through two channels:

1. **Inbound email** — client emails an attachment to the firm's Postmark inbound address; the webhook classifies and stores it automatically
2. **Upload portal** — accountant generates a shareable token link; client visits the portal page (no auth required) and uploads directly to Supabase Storage via signed upload URL (file bytes never pass through the Next.js server)

### Storage

Files are stored in a private Supabase Storage bucket. The Next.js server never holds file bytes — it issues signed upload URLs (for portal uploads) and signed download URLs (for accountant access, 300-second expiry). Each download is logged in `document_access_log`.

### Document Classification

Uploaded documents are classified against `document_types` reference data using `lib/documents/classify.ts` (keyword-based). Classification confidence (`high` / `medium` / `low` / `unclassified`) is stored on `client_documents`.

### Retention Compliance

Every `client_documents` row has a `retain_until` date derived from `tax_period_end_date` plus the statutory HMRC retention period for that filing type. The weekly `cron/retention` job:

1. Sets `retention_flagged = true` on rows where `retain_until < NOW()` and `retention_hold = false`
2. Does **not** auto-delete — manual review is required
3. Sends the org admin an email listing newly flagged documents
4. Is idempotent — re-running does not re-flag or re-notify

`retention_hold` can be set manually to protect documents during an HMRC enquiry.

### Auto Records Received

`lib/documents/auto-records-received.ts` checks after each upload whether all mandatory documents for a filing type are now present. If so, it automatically sets `records_received_for` on the client row, transitioning the traffic light to `violet`.

### Template Variables

Two document-aware variables are resolved at send time in the email pipeline:

- `{{documents_required}}` — list of outstanding required documents for the filing type
- `{{portal_link}}` — a freshly generated (or cached) upload portal URL for the client

---

## Inbound Email Processing

When a client replies to a reminder email:

```
Postmark inbound webhook
  → POST /api/postmark/inbound?token=<secret>
    → Store raw email in inbound_emails table
    → If attachments present → classify and store as client_documents
    → Run keyword detection (lib/email/keyword-detector.ts)
    → If high-confidence match → auto-update client's records_received_for
    → If low-confidence → flag for manual review in Email Activity tab
```

---

## Dashboard Pages

All authenticated pages are under `app/(dashboard)/` using the App Router layout:

| Page | Path | Purpose |
|------|------|---------|
| Dashboard | `/dashboard` | Summary cards, status distribution chart, filing overview |
| Clients | `/clients` | Client list with inline editing, CSV import, bulk actions |
| Client Detail | `/clients/[id]` | Single client view — filing status, documents, overrides |
| Templates | `/templates` | Email template list |
| Template Editor | `/templates/[id]/edit`, `/templates/new` | TipTap rich text editor with placeholder system |
| Schedules | `/schedules` | Schedule list per filing type |
| Schedule Editor | `/schedules/[id]/edit` | Step editor, client exclusions, inline template preview |
| Email Activity | `/email-logs` | Outbound email log + inbound email tab |
| Settings | `/settings` | Email sender config, send hour, team management, inbound checker |
| Billing | `/billing` | Subscription status, usage, plan upgrade/downgrade |
| Admin | `/admin` | Super-admin view: all orgs, plan status, usage metrics |
| Admin Org | `/admin/[slug]` | Org-specific admin detail view |

### Auth & Onboarding Pages

Under `app/(auth)/`:

| Page | Path | Purpose |
|------|------|---------|
| Onboarding | `/onboarding` | Post-signup org setup wizard |
| Invite | `/auth/invite` | Accept org membership invitation |
| Setup | `/auth/setup` | Post-invite member setup (CSV import + personal config) |

### Public Pages

| Page | Path | Purpose |
|------|------|---------|
| Landing | `/` | Marketing landing page (hero, features, pricing, CTA) |
| Pricing | `/pricing` | Public pricing page |
| Portal | `/portal/[token]` | Client-facing document upload portal (no auth required) |

---

## Lib Structure

```
lib/
├── auth/           — org-context helpers (getOrgId, getOrgRole)
├── billing/        — usage limits, read-only mode, trial logic, notifications
├── deadlines/      — UK HMRC deadline calculation formulas
├── documents/      — storage, metadata, checklist, classification, notifications, auto-records-received
├── email/          — rendering, sending, keyword detection, sender
├── reminders/      — reminder scheduling logic
├── stripe/         — Stripe client (lazy init), plan config, webhook handlers
├── supabase/       — 5 Supabase client wrappers
├── templates/      — template variable resolution
├── types/          — shared TypeScript types
├── utils/          — shared utilities
├── validations/    — Zod schemas
└── webhooks/       — webhook signature verification
```

---

## Hosting & Deployment

- **Platform:** Vercel (Next.js)
- **Cron:** Vercel Cron Jobs configured in `vercel.json` — 5 jobs (2 hourly, 3 daily/weekly)
- **Git workflow:** Commits go directly to `main`, Vercel auto-deploys on push
- **No branching strategy** — single developer workflow
