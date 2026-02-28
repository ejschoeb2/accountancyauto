# Project Research Summary

**Project:** Prompt — v5.0 Third-Party Cloud Storage Integrations
**Domain:** B2B SaaS — configurable cloud storage backends (Google Drive, OneDrive, Dropbox) for UK accounting practice management
**Researched:** 2026-02-28
**Confidence:** HIGH

## Executive Summary

Prompt v5.0 adds Google Drive, Microsoft OneDrive, and Dropbox as selectable per-org storage backends. This is not a sync feature — the third-party provider becomes the single storage layer, replacing Supabase Storage for orgs that connect a provider. The existing `lib/documents/storage.ts` module must be refactored into a provider-agnostic interface first, before any provider-specific code is written. Every other deliverable in this milestone depends on that foundation. The most important architectural decision is also the simplest: add a `storage_backend` column to `client_documents` (not just `organisations`) so that DSAR exports and download handlers always know which API to call on a per-document basis, even when an org switches providers mid-lifecycle.

The recommended sequencing is Google Drive first (smallest bundle, `drive.file` scope avoids restricted-scope verification, clearest API), then OneDrive (more complex — MSAL token cache, M365 vs personal account split, admin consent requirement), then Dropbox (simple API, but lower UK market share than the first two). All three share the same token refresh pattern and must use the same `withTokenRefresh` utility built in the Google Drive phase. Token security is non-negotiable before any provider goes to production: refresh tokens must be AES-256-GCM encrypted at rest using an `ENCRYPTION_KEY` env var — plaintext refresh tokens in a Postgres column constitute a full cloud storage access exposure on any DB breach.

The highest-severity pitfalls are architectural rather than implementation-level: silent upload failures when access tokens expire without retry, per-document backend routing broken by relying on `org.storage_backend` instead of `doc.storage_backend`, and orphaned documents when an accountant revokes provider access externally. These three mistakes result in data loss or permanent document inaccessibility, which is unacceptable for an accounting compliance tool operating under HMRC retention requirements. All three are preventable by decisions made in the Storage Abstraction Layer phase — get the schema and token wrapper right first and the provider phases follow cleanly.

---

## Key Findings

### Recommended Stack

STACK.md documents only the net-new packages needed for this milestone — the existing Next.js + Supabase + Vercel stack is unchanged. Six new production dependencies across the three providers, each chosen for a specific reason.

**Core technologies (new):**
- `@googleapis/drive@^20.1.0` — Google Drive API v3; scoped package (2.3 MB) instead of `googleapis` (199 MB full package); avoids Vercel 250 MB function size limit
- `google-auth-library@^10.6.1` — OAuth2Client for Drive; required explicitly because `@googleapis/drive` does not re-export the token-event API needed for server-side token refresh persistence
- `@azure/msal-node@^5.0.5` — Microsoft identity OAuth2; the only library that correctly handles M365 confidential client, `/common` authority, and `ICachePlugin` for Postgres-persisted token cache
- `@microsoft/microsoft-graph-client@^3.0.7` — OneDrive file operations via Graph API; provides `OneDriveLargeFileUploadTask` for chunked uploads (required for files over 4 MB)
- `dropbox@^10.34.0` — official Dropbox SDK; provides `checkAndRefreshAccessToken()` and typed upload session methods; app folder scope boundary is the cleanest least-privilege option in the provider set

**Critical version and constraint notes:**
- Do NOT use `googleapis` (full package) — 199 MB unpacked, will likely exceed Vercel function limits combined with other deps
- Do NOT use `@azure/msal-browser` — browser-only package, crashes in Node.js server-side functions
- Do NOT use `@azure/identity` — designed for machine-to-machine Azure service auth, not user OAuth2 authorization code flow
- No shared OAuth helper (e.g. `simple-oauth2`) — each provider has idiosyncratic refresh behaviors that a shared abstraction handles incorrectly; provider-specific SDKs are the right layer
- Six new env vars required (two per provider: client ID + client secret); redirect URIs are per-provider
- All three provider SDKs are pure TypeScript/JavaScript — no native bindings, compatible with Vercel serverless

