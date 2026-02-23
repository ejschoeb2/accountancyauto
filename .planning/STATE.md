# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-19)

**Core value:** Automate the hours accountants spend manually chasing clients for records and documents, while keeping the accountant in full control of messaging and timing.

**Current focus:** v3.0 Multi-Tenancy & SaaS Platform — Phase 16 (Member Setup Wizard) executing.

## Current Position

Phase: 16 of 16 (Member Setup Wizard)
Plan: 4 of 4 (checkpoint — awaiting human verification)
Status: Phase 16 plan 04 auto-task complete; checkpoint human-verify pending
Last activity: 2026-02-23 — Phase 16 plan 04 Task 1 complete (wizard page shell); awaiting human verification checkpoint

Progress: [████░] 4/4 Phase 16 plans complete (checkpoint pending)

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
- Total plans completed: 13
- Phases: 5 (Phase 10-14)
- Requirements: 43 mapped
- Status: Phase 10 complete (all 5 plans), Phase 11 complete (all 5 plans), Phase 12 complete (all 3 plans), Phase 13 not started

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
- [D-11-05-01] Stripe client uses lazy Proxy-based initialization to prevent build failures when STRIPE_SECRET_KEY is not set at build time
- [D-12-01-01] Subdomain routing: {slug}.app.phasetwo.uk in production, ?org= query param in development
- [D-12-01-02] Wrong org redirect uses JWT org_id fast path; falls back to user_organisations query for pre-hook sessions
- [D-12-01-03] copyCookies() helper ensures auth token refresh is preserved on all redirect responses
- [D-12-01-04] /auth/signout and /pricing added to PUBLIC_ROUTES alongside /login and /auth/callback
- [D-12-01-05] Unauthenticated on no-slug in dev → /login; in prod → phasetwo.uk (marketing)
- [Phase 12-02]: [D-12-02-01] sendRichEmail accepts optional orgPostmarkToken; falls back to env var postmarkClient if not provided (backwards compatible)
- [Phase 12-02]: [D-12-02-02] Cron skips tokenless orgs with console.warn and pushes skip entry to allResults — no exception thrown
- [Phase 12-02]: [D-12-02-03] Ad-hoc and reply email server actions fetch org token via admin client, pass as optional param — falls back to env var for unconfigured orgs
- [Phase 12-03]: [D-12-03-01] Magic link emailRedirectTo uses org subdomain URL in production; falls back to NEXT_PUBLIC_APP_URL/auth/callback in dev — cookie scoping correct for both environments
- [Phase 12-03]: [D-12-03-02] Auth callback resolves org slug from JWT app_metadata.org_id (fast path) to avoid extra DB query for post-hook sessions
- [Phase 12-03]: [D-12-03-03] Dev redirect from callback appends ?org= param (consistent with middleware dev pattern from 12-01)
- [Phase 13-01]: [D-13-01-01] emailRedirectTo for onboarding magic link goes to /auth/callback; middleware no-org fallback redirects to /onboarding to complete the loop (avoids client-side code exchange)
- [Phase 13-01]: [D-13-01-02] Already-onboarded redirect lives in onboarding layout.tsx (server component), not middleware — avoids extra DB query per request
- [Phase 13-01]: [D-13-01-03] Admin client used for all org/user_org INSERT during onboarding — user has no org_id in JWT until after createOrgAndJoinAsAdmin + refreshSession()
- [Phase 13-01]: [D-13-01-04] createOrgAndJoinAsAdmin idempotency: checks existing user_organisations row before creating to prevent double-create
- [Phase 13-02]: [D-13-02-01] Admin client used for validateInviteToken and acceptInvite — invitee has no org_id in JWT so RLS on invitations would block SELECT queries
- [Phase 13-02]: [D-13-02-02] Email-as-member check uses getUserById loop over memberships (not listUsers filter) — avoids reliance on SDK method availability
- [Phase 13-02]: [D-13-02-03] Unauthenticated invitees shown invite details + Sign In link; user re-clicks invite link after signing in
- [Phase 13-02]: [D-13-02-04] sendInviteEmail uses platform POSTMARK_SERVER_TOKEN — invitee org may not have Postmark configured; these are system notifications
- [Phase 13-03]: [D-13-03-01] orgRole defaults to 'member' in NavLinks and SettingsLink client components — safe default restricts access if prop is missing
- [Phase 13-03]: [D-13-03-02] /schedules and /templates hidden from member nav but no server-side redirect — nav hiding is primary UX control; only /settings and /billing get server-side protection
- [Phase 13-03]: [D-13-03-03] layout.tsx catches getOrgContext() errors and defaults orgRole to 'member' — prevents crash for users mid-onboarding with no org
- [Phase 14-super-admin-dashboard]: Admin route middleware bypass: isAdminRoute() inserted at Step 3.5; unauthenticated users redirected to /login; page-level guard enforces is_super_admin
- [Phase 14-super-admin-dashboard]: isSuperAdmin extracted from user.app_metadata in dashboard layout, passed as prop to NavLinks — no extra DB query
- [Phase 14-super-admin-dashboard]: Client/user counts fetched via Promise.all() with head:true count queries per org in admin page
- [Phase 14-super-admin-dashboard]: STATUS_CONFIG in OrgTable matches billing-status-card.tsx exactly for consistent visual language
- [Phase 14]: STATUS_CONFIG duplicated inline in /admin/[slug] page (not extracted to shared file) — 5 lines not worth adding shared module complexity
- [Phase 14]: Postmark token shown as Configured/Not configured badge in org detail page — never reveal token value even to super-admins via UI
- [Phase 14]: generateMetadata uses async params (Promise) — required pattern in Next.js 16 for dynamic segment params
- [Phase 13]: [D-13-04-01] useTransition for invite/role-change/remove server actions — keeps UI responsive during network calls
- [Phase 13]: [D-13-04-02] pendingAction state per-row for cancel/resend — avoids disabling whole member list
- [Phase 13]: [D-13-04-03] Trial reminder window gte(now+3d)+lt(now+4d) with idempotency flag prevents double-sends
- [Phase 13]: [D-13-04-04] trial-expiry cron added to vercel.json — was missing from schedule despite route existing
- [Phase 15-02]: [D-15-02-01] ADMIN_ONLY_HREFS now contains only /billing — schedules and templates visible to all roles (RLS handles scoping)
- [Phase 15-02]: [D-15-02-02] Org-level reads updated to .is('user_id', null) — prevents reading user-specific rows as org defaults after migration
- [Phase 15-02]: [D-15-02-03] Member settings page uses early-return pattern (no redirect) — members access /settings with simplified view
- [Phase 15-02]: [D-15-02-04] MemberSettingsCard saves send hour + email settings in a single Save action (not auto-save like SendHourPicker)
- [Phase 15-per-accountant-config]: [D-15-01-01] NULLS NOT DISTINCT for app_settings unique constraint — ensures (org_id, NULL, key) is truly unique; prevents duplicate org-level defaults
- [Phase 15-per-accountant-config]: [D-15-01-02] app_settings RLS stays org-scoped (not owner-scoped) — org defaults (user_id IS NULL) must be readable by all org members; user_id filtering in application code
- [Phase 15-per-accountant-config]: [D-15-01-03] Do NOT backfill user_id on app_settings — existing rows are org-level defaults (NULL = org-level is correct semantic)
- [Phase 15-per-accountant-config]: [D-15-01-04] Migration history repair pattern — use --include-all flag when remote history has out-of-order entries from dashboard-applied migrations
- [Phase 15-per-accountant-config]: [D-15-03-01] Per-user per-org lock key (cron_reminders_{org_id}_{userId}) — prevents two cron runs processing same user simultaneously; org-level lock would block all members while one is processing
- [Phase 15-per-accountant-config]: [D-15-03-02] processReminders kept as deprecated wrapper — calls processRemindersForUser per member; new cron entry point calls processRemindersForUser directly
- [Phase 15-per-accountant-config]: [D-15-03-03] ownerId optional in queue-builder — backwards compatible; server actions omit it (RLS handles), cron passes it explicitly
- [Phase 15-per-accountant-config]: [D-15-03-04] accountant_name resolved from user email_sender_name setting (with org fallback) — replaces hardcoded 'PhaseTwo'
- [Phase 15-per-accountant-config]: [D-15-04-01] owner_id derived at send time from clients.owner_id JOIN (no reminder_queue schema change) — owner is a client property, always correct at send time
- [Phase 15-per-accountant-config]: [D-15-04-02] getEmailFromForUser does two separate queries merged in app code — avoids complex SQL for 3-key lookup; consistent with settings fallback pattern
- [Phase 15-per-accountant-config]: [D-15-04-03] Postmark server token stays org-level — only From name and Reply-To are per-user; token is infrastructure, not identity
- [Phase 15-per-accountant-config]: Templates/schedules cloned one-by-one (not bulk) to capture generated IDs for schedule_steps FK remapping
- [Phase 15-per-accountant-config]: schedule_client_exclusions and app_settings NOT cloned on new user seed — exclusions meaningless without clients; settings use org-default fallback pattern
- [Phase 16-member-setup-wizard]: [D-16-01-01] markMemberSetupComplete omits requireWriteAccess — wizard runs before subscription enforcement; writing a completion flag must not be blocked by billing gate
- [Phase 16-member-setup-wizard]: [D-16-01-02] member_setup_complete is per-user (user_id = user.id), NOT org-level (user_id IS NULL) — each member completes setup independently
- [Phase 16-member-setup-wizard]: [D-16-01-03] /setup exemption in enforceSubscription prevents redirect loop for new members on expired-trial orgs
- [Phase 16-member-setup-wizard]: [D-16-02-01] CsvImportStep created as extraction (not shared component) — original dialog kept 100% unchanged because it serves different context
- [Phase 16-member-setup-wizard]: [D-16-02-02] Skip for now on upload state only; mapping/edit-data use Back navigation
- [Phase 16-member-setup-wizard]: [D-16-02-03] Results state button reads 'Next: Configure' — contextual wizard label
- [Phase 16-member-setup-wizard]: [D-16-03-01] Setup layout silently catches getMemberSetupComplete errors — no org context yet for fresh invitees; wizard must proceed without error
- [Phase 16-member-setup-wizard]: [D-16-03-02] Dashboard wizard gate uses dynamic import inside try block — avoids top-level import cost on all layout renders; cached after first call
- [Phase 16-member-setup-wizard]: [D-16-03-03] ConfigStep uses ToggleGroup (not Select) for inbound mode — binary choice benefits from visual toggle in wizard context
- [Phase 16-member-setup-wizard]: [D-16-03-04] ConfigStep Save & Continue always visible (not isDirty-conditional) — explicit user action required to advance wizard even with defaults
- [Phase 16-member-setup-wizard]: [D-16-04-01] Promise.all prefetch on mount for Step 2 defaults — all three settings fetched in parallel while user is on Step 1; Step 2 renders instantly without loading state in the common case
- [Phase 16-member-setup-wizard]: [D-16-04-02] Error state on markMemberSetupComplete failure shown inline without redirect — user can retry; wizard does not advance on error
- [Phase 16-member-setup-wizard]: [D-16-04-03] window.location.href = "/" for final redirect — forces full page load and middleware re-evaluation so member_setup_complete flag is picked up correctly

