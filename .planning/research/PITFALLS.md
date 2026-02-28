# Pitfalls Research

**Domain:** Adding Google Drive, Microsoft OneDrive, and Dropbox as configurable per-org storage backends to an existing Next.js + Supabase SaaS for UK accounting practices (v5.0 — Third-Party Storage Integrations)
**Researched:** 2026-02-28
**Confidence:** HIGH (Google, Microsoft, Dropbox official docs; ICO guidance; verified against existing codebase)

---

## Scope Note

This file supersedes the v4.0 PITFALLS.md (which covered Supabase Storage, Postmark attachment extraction, and UK GDPR compliance for document collection). These pitfalls are specific to the v5.0 milestone — adding Google Drive, Microsoft OneDrive, and Dropbox as selectable per-org storage backends to a system that already stores documents in Supabase Storage.

**Phase references used throughout:**
- Phase 24 = Storage Abstraction Layer (provider-agnostic interface, organisations table schema, token columns)
- Phase 25 = Google Drive Integration (OAuth2, Drive API v3, folder structure, token refresh)
- Phase 26 = Microsoft OneDrive Integration (Microsoft Graph API, MSAL OAuth2, personal vs M365 complexity)
- Phase 27 = Dropbox Integration (Dropbox API v2, OAuth2 offline tokens)
- Phase 28 = Settings UI + Token Lifecycle Management (connect/disconnect UI, refresh token cron, re-auth prompts)
- Phase 29 = Portal, Inbound Email, and DSAR Integration (route file bytes through provider APIs)

Note: Phase numbers are provisional. The roadmap will assign final numbers after this research is complete.

---

## Critical Pitfalls

Mistakes that cause data loss, silent upload failures, security breaches, or architectural rewrites.

---

### Pitfall 1: Silent Upload Failures When Access Tokens Expire Mid-Cron

**What goes wrong:**
The portal upload route and the Postmark inbound attachment handler both call the storage abstraction layer. If the access token for the configured provider expires between a cron run starting and the upload call executing, the provider API returns a 401. Without explicit token refresh logic wrapping every upload call, the error is swallowed and `client_documents` never gets a `storage_path` — the metadata row is written but the file is gone. The accountant sees a document listed in the system but cannot download it.

**Why it happens:**
Google, OneDrive, and Dropbox access tokens are short-lived (Google: 1 hour; OneDrive/MSAL: 1 hour; Dropbox: 4 hours). Developers often refresh tokens reactively — only when a 401 is received — but do not implement the retry that re-attempts the upload after the refresh. The result: the 401 is logged but no file is stored.

**How to avoid:**
Wrap every provider API call in a `withTokenRefresh(orgId, call)` utility that:
1. Reads the stored access token and its `token_expires_at` timestamp.
2. If `expires_at < now + 5 minutes` (proactive buffer), refreshes before the call.
3. Executes the call with the fresh token.
4. If the provider still returns 401 (rare race condition), retries once after another refresh.
5. If still failing, marks the org's `storage_token_status = 'reauth_required'` and throws — never silently swallows.

This wrapper lives at `lib/storage/token-refresh.ts` and is the only place any provider API credential is used.

**Warning signs:**
- `client_documents` rows with a `null` `storage_path` column after creation.
- Provider error logs showing 401 responses near cron execution windows.
- Accountants reporting "document listed but download fails."

**Phase to address:** Phase 25 (Google Drive) — implement the `withTokenRefresh` pattern there; Phase 26 and 27 reuse the same wrapper with provider-specific refresh calls.

---

### Pitfall 2: Unencrypted Refresh Tokens Stored in the Organisations Table

**What goes wrong:**
The `organisations` table gains columns such as `google_refresh_token`, `onedrive_refresh_token`, and `dropbox_refresh_token`. If these are stored as plaintext `text` columns, a Supabase data breach, a misconfigured RLS policy, or a SQL injection exposes every accounting firm's cloud storage credentials simultaneously. A refresh token grants permanent access to a firm's Google Drive or OneDrive — including all their client financial documents.