**Database additions (organisations table):**
- `storage_backend` enum: `supabase | google_drive | onedrive | dropbox` (default: `supabase`)
- `storage_backend_status`: `active | error | null`
- Per-provider encrypted token columns (`_enc` suffix convention signals encryption at all times)
- For MSAL/OneDrive: serialized cache blob column (`ms_token_cache`) rather than individual token columns

**Database additions (client_documents table — critical):**
- `storage_backend` column (same enum) — records the backend active at upload time; must not be derived from `org.storage_backend`

### Expected Features

FEATURES.md defines the feature boundary for this milestone precisely.

**Must have (table stakes for v5.0 launch — P1):**
- OAuth connect/disconnect flow from Settings UI — industry expectation for any SaaS integration
- Connected/disconnected status display with account email and storage root path
- Automatic silent token refresh before expiry — accountants will not tolerate hourly re-auth prompts
- Auto-created folder structure on first upload (no manual setup required by the accountant)
- All new uploads routed through connected provider — portal uploads and inbound email attachments both
- Provider-specific temporary download links replacing Supabase signed URLs
- Visible re-auth banner when token is revoked or refresh fails
- DSAR export updated to fetch bytes from provider API (GDPR legal requirement)
- Token encryption at rest (security requirement, not optional polish)

**Should have (competitive differentiators — P2, after Google Drive validated):**
- OneDrive integration (MSAL complexity warrants post-Google sequencing)
- Dropbox integration (lower UK market share than Google/Microsoft)
- Configurable root folder name (firm-specific folder naming conventions)
- Token health indicator in Settings (shows last refresh time, connection status)
- Per-document provider badge in document list UI

**Defer (v5.x / future):**
- Migration helper: move existing Supabase files to provider on connection — deferrable because newly uploaded files go to the provider immediately; existing Supabase files remain accessible; split store is suboptimal but not broken
- Google Shared Drive support — requires restricted `drive` scope and annual third-party security assessment; only worth pursuing once integration is proven at scale
- Streaming DSAR export — needed when document counts per client exceed ~50 files; Vercel serverless timeout risk at that scale
- Two-way sync / watching provider for changes — anti-feature; the provider is the storage layer, not the ingestion layer

**Confirmed anti-features (do not build):**
- `drive` (full) scope — triggers Google restricted-scope verification (weeks of delay); `drive.file` is functionally sufficient for all Prompt use cases
- Silent fallback to Supabase if provider upload fails — creates split-brain document store with inconsistent DSAR exports; fail explicitly instead
- Deleting files from provider when Prompt document record is deleted — conflicts with HMRC 6-year retention; keep bytes in provider even when metadata row is removed
- Two-way Drive sync — complete second system for marginal gain; Drive is the storage destination, not an ingestion source

### Architecture Approach

The v4.0 document collection layer (ARCHITECTURE.md) established the foundation that v5.0 extends. The existing `lib/documents/storage.ts` module wraps Supabase Storage; v5.0 refactors it into a provider-agnostic interface with four implementations: `SupabaseStorageProvider`, `GoogleDriveProvider`, `OneDriveProvider`, `DropboxProvider`. All upload paths (portal, inbound email) and all download paths (dashboard, DSAR export) route through this interface — no provider-specific code appears outside `lib/documents/storage/`.

**Major components and their responsibilities:**