### Roadmap Evolution

- Phase 16 added: Member Setup Wizard — post-invite setup flow with CSV client import and configuration

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
| Phase 12-subdomain-routing-access-gating P02 | 15 | 2 tasks | 6 files |
| Phase 14-super-admin-dashboard P01 | 10 | 2 tasks | 6 files |
| Phase 14 P02 | 3 | 1 tasks | 3 files |
| Phase 13 P04 | 6 | 2 tasks | 5 files |
| Phase 15-per-accountant-config P01 | 7 | 2 tasks | 3 files |
| Phase 15-per-accountant-config P04 | 5 | 1 tasks | 2 files |
| Phase 15-per-accountant-config P05 | 5 | 2 tasks | 2 files |
| Phase 16-member-setup-wizard P01 | 2 | 3 tasks | 3 files |
| Phase 16-member-setup-wizard P02 | 3 | 1 tasks | 1 files |
| Phase 16-member-setup-wizard P03 | 6 | 3 tasks | 3 files |

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
| 005 | Accountant-scoped client isolation and seat limit removal | 2026-02-22 | dbd7884 | [5-accountant-scoped-client-isolation-and-r](./quick/5-accountant-scoped-client-isolation-and-r/) |

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

Last session: 2026-02-23 UTC
Stopped at: Phase 16 plan 04 — Task 1 complete (wizard page shell created); Task 2 is checkpoint:human-verify (pending)
Resume file: None
Next step: Human verification of full wizard flow end-to-end; then Phase 16 complete

---
*Phase 16 plan 01 complete -- member setup wizard foundation: server actions, middleware exemption, invite redirect (2026-02-22)*
