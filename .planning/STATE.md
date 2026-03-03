---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: Multi-Tenancy & SaaS Platform
status: unknown
last_updated: "2026-03-03T02:20:16.228Z"
progress:
  total_phases: 31
  completed_phases: 29
  total_plans: 105
  completed_plans: 102
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-28)

**Core value:** Automate the hours accountants spend manually chasing clients for records and documents, while keeping the accountant in full control of messaging and timing.

**Current focus:** Phase 30 Plan 03 complete — Accountant-facing validation warning UI: amber badge + clear action on document card, Issues column in activity uploads table, UploadValidationModal detail popup, Needs Review filter chip.

## Current Position

Phase: 30 (complete — all 3 plans done)
Plan: 03 complete
Status: Phase 30 Plan 03 complete — Amber badge on document cards, Issues column in uploads table, UploadValidationModal
Last activity: 2026-03-03 — Phase 30-03 document-card badge + clear action, uploads-table Issues column, upload-validation-modal.tsx

Resume file: none
Next step: Phase 30 complete — all 3 plans executed

Progress: ░░░░░░░░░░ 0% (0/6 phases complete)

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
- Phases: 6 (18-23)
- Requirements: 18 mapped (+ pricing phases)
- Status: All phases complete (shipped 2026-02-28)

**v5.0 Status:**
- Phases: 6 (24-29)
- Requirements: 36 mapped
- Status: Roadmap created, no plans started

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
- [D-12-01-05] Unauthenticated on no-slug in dev -> /login; in prod -> phasetwo.uk (marketing)
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

**Phase 24-03 Decisions:**
- [D-24-03-01] getKey() called lazily inside each function, not at module scope — mirrors D-11-05-01 Stripe client; prevents build failures when ENCRYPTION_KEY absent at build/CI time
- [D-24-03-02] Ciphertext format iv_hex:authTag_hex:encrypted_hex (self-contained single TEXT string) — no external metadata required for decryption
- [D-24-03-03] GCM auth tag errors NOT suppressed in decryptToken() — wrong key or tampered ciphertext must throw immediately
- [D-24-03-04] 12-byte (96-bit) IV via randomBytes(12) per encryptToken() call — GCM standard; fresh IV per call is non-negotiable for semantic security

**Phase 24-01 Decisions:**
- [D-24-01-01] storage_backend_status uses TEXT + CHECK constraint (not enum) — values can be added without ALTER TYPE; CHECK includes 'reauth_required' from the start for Phase 25 use
- [D-24-01-02] Per-document storage_backend column on client_documents set at INSERT time, never derived from org's current storage_backend — prevents broken routing after backend switches
- [D-24-01-03] All _enc columns are TEXT DEFAULT NULL, nullable — written only by lib/crypto/tokens.ts (Plan 02)
- [D-24-01-04] Enum type and all dependent columns in a single migration to avoid ordering failures