1. **`lib/documents/storage.ts` (refactored to interface)** — provider-agnostic `upload()`, `getDownloadUrl()`, `delete()` methods; dispatches to the correct provider implementation based on `org.storage_backend`; this is the load-bearing component for the entire milestone
2. **`lib/storage/token-refresh.ts`** — `withTokenRefresh(orgId, call)` utility; proactively refreshes tokens 5 minutes before expiry; catches provider-specific fatal errors (`invalid_grant` for Google, `AADSTS53003` for OneDrive); sets `storage_token_status = 'reauth_required'` and never swallows failures silently
3. **`lib/crypto/tokens.ts`** — AES-256-GCM encrypt/decrypt utilities; `ENCRYPTION_KEY` from env var (never stored in Supabase); all `_enc` columns pass through this before DB write and after DB read; no plaintext tokens outside this module
4. **`/api/auth/[provider]/callback` route handlers** — OAuth2 authorization code exchange per provider; validates `state` parameter for CSRF protection; stores encrypted tokens; triggers root folder creation on first connect
5. **Settings UI — Storage tab** — connect/disconnect per provider; shows connected account info, root folder path, token health; re-auth banner propagated to main dashboard layout when status is error
6. **Daily health-check cron** — lightweight provider API call per org with active non-Supabase backend; sets re-auth status and emails org admin on failure

**Key architectural constraints identified in research:**
- Portal upload flow must change from signed-URL pattern (browser direct to Supabase) to server-proxied (browser to Next.js to provider API) — none of the three providers support the direct signed upload URL pattern Supabase uses
- Google Drive and OneDrive do not have native signed URL equivalents — downloads must be proxied through the Next.js server (fetch bytes server-side, stream to browser); Dropbox has `get_temporary_link` (4h TTL) which is closer to the existing pattern
- Vercel 4.5 MB request body limit applies to proxied uploads through Next.js — for large files, use provider-native direct upload or upload session APIs rather than routing all bytes through the server
- Token storage for all three providers must be Postgres-persisted with rehydration on each Vercel function invocation (no persistent in-memory state between invocations)

### Critical Pitfalls

PITFALLS.md documents 8 critical pitfalls and numerous moderate risks. Top 5 by data loss or security severity:

1. **Silent upload failures on token expiry** — access token expires mid-upload; 401 returned by provider but not retried; `client_documents` row written with `null` storage_path; document listed but permanently inaccessible. Prevention: `withTokenRefresh` wrapper with proactive refresh + one retry + explicit `reauth_required` status set on fatal failure. Must be built in Phase 25 before any provider upload reaches production.

2. **Unencrypted refresh tokens in Postgres** — plaintext token columns expose permanent cloud storage access on any DB breach; refresh tokens for Google and Dropbox do not expire by default. Prevention: AES-256-GCM encryption via `lib/crypto/tokens.ts`, `_enc` column suffix convention to signal encryption to all developers, `ENCRYPTION_KEY` env var never stored in Supabase. Must be built in Phase 24 before any token is ever written to the database.

3. **Per-org backend routing for downloads (wrong)** — using `org.storage_backend` instead of `doc.storage_backend` to determine download API; breaks for any org that has ever switched backends; DSAR exports silently fetch wrong bytes or fail. Prevention: `storage_backend` column on `client_documents` set at upload time; routing logic always reads the per-document column, never derives backend from the current org setting. Schema change in Phase 24 migration.

4. **Google `invalid_grant` with no re-auth signal** — Google silently invalidates refresh tokens on password change, user revocation, 50-token limit, or when app is in Testing status (7-day forced expiry). System continues attempting refresh with invalid token; all subsequent uploads fail silently. Prevention: explicitly catch `invalid_grant` HTTP 400 response, set re-auth status, null out stored refresh token, surface persistent banner. App must be in Production (not Testing) status before any real firm connects.

5. **Orphaned documents when accountant revokes provider access externally** — no webhook from any provider on revocation; documents remain listed in Prompt with inaccessible storage paths; accountant cannot download ahead of filing deadlines. Prevention: daily health-check cron per active org; download-time 401 detection sets re-auth status immediately; Settings UI shows document count before allowing disconnect with explicit confirmation required.

---

## Implications for Roadmap

Based on combined research, the milestone decomposes into 6 phases. Phase numbers 24–29 are suggested by PITFALLS.md as provisional — the roadmapper should verify against existing phase numbering in ROADMAP.md.

### Phase 24: Storage Abstraction Layer

**Rationale:** Every other phase depends on this foundation. The storage interface, schema migrations, and token encryption utility must exist before any provider-specific code is written. Building provider code against an incomplete abstraction causes architectural rewrites later. Token columns and the per-document `storage_backend` column are painful to add retroactively once documents are in the system.