**Why it happens:**
Storing OAuth tokens in a relational database column is the simplest implementation. Developers assume Supabase's RLS policies are sufficient protection, which they are not — RLS protects row-level access within the application but does not protect against database-level breaches, service role leaks, or debug log exposure.

**How to avoid:**
Encrypt refresh tokens before writing to the database using AES-256-GCM with a server-side key that is NOT stored in Supabase. Use an `ENCRYPTION_KEY` environment variable (32-byte hex) held only in Vercel environment variables. Implement `encryptToken(plaintext): string` and `decryptToken(ciphertext): string` utilities in `lib/crypto/tokens.ts`. The IV is stored alongside the ciphertext (standard GCM practice). Never log decrypted tokens. Use Node.js `crypto.createCipheriv` — no external dependencies needed.

Schema pattern: `google_refresh_token_enc TEXT` (not `google_refresh_token`) signals to all developers that the value is always encrypted.

**Warning signs:**
- Token columns named without `_enc` suffix — no encryption signal.
- Any server action or API route that `console.log`s request bodies containing token fields.
- Supabase Dashboard showing readable token strings in the table editor.

**Phase to address:** Phase 24 (Storage Abstraction Layer) — add encrypted token columns in the schema migration and the crypto utility before any provider-specific token is ever written.

---

### Pitfall 3: Google Refresh Token Silently Invalidated — No Re-Auth Signal to Accountant

**What goes wrong:**
Google silently invalidates a refresh token without notifying the application when:
- The user changes their Google account password.
- The user manually revokes access via myaccount.google.com.
- The application has fewer than 100 users and the OAuth app status is "Testing" — Google revokes tokens after 7 days in Testing status.
- The user has accumulated 50+ refresh tokens for the same Google OAuth client (Google enforces a per-user limit and silently revokes the oldest).

When the next upload attempt runs, `invalid_grant` is returned from `https://oauth2.googleapis.com/token`. If the system does not catch this specific error code and translate it to a re-auth required state, all subsequent uploads for that org silently fail.

**Why it happens:**
`invalid_grant` looks like a transient network error to developers unfamiliar with Google's OAuth behaviour. It is treated as a generic failure rather than a terminal credential state requiring user action.

**How to avoid:**
In the `withTokenRefresh` wrapper, specifically catch `invalid_grant` from Google's token endpoint (HTTP 400, `error: "invalid_grant"`). On receiving this:
1. Set `organisations.google_token_status = 'reauth_required'` and `google_refresh_token_enc = NULL`.
2. Do not retry.
3. Log the event to an audit table.
4. Surface a persistent warning banner in the dashboard Settings > Storage tab.

Before going to production, publish the Google OAuth app — move it out of "Testing" status. Testing apps have a 7-day token expiry that breaks any firm that does not re-authenticate weekly.

**Warning signs:**
- `invalid_grant` errors appearing in server logs.
- Org's `google_token_status` cycling rapidly between `active` and `reauth_required`.
- Any Google OAuth app remaining in "Testing" status after initial development.

**Phase to address:** Phase 25 (Google Drive Integration) — `invalid_grant` handling must be implemented before Phase 25 is considered complete. Phase 28 adds the Settings UI that surfaces the re-auth banner.

---

### Pitfall 4: Dropbox OAuth Without `token_access_type=offline` — No Refresh Token Issued

**What goes wrong:**
Dropbox's OAuth2 flow defaults to `token_access_type=online` if the parameter is omitted. In online mode, Dropbox issues only a short-lived access token (4-hour expiry) with no refresh token. The first upload after 4 hours fails. There is no refresh token to use, meaning the firm must re-authenticate every 4 hours to continue storing documents.

This is a silent configuration mistake — the OAuth flow completes successfully, the user is redirected back, but no refresh token appears in the response payload.

