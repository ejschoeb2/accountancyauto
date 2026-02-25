---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: Overview
status: unknown
last_updated: "2026-02-25T21:34:44.579Z"
progress:
  total_phases: 23
  completed_phases: 20
  total_plans: 75
  completed_plans: 72
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-23)

**Core value:** Automate the hours accountants spend manually chasing clients for records and documents, while keeping the accountant in full control of messaging and timing.

**Current focus:** v4.0 Document Collection milestone COMPLETE — Phase 18 complete; Phase 19 all 4 plans complete

## Current Position

Phase: 21 — Document Verification — OCR & Classification Pipeline
Plan: 03 complete — Phase 21 complete (all 3 plans done)
Status: Phase 21 complete — 21-01 (schema migration) done; 21-02 (OCR utilities + extended classifier) done; 21-03 (upload handler wiring) done
Last activity: 2026-02-25 — Plan 21-03 complete: portal upload + Postmark inbound wired with OCR buffer, integrity checks, corrupt PDF rejection, 7 Phase 21 columns in both INSERTs

Progress: [##########] Phase 18 done | [##########] Phase 19: 4/4 plans complete | [####......] Phase 20: 2/? plans complete

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
- Total plans completed: 22
- Phases: 8 (Phase 10-17)
- Requirements: 43 mapped
- Status: All phases complete (shipped 2026-02-23)

**v4.0 Status:**
- Phases: 2 (18-19)
- Requirements: 18 mapped
- Status: Phase 18 complete (4/4 plans), Phase 19 not yet started

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
- [D-10-05-02] Demo user linked to Acme test org; Prompt reserved for real accounts (phases 12/13)
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
- [Phase 17-marketing-landing-page]: framer-motion v12.34.3 installed; compatible with React 19
- [Phase 17-marketing-landing-page]: Bottom boundary bounce added to HeroParticles (not in reference) — prevents particles escaping the 150vh container
- [Phase 17-marketing-landing-page]: PricingSection hardcodes tier values — no lib/stripe/plans.ts import to avoid Stripe env var coupling
- [Phase 17-marketing-landing-page]: Footer CTA uses inverted colour scheme (white bg + violet text) for contrast on dark background
- [Phase 17-03]: app/page.tsx deleted entirely — (marketing)/page.tsx is sole handler for '/'; no re-export needed
- [Phase 17-03]: Middleware root bypass is auth-state-agnostic — authenticated users at '/' see marketing page; dashboard is at '/dashboard?org=slug'
- [Phase 17-03]: scroll-smooth added to main element className — CSS-level smooth scroll for anchor nav links

**v4.0 Decisions (from research — pre-committed before implementation):**
- Storage bucket name: `prompt-documents` (private bucket, EU West region — verify project region at creation time)
- Storage path convention: `orgs/{org_id}/clients/{client_id}/{filing_type_id}/{tax_year}/{uuid}.{ext}` — server-generated UUID; original filename stored in `client_documents.original_filename` only
- Portal uploads use `storage.upload()` with admin client (NOT `createSignedUploadUrl` — known service_role `owner=null` bug in storage-js #186)
- `classification_confidence` stored as enum label (`high`/`medium`/`low`/`unclassified`) — simpler to display and query; numeric score deferred to v5.0 if ML classification added
- Signed download URL expiry: maximum 300 seconds — every generation logged in `document_access_log` before URL is returned to client
- `document_access_log` is INSERT-only for authenticated users (no UPDATE/DELETE via RLS) — audit trail integrity
- Portal token entropy: `crypto.randomBytes(32)` (256-bit); SHA-256 hash stored; raw token shown once and discarded
- Portal layout includes `<meta name="referrer" content="no-referrer">` — prevents token leaking via Referer header to analytics
- Retention anchor: `tax_period_end_date` (not `received_at`) — HMRC CH14600 + TMA 1970 s12B compliance
- Retention hold: `retention_hold = true` skips flagging during active HMRC enquiries (destroying records under enquiry is a criminal offence under TMA 1970 s.20BB)
- Privacy policy deployment is a hard gate before any real documents are stored in production (UK GDPR Art. 13/14 transparency obligation)
- New npm packages: `file-type@^21.3.0` (magic byte MIME detection), `fflate@^0.8.2` (DSAR ZIP export)
- Bucket creation is a manual step (Supabase Dashboard or management API) — cannot be done via SQL migration
- DSAR covers all personal data categories: `client_documents`, `inbound_emails`, `email_log`, `clients` profile, `audit_log`
- Postmark webhook extension is non-blocking: email stored in `inbound_emails` first; attachment extraction is Step 6; Storage failure does not prevent 200 response
- [Phase 18]: [D-18-02-01] vitest used instead of jest — project test runner is vitest; test file imports from vitest not jest
- [Phase 18]: [D-18-02-02] BUCKET_NAME module-level const reads SUPABASE_STORAGE_BUCKET_DOCUMENTS env var with 'prompt-documents' fallback
- [Phase 18]: [D-18-02-03] createSignedUploadUrl NOT used in storage.ts — documented in comments; only createSignedUrl (downloads) is safe with admin client
- [Phase 18-document-collection-foundation]: document_types and filing_document_requirements are global reference tables (no org_id) — authenticated SELECT USING(true), service_role-only writes
- [Phase 18-document-collection-foundation]: document_access_log: INSERT + SELECT only for authenticated (no UPDATE/DELETE RLS policies) — audit trail immutability for HMRC enquiry compliance
- [Phase 18-document-collection-foundation]: upload_portal_tokens.token_hash TEXT NOT NULL UNIQUE — raw token never stored; SHA-256 hex of crypto.randomBytes(32)
- [Phase 18]: [D-18-03-01] Amendments 1-6 applied inline — no visible changelog or amendment section; last updated date unchanged (already February 2026)
- [Phase 18]: [D-18-03-02] Amendment 7 (date) requires no change — both pages already show February 2026
- [Phase 18]: [D-18-04-01] Storage RLS uses auth_org_id()::text cast — auth_org_id() returns UUID, storage.foldername returns text[], explicit cast required to prevent silent type mismatch bugs
- [Phase 18]: [D-18-04-02] 5 separate storage.objects policies (not one FOR ALL) — consistent with project pattern D-10-02-03 for per-operation clarity
- [Phase 18]: [D-18-04-03] service_role ALL policy specifies both USING and WITH CHECK — required for complete DML coverage
- [Phase 18]: [D-18-04-04] Full Phase 18 integration verification passed — 5 checks: tables, seed data, storage RLS, privacy/terms pages, npm run build
- [Phase 19-01]: [D-19-01-01] inbound_email_id excluded from client_documents INSERT — column not present in Phase 18 schema; plan noted this as expected conditional omission
- [Phase 19-01]: [D-19-01-02] BANK_STATEMENT keyword pattern restricted to 'bank statement' phrase — prevents false positives on unrelated documents containing the word 'statement'
- [Phase 19-01]: [D-19-01-03] KEYWORD_MAP uses actual seed codes (CT600_ACCOUNTS, CT600_TAX_COMPUTATION, PAYROLL_SUMMARY) not plan alias names (COMPANY_ACCOUNTS, CT600, PAYSLIP)
- [Phase 19-01]: [D-19-01-04] Migration history repair applied (20260210) — idempotent ADD COLUMN IF NOT EXISTS ran cleanly; consistent with D-15-01-04 pattern
- [Phase 19]: [D-19-03-01] document_access_log INSERT uses created_at (auto-defaulted) + org_id — plan had accessed_at which does not exist in Phase 18 schema
- [Phase 19]: [D-19-03-02] PostgREST FK join typed as unknown as DocumentActivity[] — double-cast required for Supabase SDK array inference mismatch
- [Phase 19]: [D-19-03-03] DocumentCard fetches all client documents once per page mount and filters client-side by filing_type_id — simpler than per-card API call
- [Phase 19]: [D-19-02-01] Portal page validates token inline via createServiceClient — avoids extra network hop, keeps server component pattern
- [Phase 19]: [D-19-02-02] PostgREST FK join for document_types returns array — normalised in normaliseRequirements() in portal page
- [Phase 19]: [D-19-02-03] Button variants use IconButtonWithText (violet/green) — standard Button component lacks these variants
- [Phase 19]: [D-19-02-04] used_at update is fire-and-forget in portal server component — non-critical, does not block page render
- [Phase 19]: [D-19-02-05] Checklist customisation upsert uses onConflict: 'client_id,filing_type_id,document_type_id' matching unique constraint from Phase 19 schema
- [Phase 19]: [D-19-04-01] JSZip arraybuffer type for generateAsync — nodebuffer and uint8array fail TypeScript strict mode with BodyInit; arraybuffer passes
- [Phase 19]: [D-19-04-02] PostgREST FK join returns clients as array; normalised inline in cron route (pick index 0) rather than changing FlaggedDocument interface
- [Phase 19]: [D-19-04-03] DSAR manifest excludes storage_path — raw Storage paths must never be exposed per DOCS-05; manifest contains document metadata fields only
- [Phase 19-04]: Retention cron idempotency via WHERE retention_flagged=false — re-run is always a safe no-op; never auto-deletes documents (flag-and-notify pattern)
- [Phase 19]: condition_description removed from filing_document_requirements select — column does not exist in Phase 18 schema; PostgREST silently returns null for unknown columns, rendering empty checklist
- [Phase 20-01]: docSummaryMap built via single descending-ordered SELECT on client_documents; first row per filing_type_id is most recent — O(n) app-code aggregation per MEMORY.md FK join workaround pattern
- [Phase 20-01]: Document query failure in filings route is non-fatal — console.warn + defaults (0/null) rather than 500; document count must not break filing management view
- [Phase 20-01]: filing_type_id filter on documents route is opt-in and backwards compatible — omitting param returns all documents (existing behaviour)
- [Phase 20-03]: resolveDocumentsRequired catch-and-continue — document DB query failure sets documentsRequired='' and pushes to result.errors; reminder email not aborted
- [Phase 20-03]: Portal token INSERT is additive only (no revoke, no UPSERT) — matches CONTEXT.md locked decision; old tokens remain valid until own expires_at
- [Phase 20-03]: Token expiry = nextStep.delay_days with 30-day fallback — ensures portal link stays valid until next reminder arrives
- [Phase 20-03]: documents_required and portal_link default to '' for custom (non-filing) reminders — templates render correctly regardless of reminder type
- [Phase 20-03]: Tax year derived from reminder.deadline_date.getFullYear() — simple TEXT year for upload_portal_tokens.tax_year column
- [Phase 20-02]: div[role=button] used for DocumentCard expand trigger — nested button elements cause React hydration errors; div with role/tabIndex/onKeyDown is the correct pattern for interactive card headers with child interactive elements
- [Phase 20-02]: ChecklistModal embeds customisation logic inline (no import of standalone ChecklistCustomisation) — modal scoped to known filingTypeId removes need for filing type dropdown
- [Phase 20-02]: notifyAutoRecordsReceived() exported from DocumentCard — called by upload handler response path, not wired to mount; keeps component stateless regarding upload events
- [Phase 21]: [D-21-01-01] DEFAULT 'keyword' on extraction_source — historical rows reflect pre-OCR classifier method, not NULL; Phase 22 display reads this value to explain extraction provenance
- [Phase 21]: [D-21-01-02] Partial index WHERE file_hash IS NOT NULL — historical uploads have no hash so NULL rows excluded from duplicate detection index
- [Phase 21]: [D-21-01-03] All 7 OCR/integrity columns nullable — historical rows unaffected, zero migration risk; Phase 22 handles NULL gracefully per locked decision
- [Phase 21]: [D-21-02-01] Employer regex uses lazy quantifier + lookahead for PAYE/NI/National/Works labels — greedy pattern over-captures into following HMRC fields; lazy {2,60}? + lookahead is correct for normalised single-line text
- [Phase 21]: [D-21-02-02] Local d.ts in types/ for pdf-parse-debugging-disabled — @types/pdf-parse covers original package name, not the fork; lightweight local declaration resolves TS7016
- [Phase 21]: [D-21-02-03] KEYWORD_DEFAULTS const with satisfies — ensures all 6 Phase 21 fields populated for non-OCR paths without repetition; reduces error surface when adding future fields
- [Phase 21]: [D-21-02-04] integrity.ts catches pdf-parse throw and sets pageCount=null — corrupt PDF rejection is classifyDocument's responsibility; integrity checker must not double-reject
- [Phase 21-03]: [D-21-03-01] runIntegrityChecks not called in inbound handler — inbound is fire-and-forget with no rejection path; portal is the only user-facing path where duplicate/size/page-count enforcement makes sense
- [Phase 21-03]: [D-21-03-02] page_count is null for inbound attachments — integrity.ts page count is only populated via runIntegrityChecks (portal path); inbound skips integrity checks by design
- [Phase 21-03]: [D-21-03-03] sha256Hash computed inline in inbound handler via crypto.createHash — avoids importing integrity.ts which would pull in runIntegrityChecks and imply enforcement

### Roadmap Evolution

- Phase 16 added: Member Setup Wizard — post-invite setup flow with CSV client import and configuration
- Phase 17 added: Marketing Landing Page — public-facing marketing site with hero, features, pricing, and footer sections
- Phase 18 added: Document Collection Foundation — schema, Storage, RLS, privacy policy, seed data, token table
- Phase 19 added: Collection Mechanisms — passive + active collection, classification, dashboard integration, retention cron, DSAR export
- Phase 20 added: Document Integration & Document-Aware Reminders — documents inside filing cards, {{documents_required}} + {{portal_link}} template variables, auto-set Records Received
- Phase 21 added: Document Verification — OCR & Classification Pipeline — pdf-parse + regex extraction of tax year/employer/PAYE ref from P60/P45/SA302; populate structured metadata on client_documents
- Phase 22 added: Document Verification — Portal Feedback & Dashboard Summary — client-facing wrong-year/integrity warnings at upload; accountant-facing pre-read summary in filing card

### Known Risks

All v1.0, v1.1, v2.0, and v3.0 risks resolved.

**v4.0 risks from research (PITFALLS.md — must be addressed during Phase 18 planning):**
1. Storage RLS not written — private bucket rejects all SDK calls (non-service-role). Fix: write org-scoped `storage.objects` policies using `storage.foldername(objects.name)` before Phase 19 begins. Test with real authenticated JWT.
2. Privacy policy not updated before documents stored — UK GDPR transparency violation. Fix: COMP-01 is in Phase 18 and is a hard deployment gate before the production bucket receives any real data.
3. HMRC retention anchored to `received_at` instead of `tax_period_end_date` — incorrect deletion dates + criminal risk under enquiry. Fix: `tax_period_end_date` and `retention_hold` are non-nullable in Phase 18 schema.
4. Portal token stored as plaintext or with insufficient entropy. Fix: `crypto.randomBytes(32)`, `sha256(rawToken)` stored, `<meta name="referrer" content="no-referrer">` in portal layout.
5. `createSignedUploadUrl` service_role bug (`owner=null`). Fix: use `storage.upload()` with admin client for portal uploads.
6. Vercel 4.5 MB serverless payload limit — hard constraint, not configurable. Fix: signed upload URL pattern is mandatory; portal client uploads direct to Supabase Storage, bypassing Next.js entirely.

### Open Questions (to resolve during Phase 18 planning)

| Question | Resolve Before |
|----------|---------------|
| 5/6-year retention split: derive `retain_until` from `filing_type_id` in application code, or store `retention_years` on `client_documents`? | Phase 18 plan |
| AML/KYC documents: same `client-documents` bucket or exclude from standard retention cron via `retention_rule` column? | Phase 18 plan |
| DSAR ZIP size limit mitigation: stream to temp Storage path when client has >50 documents? Decide before Phase 19-03 DSAR plan. | Phase 19-03 plan |
| `SUPABASE_STORAGE_BUCKET_DOCUMENTS` env var: add to ENV_VARIABLES.md before Phase 18 implementation | Phase 18 plan |
| Phase 18 P02 | 12 | 2 tasks | 4 files |
| Phase 18-document-collection-foundation P01 | 8 | 2 tasks | 2 files |
| Phase 18 P03 | 10 | 2 tasks | 2 files |
| Phase 19 P03 | 284 | 2 tasks | 7 files |
| Phase 19 P02 | 11 | 2 tasks | 12 files |
| Phase 21-document-verification-ocr-classification-pipeline P01 | 8 | 1 tasks | 1 files |
| Phase 21-document-verification-ocr-classification-pipeline P03 | 14 | 2 tasks | 5 files |

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
| 006 | Privacy policy and terms of service pages | 2026-02-23 | 05169c7 | [6-build-privacy-policy-and-terms-of-servic](./quick/6-build-privacy-policy-and-terms-of-servic/) |

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
- CHAS-01/02: Automated chasing sequences — deferred to v5.0
- INTEL-01/02: OCR/field extraction and auto-checklist update — deferred to v5.0

## Session Continuity

Last session: 2026-02-25 UTC
Stopped at: Phase 21 Plan 03 — complete (upload handler wiring — OCR + integrity into portal upload and Postmark inbound)
Resume file: .planning/phases/21-document-verification-ocr-classification-pipeline/21-03-SUMMARY.md
Next step: Phase 22 — Document Verification Portal Feedback & Dashboard Summary

---
*v4.0 roadmap created 2026-02-23 — Phase 18 (Document Collection Foundation) and Phase 19 (Collection Mechanisms) added; 18 requirements mapped with 100% coverage*
