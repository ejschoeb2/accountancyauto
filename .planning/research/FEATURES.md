# Feature Research: v5.0 Third-Party Storage Integrations

**Domain:** Cloud storage provider integrations for B2B SaaS (Google Drive, OneDrive, Dropbox as configurable storage backends for UK accounting practices)
**Researched:** 2026-02-28
**Confidence:** HIGH for OAuth scope requirements (official provider docs verified); HIGH for token lifecycle patterns (official MSAL/Dropbox/Google docs verified); MEDIUM for folder structure conventions (WebSearch, multiple B2B SaaS sources); MEDIUM for UX expectations (WebSearch, competitor analysis); LOW for UK accounting-specific storage preferences (no primary research, inference from market patterns)

---

## Context

This replaces the existing FEATURES.md (which covers v4.0 document collection) with research for v5.0. The v5.0 milestone adds Google Drive, Microsoft OneDrive, and Dropbox as **configurable per-org storage backends** — not a sync feature, not a two-way mirror. When an accounting firm connects their Google Drive, all new document uploads (portal, inbound email) are written directly to their Drive. Prompt retains only metadata (`client_documents` rows). The firm owns the files in their own cloud storage account.

This is architecturally different from "two-way sync with cloud storage" (which was correctly identified as an anti-feature in the v4.0 research). Here, the third-party provider *is* the storage layer — Supabase Storage becomes optional for orgs that have connected a provider.

**Target user:** Partner or practice manager at a UK accounting firm using Google Workspace or Microsoft 365 — non-technical, expects integration to "just work" like connecting Xero to their accountancy practice.

**Existing system dependencies:**
- `client_documents` table — `storage_path` column currently holds a Supabase Storage object path; with third-party backends, it holds a provider file ID (Google Drive file ID, OneDrive item ID) or path (Dropbox)
- `lib/documents/storage.ts` — the storage abstraction layer to be made provider-agnostic (upload/getDownloadUrl/delete)
- `organisations` table — needs `storage_backend` enum column and OAuth token columns
- Upload paths: portal upload, inbound email attachment — both must route through the new abstraction
- DSAR export — must fetch bytes from provider API, not Supabase Storage, when a third-party backend is active

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features accounting firms will expect from any "connect your Google Drive" integration. Missing these = integration feels broken or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **OAuth connect flow from Settings UI** | Industry standard for SaaS integrations. Clicking "Connect Google Drive" opens provider OAuth, user grants permission, returns to Prompt as connected. | MEDIUM | Standard OAuth 2.0 authorization code flow. Callback route stores token in `organisations` row. This is how every tool the accountant uses works (Xero, QuickBooks, etc.) |
| **Connected / disconnected status in UI** | Accountant needs to see at a glance which provider is active. Ambiguity about where files are going creates anxiety. | LOW | Settings card per provider: shows connected account email/name, storage root path, and a Disconnect button. Grey = not connected, green = active. |
| **Disconnect and revert to Supabase Storage** | The accountant may want to switch back. An irreversible integration is a trust problem. | LOW | Disconnect removes OAuth tokens from `organisations`, sets `storage_backend` back to `supabase`. Existing files already in the provider are NOT deleted — they remain there. New uploads go back to Supabase Storage. Warn clearly in UI. |
| **Automatic token refresh (silent, invisible to user)** | Access tokens for all three providers expire within 1 hour (Google) or are short-lived (Dropbox). Accountants do not tolerate "reconnect your account" pop-ups every hour during normal work. | HIGH | Must refresh silently before token expiry using stored refresh token. Retry logic for upload failures caused by expired tokens. See token lifecycle details in pitfalls section. |
| **Folder created automatically — no manual setup** | Accountants are not file system administrators. They expect the integration to create the folder structure. "You need to create a folder called Prompt first" is a support ticket. | MEDIUM | On first upload for each org, create root folder (e.g. `Prompt/` or configurable name). Sub-folders per client and filing type created on demand. Provider APIs all support folder creation. |
| **All future uploads go to connected provider** | Once connected, everything new should go to the provider — portal uploads, inbound email attachments. Accountants do not want to think about where files go. | HIGH | The storage abstraction layer (`lib/documents/storage.ts`) must route based on `org.storage_backend`. Affects portal upload, inbound email handler, potentially DSAR export fetch path. |
| **Download still works from the accountant's UI** | The accountant expects to click a document in Prompt and download it. The provider being the storage layer must not change this UX. | MEDIUM | Instead of a Supabase signed URL, generate a provider-specific temporary link: Google Drive temporary download link, OneDrive sharing link with expiry, Dropbox temporary link. All expire after ~300 seconds, matching existing behaviour. Log to `document_access_log` as before. |
| **Visible reconnect flow when token is revoked** | Tokens get revoked by the user from within the provider (e.g. from Google Account settings). The integration will silently fail on the next upload if not detected. | MEDIUM | On token refresh failure or upload failure with auth error, set `storage_backend_status` = `error` on the org. Show banner: "Your Google Drive connection needs to be re-authorised." Reconnect re-runs the OAuth flow. |
| **Supabase Storage remains default (no change for unconnected orgs)** | Orgs not connecting a provider must not be affected. Existing document infrastructure must be unchanged. | LOW | `storage_backend` defaults to `supabase` on organisations. All existing code paths continue to work. Provider routing is conditional, not a rewrite. |
| **DSAR export still works with provider backend** | GDPR right of access must be fulfilled regardless of where files are stored. The ZIP must contain the actual file bytes, not just metadata. | HIGH | DSAR export route must call provider download API to fetch bytes before zipping. Currently it uses Supabase Storage `download()`. Must be abstracted to call the provider API when `storage_backend != supabase`. |