**Why it happens:**
The Dropbox documentation does not make `token_access_type=offline` the default or the obvious choice. It requires explicitly reading the offline access guide. Dropbox deprecated long-lived access tokens in September 2021, so most tutorial content pre-dating that change shows patterns that no longer work.

**How to avoid:**
The Dropbox authorization URL must include `token_access_type=offline`:
```
https://www.dropbox.com/oauth2/authorize?client_id=APP_KEY&response_type=code&token_access_type=offline&redirect_uri=...
```

Write a test immediately after the OAuth callback: verify the token exchange response contains a `refresh_token` field. If it does not, reject the connection and show an error — do not store the access token alone.

**Warning signs:**
- No `refresh_token` field in Dropbox OAuth token response.
- Uploads succeeding for 4 hours then failing universally for an org.
- Dropbox access token expiry timestamps all clustered exactly 4 hours after OAuth connection time.

**Phase to address:** Phase 27 (Dropbox Integration) — add this check as a success criterion for the OAuth callback handler.

---

### Pitfall 5: Microsoft OneDrive Personal vs Business Account OAuth Complexity

**What goes wrong:**
OneDrive for personal Microsoft accounts (MSA) uses a completely different authentication endpoint (`login.live.com`) versus OneDrive for Business / Microsoft 365 accounts which use Azure Active Directory (`login.microsoftonline.com/common` or a tenant-specific URL). A single OAuth flow cannot transparently handle both. Accounting firms running Microsoft 365 (the majority of UK accountants) encounter errors when the app is configured for personal accounts only, or vice versa.

Additionally, Microsoft 365 tenants may have Conditional Access policies that block third-party OAuth apps from receiving tokens — the token request returns `AADSTS53003` with no user-facing explanation, leaving the firm unable to connect their OneDrive at all.

**Why it happens:**
The Microsoft Graph documentation presents the `/common` endpoint as universal, but it only works for Entra ID (work/school) accounts. Personal Microsoft account OneDrive uses a separate Live SDK OAuth path. Developers test with personal accounts during development and the integration fails for the M365 business accounts that are the target audience.

Conditional Access failures are invisible during development because personal developer tenants do not have CA policies. They appear only when real firm admins attempt to connect.

**How to avoid:**
Target Microsoft 365 / Entra ID accounts only (use `login.microsoftonline.com/common`, `signInAudience: AzureADandPersonalMicrosoftAccount`). Do not attempt to support personal MSA OneDrive — UK accounting practices use M365.

For Conditional Access: document the requirement that the firm's M365 admin must grant the app consent via an admin consent URL (not just individual user consent). Provide a pre-flight check in the Settings UI that explains this requirement. If a `AADSTS53003` is received during OAuth callback, display a specific, actionable error: "Your Microsoft 365 administrator has restricted third-party app access. Ask your M365 admin to grant admin consent for Prompt."

Register the app in Azure portal with `Files.ReadWrite.AppFolder` permission (for M365 delegated access to OneDrive) to stay within least-privilege scope.

**Warning signs:**
- `AADSTS53003` error codes in the OAuth callback handler.
- OAuth callback receiving an authorization code but token exchange failing for work accounts.
- Firms with M365 unable to complete OAuth flow while personal account testing succeeds.

**Phase to address:** Phase 26 (Microsoft OneDrive Integration) — test against an M365 developer tenant (not a personal account) from day one. Document the admin consent requirement in the Settings UI.

---

### Pitfall 6: `drive.file` Scope Loses Access to Files Uploaded by Server-Side Code

**What goes wrong:**
Google's `drive.file` scope grants access only to files the app created using that specific user's OAuth token. Files uploaded by the server using a service account or a different user's token are not visible under `drive.file`. In this application, the portal upload, Postmark inbound handler, and cron-triggered operations all run server-side — they upload files on behalf of the org, not in response to a user-initiated action.

