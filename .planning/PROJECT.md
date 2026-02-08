# Peninsula Accounting Client Reminder System

## What This Is

A web application for Peninsula Accounting that connects to their QuickBooks Online account, syncs the client list automatically, and sends scheduled email reminders to clients about upcoming filing obligations — year-end accounts, VAT returns, self-assessment deadlines, corporation tax, and Companies House filings. The accountant creates rich text email templates with placeholder variables, configures reminder schedules with multi-step escalation, and can send ad-hoc emails to selected clients. The system handles everything else: calculating when reminders are due, rendering emails with client data, sending them at the right time, tracking delivery, and providing a dashboard with traffic-light status indicators to monitor the whole process.

## Core Value

Accountants spend hours every month manually chasing clients for records and documents. This system automates that entirely while keeping the accountant in full control of messaging and timing.

## Requirements

### Validated

- ✓ QuickBooks OAuth 2.0 connection with automatic token refresh — v1.0
- ✓ Full client list sync from QuickBooks — v1.0
- ✓ Filing metadata management per client (client type, year-end, VAT details, deadlines) — v1.0
- ✓ Bulk-edit tools and CSV import for initial metadata setup — v1.0
- ✓ Configurable reminder templates with email sequences and escalating urgency — v1.0
- ✓ Template variables auto-populated from client and practice data — v1.0
- ✓ Per-client overrides for template content and timing — v1.0
- ✓ Rules engine calculating due reminders from anchor dates, delays, and client status — v1.0
- ✓ Automatic year-on-year and quarter-on-quarter rollover — v1.0
- ✓ Daily cron scheduler determining and dispatching due reminders — v1.0
- ✓ Email sending via Postmark with accountant's verified domain as sender — v1.0
- ✓ Bounce handling and delivery tracking — v1.0
- ✓ Dashboard with traffic-light client status (green/amber/red/grey) — v1.0
- ✓ Client detail view with filing status, reminder log, and controls — v1.0
- ✓ Reminder log with full audit trail (timestamps, delivery status) — v1.0
- ✓ Failed email alerts and warning banner — v1.0
- ✓ Mark records as received / pause reminders per client — v1.0
- ✓ UK filing deadline calculators with bank holiday support — v1.0
- ✓ Working day calculation for send dates — v1.0
- ✓ Per-client deadline overrides — v1.0
- ✓ Template step editor with 1-5 configurable steps — v1.0
- ✓ Calendar grid view with deadline visualization — v1.0
- ✓ Filing type auto-assignment based on client type — v1.0
- ✓ Distributed lock for cron to prevent concurrent execution — v1.0
- ✓ HMAC webhook verification for Postmark — v1.0
- ✓ Two-stage cron (queue building + email sending) — v1.0
- ✓ Field-level template override inheritance — v1.0
- ✓ Records received tracking per filing type — v1.0
- ✓ Pause/unpause reminders per client — v1.0
- ✓ Global and per-client audit logs — v1.0
- ✓ Dashboard summary metrics (overdue, chasing, sent today) — v1.0
- ✓ QuickBooks connection status banner — v1.0
- ✓ Standalone email templates with rich text editor (TipTap) — v1.1
- ✓ Slash-command autocomplete for placeholder insertion — v1.1
- ✓ Atomic placeholder pills that cannot be split or corrupted — v1.1
- ✓ Paste from Word/Outlook strips formatting — v1.1
- ✓ HTML sanitization on save (Zod TipTap validation) — v1.1
- ✓ Template body stored as TipTap JSON — v1.1
- ✓ Template CRUD with card grid list, create/edit pages — v1.1
- ✓ Subject line placeholder insertion via button dropdown — v1.1
- ✓ TipTap JSON to email-safe inline-styled HTML via React Email — v1.1
- ✓ Separate scheduling system (templates assigned to timings) — v1.1
- ✓ Multi-step schedules with reordering, template/delay/urgency per step — v1.1
- ✓ Schedule CRUD with sub-tab navigation — v1.1
- ✓ Ad-hoc sending (select clients, pick template, preview, send) — v1.1
- ✓ Multi-step send modal with progress tracking — v1.1
- ✓ Delivery log with ad-hoc/scheduled type indicators — v1.1
- ✓ Auto-migration of JSONB templates to normalized tables — v1.1
- ✓ Queue builder reads from normalized tables (schedules/schedule_steps/email_templates) — v1.1
- ✓ Rich HTML email rendering via TipTap pipeline in cron — v1.1
- ✓ Complete v1.0 legacy code removal — v1.1

### Active

(No active requirements — next milestone not yet defined)

### Out of Scope