---

### Differentiators (Competitive Advantage)

Features not universally expected but valued by UK accounting firms. These distinguish a high-quality integration from a checkbox integration.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Least-privilege OAuth scopes** | Accounting firms are security-conscious. "Why does Prompt need access to my entire Google Drive?" is a real objection. Using `drive.file` (Google) or minimum equivalent scopes means Prompt can only see files it creates — not the firm's whole Drive. | MEDIUM | Google: `drive.file` — per-file access, no verification overhead, Prompt sees only files it creates or user explicitly shares. Dropbox: `files.content.write` + `files.content.read` + `files.metadata.read` scoped to app folder pattern. OneDrive: `Files.ReadWrite` (note: `Files.ReadWrite.AppFolder` is personal accounts only — not available for M365 business accounts). This is a trust differentiator. |
| **Configurable root folder name** | Larger firms may have existing folder conventions ("Clients 2026", "Tax Work"). Letting them specify the root folder name means the integration fits their existing structure rather than imposing one. | LOW | Settings field: "Storage folder name" — defaults to "Prompt", stored on `organisations`. Used as root folder in provider. Validate on save (no special characters, reasonable length). |
| **Folder structure mirrors the existing data model** | `orgs/{org_id}/clients/{client_id}/{filing_type}/{tax_year}/` is the existing Supabase path pattern. Mirroring this in the provider's folder structure (using readable names, not UUIDs) means the accountant can navigate their Drive and find documents intuitively. | MEDIUM | Folder structure: `{root}/{client_name}/{filing_type}/{tax_year}/filename.pdf`. Use client name and filing type label, not UUIDs — meaningful to humans in the Drive UI. Example: `Prompt/Smith & Sons Ltd/Corporation Tax/2024-2025/bank-statement.pdf`. Provider folder creation is idempotent (check if exists, create if not). |
| **File naming that makes sense in Drive** | In Supabase Storage, files are stored as `{uuid}.ext`. In a human-visible Google Drive, `a1b2c3d4.pdf` is useless. Files should be named meaningfully. | LOW | Derived filename on provider upload: `{document_type}_{upload_date}.{ext}`. Example: `P60_2026-01-15.pdf`. Fall back to original client filename if document type is unclassified. Store derived name separately from Supabase `storage_path` equivalent (which holds the provider file ID). |
| **Multiple providers available simultaneously (choose one active)** | Firms that switch from Dropbox to Google Workspace don't want to lose their configuration. | LOW | Store OAuth tokens for all three providers in `organisations` columns. `storage_backend` enum determines which is active. All three can be "connected" simultaneously; only one is active as the current backend. Switching active backend is a single dropdown change. |
| **Migration helper: existing Supabase files to provider** | When an org connects a provider, their existing documents are in Supabase Storage. Without a migration path, the document store is split across two locations. | HIGH | OPTIONAL for v5.0 MVP. Post-connection migration: background job that downloads each `client_documents` file from Supabase Storage and uploads to the provider, updating `storage_path`. Show progress in Settings. This is v5.x — flag as future. |
| **Token health indicator in Settings** | Proactive visibility into connection health reduces unexpected failures. Show "Last successful upload: 2 hours ago" and "Token expires in: 45 minutes" (or "Token refreshed automatically at 14:23"). | MEDIUM | Surface `oauth_last_refreshed_at` and `oauth_expires_at` from `organisations` in Settings UI. Green/amber/red health indicator. Amber = approaching expiry without successful refresh in last 24h. Red = failed. |