**Delivers:**
- `lib/documents/storage.ts` refactored to provider-agnostic interface with Supabase implementation kept intact (no regression to existing functionality)
- `organisations` table migration: `storage_backend` enum, `storage_backend_status`, encrypted token columns per provider (`_enc` suffix)
- `client_documents` table migration: `storage_backend` column (critical — see Pitfall 7)
- `lib/crypto/tokens.ts`: AES-256-GCM encrypt/decrypt utility, `ENCRYPTION_KEY` env var documented in ENV_VARIABLES.md
- All existing Supabase functionality unchanged — Supabase provider passes through as before

**Avoids:** Pitfall 2 (unencrypted tokens), Pitfall 7 (storage path incompatibility on backend switch)

**Research flag:** Standard patterns — no phase research needed. Storage abstraction refactor and Postgres migration are established patterns in the existing codebase.

---

### Phase 25: Google Drive Integration

**Rationale:** Google Drive first because `@googleapis/drive` uses the non-restricted `drive.file` scope (no Google app verification process required), the bundle size is minimal (2.3 MB vs 199 MB for full googleapis), and the API is the best-documented of the three. Building the `withTokenRefresh` wrapper here establishes the pattern reused in all subsequent provider phases. This is the riskiest implementation phase — get the token refresh and `drive.file` folder ownership patterns right here and Phases 26–27 are mechanical extensions.

**Delivers:**
- `npm install @googleapis/drive@^20.1.0 google-auth-library@^10.6.1`
- OAuth2 connect flow: `/api/auth/google/callback` route handler with `state` CSRF validation
- `GoogleDriveProvider` implementation of the storage interface (`upload`, `getDownloadUrl`, `delete`)
- `withTokenRefresh` utility in `lib/storage/token-refresh.ts` — proactive refresh, retry, fatal error handling
- Root folder auto-creation at OAuth connect time with folder ID stored in `organisations.google_drive_folder_id`
- Human-readable folder structure: `{root}/{client_name}/{filing_type}/{tax_year}/filename`
- `invalid_grant` handling: set re-auth status, null refresh token column, never retry
- Portal upload and inbound email attachment routes updated for Google Drive backend
- DSAR export updated: fetch bytes from Drive API when `storage_backend = 'google_drive'`
- Settings UI: Google Drive connect/disconnect card with connected account display and health indicator
- Google OAuth app in Production status (not Testing) before any real firm connects

**Avoids:** Pitfall 1 (silent failures), Pitfall 3 (wrong routing), Pitfall 4 (`invalid_grant`), Pitfall 6 (`drive.file` ownership constraint)

**Research flag:** Needs `/gsd:research-phase` specifically for the download proxy pattern. Google Drive has no native signed URL equivalent for files stored under the `drive.file` scope. The server-proxy approach (fetch bytes server-side, stream to browser) introduces Vercel execution time risk for large accounting documents. Resolve the approach — proxy vs short-lived sharing link — before writing any upload or download code.

---

### Phase 26: Microsoft OneDrive Integration

**Rationale:** OneDrive second because it is the dominant platform for UK accounting practices (M365 is the standard). Higher implementation complexity than Google Drive due to MSAL token cache serialization, M365 vs personal account split, and admin consent requirement. Tackles these unknowns after the storage abstraction and token refresh patterns are validated in Phase 25.

**Delivers:**
- `npm install @azure/msal-node@^5.0.5 @microsoft/microsoft-graph-client@^3.0.7`
- OAuth2 connect flow targeting `login.microsoftonline.com/common` (M365 + personal Microsoft accounts)
- Admin consent URL surfaced in Settings — required for M365 tenants with Conditional Access policies
- `OneDriveProvider` implementation reusing `withTokenRefresh` wrapper
- MSAL `ICachePlugin` for Postgres-persisted token cache (`ms_token_cache` blob column)
- `AADSTS53003` Conditional Access error surfaced with specific actionable message in Settings UI
- Self-enforced app folder convention at `Apps/Prompt/` path (since `Files.ReadWrite.AppFolder` scope is personal-account-only and unavailable for M365 business accounts)
- All upload/download/DSAR paths updated for OneDrive backend
- Settings UI: OneDrive connect/disconnect card