**v5.0 Decisions (from research — pre-committed before implementation):**
- Use `@googleapis/drive@^20.1.0` (scoped package, 2.3 MB) NOT `googleapis` (199 MB — Vercel function size limit risk)
- Use `@azure/msal-node@^5.0.5` NOT `@azure/msal-browser` (browser-only, crashes in Node.js serverless)
- Use `@azure/msal-node` + `@microsoft/microsoft-graph-client@^3.0.7` NOT `@azure/identity` (machine-to-machine only, not user OAuth2)
- No shared OAuth helper — each provider has idiosyncratic refresh behaviors; provider-specific SDKs are the correct abstraction layer
- Token encryption: AES-256-GCM via `lib/crypto/tokens.ts`; `_enc` column suffix signals encryption at all times; `ENCRYPTION_KEY` env var never stored in Supabase
- Per-document `storage_backend` column on `client_documents` set at insert time, never derived from org's current `storage_backend` — prevents broken routing after backend switches
- Google Drive: `drive.file` scope only — full `drive` scope triggers restricted-scope verification (weeks of delay); `drive.file` covers all Prompt use cases
- Google Drive downloads: server-proxied (no native signed URL under `drive.file` scope) — resolve exact approach (proxy vs streaming) before Phase 25 coding
- OneDrive: `/common` authority supports both M365 business and personal Microsoft accounts from single app registration
- OneDrive: `Files.ReadWrite.AppFolder` scope is personal-account-only and unavailable for M365 business accounts; self-enforce `Apps/Prompt/` path in application code instead
- OneDrive MSAL token cache: serialized as JSON blob, encrypted, persisted to `organisations.ms_token_cache_enc` via `ICachePlugin` interface
- Dropbox: `token_access_type=offline` must be explicit in authorization URL; OAuth callback rejects if no refresh token returned
- Dropbox: app folder scope (`/Apps/Prompt/`) — provider-enforced boundary, cleaner than OneDrive self-enforcement
- Dropbox downloads: `filesGetTemporaryLink` (4-hour TTL) — closest to existing signed URL UX
- Silent upload failure prevention: `withTokenRefresh(orgId, call)` wrapper with proactive refresh + explicit `reauth_required` status on fatal `invalid_grant` / `AADSTS53003` — built in Phase 25 before any upload reaches production
- Disconnect modal shows document count before clearing tokens — prevents accidental permanent inaccessibility
- Daily health-check cron: lightweight API call per org with active non-Supabase backend; idempotent re-email guard (does not re-notify on consecutive failures)
- Privacy policy hard gate: Google LLC, Microsoft Corporation, Dropbox Inc. added to sub-processor list before any provider goes to production (UK GDPR Art. 13/14)
- Portal upload for large files: provider-native chunked upload session APIs — Vercel 4.5 MB request body limit applies to any proxied upload through Next.js
- Postmark inbound handler: always returns 200; provider upload is async or size-guarded to prevent webhook timeout; idempotency guard on `client_documents` insert against Postmark retries
- [Phase 24-02]: [D-24-02-01] StorageProvider interface defines upload(), getDownloadUrl(), delete(), getBytes() — four methods sufficient for all current and Phase 25-27 use cases
- [Phase 24-02]: [D-24-02-02] resolveProvider() defaults to SupabaseStorageProvider for null storage_backend — safe default for pre-migration rows
- [Phase 24-02]: [D-24-02-03] Backwards-compatible named exports use @deprecated JSDoc — signals intent to new callers; existing callers unchanged
- [Phase 24-02]: [D-24-02-04] getBytes() reuses getDownloadUrl() internally — avoids duplicating signed URL logic; consistent with DSAR export pattern
- [Phase 25-01]: [D-25-01-01] Use auth.OAuth2 (named export from @googleapis/drive) not google.auth.OAuth2 — google is not a named export from the scoped package
- [Phase 25-01]: [D-25-01-02] OAuth2Client construction is lazy (inside withTokenRefresh) — mirrors D-11-05-01 Stripe pattern; prevents build failures when Google env vars absent
- [Phase 25-01]: [D-25-01-03] invalid_grant detection checks err.response.data.error AND err.message string — covers both google-auth-library response format and edge-case string messages
- [Phase 25-02]: [D-25-02-01] Use { drive as createDrive } named export from @googleapis/drive — google is not a named export from the scoped package
- [Phase 25-02]: [D-25-02-02] Drive file ID is the storagePath for Google Drive — stored in client_documents.storage_path, used directly for getBytes() and delete()
- [Phase 25-02]: [D-25-02-03] clientName is optional in UploadParams with fallback to clientId — backwards compatible; SupabaseStorageProvider ignores the field
- [Phase 25-02]: [D-25-02-04] getDownloadUrl() throws with clear error — drive.file scope cannot produce public URLs; download routes must use getBytes() via server-proxy
- [Phase 25]: [D-25-03-01] Use extracted string variables after getToken() — avoids TypeScript mismatch between Credentials type and returned token shape; setCredentials() called with original tokens object
- [Phase 25]: [D-25-03-02] All callback error paths redirect to /settings?tab=storage&error=X — OAuth callbacks must never expose raw error state to users
- [Phase 25]: [D-25-03-03] Guard both access_token AND refresh_token absence after getToken() — plan only specified refresh_token guard but access_token is equally required for Drive API use
- [Phase 25-04]: [D-25-04-01] Buffer -> Uint8Array for Response BodyInit: TypeScript's Response constructor does not accept Node.js Buffer; new Uint8Array(bytes) is the correct BodyInit-compatible cast
- [Phase 25-04]: [D-25-04-02] PostgREST !inner join cast through unknown: SDK infers array type for joined relations; direct as { ... } assertion fails; routing through unknown first avoids TypeScript overlap error
- [Phase 25-04]: [D-25-04-03] maxDuration = 60 on documents/route.ts — Google Drive getBytes() streams a full file; Vercel default 10s timeout too short for large PDFs
- [Phase 25-04]: [D-25-04-04] orgConfig fetched once before attachment loop in processAttachments — prevents N extra DB round-trips for multi-attachment emails
- [Phase 25-05]: Per-document storage_backend routing in DSAR: org config fetched once before loop; doc.storage_backend determines google_drive vs supabase byte-fetch strategy
- [Phase 25-05]: disconnectGoogleDrive uses admin client and clears all 6 token/config columns; revalidatePath('/settings') ensures StorageCard re-renders with updated state
- [Phase 27-02]: DB-based CSRF state (organisations.dropbox_oauth_state) used for Dropbox — differs from Google Drive's HttpOnly cookie approach; plan requirement
- [Phase 27-02]: disconnectDropbox uses getOrgContext() for admin role guard (orgRole \!== admin); Google Drive disconnectGoogleDrive omitted this guard historically
- [Phase 27]: [D-27-01-01] DropboxAuth.checkAndRefreshAccessToken() used (no custom wrapper needed unlike Google Drive Phase 25)
- [Phase 27]: [D-27-01-02] App folder path convention: no /Apps/Prompt/ prefix in paths — Dropbox platform enforces boundary for App folder access type
- [Phase 27]: [D-27-01-03] getBytes() reuses getDownloadUrl() temporary link then fetches bytes — consistent with SupabaseStorageProvider pattern
- [Phase 27]: [D-27-01-04] Schema migration uses IF NOT EXISTS — columns were already present from Phase 24; migration is idempotent
- [Phase 27-03]: [D-27-03-01] DSAR branching changed to supabase-as-default: if (!storage_backend || === 'supabase') rather than if (=== 'google_drive') — forward-compatible for any future backend
- [Phase 27-03]: [D-27-03-02] Dropbox download returns { signedUrl: url } (temporary link) not proxied bytes — filesGetTemporaryLink works under app folder scope, unlike Google Drive drive.file scope
- [Phase 27-03]: [D-27-03-03] Dropbox download route uses storage_backend: 'dropbox' explicitly (per-document routing per D-24-01-02, not org.storage_backend)
- [Phase 26-01]: PostgresMsalCachePlugin encrypts entire serialized MSAL cache as single AES-256-GCM blob via lib/crypto/tokens.ts — no per-token encryption
- [Phase 26-01]: cacheHasChanged guard in afterCacheAccess prevents unnecessary DB writes on read-only token operations
- [Phase 26]: [D-26-02-01] Fresh MSAL client per request — PostgresMsalCachePlugin.beforeCacheAccess fires once per client instance; reusing across requests would serve stale cache
- [Phase 26]: [D-26-02-02] OneDrive item ID as storagePath — stored in client_documents.storage_path; stable identifier for getBytes, getDownloadUrl, and delete
- [Phase 26]: [D-26-02-03] OneDrive download uses getDownloadUrl (temporary link) not getBytes — OneDrive natively provides @microsoft.graph.downloadUrl under Files.ReadWrite scope
- [Phase 26]: [D-26-03-01] MSAL client created lazily inside handler (not module scope) — mirrors D-11-05-01 Stripe pattern; prevents build failures when MS env vars absent at build time
- [Phase 26]: [D-26-03-02] PostgresMsalCachePlugin injected in callback only, not connect — connect only generates auth URL, no tokens involved; plugin added for callback so afterCacheAccess fires to persist initial cache
- [Phase 26]: [D-26-03-03] StorageCard uses Suspense boundary wrapping inner component — required for useSearchParams in Next.js App Router without blocking static rendering
- [Phase 26]: [D-26-03-04] oneDriveConnected prop derived from ms_home_account_id IS NOT NULL — homeAccountId is reliable presence indicator; ms_token_cache_enc could be null during re-auth flows
- [Phase 28]: disconnectGoogleDrive return type changed to Promise<{ error?: string }> with admin role guard — consistent with disconnectDropbox pattern
- [Phase 28]: Re-auth banner uses providerName derived from org.storage_backend (declared before try block with safe fallback)
- [Phase 28]: D-28-03-01: PostgresMsalCachePlugin takes only orgId:string; D-28-03-02: app_settings upsert uses onConflict 'org_id,user_id,key' with user_id:null per Phase 15 NULLS NOT DISTINCT constraint; D-28-03-03: Idempotency queries use .is('user_id',null); D-28-03-04: reauth_required orgs filtered at query level not loop level
- [Phase 28]: [D-28-02-01] disconnectOneDrive returns Promise<{ error?: string }> with admin role guard — consistent with disconnectGoogleDrive and disconnectDropbox
- [Phase 28]: [D-28-02-02] Document count fetched async after modal opens — avoids blocking button click; modal shows Loading then count
- [Phase 28]: [D-28-02-03] Confirm button disabled while documentCount === null — prevents disconnect before count is known
- [Phase 29]: NULLS DISTINCT (standard Postgres default) instead of NULLS NOT DISTINCT for uq_inbound_emails_org_message_id — existing rows all have NULL postmark_message_id; NULLS NOT DISTINCT would treat same-org NULLs as duplicates and fail constraint creation
- [Phase 29]: LARGE_FILE_THRESHOLD = 4 MB; CHUNK_SIZE = 1.25 MB (LCM of Drive/OneDrive alignment); three-step session+chunks+finalize pattern for large portal uploads
- [Phase 30]: SheetJS require() inside function body to avoid App Router CJS/ESM issues (Pitfall 1)
- [Phase 30]: Bank statement PDF check only fires on structured period markers, not arbitrary dates (Pitfall 3)
- [Phase 30]: VAT period plausibility uses +-1 year from portal tax year, not exact stagger group alignment (Pitfall 4)
- [Phase 30]: ValidationWarning interface redefined locally in portal client components to avoid importing server-only lib/documents/validate.ts into client bundle
- [Phase 30]: showConfirmationCard requires validationWarnings.length === 0 — amber warning card takes absolute priority over green confirmation card (never both simultaneously)
- [Phase 30]: ValidationWarning type duplicated locally in client files (not imported from server module) to avoid importing server-only module into client bundle