If `drive.file` is used and the server-side upload uses the org's stored refresh token, Google Drive will store the file successfully but subsequent calls to list or retrieve that file using a different access token (even from the same org) may return 404 depending on how the folder permissions are set.

**Why it happens:**
`drive.file` sounds like the correct minimal-privilege choice and Google explicitly recommends it over the full `drive` scope. But `drive.file` was designed for user-initiated file picking flows (Google Picker API), not for server-side document management.

**How to avoid:**
Use `https://www.googleapis.com/auth/drive.file` but ensure that:
1. All uploads use the same org's refresh token (the token obtained during the OAuth connection flow).
2. Create a dedicated app folder in Drive at OAuth connection time using `spaces=appDataFolder` or create an explicitly named `Prompt Documents` folder and store its folder ID in the organisations table.
3. All subsequent operations (upload, download metadata retrieval, delete) use the same org's stored token.
4. Never use a service account for Drive access — this breaks `drive.file` ownership.

Alternatively, if this proves too complex during implementation, use `https://www.googleapis.com/auth/drive` (full scope) — but this requires Google's restricted scope verification process (which takes 2-4 weeks and requires a security assessment for apps storing user data on servers). Plan for this verification timeline if the full Drive scope is needed.

**Warning signs:**
- Files successfully uploaded but returning 404 on subsequent GET requests.
- Drive API returning `insufficientPermissions` on file download even though the upload succeeded.
- `drive.file` scope returning empty file lists when listing files created by the server.

**Phase to address:** Phase 25 (Google Drive Integration) — resolve the folder strategy and scope choice before writing any upload code.

---

### Pitfall 7: Storage Path Incompatibility When Orgs Switch Backends (Supabase to Provider)

**What goes wrong:**
Existing documents stored in Supabase Storage have `storage_path` values like `orgs/{orgId}/clients/{clientId}/corp-tax/2025/{uuid}.pdf`. When an org connects Google Drive and switches their `storage_backend` to `google_drive`, the new uploads get Drive file IDs like `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms` as their `storage_path`. The DSAR export ZIP builder and the download handler must now handle two completely different `storage_path` formats within the same org's document set. The format leaks the backend type into application code everywhere `storage_path` is used.

This is not a theoretical edge case — any org that connects a new backend mid-lifecycle will have a mixed document set.

**Why it happens:**
The `storage_path` column stores a path string that made perfect sense for Supabase Storage (filesystem-style path) but is semantically different for Google Drive (opaque file ID) and OneDrive (item ID or drive path). Treating `storage_path` as a universal file reference without encoding which backend to use means every piece of code reading `storage_path` must infer the backend from the org's current `storage_backend` setting — which may have changed since the document was stored.

**How to avoid:**
Add a `storage_backend` column to `client_documents` — not just on `organisations`. Every document row records the backend it was stored on at upload time. The download handler uses `doc.storage_backend`, not `org.storage_backend`. The DSAR export reads the per-document backend to determine how to fetch the file.

Schema addition in Phase 24:
```sql
ALTER TABLE client_documents
  ADD COLUMN storage_backend text NOT NULL DEFAULT 'supabase'
    CHECK (storage_backend IN ('supabase', 'google_drive', 'onedrive', 'dropbox'));
```

Backfill: `UPDATE client_documents SET storage_backend = 'supabase' WHERE storage_backend IS NULL`.

**Warning signs:**
- Download handler routing logic based on `org.storage_backend` rather than `doc.storage_backend`.
- DSAR export failing for orgs that switched backends mid-usage.
- `storage_path` values that look like Drive file IDs being passed to the Supabase Storage download function.

**Phase to address:** Phase 24 (Storage Abstraction Layer) — this schema change must be done in Phase 24's migration before any provider-specific code is written.

---

### Pitfall 8: User Revokes Provider Access in Provider Settings — Orphaned Documents With No Recovery Path

