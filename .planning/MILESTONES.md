# Project Milestones: Prompt Client Reminder System

## v5.0 Third-Party Storage Integrations (Shipped: 2026-03-03)

**Delivered:** Replaced locked-in Supabase Storage with configurable per-org storage backends — Google Drive, Microsoft OneDrive, and Dropbox — with AES-256-GCM encrypted OAuth tokens, provider-agnostic upload/download routing, and per-document-type advisory validation warnings.

**Phases completed:** 24-30 (25 plans total)

**Key accomplishments:**

- Provider-agnostic StorageProvider interface with resolveProvider() factory routing all uploads/downloads by org config
- Google Drive integration — OAuth2 (drive.file scope), folder hierarchy, server-proxied downloads, withTokenRefresh utility
- Microsoft OneDrive integration — MSAL OAuth2 with ICachePlugin encrypted cache, M365 business + personal account support
- Dropbox integration — OAuth2 offline, app folder boundary, temporary link downloads (4-hour TTL)
- AES-256-GCM token encryption module — no plaintext OAuth tokens ever stored in database
- Settings Storage tab with connect/disconnect cards, health-check cron, re-auth banner, disconnect confirmation with document count
- Per-document-type upload validation — advisory warnings for bank statements, VAT workings, P60, P45, SA302 with portal amber card + accountant review UI
- Chunked upload session APIs for files exceeding Vercel 4.5 MB limit; Postmark inbound idempotency guard

**Stats:**

- 192 files changed (18,230 insertions, 6,984 deletions)
- 12,558 lines of TypeScript (total codebase)
- 7 phases, 25 plans
- 38 feature commits
- 4 days (2026-02-28 → 2026-03-03)

**Git range:** `aff7bad` → `fb99753`

**What's next:** v6.0 planning — HMRC API integration, advanced analytics, or mobile-first redesign

---


## v1.1 Template & Scheduling Redesign (Shipped: 2026-02-08)

**Delivered:** Decoupled email templates from scheduling logic with TipTap rich text editor, normalized database architecture, ad-hoc sending, and complete v1.0-to-v1.1 migration with zero legacy code remaining.

**Phases completed:** 4-9 (13 plans total)

**Key accomplishments:**

- Normalized database architecture — 5 relational tables replacing JSONB-embedded template structure
- TipTap 3.x rich text editor with atomic placeholder pills and paste-formatting protection
- Email rendering pipeline converting TipTap JSON to inline-styled HTML via React Email
- Schedule management UI with multi-step editor, reordering, and template assignment
- Ad-hoc email sending with multi-step modal, preview, progress tracking, and delivery log integration
- Complete v1.0 code removal — zero legacy code, old tables dropped

**Stats:**

- 92 files changed (14,048 insertions, 2,117 deletions)
- 14,567 lines of TypeScript (total codebase)
- 6 phases, 13 plans
- 62 commits
- 2 days (2026-02-07 → 2026-02-08)

**Git range:** `32e528b` → `cf7f6c5`

**What's next:** Production deployment, per-client overrides UI, individual reminder cancel/reschedule

---

## v1.0 MVP (Shipped: 2026-02-07)

**Delivered:** Full automated client reminder system — QuickBooks integration, UK filing deadline calculation, multi-step email reminders via Postmark, and monitoring dashboard with traffic-light status.

**Phases completed:** 1-3 (17 plans total)

**Key accomplishments:**

- QuickBooks OAuth integration with automatic token refresh and client sync
- UK filing deadline calculators for Corporation Tax, Companies House, VAT, and Self Assessment with bank holiday handling
- Multi-step reminder templates with placeholder variables and per-client override inheritance
- Daily cron job that builds reminder queue and processes pending emails via Postmark
- Postmark webhook integration for delivery/bounce tracking with HMAC signature verification
- Dashboard with traffic-light status indicators, summary metrics, and chronological audit log

**Stats:**

- 98 TypeScript files created
- 11,168 lines of TypeScript
- 3 phases, 17 plans
- 55 commits
- 1 day from start to ship (2026-02-06 → 2026-02-07)

**Git range:** `4e35a51` → `a353410`

**What's next:** Production setup — Postmark DNS verification, QuickBooks app review, Vercel deployment

---
