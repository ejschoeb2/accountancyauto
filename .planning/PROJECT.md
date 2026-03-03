# Prompt Client Reminder System

## What This Is

A SaaS web application for UK accounting practices that automates client reminder workflows and document collection. Firms connect QuickBooks Online to sync clients, create rich text email templates with placeholder variables, and configure multi-step reminder schedules with escalating urgency. The system calculates filing deadlines, sends reminders at the right time via Postmark, and tracks delivery with a traffic-light dashboard. Clients upload documents through a branded portal with OCR-powered classification and advisory validation warnings. Firms choose where documents are stored — Supabase Storage (default), Google Drive, Microsoft OneDrive, or Dropbox — with encrypted OAuth tokens and per-document backend routing.

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

### Validated (v4.0)

- ✓ Document types catalog and filing requirements mapping (document_types, filing_document_requirements) — v4.0
- ✓ client_documents table with metadata, storage_path, OCR fields, retention anchors — v4.0
- ✓ document_access_log table: full audit trail of document downloads — v4.0
- ✓ Supabase Storage private bucket with org-scoped path convention, signed URL downloads (300s expiry) — v4.0
- ✓ Retention enforcement: 6-year HMRC requirement, weekly cron flagging, retention_hold for enquiries — v4.0
- ✓ DSAR export: ZIP archive with JSON manifest from client detail page — v4.0
- ✓ Privacy policy + Terms amended (7 gaps: document category, retention carve-out, processing scope, portal subjects, Supabase processor, Terms S6) — v4.0
- ✓ Passive collection: Postmark inbound attachment extraction → Supabase Storage, classification — v4.0
- ✓ Active collection: token-based client upload portal (Prompt-branded, no login, checklist-driven) — v4.0
- ✓ Per-client checklist customisation: toggle items, add ad-hoc items, persist per client-filing pair — v4.0
- ✓ Documents inline in filing type cards: count, most recent, expand to list, signed URL download — v4.0
- ✓ Dashboard activity feed: real-time document submissions across org — v4.0
- ✓ Accountant notifications on portal upload — v4.0
- ✓ OCR extraction pipeline: P60/P45/SA302/P11D tax year, employer, PAYE ref from pdf-parse — v4.0
- ✓ File integrity checks: size, page count, duplicate hash detection, corrupt PDF rejection — v4.0
- ✓ Portal upload confirmation: ExtractionConfirmationCard, duplicate warning flow — v4.0
- ✓ {{documents_required}} and {{portal_link}} template variables resolved at send time — v4.0
- ✓ Auto Records Received when all mandatory documents uploaded — v4.0

### Validated (v5.0)

- ✓ Provider-agnostic StorageProvider interface with resolveProvider() factory routing by org config — v5.0
- ✓ Per-org storage_backend enum + encrypted OAuth token columns on organisations — v5.0
- ✓ Google Drive integration: OAuth2 (drive.file scope), folder hierarchy, server-proxied downloads — v5.0
- ✓ Microsoft OneDrive integration: MSAL OAuth2, M365 + personal accounts, ICachePlugin encrypted cache — v5.0
- ✓ Dropbox integration: OAuth2 offline, app folder scope, temporary link downloads — v5.0
- ✓ Settings Storage tab: connect/disconnect cards, health-check cron, re-auth banner — v5.0
- ✓ AES-256-GCM token encryption — no plaintext tokens ever stored — v5.0
- ✓ Portal upload, inbound email, DSAR export all route through resolveProvider() — v5.0
- ✓ Chunked upload sessions for files > 4.5 MB (Vercel body limit) — v5.0
- ✓ Postmark inbound idempotency guard — v5.0
- ✓ Per-document-type advisory validation (bank statements, VAT, P60, P45, SA302) — v5.0
- ✓ Supabase Storage remains default for orgs without a provider — v5.0

### Active

(No active requirements — next milestone not yet defined)

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
- **Current state:** v5.0 shipped 2026-03-03 — full multi-tenant SaaS with configurable storage backends (Supabase/Google Drive/OneDrive/Dropbox), per-document-type validation, 12,558 LOC TypeScript
- **Architecture:** Normalized relational tables, TipTap JSON templates, React Email rendering, two-stage cron (queue + send), provider-agnostic StorageProvider interface with per-document backend routing
- **Storage:** Per-org configurable backend via OAuth2; AES-256-GCM encrypted tokens; chunked uploads for large files; daily health-check cron
- **Milestones shipped:** v1.0 MVP (2026-02-07), v1.1 Template & Scheduling Redesign (2026-02-08), v2.0 QOL & Platform Hardening (2026-02-14), v3.0 Multi-Tenancy & SaaS (2026-02-23), v4.0 Document Collection (2026-02-28), v5.0 Third-Party Storage Integrations (2026-03-03)

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
| Provider-agnostic StorageProvider | resolveProvider() factory routes by org config; per-document backend routing | Good |
| AES-256-GCM token encryption | No plaintext OAuth tokens in DB; lazy key loading | Good |
| drive.file scope (not full drive) | Avoids Google restricted-scope verification; covers all use cases | Good |
| MSAL ICachePlugin for OneDrive | Encrypted Postgres persistence between Vercel invocations | Good |
| Per-document storage_backend | Set at insert time, never derived from org's current setting | Good |
| Chunked upload sessions | Provider-native APIs bypass Vercel 4.5 MB body limit | Good |
| Advisory validation (never reject) | Warn clients about potential issues; accountant reviews | Good |

## Current Milestone: None (planning next)

v5.0 shipped. Use `/gsd:new-milestone` to define v6.0.

---
*Last updated: 2026-03-03 after v5.0 milestone shipped (Third-Party Storage Integrations)*