---

### Anti-Features (Commonly Requested, Often Problematic)

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| **`drive` (full Drive access) scope instead of `drive.file`** | "Won't it be simpler to just request full Drive access?" | `drive` and `drive.readonly` are restricted scopes under Google's OAuth verification requirements. Apps requesting these must undergo an annual third-party security assessment. `drive.file` achieves everything needed (Prompt creates the files) without restricted-scope overhead or user-visible "this app can see all your Drive files" consent warning. | Use `drive.file` scope exclusively. Prompt only needs to access files it creates. Enforce this architecture: Prompt never reads pre-existing Drive files. |
| **`Files.ReadWrite.All` scope for OneDrive** | "We need access to all files in OneDrive for the integration to work." | `Files.ReadWrite.All` grants access to all files in the user's OneDrive, not just app-created files. This is far more permission than needed and creates user consent friction. Note: `Files.ReadWrite.AppFolder` (the least-privilege equivalent) is not available for Microsoft 365 business accounts — only personal accounts. | Use `Files.ReadWrite` (not `.All`) for M365. Create a dedicated app folder within the user's OneDrive (`Apps/Prompt/`) and constrain all operations to that path in application logic. Access control is enforced in code, not via scope, for M365. |
| **Storing long-lived access tokens in plaintext DB columns** | "Easiest to just store the token string directly." | Access tokens typically expire in 1 hour. Storing plaintext tokens in `organisations` without encryption exposes them if the DB is compromised. Refresh tokens are long-lived (Google's never expire by default unless revoked; Dropbox refresh tokens don't expire). | Encrypt at rest: use a symmetric encryption key (from env var) to encrypt `oauth_access_token` and `oauth_refresh_token` columns. Decrypt only at the moment of API call. This is one migration + one utility function — low overhead, critical security. |
| **Two-way sync: watching provider for changes** | "If an accountant uploads a file directly to Drive, shouldn't it appear in Prompt?" | Drive webhook subscriptions (Google Drive push notifications, OneDrive webhooks) require publicly accessible endpoints, subscription renewal, and handling provider-initiated events. This is a complete second system (inbound rather than outbound) for marginal gain. Accountants should upload via Prompt (portal or email) — Drive is the storage layer, not the ingestion layer. | Prompt is the authoritative source of what documents exist (via `client_documents`). Files uploaded directly to Drive outside Prompt simply don't appear in Prompt. Document this clearly. The value of the integration is files going TO the provider, not FROM it. |
| **Automatic folder sharing with clients** | "When I connect Drive, can the portal just show clients their shared folder?" | Sharing Drive/OneDrive folders with clients (who are not Google/Microsoft account holders) via OAuth is complex: you'd need their email, provider-specific sharing API, and client-side permission setup. It bypasses the existing portal access model entirely. | The existing token-based client portal is the proven pattern. Files in Drive are for the accountant — not for clients. Clients upload via the existing portal; accountants download from their Drive. |
| **Support for Google Shared Drives (Team Drives)** | "Our firm uses a Shared Drive, not individual Drive." | Google Shared Drives require the `drive` scope (restricted) instead of `drive.file` which only applies to My Drive. Supporting Shared Drives triggers the full Google app verification process. | v5.0 supports My Drive only with `drive.file` scope. Document this limitation. Shared Drive support is a v5.x feature once the integration is proven and Google app verification is worth pursuing. |
| **Silent fallback: write to Supabase if provider fails** | "If Drive is down, just save to Supabase as backup." | A silent fallback means `storage_path` could reference either Supabase or Drive depending on which worked at the time of upload. This creates an inconsistent state: some documents are in Drive, some are in Supabase. DSAR exports would need to check both. Diagnostics become painful. | Fail explicitly. If the provider upload fails after retries, return an error to the caller and do not store the document. Surface the failure to the accountant immediately (banner, notification). An explicit failure is honest; a silent fallback creates a hidden split-brain state. |
| **Deleting files from provider on document delete in Prompt** | "When I delete a document in Prompt, it should delete from Drive too." | Providers treat deletion as permanent and immediate (no recycle bin guarantee). If an accountant deletes a Prompt document record but the file needs to be retained for HMRC compliance (6-year retention), the file should stay in Drive even if the Prompt metadata row is deleted. | Do not delete provider files on Prompt document deletion. Only delete the `client_documents` metadata row. The file remains in the provider's storage as the accountant's own files. Document this clearly: "Deleting a document in Prompt removes it from Prompt's records. The file remains in your Google Drive." If hard deletion is needed (GDPR erasure), add a separate explicit "Delete from Drive" confirmation step after the retention hold has been cleared. |