### Roadmap Evolution

- Phase 16 added: Member Setup Wizard — post-invite setup flow with CSV client import and configuration
- Phase 17 added: Marketing Landing Page — public-facing marketing site with hero, features, pricing, and footer sections
- Phase 18 added: Document Collection Foundation — schema, Storage, RLS, privacy policy, seed data, token table
- Phase 19 added: Collection Mechanisms — passive + active collection, classification, dashboard integration, retention cron, DSAR export
- Phase 20 added: Document Integration & Document-Aware Reminders — documents inside filing cards, template variables, auto-set Records Received
- Phase 21 added: Document Verification — OCR & Classification Pipeline — pdf-parse + regex extraction; structured metadata on client_documents
- Phase 22 added: Document Verification — Portal Feedback & Dashboard Summary — client-facing warnings at upload; accountant-facing pre-read summary
- Phase 23 added: Unified pricing experience with slider calculator and upgrade prompts — shared PricingSlider; Stripe metered billing; upgrade prompt
- Phase 24 added: Storage Abstraction Layer — provider-agnostic interface, schema migrations, AES-256-GCM token encryption
- Phase 25 added: Google Drive Integration — OAuth2, GoogleDriveProvider, withTokenRefresh, portal/inbound/DSAR updated
- Phase 26 added: Microsoft OneDrive Integration — MSAL OAuth2, OneDriveProvider, M365/personal, AADSTS53003 handling
- Phase 27 added: Dropbox Integration — OAuth2 offline, DropboxProvider, app folder, temporary link downloads
- Phase 28 added: Settings UI & Token Lifecycle — unified Storage tab, re-auth banner, health-check cron, privacy policy update
- Phase 29 added: Hardening & Integration Testing — large file uploads, Postmark webhook safety, mixed-backend DSAR, end-to-end verification
- Phase 30 added: Per-document-type upload validation — tailored checks per document type, CSV MIME fix, large-file path validation

