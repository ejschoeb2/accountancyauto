# Architecture Reference

This document describes how the Peninsula Accounting backend is structured and how all the pieces connect. It is intended to give full context to any agent or developer working on the codebase without needing to re-analyse the setup.

For environment variable details, see `ENV_VARIABLES.md`.

---

## High-Level Overview

```
                         Vercel (Next.js App Router)
                    ┌──────────────────────────────────┐
                    │                                  │
  Browser ────────► │  Middleware (auth session check)  │
                    │         │                        │
                    │    ┌────▼────────────────────┐   │
                    │    │  (dashboard) pages       │   │
                    │    │  - /dashboard            │   │
                    │    │  - /clients              │   │
                    │    │  - /templates            │   │
                    │    │  - /schedules            │   │
                    │    │  - /email-logs           │   │
                    │    │  - /settings             │   │
                    │    │  - /rollover             │   │
                    │    └────────────────────────┘   │
                    │                                  │
                    │    ┌─────────────────────────┐   │
  Vercel Cron ────► │    │  /api/cron/*             │   │
                    │    │  (CRON_SECRET auth)      │   │
                    │    └────────────────────────┘   │
                    │                                  │
  Postmark ───────► │    │  /api/postmark/inbound   │   │
  (inbound)         │    │  /api/webhooks/postmark  │   │
                    │    │  (token/signature auth)  │   │
                    │    └────────────────────────┘   │
                    └──────┬───────────────┬───────────┘
                           │               │
                   ┌───────▼──────┐  ┌─────▼──────┐
                   │   Supabase   │  │  Postmark   │
                   │  (Postgres   │  │  (Outbound  │
                   │   + Auth)    │  │   Email)    │
                   └──────────────┘  └────────────┘
```

---

## Tenancy Model

**Single-tenant, one deployment per client.** Each accounting firm gets:
- Its own Vercel deployment
- Its own Supabase project (separate database + auth)
- Its own Postmark server (separate sending domain)

No tables have a `tenant_id` column. All RLS policies use `USING (true)` — any authenticated user in that Supabase project sees all rows. There is no tenant resolution in middleware, no subdomain routing, and no user-to-tenant mapping.

See `ENV_VARIABLES.md` for which variables change per deployment.

---

## Supabase Clients

There are 5 Supabase client wrappers, all pointing at the same project via env vars:

| File | Type | Auth Level | Used By |
|------|------|------------|---------|
| `lib/supabase/client.ts` | Browser (`createBrowserClient`) | Anon key, cookie session | Client components |
| `lib/supabase/server.ts` | Server (`createServerClient`) | Anon key, cookie session | Server components, server actions |
| `lib/supabase/middleware.ts` | Middleware (`createServerClient`) | Anon key, cookie session | `middleware.ts` session refresh |
| `lib/supabase/admin.ts` | Admin (`createClient`) | Service role key, bypasses RLS | Cron jobs, admin operations |
| `lib/supabase/service.ts` | Service (`createClient`) | Service role key, bypasses RLS | Webhooks (Postmark inbound) |

`admin.ts` and `service.ts` are functionally identical — both create a service-role client that bypasses RLS. They exist as separate files for semantic clarity (admin operations vs webhook handlers).

---

## Authentication

- **Provider:** Supabase Auth (email/password)
- **Middleware:** `middleware.ts` delegates to `lib/supabase/middleware.ts` which refreshes the session cookie on every request
- **Public routes:** `/login`, `/auth/callback`
- **Excluded from middleware:** `/api/webhooks/*`, `/api/cron/*` (these use their own secret-based auth)
- **Demo mode:** When `NEXT_PUBLIC_IS_DEMO=true`, a demo user (`demo@peninsula-internal.local`) is available via a one-click login button
- **RLS model:** All policies are `USING (true)` — any authenticated user has full read/write access to all tables. There is no per-user data scoping.

---

## Database Schema

All tables live in a single Supabase Postgres database. Migrations are in `supabase/migrations/` using `<timestamp>_name.sql` naming.

### Core Business Tables

| Table | Purpose |
|-------|---------|
| `clients` | Accounting firm's client list (name, email, year_end_date, vat_stagger_group, metadata including records_received_for, completed_for) |
| `filing_types` | Reference data: 5 HMRC filing types (seeded, immutable) |
| `client_filing_assignments` | Which filing types are assigned to which client |
| `client_deadline_overrides` | Per-client deadline date overrides |
| `client_filing_status_overrides` | Manual traffic light status overrides per client/filing |

### Email Templates & Schedules

| Table | Purpose |
|-------|---------|
| `email_templates` | Reusable email template content (TipTap JSON) |
| `schedules` | One reminder schedule per filing type (or custom) |
| `schedule_steps` | Ordered steps within a schedule (days before deadline, template link) |
| `schedule_client_exclusions` | Opt specific clients out of a schedule |
| `client_email_overrides` | Per-client email content customisations |
| `client_schedule_overrides` | Per-client timing customisations |

### Email Pipeline