---

## Feature Dependencies

```
[organisations.storage_backend enum + OAuth token columns]
    └──required by──> [OAuth connect flow from Settings UI]
                          └──required by──> [Connected/disconnected status]
                          └──required by──> [Disconnect and revert]
                          └──required by──> [Automatic token refresh]
                          └──required by──> [Visible reconnect on revocation]

[Storage abstraction layer (lib/documents/storage.ts)]
    └──required by──> [All future uploads go to connected provider]
                          └──affects──> [Portal upload route]
                          └──affects──> [Inbound email attachment handler]
                          └──affects──> [DSAR export byte fetch]
                          └──enables──> [Provider-specific temporary download links]

[Automatic token refresh]
    └──required by──> [All future uploads go to connected provider]
    └──required by──> [Download still works from accountant UI]
    └──required by──> [DSAR export still works]

[Folder structure on provider]
    └──required by──> [All future uploads go to connected provider]
    └──required by──> [Configurable root folder name]
    └──enables──> [Meaningful file naming in Drive]

[Provider temporary download links]
    └──required by──> [Download still works from accountant UI]
    └──required by──> [DSAR export]

[Least-privilege scopes]
    └──constrains──> [Google: drive.file only, no Shared Drive]
    └──constrains──> [OneDrive: Files.ReadWrite, app folder convention]
    └──constrains──> [Dropbox: files.content.write + files.content.read + files.metadata.read]

[Token encryption]
    └──required by──> [Automatic token refresh]
    └──required by──> [OAuth connect flow]
    └──independent of but alongside──> [Storage backend routing]

[Migration helper (future)]
    └──requires──> [Storage abstraction layer]
    └──requires──> [OAuth connect flow]
    └──depends on──> [Supabase Storage download (existing)]
    └──depends on──> [Provider upload API]
```

### Dependency Notes

- **Storage abstraction is the load-bearing piece:** Every other feature in this milestone depends on `lib/documents/storage.ts` becoming provider-agnostic. Build and test this layer first, against the Supabase backend to confirm no regression, before wiring any provider.
- **Token refresh must be in place before any upload path uses a provider:** A single upload failure due to token expiry will lose a document. Refresh logic must be tested against all three providers before enabling provider backends in production.
- **Scope choices constrain architecture:** `drive.file` scope for Google means Prompt can only read files it created via the API. The migration helper (reading pre-existing Supabase files to copy to Drive) would need a different flow — Prompt creates new files in Drive by uploading, then the old Supabase file can be deleted. This is fine. What it cannot do is browse an accountant's pre-existing Drive folders.
- **OneDrive `Files.ReadWrite.AppFolder` is personal-only:** This is a significant constraint. For M365 business accounts (the target market), the app folder pattern must be enforced in application code, not via OAuth scope. This means the app must self-constrain to `Apps/Prompt/` path prefix and document this clearly.
- **DSAR export has a hard dependency on provider download API:** If the export fetches bytes synchronously and the provider is slow or unavailable, the export will time out (Vercel Pro: 5–10s default, 60s with explicit config). Consider streaming or background job approach for large DSAR exports in v5.x.

---

## MVP Definition (v5.0 Launch)

### Launch With (v5.0)

Minimum viable provider integration: connect a provider, have uploads go there, have downloads still work.

- [ ] **Storage abstraction layer** — `lib/documents/storage.ts` becomes an interface with `upload()`, `getDownloadUrl()`, `delete()` methods. Supabase Storage is the first implementation. Required before any provider is wired.
- [ ] **`organisations` schema update** — `storage_backend` enum (supabase | google_drive | onedrive | dropbox), `storage_backend_status` (active | error | null), OAuth token columns (access token, refresh token, expires at, account email/name) per provider. Encrypted at rest.
- [ ] **Google Drive integration** — OAuth flow (drive.file scope), Drive API v3 upload, folder creation, temporary download link, token refresh. First provider to ship because `drive.file` avoids restricted scope overhead.
- [ ] **Settings UI: connect/disconnect Google Drive** — Show connected account, storage root path, health indicator. Reconnect banner when status = error.
- [ ] **Token refresh utility** — For Google: exchange refresh_token for new access_token before expiry. Store refreshed token. Handle revocation gracefully (set status = error, surface banner).
- [ ] **Portal upload updated for non-Supabase backends** — When `storage_backend = google_drive`, route file bytes to Drive API instead of Supabase Storage. Metadata still written to `client_documents`.
- [ ] **Inbound email attachments updated** — Same routing logic: when `storage_backend != supabase`, upload attachment bytes to provider API.
- [ ] **Provider download URL in document view** — Generate Google Drive temporary link instead of Supabase signed URL when backend is Google Drive. Log to `document_access_log` as before.
- [ ] **DSAR export updated for provider backend** — Fetch file bytes from Drive API when `storage_backend = google_drive`. ZIP still assembled and returned the same way.
- [ ] **Visible reconnect flow** — Banner and Settings status badge when token refresh fails. One-click re-authorisation flow.

