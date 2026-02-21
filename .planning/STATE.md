# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-19)

**Core value:** Automate the hours accountants spend manually chasing clients for records and documents, while keeping the accountant in full control of messaging and timing.

**Current focus:** v3.0 Multi-Tenancy & SaaS Platform — Phase 11 in progress

## Current Position

Phase: 11 of 14 (Stripe Billing)
Plan: 4 of 5 (Billing Dashboard Page)
Status: In progress
Last activity: 2026-02-20 — Completed 11-04-PLAN.md (Billing dashboard page with status, usage bars, portal button)

Progress: [████████████████░░░░] 4/5 Phase 11 plans complete

## Performance Metrics

**v1.0 Velocity:**
- Total plans completed: 17
- Total execution time: ~78 min
- Timeline: 1 day (2026-02-06 -> 2026-02-07)

**v1.1 Velocity:**
- Total plans completed: 13
- Total execution time: ~60 min
- Timeline: 2 days (2026-02-07 -> 2026-02-08)
- Phases: 6 (Phase 4-9)
- Commits: 62
- Files changed: 92

**v2.0 Velocity:**
- Quick tasks completed: 4
- Features: Auth refactor, email logs, filing management, bulk ops, rollover, CSV improvements
- Timeline: 6 days (2026-02-09 -> 2026-02-14)
- Status: Shipped

**v3.0 Velocity:**
- Total plans completed: 6
- Phases: 5 (Phase 10-14)
- Requirements: 43 mapped
- Status: Phase 10 complete (all 5 plans), Phase 11 in progress (4/5)

## Accumulated Context

### Decisions

See PROJECT.md Key Decisions table for full list (22 decisions).

Recent decisions affecting v3.0:
- Single Supabase project for all tenants — org_id isolation via RLS, not separate databases
- JWT claims must use `app_metadata` (not `user_metadata`) — user_metadata is client-writable; app_metadata requires service role
- Cron jobs refactored to iterate over orgs (ORG-10) placed in Phase 10 — must be deployed before or alongside RLS activation to prevent cross-tenant email delivery
- Stripe Hosted Checkout (redirect flow) — no client-side Stripe.js required; no PCI scope
- NOTF-02 (payment-failed email) in Phase 11 alongside the Stripe webhook handler that triggers it
- NOTF-01 (trial-ending email) in Phase 13 alongside onboarding which sets trial_ends_at
- AUTH-05 (per-org Postmark) in Phase 12 — Postmark not used in Phase 10/11; first needed when subdomain routing is live
- Plan tier enum values: `('lite', 'sole_trader', 'practice', 'firm')` — must confirm before Phase 10 migration SQL
- Stripe API version to pin: `2026-01-28.clover`
- One new npm package: `stripe@^20.3.1` — all other dependencies already present
- [D-10-01-01] app_settings restructured: key TEXT PK -> UUID id PK + UNIQUE(org_id, key)
- [D-10-01-02] locks keeps TEXT PK; org scoping via org_id column + application code
- [D-10-01-03] filing_types, bank_holidays_cache, oauth_tokens skipped from org_id migration (global reference data)
- [D-10-01-04] Temporary USING(true) RLS policies on new tables (Plan 02 replaces) — REPLACED by 10-02
- [D-10-02-01] app_metadata for JWT claims (not user_metadata) — user_metadata is client-writable
- [D-10-02-02] auth_org_id() returns zero UUID on missing claims (prevents NULL comparison bugs)
- [D-10-02-03] Separate per-operation RLS policies (SELECT/INSERT/UPDATE/DELETE) not FOR ALL
- [D-10-02-04] organisations: authenticated SELECT only, no write access (managed via service_role)
- [D-10-02-05] user_organisations: authenticated SELECT only, no write access
- [D-10-02-06] filing_types/bank_holidays_cache: read-only for authenticated, writes via service_role
- [D-10-03-01] Sequential org iteration in cron jobs (not parallel)
- [D-10-03-02] rebuildQueueForClient takes optional orgId (falls back to client.org_id)
- [D-10-03-03] cancel/restore/unpause helpers unchanged (client_id already scopes to one org)
- [D-10-03-04] sendRichEmail kept unchanged; new sendRichEmailForOrg for cron jobs
- [D-10-04-01] getOrgId() extracts org_id from JWT app_metadata for server actions
- [D-10-04-02] API routes with INSERT/upsert also updated (not just server actions) — all tables have org_id NOT NULL
- [D-10-04-03] Postmark inbound webhook resolves org_id from matched client, falls back to founding org
- [D-10-04-04] Server actions with only SELECT/UPDATE/DELETE unchanged (RLS handles filtering)
- [D-10-05-01] supabase_auth_admin needs explicit RLS policy (not just GRANT SELECT) to read user_organisations in JWT hook
- [D-10-05-02] Demo user linked to Acme test org; Peninsula reserved for real accounts (phases 12/13)
- [D-10-05-03] Sign-out card added to settings page for accessible logout
- [D-11-01-01] Stripe API version pinned to 2026-01-28.clover
- [D-11-01-02] Price IDs from env vars (STRIPE_PRICE_LITE etc.) for test/prod flexibility
- [D-11-01-03] processed_webhook_events: service_role-only RLS (webhook handler uses admin client)
- [D-11-01-04] isOrgReadOnly defaults to true (read-only) for unknown/missing orgs (safe default)
- [D-11-01-05] Placeholder prices: Lite £20, Sole Trader £39, Practice £89, Firm £159/mo
- [D-11-02-01] Insert-before-handle idempotency: mark event processed before handler dispatch, unique constraint fallback for race conditions
- [D-11-02-02] Return 200 even on handler errors to prevent Stripe retries (event already marked processed)
- [D-11-02-03] Auth admin API (getUserById) for admin email resolution, avoids PostgREST FK join issues
- [D-11-02-04] Payment-failed email uses platform Postmark token (system notification, not org-specific)
- [D-11-03-01] Checkout route reuses existing stripe_customer_id or falls back to customer_email for new customers
- [D-11-03-02] Practice tier highlighted as "Popular" on pricing page with primary ring indicator
- [D-11-03-03] Pricing page is a client component using browser Supabase client for auth state
- [D-11-03-04] Trial-expiry cron uses batch .in() update rather than sequential per-org updates
- [D-11-04-01] Status badge uses inline div+span pattern from DESIGN.md (not Badge component) for non-interactive display
- [D-11-04-02] User count fetched via user_organisations count query (not stored on org table)
- [D-11-04-03] Usage bars show percentage only when limit is not null (unlimited shows no percentage)

