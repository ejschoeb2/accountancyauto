# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-19)

**Core value:** Automate the hours accountants spend manually chasing clients for records and documents, while keeping the accountant in full control of messaging and timing.

**Current focus:** v3.0 Multi-Tenancy & SaaS Platform — roadmap complete, ready to plan Phase 10

## Current Position

Phase: Phase 10 — Org Data Model & RLS Foundation (not started)
Plan: —
Status: Roadmap complete — awaiting `/gsd:plan-phase 10`
Last activity: 2026-02-19 — v3.0 roadmap created (5 phases, 43 requirements mapped)

Progress: [████████████░░░░░░░░] v3.0 roadmap complete, execution not yet started (30 plans complete from v1.0-v2.0; v3.0 plans TBD)

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
- Total plans completed: 0
- Phases: 5 (Phase 10-14)
- Requirements: 43 mapped
- Status: Roadmap complete, ready to plan Phase 10

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
| Exact `plan_tier` enum values (placeholder SQL used `starter/pro/enterprise`) | Phase 10 plan |
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

Last session: 2026-02-19
Stopped at: v3.0 roadmap created — 5 phases (10-14), 43 requirements mapped
Resume file: None
Next step: `/gsd:plan-phase 10` to begin Phase 10: Org Data Model & RLS Foundation

---
*v3.0 roadmap complete — ready for Phase 10 planning (2026-02-19)*