### Known Risks

**v5.0 risks from research (must be addressed during Phase 24-25 planning):**
1. Unencrypted refresh tokens in Postgres — plaintext token exposes permanent cloud storage access on any DB breach. Fix: AES-256-GCM via `lib/crypto/tokens.ts` is a Phase 24 deliverable and a hard gate before any token is ever written to the database.
2. Silent upload failures on token expiry — access token expires mid-upload; 401 returned by provider but not retried; `client_documents` row written with null storage_path; document listed but permanently inaccessible. Fix: `withTokenRefresh` wrapper built in Phase 25 before any provider upload reaches production.
3. Per-org backend routing for downloads (wrong approach) — using `org.storage_backend` instead of `doc.storage_backend` breaks for orgs that have ever switched backends. Fix: `storage_backend` column on `client_documents` set at insert time (Phase 24 schema change).
4. Google `invalid_grant` with no re-auth signal — Google invalidates refresh tokens on password change, revocation, 50-token limit, or Testing app status (7-day forced expiry). Fix: explicitly catch `invalid_grant`, set reauth status, null token, surface banner. Google OAuth app must be in Production status before any real firm connects.
5. Orphaned documents on external provider access revocation — no provider webhook on revocation; documents listed but inaccessible. Fix: daily health-check cron (Phase 28) + download-time 401 detection; disconnect modal shows document count before clearing tokens.
6. Vercel 4.5 MB request body limit — applies to any proxied upload through Next.js. Fix: provider-native chunked upload session APIs for large files (Phase 29).
7. Postmark webhook timeout on slow provider upload — inbound handler must return 200 within response window. Fix: async/background provider upload with idempotency guard on client_documents insert (Phase 29).