**What goes wrong:**
An accountant connects their Google Drive, uploads 200 client documents, then manually revokes Prompt's access in Google Account settings (myaccount.google.com). The `client_documents` rows still exist in Postgres with `storage_backend = 'google_drive'` and `storage_path` = file IDs, but every download attempt returns 401. The accountant sees 200 documents listed in Prompt with no way to download any of them. This is the worst-case data availability failure for a practice — client records are inaccessible ahead of filing deadlines.

**Why it happens:**
Cloud storage integrations assume the connection persists. There is no webhook from Google, OneDrive, or Dropbox notifying the application when access is revoked externally. The failure is discovered only when the next download attempt fails.

**How to avoid:**
Three mitigations:

1. **Health check cron**: A daily lightweight API call (e.g., list the app folder) per org that has an active third-party backend. If the call fails with 401/invalid_grant, set `storage_token_status = 'reauth_required'` and send an email to the org admin: "Your Google Drive connection has been disconnected. Documents stored in Drive are inaccessible until you reconnect."

2. **Download-time detection**: The download handler catches 401/403 from the provider and immediately sets `storage_token_status = 'reauth_required'`, returns an error to the UI with a specific message, and does not attempt retries.

3. **Settings UI warning**: The Settings > Storage tab prominently shows "X documents stored in this provider. Disconnecting will make them inaccessible." This is shown as a persistent reminder, not only at disconnect time.

There is no automatic recovery path once documents are deleted from the provider — this is by design (the provider is the source of truth for bytes). The only recovery is the user reconnecting their account.

**Warning signs:**
- `storage_token_status` not being updated on provider 401 responses.
- No daily health check cron for provider connectivity.
- Settings UI allowing disconnect without warning about stored document count.