### Known Risks

All v1.0 and v1.1 risks resolved.

**v3.0 risks identified in research (from PITFALLS.md):**
1. Cron jobs bypass RLS — must add org_id filters before or simultaneously with RLS activation (Phase 10)
2. RLS activated before JWT hook verified will lock out all users — verify hook first, then activate RLS
3. JWT claims must use `app_metadata` not `user_metadata` — architectural invariant, cannot be changed after RLS is active
4. Stripe webhook race (`subscription.created` fires before `checkout.session.completed`) — use `checkout.session.completed` as sole provisioning trigger + idempotency table
5. Trial expiry not enforced if Stripe webhook delivery fails — store `trial_ends_at` at org creation; check in middleware; add daily fallback cron
6. Postmark token for founding org must be seeded from env var before cron switches to per-org token mode

### Open Questions (to resolve during planning)

| Question | Resolve Before |
|----------|---------------|
| ~~Exact `plan_tier` enum values~~ RESOLVED: `('lite', 'sole_trader', 'practice', 'firm')` created in 10-01 | Phase 10 plan |
| Is Peninsula VAT-registered? (determines Stripe Tax configuration) | Phase 11 plan |
| Reserved slug list (admin, www, api, app, billing, etc.) | Phase 10/13 plan |
| Where do per-org Postmark server tokens come from for new tenants? (admin enters own token vs programmatic via API vs shared account) | Phase 13 plan |
| Data retention policy for cancelled orgs (30 days mentioned; confirm before Phase 14) | Phase 14 plan |

### Tech Debt

1. PostgREST FK join workaround in audit-log.ts (v1.0)
2. Dual PlaceholderNode implementations — client vs server (v1.1)
3. Extension config duplicated between editor and renderer (v1.1)
4. 9 pre-existing test failures in rollover.test.ts and variables.test.ts
5. Phase 1 plans 02-04 missing formal SUMMARY.md files
6. Phase 1 & 3 missing formal VERIFICATION.md

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 001 | Custom schedules with user-defined dates | 2026-02-09 | 272d79b | [001-custom-schedules](./quick/001-custom-schedules/) |
| 002 | Demo client creation dialog and POST API | 2026-02-09 | 074aa4c | [002-demo-client-creation](./quick/002-demo-client-creation/) |
| 003 | Auth and multi-practice deployment automation | 2026-02-12 | fd582b9 | [003-auth-and-multi-practice-setup](./quick/003-auth-and-multi-practice-setup/) |
| 004 | Streamlined 3-step onboarding wizard | 2026-02-12 | b44ad4d | [004-streamlined-onboarding-wizard](./quick/004-streamlined-onboarding-wizard/) |

### Deferred Features

- RNDR-01/02/03: Live preview pane (descoped from v1.1)
- SCHD-09/10: Cancel/reschedule individual reminders
- OVRD-01 to OVRD-05: Per-client override UI (tables exist, no UI)
- DISC-01 to DISC-04: Template organization (search, filter, usage stats)
- EMAL-01 to EMAL-03: Email enhancements (plain text fallback, Litmus, retry)
- CALV-01/02: Calendar view for scheduled reminders
- QKSN-01: Ad-hoc email from client detail page
- Inbound email intelligence (original v3.0 Phases 10-13) — deferred indefinitely
- BILL-EXT-01: Stripe metered/usage-based overage billing — defer to v3.x
- BILL-EXT-02: Annual billing option — defer to v3.x
- ADMN-EXT-01: Super-admin impersonation — RLS complexity, defer to v3.x
- ADMN-EXT-02: Super-admin manual plan override — defer to v3.x

## Session Continuity

Last session: 2026-02-21 00:00 UTC
Stopped at: Completed 11-04-PLAN.md (Billing Dashboard Page)
Resume file: None
Next step: Execute 11-05-PLAN.md (Read-Only Enforcement)
Note: Billing page with status card, usage bars, and Stripe portal button all created

---
*Phase 11 plan 04 complete — Admin-only billing page with subscription status card, color-coded usage bars, and Stripe Customer Portal button (2026-02-20)*