### Add After Validation (v5.x)

- [ ] **Microsoft OneDrive integration** — More complex than Google Drive due to M365 vs personal account split, MSAL token management. Add after Google Drive is validated in production.
- [ ] **Dropbox integration** — Simpler API than OneDrive, but fewer UK accounting firms use Dropbox (Google Workspace and Microsoft 365 dominate this market). Add after OneDrive.
- [ ] **Configurable root folder name** — Low effort, add with OneDrive or Dropbox when Settings UI is being updated anyway.
- [ ] **Migration helper** — Background job to move existing Supabase files to provider on connection. High effort, deferrable: newly uploaded files go to Drive; existing files remain accessible in Supabase Storage. Split store is suboptimal but not broken.
- [ ] **Token health indicator** — Surface `oauth_last_refreshed_at` and `oauth_expires_at` in Settings. Add once the token refresh system is proven stable.

### Future Consideration (v5.2+)

- [ ] **Google Shared Drive support** — Requires `drive` scope, Google restricted scope verification, annual security assessment. Only worth pursuing when practice size and usage justify the compliance overhead.
- [ ] **Multiple active backends** — Different orgs within a team using different backends. Currently one backend per org is sufficient.
- [ ] **Streaming DSAR export** — For large client document sets, ZIP assembly may time out Vercel serverless limit. Streaming or background job approach needed if document counts are large.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Storage abstraction layer | HIGH | MEDIUM | P1 — foundation for all providers |
| organisations schema update | HIGH | LOW | P1 — foundation |
| Token encryption at rest | HIGH | LOW | P1 — security requirement |
| Google Drive OAuth connect/disconnect | HIGH | MEDIUM | P1 — first provider |
| Google Drive token refresh | HIGH | MEDIUM | P1 — must precede any prod use |
| Portal upload routing (Google Drive) | HIGH | MEDIUM | P1 — core upload path |
| Inbound email routing (Google Drive) | HIGH | MEDIUM | P1 — second upload path |
| Provider download URL (Google Drive) | HIGH | MEDIUM | P1 — download must work |
| DSAR export update (Google Drive) | HIGH | HIGH | P1 — legal requirement |
| Visible reconnect flow + error banner | HIGH | LOW | P1 — trust and safety |
| OneDrive OAuth connect/disconnect | HIGH | HIGH | P2 — second provider (after Google) |
| OneDrive token refresh (MSAL) | HIGH | HIGH | P2 — complex, MSAL dependency |
| Dropbox OAuth connect/disconnect | MEDIUM | MEDIUM | P2 — third provider |
| Configurable root folder name | MEDIUM | LOW | P2 — polish |
| Token health indicator in Settings | MEDIUM | LOW | P2 — operational visibility |
| Migration helper (Supabase → provider) | MEDIUM | HIGH | P3 — deferrable |
| Google Shared Drive support | LOW | HIGH | P3 — restricted scope overhead |

**Priority key:**
- P1: Must ship in v5.0
- P2: Add in v5.x (OneDrive + Dropbox phase)
- P3: Future milestone

---

## Provider-Specific Technical Notes

### Google Drive