**Phase to address:** Phase 28 (Settings UI + Token Lifecycle Management) — health check cron and disconnect warning. Phase 25-27 — download-time 401 detection.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store access token only (no refresh token) | Simpler OAuth flow, no token rotation needed | Every upload fails after 1-4 hours; firm must re-authenticate constantly | Never — always request offline access |
| Use `org.storage_backend` to route downloads | One column to maintain | DSAR and downloads break for orgs that switched backends | Never — add `storage_backend` to `client_documents` |
| Plaintext refresh tokens in `organisations` | Simpler read/write code | Full cloud access exposure on any DB breach | Never for production |
| Single OAuth app registration for all envs | No credential juggling | Test tokens pollute production token limits; Google dev app tokens expire in 7 days | Never — separate app registrations per environment |
| Skip token expiry proactive check, rely on 401 retry | Less code | Mid-upload 401 failures on large files; Postmark webhook times out waiting for retry | Never for server-side upload flows |
| Reuse Supabase Storage `storage_path` format for provider paths | Familiar column semantics | Provider file IDs look nothing like file paths; routing logic becomes ambiguous | Never — `storage_path` stores whatever the provider returns as its identifier |
| Route file bytes through Next.js server for all providers | Consistent upload code | Portal uploads will hit Vercel's 4.5MB request body limit for large accounting documents | Acceptable only for small file inbound email; portal uploads must use provider direct upload |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Google Drive | Requesting `drive` (full) scope instead of `drive.file` | Use `drive.file` — avoid Google's restricted scope verification process (weeks of delay) |
| Google Drive | Not storing the root folder ID returned after creating the org's Drive folder | Store Drive folder ID in `organisations.google_drive_folder_id` at connection time; do not recreate the folder on every upload |
| Google Drive | Not handling token rotation — Google sometimes rotates refresh tokens | Always check if the token response contains a new `refresh_token`; if so, update the stored value |
| OneDrive | Using personal MSA OAuth endpoint for business M365 accounts | Use `login.microsoftonline.com/common` for M365 delegated auth; do not target `login.live.com` |
| OneDrive | Not requesting admin consent — individual user consent insufficient for M365 tenants with CA policies | Provide an admin consent URL in Settings UI; document this as a prerequisite for M365 firms |
| OneDrive | Using the OneDrive `path`-based API instead of item IDs | Always store and use item IDs (`items/{id}`) — paths break when users rename or move folders |
| Dropbox | Omitting `token_access_type=offline` from authorization URL | Explicitly set `token_access_type=offline`; verify response contains `refresh_token` |
| Dropbox | Using `/files/upload` for files over 150MB | Use upload session API (`upload_session/start`, `append_v2`, `finish`) for accounting documents that may be large PDFs |
| All providers | Making upload calls directly from the Postmark inbound webhook handler | The Postmark webhook has a short response window; upload to the provider asynchronously (queue the bytes, upload in background) or risk timeout |
| All providers | Assuming `storage_path` is always a filesystem-style path | `storage_path` stores whatever the provider returns: Drive file ID, OneDrive item ID, or Dropbox path string |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Refreshing tokens on-demand inside API route handlers | Occasional slow page loads; timeouts on Vercel Pro (default 30s) | Pre-emptively refresh tokens in background cron before they expire | At high traffic when multiple simultaneous requests all trigger token refresh |
| Sequential uploads for DSAR export across provider API | DSAR export takes minutes for firms with hundreds of documents; Vercel function timeout | Stream files from provider and add to ZIP incrementally; use `after()` for background processing | At 50+ documents in a DSAR export |
| Listing provider folders to find files by name | Works for < 10 files; breaks at hundreds | Always store and use provider-specific file IDs/item IDs; never find-by-name | At any scale above a handful of documents |
| Google Drive API: 12,000 requests per 60-second project-wide | Batch imports of documents hitting quota | Implement exponential backoff with jitter; batch Drive API calls; monitor quota dashboard | Any org migrating or bulk-importing >100 files |
| Dropbox API rate limit: 25,000 calls/hour for Business | Silent throttling with HTTP 429 | Implement retry with `Retry-After` header respect; do not ignore 429 responses | At scale with multiple orgs simultaneously uploading |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Logging decrypted refresh tokens in server error handlers | Full cloud storage access exposure in log aggregation tools (Vercel logs, Sentry) | Strip all `*_token*` and `*_refresh*` fields from error contexts before logging; never `console.log(org)` in code that handles tokens |
| Storing Drive folder ID or OneDrive item ID in a public-facing API response | Attacker enumerates provider file paths without auth | Provider IDs are not secrets but should not be exposed; always proxy downloads through the application — never pass provider IDs to the client |
| Not validating the OAuth `state` parameter on callback | CSRF attack on OAuth flow; attacker connects their cloud account to a victim org | Generate a cryptographically random `state` for each OAuth initiation; store it in an httpOnly session cookie; verify on callback |
| Using the service role client to call provider APIs | Service role token stored in provider OAuth flow; accidental provider API key/org confusion | Provider OAuth tokens are per-org user credentials; use a dedicated non-service-role lookup to retrieve and decrypt them |
| Allowing org members to connect/disconnect storage backends | A rogue member disconnects the backend, making 200 documents inaccessible | Restrict storage backend connection and disconnection to org admins only; enforce in the Settings UI and the API route |
| GDPR: not updating the privacy policy to list each provider as a sub-processor | ICO regulatory violation if an audit finds providers processing personal data without disclosure | When Phase 28 ships, add Google LLC (Google Drive), Microsoft Corporation (OneDrive), and Dropbox Inc. to the sub-processor list in `/privacy` |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing "Connect Google Drive" with no explanation of what access is granted | Accountants refuse to connect due to vague permissions scope | Show the exact scope requested ("Prompt will create and manage files in a dedicated Prompt folder in your Drive") before initiating OAuth |
| No feedback after OAuth callback completes | Accountant lands back on Settings page with no confirmation | Show a success state ("Google Drive connected — documents will now be stored in your Drive") with the folder name visible |
| Allowing disconnect with no warning about inaccessible documents | Accountant disconnects, panics when downloads fail | Show a modal: "X documents are stored in Google Drive. Disconnecting will make them inaccessible until you reconnect." Require explicit confirmation. |
| Not showing which backend each document was stored on | Accountant cannot tell why some downloads work and others fail after a backend switch | Show a small provider badge (Supabase, Drive, OneDrive, Dropbox) on each document row in the document list |
| Re-auth required state only visible in Settings | Accountant misses the notification; uploads silently fail for days | Show a persistent warning banner in the main dashboard layout when `storage_token_status = 'reauth_required'` — same pattern as the Postmark failed-email banner |
| OAuth window opening in the same tab | Navigating back loses form state; confusing redirect chain | Always open provider OAuth in a popup window; use `window.postMessage` to signal completion to the parent; close popup on success |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Google Drive OAuth connected:** Verify `refresh_token` is present in the token response — not just `access_token`. Check that the app is in Production status (not Testing) to avoid 7-day expiry.
- [ ] **OneDrive OAuth connected:** Verify the token was obtained via M365/Entra ID (`login.microsoftonline.com`) not Live (`login.live.com`). Confirm `offline_access` scope was included to receive a refresh token.
- [ ] **Dropbox OAuth connected:** Verify `refresh_token` is in the response (only present when `token_access_type=offline` was in the auth URL). Test that a refresh call 5 hours later succeeds.
- [ ] **Token encryption:** Verify the `_enc` suffix columns contain ciphertext, not plaintext. Verify decryption works by completing a full upload/download cycle.
- [ ] **Backend switching:** Upload a document to Supabase, switch org to Google Drive, upload another document — verify DSAR export downloads both correctly.
- [ ] **Portal upload routing:** With Google Drive configured, upload a file through the client portal — verify bytes go to Drive API, not Supabase Storage.
- [ ] **Postmark inbound routing:** Send an email attachment while org uses OneDrive — verify the attachment lands in OneDrive, not Supabase.
- [ ] **DSAR export:** Verify the ZIP builder fetches bytes from the correct backend per document (not just per org's current setting).
- [ ] **Disconnect warning:** Disconnect Google Drive with stored documents — verify the modal shows the document count and refuses to proceed without confirmation.
- [ ] **Re-auth banner:** Set an org's `storage_token_status = 'reauth_required'` manually — verify the dashboard shows the banner without navigating to Settings.
- [ ] **Privacy policy:** Verify `/privacy` sub-processor list includes all three new providers by name with their registered country.

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Token expired, uploads failed silently | MEDIUM | Set `storage_token_status = 'reauth_required'`; notify org admin; admin reconnects OAuth; no data loss (files never uploaded) |
| Refresh token revoked externally | MEDIUM | Same as above — re-auth flow; documents uploaded before revocation remain accessible in provider; documents that failed upload are lost |
| Plaintext tokens exposed in logs | HIGH | Immediately revoke all affected OAuth tokens from provider dashboards; alert affected firms; force re-authentication; rotate ENCRYPTION_KEY and re-encrypt all remaining tokens |
| Files uploaded to wrong provider backend | HIGH | Manual migration: download from actual provider, re-upload to correct provider, update `storage_path` and `storage_backend` per row — no automated recovery path |
| Org disconnected Drive with orphaned documents | HIGH | Admin must reconnect the same account to restore access; if the provider account was deleted, documents are permanently inaccessible — explain clearly in Settings UI |
| OneDrive files moved/renamed breaking paths | LOW | Item ID-based access is path-independent; no recovery needed if item IDs are stored correctly |
| Google Drive quota exceeded mid-upload | LOW | Retry with exponential backoff; if quota persists, request quota increase from Google Cloud Console; no data loss (failed uploads not committed to client_documents) |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Silent upload failures on token expiry | Phase 25 (first `withTokenRefresh` impl), reused in 26+27 | Manually expire a test access token; verify upload retries successfully and org remains connected |
| Unencrypted refresh tokens | Phase 24 (schema + crypto utility) | Read `organisations` row in Supabase Dashboard; verify token columns contain ciphertext |
| Google `invalid_grant` with no re-auth signal | Phase 25 | Revoke test token from Google Account settings; verify dashboard shows re-auth banner within 24 hours |
| Dropbox missing `token_access_type=offline` | Phase 27 | Inspect raw token exchange response; verify `refresh_token` field is present |
| OneDrive personal vs M365 complexity | Phase 26 | Test OAuth flow using an M365 developer tenant; verify admin consent URL is documented in Settings UI |
| `drive.file` scope access confusion | Phase 25 | Upload via server; verify same org token can download the file; confirm no 404 on subsequent retrieval |
| Backend incompatibility when switching providers | Phase 24 (per-document `storage_backend` column) | Switch org backend mid-usage; verify DSAR and downloads use per-document backend column |
| Orphaned documents on revocation | Phase 28 (health check cron + disconnect warning) | Revoke access in provider settings; verify warning banner appears within 24 hours; verify disconnect confirmation shows document count |
| File bytes through Next.js server (size limit) | Phase 29 (portal + inbound integration) | Upload a 10MB PDF via portal with Drive configured; verify it uses Drive's upload API, not Next.js request body |
| Missing privacy policy sub-processor entries | Phase 28 | Load `/privacy` in browser; verify all three provider names appear in sub-processor table |

---

## Sources

- [Google Drive API Scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth) — authoritative guidance on `drive.file` vs restricted scopes
- [Google OAuth2 Production Readiness — Restricted Scope Verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification) — verification timeline and requirements
- [Google OAuth2 Best Practices](https://developers.google.com/identity/protocols/oauth2/resources/best-practices) — token rotation handling
- [Nango: Google OAuth invalid_grant](https://nango.dev/blog/google-oauth-invalid-grant-token-has-been-expired-or-revoked) — MEDIUM confidence — explains common revocation causes
- [OneDrive API Authorization via Microsoft Graph](https://learn.microsoft.com/en-us/onedrive/developer/rest-api/getting-started/graph-oauth?view=odsp-graph-online) — official Microsoft auth documentation
- [OneDrive API Authorization for Personal MSA Accounts](https://learn.microsoft.com/en-us/onedrive/developer/rest-api/getting-started/msa-oauth?view=odsp-graph-online) — confirms separate endpoint for personal vs work accounts
- [Microsoft: Resolve Microsoft Graph authorization errors](https://learn.microsoft.com/en-us/graph/resolve-auth-errors) — AADSTS53003 and Conditional Access handling
- [Dropbox OAuth Guide](https://developers.dropbox.com/oauth-guide) — official `token_access_type=offline` documentation
- [Dropbox: Using OAuth 2.0 with Offline Access](https://dropbox.tech/developers/using-oauth-2-0-with-offline-access) — confirms offline requirement for long-lived tokens
- [Dropbox DBX Performance Guide](https://developers.dropbox.com/dbx-performance-guide) — rate limits and upload session guidance
- [Google Drive API Usage Limits](https://developers.google.com/workspace/drive/api/guides/limits) — 12,000 requests per 60s quota
- [ICO Security Outcomes Guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/security/a-guide-to-data-security/security-outcomes/) — encryption requirements for personal data at rest
- [OneDrive API Permissions Reference](https://learn.microsoft.com/en-us/onedrive/developer/rest-api/concepts/permissions_reference?view=odsp-graph-online) — scope differences between personal and work accounts
- [GitHub: Big upload fails because of expired access token (OneDrive)](https://github.com/abraunegg/onedrive/issues/3355) — MEDIUM confidence — documents mid-upload token expiry failure

---
*Pitfalls research for: v5.0 Third-Party Storage Integrations (Google Drive, OneDrive, Dropbox)*
*Researched: 2026-02-28*