### Open Questions (to resolve during Phase 25 planning)

| Question | Resolve Before |
|----------|---------------|
| Google Drive download proxy approach: server-proxy (simplest, timeout risk for large PDFs) vs streaming ReadableStream vs short-lived sharing link — resolve exact approach before writing any Phase 25 download code | Phase 25 plan |
| OneDrive M365 admin consent UX: exact error display, partial consent states, real M365 tenant validation needed | Phase 26 plan |
| Postmark webhook timeout mitigation: async queue vs early-ack + background upload — decide before Phase 29 coding | Phase 29 plan |
| DSAR export scale threshold: at what document count does synchronous DSAR assembly risk Vercel timeout? Add document count guard above threshold | Phase 29 plan |
| Phase 24 P02 | 8 | 1 tasks | 2 files |
| Phase 25-google-drive-integration P01 | 9 | 3 tasks | 5 files |
| Phase 25-google-drive-integration P02 | 8 | 2 tasks | 2 files |
| Phase 25 P03 | 12 | 2 tasks | 2 files |
| Phase 25-google-drive-integration P05 | 8 | 2 tasks | 6 files |
| Phase 27-dropbox-integration P02 | 9 | 2 tasks | 4 files |
| Phase 27 P01 | 19 | 2 tasks | 6 files |
| Phase 26 P01 | 25 | 3 tasks | 3 files |
| Phase 26 P02 | 548 | 2 tasks | 6 files |
| Phase 26 P03 | 7 | 2 tasks | 6 files |
| Phase 28 P03 | 20 | 2 tasks | 3 files |
| Phase 28 P01 | 207 | 2 tasks | 6 files |
| Phase 28 P02 | 5 | 2 tasks | 4 files |
| Phase 29 P02 | 18 | 2 tasks | 2 files |
| Phase 29 P01 | 4 | 2 tasks | 3 files |
| Phase 30 P01 | 3 | 1 tasks | 3 files |
| Phase 30-per-document-type-upload-validation P02 | 4 | 2 tasks | 4 files |
| Phase 30 P03 | 7 | 2 tasks | 5 files |

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
- Inbound email intelligence — deferred indefinitely
- BILL-EXT-02: Annual billing option — defer to v3.x
- ADMN-EXT-01: Super-admin impersonation — defer to v3.x
- ADMN-EXT-02: Super-admin manual plan override — defer to v3.x
- MIGR-01: Migration helper to move existing Supabase documents to newly connected provider — deferred; split store is suboptimal but not broken
- GDRV-EXT-01: Google Shared Drive support — requires restricted drive scope and annual third-party security assessment
- TOKEN-EXT-01: Streaming DSAR export for large document sets (>50 files) — defer until needed at scale

## Session Continuity

Last session: 2026-03-03 UTC
Stopped at: Completed 30-03-PLAN.md — Accountant-facing validation UI: amber badge on document cards, Issues column in uploads table, UploadValidationModal, Needs Review filter chip
Resume file: none
Next step: Phase 30 complete — all 3 plans executed

---
*v5.0 roadmap created 2026-02-28 — Phases 24-29 (Storage Abstraction Layer through Hardening & Integration Testing); 36 requirements mapped with 100% coverage*