- **OAuth scope:** `drive.file` — grants access only to files created by the app or files the user explicitly opens with the app. Prompt creates all files, so this covers all use cases. Non-restricted scope (no annual security assessment required). Consent dialog shows: "See, edit, create, and delete only the specific Google Drive files you use with this app."
- **Token lifetime:** Access tokens expire in 3600 seconds (1 hour). Refresh tokens do not expire but are invalidated if the user revokes access from Google Account settings, or if the app has been unused for 6 months (Google enforces inactivity expiry for some apps).
- **Upload method:** For documents under 5 MB (typical tax document): multipart upload (single request with metadata + file bytes). For documents 5–150 MB: resumable upload (initiate session URI, then upload in one or multiple chunks of 256 KB multiples). Given typical accounting documents (PDFs, scans) are under 5 MB, multipart is the practical default.
- **Folder creation:** Create with `mimeType: 'application/vnd.google-apps.folder'` and `parents` array pointing to parent folder. Check for existing folder by name before creating (idempotent).
- **File ID as `storage_path`:** `storage_path` on `client_documents` holds the Google Drive file ID (e.g. `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms`). This is permanent — the file can be moved/renamed in Drive and the ID remains valid.
- **Temporary download link:** Use `files.get` with `alt=media` + access token, or generate an export/download URL. Standard practice: return a short-lived authenticated URL. Google does not have a native "signed URL" equivalent for Drive files (unlike GCS). Pattern: proxy the download through the Next.js server (fetch bytes server-side, stream to browser). This is the main deviation from Supabase's signed URL pattern.
- **Confidence:** MEDIUM-HIGH. Based on official Google Drive API docs (linked in sources).

### Microsoft OneDrive

- **OAuth scope:** `Files.ReadWrite` (delegated) for M365 business accounts. `Files.ReadWrite.AppFolder` is personal Microsoft accounts only — not applicable here. Target market is M365 (Google Workspace and M365 dominate UK accounting practice). Request `offline_access` to obtain a refresh token.
- **Token lifetime:** Access tokens expire in 3600 seconds (1 hour). Refresh tokens have a rolling expiry of 24 hours of inactivity (or 90 days maximum). This is more aggressive than Google. MSAL handles token cache and silent refresh via `acquireTokenSilent`.
- **MSAL vs raw HTTP:** Microsoft recommends using MSAL Node.js (`@azure/msal-node`) rather than manually handling token refresh. MSAL stores tokens in its internal cache and refreshes silently. For server-side (Vercel), use a confidential client with client secret. App registration in Azure AD / Entra ID required.
- **App folder convention (self-enforced):** Since `Files.ReadWrite.AppFolder` is unavailable for M365, create a dedicated folder at `/drive/root:/Apps/Prompt:/` and constrain all operations to that path. This is enforced in application code, not by scope. Document this clearly for accountants: "Prompt stores files in your OneDrive under Apps > Prompt."
- **Upload method:** Microsoft Graph API `/me/drive/root:/path/to/file:/content` (PUT for files < 4 MB). For files > 4 MB: upload session (create session, then upload in chunks of up to 60 MB). Most documents < 4 MB, so PUT is the default.
- **Item ID as `storage_path`:** Store the OneDrive item ID. Unlike Google Drive, OneDrive item IDs are scope-dependent — if the user changes tenants or the item is moved across drives, the ID may become invalid.
- **Temporary download link:** Use `@microsoft.graph.downloadUrl` property (pre-signed URL returned in item metadata) or `@microsoft.graph.directUrl`. These expire and require re-fetching via Graph API. Alternatively: proxy through Next.js server (same pattern as Google Drive).
- **Confidence:** MEDIUM. MSAL complexity and the `Files.ReadWrite.AppFolder` limitation for M365 are the main risks. Verified from Microsoft Learn docs.

### Dropbox

- **OAuth scope:** `files.content.write` + `files.content.read` + `files.metadata.read`. These are the minimum for upload, download, and listing. Dropbox uses scoped access (migrated from legacy full-access tokens in 2021).
- **Token lifetime:** Short-lived access tokens expire after 4 hours. Refresh tokens do not expire (long-lived by default with offline access type). Exchange refresh token for new access token via POST to `/oauth2/token` with `grant_type=refresh_token`.
- **App folder vs full Dropbox:** Dropbox apps can be scoped to an "App folder" (`/Apps/{app_name}/`) — this is the least-privilege option and available without requesting full Dropbox access. Unlike OneDrive, this is an actual API-enforced boundary. Recommended: use app folder scope. Access is then constrained at the provider level, not just in code.
- **Path-based `storage_path`:** Unlike Google Drive and OneDrive (which use file IDs), Dropbox uses paths. `storage_path` would be something like `/Apps/Prompt/Smith & Sons Ltd/Corporation Tax/2024-2025/bank-statement.pdf`. Paths are human-readable in the Dropbox UI, which is a UX advantage. Downside: path changes (if the accountant renames a folder in Dropbox) break the path reference. Mitigate by using Dropbox's file ID (`rev` field) for robust lookups.
- **Upload method:** `files_upload` endpoint for files up to 150 MB. Larger files require upload sessions. UK accounting documents are well under 150 MB.
- **Temporary download link:** Dropbox has a `get_temporary_link` endpoint that returns a temporary URL (valid for 4 hours). This is close to the Supabase signed URL pattern. Simplest approach for downloads.
- **Confidence:** MEDIUM-HIGH. Dropbox API is well-documented and the app folder pattern is clean. Fewer edge cases than OneDrive.