**Avoids:** Pitfall 5 (personal vs M365 account split), Pitfall 1 (token expiry — MSAL silent refresh via ICachePlugin)

**Research flag:** Needs `/gsd:research-phase`. Test against an M365 developer tenant (not a personal Microsoft account) from day one. The `Files.ReadWrite.AppFolder` personal-only limitation and Conditional Access failure modes (`AADSTS53003`) are high enough risk to validate empirically before implementation begins. The admin consent flow UX also needs design decisions that depend on real M365 tenant behavior.

---

### Phase 27: Dropbox Integration

**Rationale:** Dropbox third because UK accounting market penetration is lower than Google Workspace and M365. The Dropbox API is the simplest of the three. The `token_access_type=offline` gotcha must be validated in the OAuth callback before storing any token — this is a silent configuration mistake that causes 4-hour upload failures with no error visible until access token expiry.

**Delivers:**
- `npm install dropbox@^10.34.0`
- OAuth2 connect flow with explicit `token_access_type=offline` in authorization URL
- OAuth callback rejects and shows error if no `refresh_token` is present in the token exchange response
- `DropboxProvider` implementation reusing `withTokenRefresh` wrapper
- App folder scope (`/Apps/Prompt/`) — provider-enforced boundary (cleaner than OneDrive's self-enforcement)
- `checkAndRefreshAccessToken()` integration for Postgres-rehydrated `DropboxAuth` instance
- `get_temporary_link` for downloads (4-hour TTL — closer to the existing signed URL UX than proxy approach)
- All upload/download/DSAR paths updated for Dropbox backend
- Settings UI: Dropbox connect/disconnect card

**Avoids:** Pitfall 4 (Dropbox missing offline token type), Pitfall 1 (silent token expiry)

**Research flag:** Standard patterns — Dropbox SDK is well-documented with good TypeScript types and a clean app folder model. No phase research needed.

---

### Phase 28: Settings UI and Token Lifecycle Management

**Rationale:** Consolidates all Settings UI work and adds proactive token lifecycle management. The daily health-check cron and re-auth banner belong in a dedicated phase rather than being scattered across provider phases. Privacy policy update is a compliance checkpoint that must ship with or before this phase — adding three new sub-processors requires explicit policy disclosure under UK GDPR.

**Delivers:**
- Settings > Storage tab: unified provider status cards (connect/disconnect/re-auth per provider with account details)
- Persistent re-auth banner in main dashboard layout when `storage_token_status = 'reauth_required'` — same pattern as the existing Postmark failed-email banner
- Disconnect modal showing document count stored in provider; requires explicit typed confirmation before allowing disconnect
- Daily health-check cron: lightweight API call per org with active non-Supabase backend; emails org admin on failure; sets re-auth status
- Token health indicator: shows last successful upload time and token expiry status (green/amber/red)
- Privacy policy update: add Google LLC, Microsoft Corporation, Dropbox Inc. to sub-processor list with registered countries
- Per-document provider badge in document list UI (shows which backend each file is stored on — important for orgs that have switched backends)

**Avoids:** Pitfall 8 (orphaned documents on revocation — health cron + disconnect warning), UX pitfall (ambiguous disconnect), security mistake (missing GDPR sub-processor disclosure)

**Research flag:** Standard patterns — UI and cron patterns are established in the existing codebase. No phase research needed.

---

### Phase 29: Portal, Inbound Email, and DSAR Hardening

**Rationale:** Phases 25–27 update upload and download paths per provider, but cross-cutting edge cases require a dedicated hardening pass: large file uploads via portal that exceed the Vercel 4.5 MB body limit, Postmark webhook timeout risk if provider upload is slow, and DSAR export timeout risk for large document sets. This phase also serves as the integration testing gate before the feature is considered production-ready.

**Delivers:**
- Portal upload refactored from server-proxied to provider-native direct upload or chunked upload session for files that would exceed the Vercel body limit
- Postmark inbound handler: provider upload either made async (queue bytes, upload in background) or size-guarded to prevent webhook timeout; always returns 200 to Postmark
- DSAR export: streaming or background processing for document sets above ~50 files (exact threshold TBD in phase research)
- End-to-end integration testing: upload via portal with each provider configured; inbound email attachment with each provider; DSAR with mixed-backend document sets (same client has docs in both Supabase and a provider after a backend switch)
- Verification against the "Looks Done But Isn't" checklist from PITFALLS.md

**Avoids:** Performance trap (file bytes through Next.js server for large files), Postmark webhook timeout, DSAR Vercel timeout at scale

**Research flag:** Consider `/gsd:research-phase` if streaming DSAR or background job processing is chosen — Vercel `after()` API and streaming response patterns have specific constraints worth verifying before implementation.

---

### Phase Ordering Rationale

- Phase 24 before all others: schema changes and the crypto utility must land before any provider token is ever stored; retrofitting these after documents exist is painful
- Phase 25 before 26 and 27: establishes `withTokenRefresh` pattern and validates the storage abstraction under a real provider; Google Drive is the lowest-complexity first integration
- Phases 26 and 27 are theoretically parallelizable but sequential is safer — OneDrive first (higher UK market priority), Dropbox second
- Phase 28 after all providers are wired: consolidates Settings UI changes rather than iterating the tab three times across provider phases
- Phase 29 last: cross-cutting concerns that are fully visible only once all providers are wired and integration tested together

### Research Flags

**Needs `/gsd:research-phase` before planning:**
- **Phase 25:** Download proxy pattern for Google Drive — no native signed URL; server-proxy for large files has Vercel execution time implications to resolve before coding begins
- **Phase 26:** M365 admin consent flow and real-tenant testing; `AADSTS53003` handling; `Files.ReadWrite.AppFolder` personal-only limitation workaround in M365 context

**Standard patterns (skip research-phase):**
- **Phase 24:** Storage abstraction refactor and Postgres migration — established codebase patterns
- **Phase 27:** Dropbox SDK — well-documented, typed, app folder pattern is clean
- **Phase 28:** Settings UI and cron — existing patterns from Postmark failed-email banner and existing cron infrastructure
- **Phase 29:** Consider research only if streaming DSAR or Vercel `after()` background processing is the chosen approach

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All package versions verified against npm registry; bundle sizes verified via npm show; Vercel serverless constraints confirmed against official Vercel KB; all provider SDK alternatives evaluated and rejected with documented rationale |
| Features | HIGH (OAuth/token lifecycle) / MEDIUM (folder conventions, download proxy UX) / LOW (UK accounting storage preferences) | OAuth scope requirements and token lifetimes verified from official provider docs; folder naming conventions from B2B SaaS patterns (multiple sources); UK market storage preferences inferred from general market data, no primary research |
| Architecture | HIGH (Supabase/existing layer) / MEDIUM-HIGH (provider-specific API patterns) | Supabase foundation is established and production-proven; Google Drive v3 and Dropbox SDK are well-documented; OneDrive MSAL complexity and M365 vs personal account split are the main implementation uncertainty areas |
| Pitfalls | HIGH | All critical pitfalls sourced from official provider documentation, confirmed ICO guidance, and validated against existing codebase context |

**Overall confidence:** HIGH for foundational decisions (schema, token encryption, `withTokenRefresh` pattern, phase sequencing). MEDIUM for provider-specific implementation details that will surface during Phase 25–26 execution.

### Gaps to Address

- **Google Drive download proxy**: The server-proxy approach for Drive downloads (no native signed URL under `drive.file` scope) introduces Vercel execution time risk for large accounting documents (large PDFs, zip archives). Resolve during Phase 25 planning — options are: server-proxy (simplest, timeout risk), short-lived sharing link via Drive sharing API (requires additional permission changes), or streaming response with `ReadableStream`. Verify the approach and its size limits before writing any Phase 25 download code.

- **OneDrive M365 admin consent UX**: The admin consent flow is documented in Microsoft Learn but the exact UX — where to surface the admin consent URL, how to detect partial consent states, what error message to show when an individual user tries to connect without admin approval — needs a real M365 developer tenant to validate. Flag for Phase 26 research.

- **Postmark webhook timeout on provider upload**: The inbound email attachment handler must return 200 to Postmark within its response window. If the provider upload is slow (large file, provider API latency), the handler may time out and Postmark retries, causing duplicate `client_documents` inserts. Resolve in Phase 29 — async queue or early-ack with background upload is the likely answer; requires idempotency guard on `client_documents` insert.

- **DSAR export scale threshold**: At what document count does synchronous DSAR assembly cause a Vercel function timeout? Not quantified in research. Flag for Phase 29 — add a document count guard and plan streaming or background job approach above the threshold before coding the DSAR update.

---

## Sources

### Primary (HIGH confidence)

- [npm registry — @googleapis/drive, google-auth-library, @azure/msal-node, @microsoft/microsoft-graph-client, dropbox] — package versions and bundle sizes verified
- [Google Drive API Scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth) — `drive.file` scope is non-restricted; full `drive` scope requires annual third-party security assessment
- [OneDrive API Authorization via Microsoft Graph — Microsoft Learn](https://learn.microsoft.com/en-us/onedrive/developer/rest-api/getting-started/graph-oauth) — `/common` authority, `offline_access` for refresh tokens
- [Files.ReadWrite.AppFolder personal-only — Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/1418013) — confirmed AppFolder scope is not available for M365 business accounts
- [Dropbox OAuth Guide](https://developers.dropbox.com/oauth-guide) — `token_access_type=offline` required for refresh tokens
- [MSAL Node token caching — Microsoft Learn](https://learn.microsoft.com/en-us/entra/msal/javascript/node/caching) — ICachePlugin pattern for Postgres-persisted token cache
- [Upload large files — Microsoft Graph SDKs](https://learn.microsoft.com/en-us/graph/sdks/large-file-upload) — OneDriveLargeFileUploadTask for files over 4 MB
- [Vercel function size limit — Vercel KB](https://vercel.com/kb/guide/troubleshooting-function-250mb-limit) — 250 MB uncompressed limit confirmed; not configurable
- [ICO Security Outcomes Guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/security/a-guide-to-data-security/security-outcomes/) — encryption requirements for personal data at rest
- [OneDrive API Permissions Reference — Microsoft Learn](https://learn.microsoft.com/en-us/onedrive/developer/rest-api/concepts/permissions_reference) — scope differences between personal and M365 accounts
- [Google Drive API Usage Limits](https://developers.google.com/workspace/drive/api/guides/limits) — 12,000 requests per 60-second project-wide quota

### Secondary (MEDIUM confidence)

- [MSAL Node best practices for serverless — Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/780890) — external storage recommendation; consistent with official caching guide
- [Nango: Google OAuth invalid_grant](https://nango.dev/blog/google-oauth-invalid-grant-token-has-been-expired-or-revoked) — explains common refresh token revocation causes
- [Dropbox: Using OAuth 2.0 with offline access](https://dropbox.tech/developers/using-oauth-2-0-with-offline-access) — official Dropbox blog; offline access pattern and refresh token lifecycle
- [Microsoft: Resolve Microsoft Graph authorization errors](https://learn.microsoft.com/en-us/graph/resolve-auth-errors) — AADSTS53003 Conditional Access handling
- [Top 5 file storage APIs — Apideck](https://www.apideck.com/blog/top-5-file-storage-apis-to-integrate-with) — B2B SaaS integration patterns; folder structure conventions

### Tertiary (LOW confidence)

- [Enterprise Cloud Storage comparison — Sesame Disk Group](https://sesamedisk.com/enterprise-cloud-storage-google-drive-vs-onedrive-vs-dropbox/) — used only for UK market share inference; not treated as authoritative for any implementation decision

---

*Research completed: 2026-02-28*
*Ready for roadmap: yes*