- Multi-tenancy / SaaS signup flow — single practice only
- Team member management — solo practitioner
- Write access to QuickBooks — read-only client data sync
- Mobile app — web dashboard only
- Real-time chat or client portal — email reminders only
- SMS reminders — email only
- Billing / payments integration
- Document upload from clients — just reminders, not a file exchange platform
- Drag-and-drop email builder — rich text editor sufficient
- HTML source code editing — non-technical user, would bypass sanitization
- Real-time collaborative editing — solo practitioner
- Email analytics (open/click tracking) — privacy concern, no actionable value

## Context

- **Practice:** Peninsula Accounting, UK-based accounting practice
- **User:** Solo practitioner who is the only dashboard user
- **Domain:** UK accounting obligations — Companies House annual accounts, HMRC Corporation Tax, Self Assessment, VAT returns (quarterly/monthly), CIS returns, confirmation statements
- **Client types:** Limited Companies, Sole Traders, Partnerships, LLPs — each with different filing obligations
- **QuickBooks API:** Uses QBO query API with SQL-like syntax, webhooks for real-time updates, OAuth 2.0 with 1-hour access tokens and 100-day refresh tokens
- **Email requirements:** Must appear to come from Peninsula Accounting's domain, requires Postmark domain verification with DKIM + return-path CNAME
- **Filing deadlines are mostly formulaic:** Corporation Tax = year-end + 9 months 1 day, Companies House = year-end + 9 months (private), VAT = quarter-end + 1 month 7 days, Self Assessment = 31 January following tax year — all overridable per client
- **Current state:** v1.1 shipped 2026-02-08 — 14,567 LOC TypeScript, Next.js + Supabase + Postmark + TipTap 3.x
- **Architecture:** Normalized relational tables (email_templates, schedules, schedule_steps), TipTap JSON for template bodies, React Email for rendering, two-stage cron (queue + send)
- **v1.1 audit:** 40/40 requirements satisfied, 10/10 cross-phase integrations, 3/3 E2E flows, UAT 17/17 after fixes
- **Milestones shipped:** v1.0 MVP (2026-02-07), v1.1 Template & Scheduling Redesign (2026-02-08)

## Constraints

- **Tech stack:** Next.js on Vercel Pro, Supabase (Postgres + Auth + Edge Functions), Postmark for transactional email, TipTap 3.x for rich text editing
- **QuickBooks scope:** `com.intuit.quickbooks.accounting` — read-only access to customer records
- **Vercel Pro:** Required for cron jobs (daily scheduler)
- **Postmark domain verification:** One-time DNS setup required before emails can be sent from practice domain
- **Intuit app review:** Required for production QuickBooks access; sandbox available for development
- **Single user:** No auth complexity — Supabase Auth with single account
- **UK-specific:** Filing obligations, deadline calculations, and terminology are all UK accounting standards

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Single practice, not SaaS | Built for Peninsula Accounting specifically; avoids multi-tenancy complexity | Good |
| Supabase backend | Postgres + Auth + Edge Functions in one platform; MCP integration available | Good |
| Vercel Pro hosting | Native cron jobs for scheduler; Next.js optimized deployment | Good |
| Postmark over SendGrid | Better deliverability for low-volume, high-importance transactional email | Good |
| QuickBooks read-only | Only need client contact data; minimises permission scope and risk | Good |
| No team features | Solo practitioner; simplifies auth and data model | Good |
| TEXT primary keys for filing types | Code readability over auto-increment IDs | Good |
| date-fns + @date-fns/utc | Timezone-safe deadline calculations | Good |
| Traffic-light 4-state system | grey/red/amber/green with strict priority order | Good |
| PostgREST FK workaround | Fetch reference tables separately due to schema cache issues | Revisit |
| Queue pattern for emails | Cron marks pending, separate process sends emails | Good |
| HMAC-SHA256 webhook verification | Timing-safe comparison prevents replay attacks | Good |
| React Email templates | Inline CSS for email client compatibility | Good |
| TipTap 3.x for rich text | React 19 compatible, atomic placeholder nodes, clean JSON output | Good |
| Composition over embedding | Email templates as standalone entities referenced by FK, not JSONB blobs | Good |
| ON DELETE RESTRICT for template FK | Prevents breaking schedules by deleting in-use templates | Good |
| Per-client overrides deferred | Tables exist but no UI — simplifies v1.1, can add later | Good |
| Schedule duplicate removed | One schedule per filing type by design; UNIQUE constraint makes duplication impractical | Good |
| Lazy Postmark client | Proxy pattern avoids module-load crash when token missing | Good |
| Three urgency levels only | normal/high/urgent — 'low' removed for simplicity | Good |
| Paste always strips formatting | Plain text only, no Ctrl+Shift+V — predictable paste behavior | Good |

---
*Last updated: 2026-02-08 after v1.1 milestone completion*