---

## OAuth Scope Risk Assessment

| Provider | Recommended Scope | Scope Category | Annual Security Assessment? | User Consent Warning |
|----------|-------------------|---------------|----------------------------|---------------------|
| Google Drive | `drive.file` | Non-sensitive | No | "See, edit, create, delete only files you use with this app" — acceptable |
| Google Drive | `drive` | Restricted | Yes — annual third-party audit | "See, edit, create, delete all files in your Google Drive" — user friction high |
| OneDrive (M365) | `Files.ReadWrite` | Standard | No | "Read and write files in your OneDrive" — acceptable |
| OneDrive (personal) | `Files.ReadWrite.AppFolder` | Standard (least-privilege) | No | App folder only — ideal but not available for M365 |
| Dropbox | App folder + content scopes | Standard | No | Access limited to Apps/Prompt folder — acceptable |

**Critical finding:** Using Google Drive's `drive.file` scope avoids the restricted scope verification process entirely. This is the correct architectural choice — Prompt creates all files via the API, so `drive.file` is functionally sufficient and carries no compliance overhead.

---

## Dependencies on Existing Architecture

| Existing System Component | How v5.0 Affects It | Change Required |
|--------------------------|--------------------|--------------------|
| `client_documents.storage_path` | Currently Supabase Storage object path. With providers: file ID (Google/OneDrive) or path (Dropbox). Column type remains TEXT — no schema change to the column itself, but semantics change. | Add `storage_provider` column (enum) so DSAR export and download URL generation know which API to call. |
| `lib/documents/storage.ts` | Core target of the refactor. Currently wraps Supabase Storage operations. Must become a provider-agnostic interface. | Complete rewrite into interface + implementations: SupabaseStorageProvider, GoogleDriveProvider, OneDriveProvider, DropboxProvider. |
| `organisations` table | Needs new columns for provider config and OAuth tokens. | Migration: add `storage_backend`, `storage_backend_status`, `gd_access_token`, `gd_refresh_token`, `gd_token_expires_at`, `gd_account_email`, similar for `od_*` and `db_*`. Encrypt token columns. |
| Portal upload route (`/api/portal/[token]/upload`) | Currently issues Supabase signed upload URL; file bytes go directly to Supabase from browser. With provider backends, bytes must go to a Next.js server endpoint that proxies to the provider API. | Change upload flow from signed URL (direct browser → Supabase) to proxy (browser → Next.js server → provider API). This is a more significant flow change than just swapping the storage call. |
| Inbound email attachment handler (`/api/postmark/inbound`) | Currently uploads bytes to Supabase Storage. With providers: upload to provider API. | Add provider routing logic after classification. Service role client already holds bytes — straightforward API call swap. |
| DSAR export (`/api/clients/[id]/documents/dsar`) | Currently downloads all bytes from Supabase Storage and zips. With providers: must call provider download API per document. | Add provider routing in download loop. Async, may need streaming for large exports. |
| `document_access_log` | No change — logs access event regardless of provider. | None. |
| Signed URL download (300s expiry) | Google and OneDrive do not have native signed URL equivalents for files — proxying through Next.js server is required. Dropbox has `get_temporary_link` (4 hours). | For Google/OneDrive: downloads become server-proxied, not direct browser ↔ storage. This affects download latency and Vercel serverless execution time for large files. Design consideration for v5.0. |

---

## Competitor Feature Analysis

| Feature | TaxDome | Karbon | Senta | Dext | Prompt v5.0 |
|---------|---------|--------|-------|------|-------------|
| Google Drive integration | Yes (full Drive sync) | No | No | No | Yes (storage backend, drive.file scope) |
| OneDrive integration | Yes (full Drive sync) | No | No | No | Yes (storage backend, Files.ReadWrite) |
| Dropbox integration | No | No | No | No | Yes (app folder pattern) |
| Least-privilege scopes | No (requests broad access) | N/A | N/A | N/A | Yes — drive.file, app folder |
| BYOS (bring your own storage) | No — sync to SaaS + provider | N/A | N/A | N/A | Yes — provider IS the storage layer |
| Automatic token refresh | Unknown | N/A | N/A | N/A | Yes — silent refresh before expiry |
| Supabase fallback if no provider | N/A | Managed storage | Managed storage | Managed storage | Yes — Supabase remains default |

