# Prompt Client Reminder System

## What This Is

A web application for Prompt that connects to their QuickBooks Online account, syncs the client list automatically, and sends scheduled email reminders to clients about upcoming filing obligations — year-end accounts, VAT returns, self-assessment deadlines, corporation tax, and Companies House filings. The accountant creates rich text email templates with placeholder variables, configures reminder schedules with multi-step escalation, and can send ad-hoc emails to selected clients. The system handles everything else: calculating when reminders are due, rendering emails with client data, sending them at the right time, tracking delivery, and providing a dashboard with traffic-light status indicators to monitor the whole process.

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

- [ ] Document types catalog and filing requirements mapping (what documents each UK filing type needs)
- [ ] client_documents table: store document metadata linked to client + filing type + storage path
- [ ] document_access_log table: full audit trail of who accessed which document when
- [ ] Supabase Storage private bucket with org-scoped path convention and EU West region
- [ ] Retention enforcement design: 6-year HMRC requirement, flagging mechanism, deletion workflow
- [ ] DSAR export data model: ZIP + JSON manifest for all client documents on request
- [ ] Privacy policy + Terms amendments: 7 gaps identified in ROADMAP.md Phase 2 (document data category, 6-year statutory carve-out, processing scope, client portal data subjects, Supabase storage use, Terms Section 6 qualification)
- [ ] Passive document collection: Postmark inbound attachment extraction → Supabase Storage, classification against document_types catalog
- [ ] Active document collection: token-based client upload portal (Prompt-branded with firm context, no login required), checklist of required documents per filing
- [ ] Per-client checklist customisation: toggle items on/off, add ad-hoc items, persist per client-filing pair
- [ ] Documents inline in filing type cards on dashboard: count, most recent, expand to list, signed URL download
- [ ] Dashboard activity feed: real-time submissions across org's clients
- [ ] Accountant notifications: in-app + email on client portal upload
- [ ] Retention enforcement cron job (Supabase Edge Function)
- [ ] DSAR export mechanism: ZIP archive with JSON manifest, accessible from client detail page

### Validated (v3.0)

- ✓ Organisations table as root entity with plan tier, billing fields, and per-org Postmark credentials — v3.0
- ✓ All data tables gain org_id FK; RLS policies scope all queries to authenticated user's organisation — v3.0
- ✓ Subdomain routing resolves org from subdomain in Next.js middleware — v3.0
- ✓ user_organisations table with admin/member roles; team invite flow — v3.0
- ✓ Stripe billing: 4 tiers (Lite/Sole Trader/Practice/Firm), checkout, webhook, billing management page — v3.0
- ✓ Guided onboarding wizard (Account → Firm Details → Plan → Trial) — v3.0
- ✓ Super-admin dashboard: tenant list, plan/status/usage monitoring — v3.0
- ✓ Per-accountant config: templates, schedules, email settings scoped per user — v3.0
- ✓ Member setup wizard: CSV import + personal configuration post-invite — v3.0
- ✓ Marketing landing page + Privacy Policy + Terms of Service — v3.0

### Deferred

- Inbound email intelligence — deferred indefinitely; can revisit after document collection is stable
- HMRC API integration (MTD VAT/ITSA) — Phase 4 of strategic roadmap, after document collection

### Out of Scope

- Write access to QuickBooks — read-only client data sync
- Mobile app — web dashboard only
- SMS reminders — email only
- Drag-and-drop email builder — rich text editor sufficient
- HTML source code editing — non-technical user, would bypass sanitization
- Real-time collaborative editing — email analytics (open/click tracking) — privacy concern
- iXBRL CT600 filing — requires accounts production engine; aspirational only (see ROADMAP.md Phase 6)

## Context

- **Target users:** UK accounting practices (sole traders to small firms); product is a SaaS platform they subscribe to
- **Domain:** UK accounting obligations — Companies House annual accounts, HMRC Corporation Tax, Self Assessment, VAT returns (quarterly/monthly), CIS returns, confirmation statements
- **Client types per org:** Limited Companies, Sole Traders, Partnerships, LLPs — each with different filing obligations
- **Email requirements:** Each org sends from their own domain via their own Postmark server (credentials stored in organisations table)
- **Filing deadlines are mostly formulaic:** Corporation Tax = year-end + 9 months 1 day, Companies House = year-end + 9 months (private), VAT = quarter-end + 1 month 7 days, Self Assessment = 31 January following tax year — all overridable per client
- **Current state:** v2.0 shipped 2026-02-14 — single-tenant, one Vercel + Supabase + Postmark deployment per firm, RLS uses USING(true), no org isolation
- **Architecture:** Normalized relational tables, TipTap JSON templates, React Email rendering, two-stage cron (queue + send)
- **Multi-tenancy target:** Single Supabase project, all tables gain org_id FK, RLS scoped via user_organisations, subdomain routing (orgslug.app.domain.com)
- **Milestones shipped:** v1.0 MVP (2026-02-07), v1.1 Template & Scheduling Redesign (2026-02-08), v2.0 QOL & Platform Hardening (2026-02-14)

## Constraints

- **Tech stack:** Next.js on Vercel Pro, Supabase (Postgres + Auth + Edge Functions), Postmark for transactional email, Stripe for billing, TipTap 3.x for rich text editing
- **Vercel Pro:** Required for cron jobs (daily scheduler)
- **Supabase shared project:** Single Supabase project for all tenants — org_id isolation via RLS, not separate databases
- **Stripe:** Subscription billing with 4 tiers; trial period via Stripe or application-layer trial_ends_at; overage via Stripe metered billing or application-layer enforcement
- **Subdomain routing:** Wildcard subdomain (`*.app.domain.com`) requires DNS wildcard record + Vercel wildcard domain config
- **UK-specific:** Filing obligations, deadline calculations, and terminology are all UK accounting standards
- **Data migration:** Existing single-tenant data must be migrated to first org; zero data loss required

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Single practice, not SaaS | Built for Prompt specifically; avoids multi-tenancy complexity | Good |
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

## Current Milestone: v4.0 Document Collection

**Goal:** Build the document collection infrastructure — backend schema, Supabase Storage, compliance framework, and the passive + active collection mechanisms — enabling accountants to receive and track client documents ahead of every UK filing deadline.

**Target features:**
- Filing requirements catalog (`document_types`, `filing_document_requirements`)
- Document metadata storage (`client_documents`, `document_access_log`)
- Supabase Storage private bucket (EU West, org-scoped paths, signed URLs only)
- Retention enforcement design + DSAR export model
- Privacy policy + Terms amendments (7 identified gaps)
- Passive collection: Postmark attachment extraction → Storage + auto-classification
- Active collection: Prompt-branded token-link client upload portal (checklist-driven, no login)
- Per-client checklist customisation
- Documents inline in filing type cards; dashboard activity feed; upload notifications
- Retention enforcement cron job + DSAR ZIP export

---
*Last updated: 2026-02-23 after v4.0 milestone started (Document Collection — Phases 18-19)*