| Table | Purpose |
|-------|---------|
| `reminder_queue` | Scheduled reminders pending send (populated by cron, consumed by send-emails cron) |
| `email_log` | Outbound email delivery history (Postmark message ID, status, timestamps) |
| `inbound_emails` | Incoming emails received via Postmark inbound webhook |

### System

| Table | Purpose |
|-------|---------|
| `app_settings` | Key/value config store (sender name, sender email, reply-to, send hour, setup mode, onboarding state) |
| `bank_holidays_cache` | Gov.uk bank holiday data for deadline calculations |
| `locks` | Distributed lock table for cron job safety |
| `oauth_tokens` | QuickBooks OAuth tokens (legacy) |

---

## API Routes

All routes live under `app/api/`. They fall into three categories:

### CRUD Routes (session-scoped)
These use `createClient()` from `lib/supabase/server.ts` and require an authenticated session cookie.

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/clients` | GET, POST | List/create clients |
| `/api/clients/[id]` | GET, PUT, DELETE | Single client CRUD |
| `/api/clients/[id]/filings` | GET, PUT | Client filing assignments |
| `/api/clients/[id]/filing-status` | PUT | Update filing status override |
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
| `/api/run-migration` | POST | Run schema migrations |

### Cron Routes (secret-scoped)
These use `createAdminClient()` (service role, bypasses RLS) and verify `CRON_SECRET` via Bearer token.

| Route | Schedule | Purpose |
|-------|----------|---------|
| `/api/cron/reminders` | Every hour at :00 | Scans clients + schedules, populates `reminder_queue` with due reminders |
| `/api/cron/send-emails` | Every hour at :10 | Reads pending `reminder_queue` entries, sends via Postmark, logs to `email_log` |

Both have `maxDuration = 300` (5 minutes, Vercel Pro limit). The reminders cron runs first, then send-emails runs 10 minutes later to process what was queued. The send hour is configurable via `app_settings` — crons run every hour but only process if the current hour matches the configured send hour.

### Webhook Routes (token-scoped)
These use service-role clients and verify incoming requests via shared secrets.

| Route | Auth Method | Purpose |
|-------|-------------|---------|
| `/api/webhooks/postmark` | Postmark signature verification | Delivery status updates (bounces, opens, clicks) |
| `/api/postmark/inbound` | `?token=POSTMARK_WEBHOOK_SECRET` query param | Receives inbound emails from clients, runs keyword detection, optionally auto-updates records received status |

---

## Server Actions

All server actions use `createClient()` (session-scoped) and live in `app/actions/`:

| File | Purpose |
|------|---------|
| `clients.ts` | Full CRUD on clients, filing assignments, status overrides |
| `settings.ts` | Read/write `app_settings` (email config, send hour, onboarding state) |
| `send-adhoc-email.ts` | Send one-off emails outside the schedule system |
| `email-queue.ts` | Manage reminder queue entries |
| `csv.ts` | Bulk import clients from CSV |
| `audit-log.ts` | Audit logging |
| `inbound-emails.ts` | Query and manage inbound emails |

---

## Reminder Pipeline

The core business logic flows through a two-stage pipeline:

```
1. QUEUE STAGE (cron/reminders)
   For each client:
     → Check assigned filing types
     → Calculate deadline dates (lib/deadlines/)
     → Walk schedule steps
     → If a step is due today → insert into reminder_queue

2. SEND STAGE (cron/send-emails)
   For each pending queue entry:
     → Render email template (lib/email/render-tiptap.ts)
     → Replace placeholders ({{client_name}}, {{deadline_date}}, etc.)
     → Send via Postmark API (lib/email/sender.ts)
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

## Inbound Email Processing

When a client replies to a reminder email:

```
Postmark inbound webhook
  → POST /api/postmark/inbound?token=<secret>
    → Store raw email in inbound_emails table
    → Run keyword detection (lib/email/keyword-detector.ts)
    → If high-confidence match → auto-update client's records_received_for
    → If low-confidence → flag for manual review in Email Activity tab
```

---

## Dashboard Pages

All pages are under `app/(dashboard)/` using the App Router layout:

| Page | Path | Purpose |
|------|------|---------|
| Dashboard | `/dashboard` | Summary cards, status distribution chart, filing overview |
| Clients | `/clients` | Client list with inline editing, CSV import, bulk actions |
| Client Detail | `/clients/[id]` | Single client view with filing status, overrides |
| Templates | `/templates` | Email template list |
| Template Editor | `/templates/[id]/edit`, `/templates/new` | TipTap rich text editor with placeholder system |
| Schedules | `/schedules` | Schedule list per filing type |
| Schedule Editor | `/schedules/[id]/edit` | Step editor, client exclusions, inline template preview |
| Email Activity | `/email-logs` | Outbound email log + inbound email tab |
| Settings | `/settings` | Email sender config, send hour, inbound checker, onboarding |
| Rollover | `/rollover` | Year-end rollover workflow |

---

## Hosting & Deployment

- **Platform:** Vercel (Next.js)
- **Cron:** Vercel Cron Jobs configured in `vercel.json` — two jobs running hourly
- **Git workflow:** Commits go directly to `main`, Vercel auto-deploys on push
- **No branching strategy** — single developer workflow