**Key differentiation from TaxDome's approach:** TaxDome integrates with Google Drive and OneDrive as a sync target (documents exist in TaxDome AND in Drive). This creates duplication and sync complexity. Prompt v5.0 makes the provider the single storage layer — no duplication, no sync. The firm's Drive IS the document store. This aligns better with how UK accounting firms already think about their file management (everything in one place, not mirrored).

---

## Sources

**Google Drive API:**
- [Choose Google Drive API scopes — Google for Developers](https://developers.google.com/workspace/drive/api/guides/api-specific-auth) — MEDIUM confidence (authoritative but WebSearch retrieval, not WebFetch verified)
- [Sensitive scope verification — Google for Developers](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification) — MEDIUM confidence
- [Restricted scope verification — Google for Developers](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification) — MEDIUM confidence
- [Upload file data — Google Drive API — Google for Developers](https://developers.google.com/workspace/drive/api/guides/manage-uploads) — MEDIUM confidence
- [Replace drive.readonly with drive.file — React Google Drive Picker issue](https://github.com/Jose-cd/React-google-drive-picker/issues/79) — LOW confidence (community, confirming scope recommendation)

**Microsoft OneDrive / Graph API:**
- [Authorization for OneDrive API via Microsoft Graph — Microsoft Learn](https://learn.microsoft.com/en-us/onedrive/developer/rest-api/getting-started/graph-oauth?view=odsp-graph-online) — HIGH confidence (official docs)
- [Understanding OneDrive API permission scopes — Microsoft Learn](https://learn.microsoft.com/en-us/onedrive/developer/rest-api/concepts/permissions_reference?view=odsp-graph-online) — HIGH confidence (official docs)
- [Files.ReadWrite.AppFolder not available for OneDrive for Business — Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/1418013/when-is-api-permission-(delegated)-files-readwrite) — HIGH confidence (official Microsoft answer confirming limitation)
- [What is an App Folder — OneDrive API — Microsoft Learn](https://learn.microsoft.com/en-us/onedrive/developer/rest-api/concepts/special-folders-appfolder?view=odsp-graph-online) — HIGH confidence
- [Get access on behalf of a user — Microsoft Graph — Microsoft Learn](https://learn.microsoft.com/en-us/graph/auth-v2-user) — HIGH confidence

**Dropbox API:**
- [Dropbox OAuth Guide — Dropbox Developers](https://developers.dropbox.com/oauth-guide) — HIGH confidence (official docs)
- [Migrating App Permissions and Access Tokens — Dropbox Tech](https://dropbox.tech/developers/migrating-app-permissions-and-access-tokens) — HIGH confidence (official blog, explains scoped access migration)
- [Using OAuth 2.0 with offline access — Dropbox Tech](https://dropbox.tech/developers/using-oauth-2-0-with-offline-access) — HIGH confidence (official blog, explains refresh token pattern)

**B2B SaaS Integration Patterns:**
- [Top 5 file storage APIs to integrate with in 2025 — Apideck](https://www.apideck.com/blog/top-5-file-storage-apis-to-integrate-with) — MEDIUM confidence (vendor blog)
- [Guide to document and file storage APIs and integrations — Merge.dev](https://www.merge.dev/blog/guide-to-document-and-file-storage-apis-and-integrations) — MEDIUM confidence (integration platform vendor)
- [Understanding Google Drive OAuth Scopes — moldstud.com](https://moldstud.com/articles/p-understanding-google-drive-oauth-scopes-a-comprehensive-security-best-practices-guide) — LOW confidence (third-party blog, corroborating)
- [Enterprise Cloud Storage comparison — Sesame Disk Group](https://sesamedisk.com/enterprise-cloud-storage-google-drive-vs-onedrive-vs-dropbox/) — LOW confidence (marketing content)
- [Microsoft OneDrive Flaw Exposes Users to Data Overreach — Infosecurity Magazine](https://www.infosecurity-magazine.com/news/microsoft-onedrive-flaw-exposes/) — LOW confidence (news article, useful for scope risk context)

---

*Feature research for: v5.0 Third-Party Storage Integrations — Prompt*
*Researched: 2026-02-28*
*Confidence: HIGH for OAuth scope requirements and token lifecycle (official provider docs confirmed via search); HIGH for OneDrive Files.ReadWrite.AppFolder personal-only limitation (Microsoft Q&A confirmed); MEDIUM for folder structure conventions and download proxy pattern (WebSearch, multiple B2B SaaS sources); LOW for UK accounting firm storage preferences (inference from market patterns, no primary research)*
