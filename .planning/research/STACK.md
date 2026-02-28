# Technology Stack: v5.0 Third-Party Storage Integrations

**Project:** Prompt — v5.0 Third-Party Cloud Storage
**Researched:** 2026-02-28
**Scope:** New packages required for Google Drive, Microsoft OneDrive, and Dropbox OAuth2 flows and API calls. Does NOT re-research the existing stack.
**Overall confidence:** HIGH (package versions verified against npm registry; bundle sizes verified; OAuth2 patterns verified against official provider documentation; Vercel serverless constraints verified against confirmed GitHub issues)

---

## Existing Stack (Unchanged)

Do not re-research or alter these:

| Technology | Version | Notes |
|------------|---------|-------|
| Next.js | 16.1.6 | App Router — server actions and route handlers |
| React | 19.2.3 | Confirmed in package.json |
| @supabase/supabase-js | ^2.95.3 | Auth + DB + Storage — default storage backend |
| @supabase/ssr | ^0.8.0 | Server-side auth helpers |
| Vercel Pro | — | 4.5 MB serverless payload limit; no persistent in-memory state between invocations |
| file-type | ^21.3.0 | Already installed — MIME detection continues to run on all uploads regardless of backend |
| fflate | ^0.8.2 | Already installed — DSAR ZIP export runs against provider-fetched bytes |

---

## New Dependencies: Google Drive

### `@googleapis/drive` (NOT `googleapis`)

| Package | Version | Purpose | Install as |
|---------|---------|---------|-----------|
| `@googleapis/drive` | ^20.1.0 | Drive API v3 — file upload, download, folder creation, sharing links | production |
| `google-auth-library` | ^10.6.1 | OAuth2 client — authorization code exchange, token refresh, credential management | production |

**Why `@googleapis/drive` instead of `googleapis`:**
The full `googleapis` package is **199 MB unpacked** and imports every Google API (Sheets, Gmail, Calendar, Maps, etc.) into the bundle. The scoped `@googleapis/drive` package exposes only the Drive v3 API surface and is approximately **2.3 MB unpacked** — 86x smaller. Vercel serverless functions have a 250 MB uncompressed size limit and benefit from smaller bundles for cold start performance. Use the scoped package; never import `googleapis` for a single-API use case.

**Why `google-auth-library` separately:**
`google-auth-library` is the foundational auth layer that `@googleapis/drive` depends on but does not re-export cleanly for manual OAuth2 flows. The `OAuth2Client` class from `google-auth-library` is required to handle the authorization code grant, store and restore tokens from Postgres, and pass a pre-loaded credential to the Drive client. Install it explicitly so the import is unambiguous and not dependent on transitive resolution.

**OAuth2 scope to request:** `https://www.googleapis.com/auth/drive.file`

This is the minimum-permission scope. It restricts the app to files that Prompt itself creates — no access to the accountant's pre-existing Drive files. This satisfies security reviews and Google's own recommendations. Do NOT request `https://www.googleapis.com/auth/drive` (full access) or `https://www.googleapis.com/auth/drive.readonly` (not needed as we write files).

**Token storage pattern for Vercel serverless:**
`google-auth-library`'s `OAuth2Client` holds tokens in memory. Vercel functions have no persistent memory between invocations. The pattern is:

```typescript
import { OAuth2Client } from 'google-auth-library';

// On each request, rehydrate from Postgres
const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI,
);

// Load stored tokens from organisations table
oauth2Client.setCredentials({
  access_token: org.google_access_token,
  refresh_token: org.google_refresh_token,
  expiry_date: org.google_token_expiry,    // milliseconds epoch
});

// OAuth2Client auto-refreshes if expiry_date is in the past
// Listen for token refresh and persist back to Postgres
oauth2Client.on('tokens', async (tokens) => {
  await db.from('organisations').update({
    google_access_token: tokens.access_token,
    google_token_expiry: tokens.expiry_date,
  }).eq('id', orgId);
});
```

The `tokens` event fires whenever `google-auth-library` silently refreshes the access token using the stored refresh token. This is the correct pattern for serverless environments — no in-memory cache is assumed.

**Drive API usage:**

```typescript
import { google } from '@googleapis/drive';

const drive = google.drive({ version: 'v3', auth: oauth2Client });

// Upload a file
const res = await drive.files.create({
  requestBody: { name: filename, parents: [folderId] },
  media: { mimeType: detectedMime, body: fileStream },
  fields: 'id',
});
const fileId = res.data.id; // stored as storage_path in client_documents

// Generate a temporary download link (1 hour)
const link = await drive.files.get({
  fileId,
  fields: 'webContentLink',
});
```

---

## New Dependencies: Microsoft OneDrive

### `@azure/msal-node` + `@microsoft/microsoft-graph-client`

| Package | Version | Purpose | Install as |
|---------|---------|---------|-----------|
| `@azure/msal-node` | ^5.0.5 | OAuth2 authorization code flow, token acquisition and refresh for Microsoft identity | production |
| `@microsoft/microsoft-graph-client` | ^3.0.7 | Microsoft Graph API client — OneDrive file operations via `/me/drive` | production |

**Why `@azure/msal-node` instead of `simple-oauth2` or raw fetch:**
Microsoft's identity platform (Entra ID, formerly Azure AD) uses non-standard token endpoint behaviors for confidential clients and has specific requirements around client assertions and the `/common` tenant endpoint needed for personal Microsoft accounts (OneDrive personal). `@azure/msal-node` is Microsoft's official library, handles the confidential client flow correctly, and is the only library explicitly documented for server-side Node.js use with both work/school accounts (M365) and personal Microsoft accounts. `simple-oauth2` is a generic OAuth2 helper — it works for standard flows but requires manual handling of all Microsoft-specific behaviors.

**Why `@azure/msal-node` instead of `@azure/identity`:**
`@azure/identity` is designed for authenticating Azure SDK clients (Blob Storage, Key Vault, etc.) using service identities. It does not support the user OAuth2 authorization code flow needed here — where an accountant grants Prompt access to their OneDrive. Use `@azure/msal-node` for user-delegated access; `@azure/identity` is for machine-to-machine Azure service authentication.

**Why `@microsoft/microsoft-graph-client` in addition to `@azure/msal-node`:**
MSAL handles auth only. The Microsoft Graph client handles the actual API calls. They are designed to work together: MSAL provides the `AuthenticationProvider`, Graph client executes the HTTP calls. Using raw `fetch` against Graph is possible but tedious — the Graph client handles retries, correct base URL, and `@microsoft/microsoft-graph-client` provides `OneDriveLargeFileUploadTask` for chunked uploads (required for files > 4 MB).

**Token storage pattern for Vercel serverless:**
MSAL Node's default in-memory token cache does not survive between Vercel function invocations. The `ICachePlugin` interface allows a custom persistence layer:

```typescript
import { ConfidentialClientApplication, ICachePlugin, TokenCacheContext } from '@azure/msal-node';

const cachePlugin: ICachePlugin = {
  beforeCacheAccess: async (cacheContext: TokenCacheContext) => {
    const cached = await db.from('organisations')
      .select('ms_token_cache')
      .eq('id', orgId)
      .single();
    if (cached.data?.ms_token_cache) {
      cacheContext.tokenCache.deserialize(cached.data.ms_token_cache);
    }
  },
  afterCacheAccess: async (cacheContext: TokenCacheContext) => {
    if (cacheContext.cacheHasChanged) {
      const serialized = cacheContext.tokenCache.serialize();
      await db.from('organisations').update({ ms_token_cache: serialized }).eq('id', orgId);
    }
  },
};

const msalClient = new ConfidentialClientApplication({
  auth: {
    clientId: process.env.AZURE_CLIENT_ID!,
    clientSecret: process.env.AZURE_CLIENT_SECRET!,
    authority: 'https://login.microsoftonline.com/common', // supports personal + M365
  },
  cache: { cachePlugin },
});
```

The `ms_token_cache` column stores the serialized JSON blob that MSAL produces. This is the approach Microsoft recommends for serverless confidential client apps.

**OneDrive scope:** `Files.ReadWrite offline_access`

`Files.ReadWrite` grants read/write to OneDrive files. `offline_access` is mandatory — without it, Microsoft does not return a refresh token, and the accountant would need to re-authorize on every access token expiry (typically 1 hour).

**Graph client setup:**

```typescript
import { Client } from '@microsoft/microsoft-graph-client';

const authProvider = {
  getAccessToken: async () => {
    const result = await msalClient.acquireTokenSilent({
      scopes: ['Files.ReadWrite', 'offline_access'],
      account: msalAccount,
    });
    return result.accessToken;
  },
};

const graphClient = Client.initWithMiddleware({ authProvider });

// Upload a file (simple, < 4 MB)
await graphClient.api(`/me/drive/root:/${path}:/content`).put(fileBuffer);

// Upload a large file using the built-in large-file task
const uploadSession = await graphClient
  .api('/me/drive/root:/Documents/file.pdf:/createUploadSession')
  .post({});
// OneDriveLargeFileUploadTask handles chunking automatically
```

---

## New Dependencies: Dropbox

### `dropbox`

| Package | Version | Purpose | Install as |
|---------|---------|---------|-----------|
| `dropbox` | ^10.34.0 | Official Dropbox API v2 SDK — OAuth2 flow, file upload (including session uploads), download, and temporary link generation | production |

**Why the official `dropbox` SDK and not raw fetch:**
The `dropbox` npm package is the official Dropbox JavaScript/TypeScript SDK. It provides:
- `DropboxAuth` class for OAuth2 authorization code flow and automatic token refresh
- `checkAndRefreshAccessToken()` which detects token expiry and calls the refresh endpoint automatically when a refresh token and app key are set
- Typed wrappers for all API v2 endpoints including `filesUploadSessionStart`, `filesUploadSessionAppendV2`, `filesUploadSessionFinish` for chunked uploads
- `filesGetTemporaryLink` for generating short-lived download URLs (4-hour TTL)

Raw fetch is viable since Dropbox API v2 is a simple JSON/HTTP API, but the SDK eliminates boilerplate for token refresh and chunked uploads, both of which are required here.

**Token storage pattern for Vercel serverless:**
`DropboxAuth` manages tokens in memory. Restore from Postgres on each request:

```typescript
import { DropboxAuth, Dropbox } from 'dropbox';

const dbxAuth = new DropboxAuth({
  clientId: process.env.DROPBOX_APP_KEY,
  clientSecret: process.env.DROPBOX_APP_SECRET,
});

// Rehydrate from Postgres
dbxAuth.setAccessToken(org.dropbox_access_token);
dbxAuth.setAccessTokenExpiresAt(new Date(org.dropbox_token_expiry));
dbxAuth.setRefreshToken(org.dropbox_refresh_token);

// SDK auto-refreshes when access token is expired if refresh token + client credentials are set
await dbxAuth.checkAndRefreshAccessToken();

// Persist new tokens back if refreshed
const freshAccessToken = await dbxAuth.getAccessToken();
if (freshAccessToken !== org.dropbox_access_token) {
  await db.from('organisations').update({
    dropbox_access_token: freshAccessToken,
    dropbox_token_expiry: dbxAuth.getAccessTokenExpiresAt().getTime(),
  }).eq('id', orgId);
}

const dbx = new Dropbox({ auth: dbxAuth });
```

**OAuth2 scope to request:** `files.content.write files.content.read`

Dropbox uses scoped OAuth2. `files.content.write` and `files.content.read` are the minimum required. Do NOT request `account_info.read` or `files.metadata.read/write` unless the UI requires them — fewer scopes mean faster user consent and smaller blast radius if tokens are compromised.

**Important — offline access:** Set `token_access_type=offline` in the authorization URL. Without this, Dropbox returns only a short-lived access token and no refresh token, requiring re-authorization every 4 hours.

```typescript
// Authorization URL generation
const authUrl = await dbxAuth.getAuthenticationUrl(
  redirectUri,
  state,
  'code',        // response_type
  'offline',     // token_access_type — REQUIRED for refresh tokens
  ['files.content.write', 'files.content.read'],
);
```

---

## No Shared OAuth2 Helper Library Needed

A shared helper like `simple-oauth2` or `openid-client` might seem appealing for handling all three providers uniformly. Do not add one. Each provider has significant idiosyncrasies:

- Google uses the `tokens` event on `OAuth2Client` for refresh notifications
- Microsoft requires the `ICachePlugin` interface and the `/common` authority
- Dropbox requires `token_access_type=offline` and `checkAndRefreshAccessToken()`

A shared abstraction would flatten these differences into either a leaky abstraction or a lowest-common-denominator that handles none of them correctly. The provider-agnostic interface belongs in `lib/documents/storage.ts` (the existing storage abstraction layer), not in the OAuth layer.

---

## Database Schema Additions

The following columns are needed on the `organisations` table (to be added via Supabase migration):

```sql
-- Storage backend selector
ALTER TABLE organisations
  ADD COLUMN storage_backend text NOT NULL DEFAULT 'supabase'
    CHECK (storage_backend IN ('supabase', 'google_drive', 'onedrive', 'dropbox'));

-- Google Drive OAuth tokens
ALTER TABLE organisations
  ADD COLUMN google_access_token  text,
  ADD COLUMN google_refresh_token text,
  ADD COLUMN google_token_expiry  bigint,   -- milliseconds since epoch
  ADD COLUMN google_drive_folder_id text;   -- root folder ID for Prompt uploads

-- Microsoft OneDrive (MSAL serialized cache blob)
ALTER TABLE organisations
  ADD COLUMN ms_token_cache text,           -- serialized MSAL cache JSON
  ADD COLUMN ms_account_id  text;           -- MSAL account homeAccountId for acquireTokenSilent

-- Dropbox OAuth tokens
ALTER TABLE organisations
  ADD COLUMN dropbox_access_token  text,
  ADD COLUMN dropbox_refresh_token text,
  ADD COLUMN dropbox_token_expiry  bigint;  -- milliseconds since epoch
```

Tokens are sensitive data. RLS on `organisations` already scopes reads to org members. Confirm the `google_refresh_token`, `ms_token_cache`, and `dropbox_refresh_token` columns are NOT exposed through any public API or anon-accessible route.

---

## Environment Variables Required

```bash
# Google Drive
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://app.yourdomain.com/api/auth/google/callback

# Microsoft OneDrive (Entra ID app registration)
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
AZURE_REDIRECT_URI=https://app.yourdomain.com/api/auth/microsoft/callback

# Dropbox
DROPBOX_APP_KEY=
DROPBOX_APP_SECRET=
DROPBOX_REDIRECT_URI=https://app.yourdomain.com/api/auth/dropbox/callback
```

Register OAuth apps at:
- Google: [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)
- Microsoft: [Azure Portal → App registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps)
- Dropbox: [Dropbox App Console](https://www.dropbox.com/developers/apps)

---

## Installation

```bash
# Google Drive
npm install @googleapis/drive@^20.1.0 google-auth-library@^10.6.1

# Microsoft OneDrive
npm install @azure/msal-node@^5.0.5 @microsoft/microsoft-graph-client@^3.0.7

# Dropbox
npm install dropbox@^10.34.0
```

No dev-only packages are needed — these are all production runtime dependencies.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Google Drive SDK | `@googleapis/drive` | `googleapis` (full package) | `googleapis` is 199 MB unpacked — 86x larger than the scoped package. Bloats every serverless function that imports it. No benefit for Drive-only use. |
| Google Drive SDK | `@googleapis/drive` | Raw `fetch` to Drive REST API | Viable but tedious — multipart upload construction, resumable upload session management, and error handling are non-trivial. The scoped package is small enough that raw fetch offers no meaningful size advantage. |
| Google Auth | `google-auth-library` | `simple-oauth2` | `simple-oauth2` is a generic OAuth2 library and does not handle Google-specific token events or the `credentials` object format expected by `@googleapis/drive`. Would require manual adapter code. |
| OneDrive auth | `@azure/msal-node` | `simple-oauth2` | Microsoft's `/common` authority, client assertion patterns, and MSAL cache serialization are non-standard. `simple-oauth2` handles none of them. Would require manual implementation of every behavior MSAL provides. |
| OneDrive auth | `@azure/msal-node` | `@azure/identity` | `@azure/identity` is for machine-to-machine Azure SDK authentication (service principals, managed identities). It does not support user OAuth2 authorization code flow. |
| OneDrive API | `@microsoft/microsoft-graph-client` | Raw `fetch` to Graph API | Graph client provides `OneDriveLargeFileUploadTask` which handles chunked upload sessions automatically. Files larger than 4 MB require upload sessions — implementing this with raw fetch is complex. |
| Dropbox SDK | `dropbox` (official) | Raw `fetch` to Dropbox API v2 | The SDK provides `checkAndRefreshAccessToken()` and typed upload session methods. Token refresh and chunked uploads in raw fetch require significant boilerplate for marginal benefit. |
| Shared OAuth helper | (none) | `simple-oauth2`, `openid-client` | Each provider has idiosyncrasies (Google token events, MSAL ICachePlugin, Dropbox offline type). A shared abstraction either leaks these differences or handles none correctly. Provider-specific SDKs are the right layer. |

---

## What NOT to Add

| Do Not Add | Why | Use Instead |
|------------|-----|-------------|
| `googleapis` (full package) | 199 MB unpacked — contains every Google API. Bloats every serverless function. Hits cold start performance on Vercel. | `@googleapis/drive` (2.3 MB) |
| `@azure/identity` | Wrong use case — for Azure service identities, not user OAuth2 flows. Lacks authorization code grant support. | `@azure/msal-node` |
| `@azure/msal-browser` | Browser-only package. Next.js route handlers and server actions run in Node.js. Using it server-side causes crashes. | `@azure/msal-node` |
| `passport` + provider strategies | Passport is a good choice for user authentication, but we already use Supabase Auth for that. Adding Passport for provider OAuth would create a parallel auth system with session storage conflicts. | Implement the OAuth2 code grant directly in route handlers using provider SDKs. |
| `next-auth` (Auth.js) | Next-auth manages user sessions — already handled by Supabase Auth. Adding next-auth to manage provider tokens would conflict with the existing Supabase session. Provider tokens are stored in Postgres columns, not next-auth sessions. | Store tokens directly in `organisations` table. |
| `@googleapis/sheets`, `@googleapis/gmail`, etc. | Not needed. Install only `@googleapis/drive`. | (nothing — just don't install them) |
| `dropbox-v2-api` (npm, third-party wrapper) | Unofficial wrapper — older, lower maintenance than the official `dropbox` SDK. No advantage. | `dropbox` (official Dropbox SDK) |
| `node-fetch` | Next.js 16 App Router runs in a Node.js environment that has native `fetch`. All three provider SDKs work with native fetch. No polyfill needed. | Native `fetch` |

---

## Vercel Serverless Compatibility Summary

| Concern | Impact | Mitigation |
|---------|--------|------------|
| No persistent in-memory state between invocations | OAuth tokens stored in RAM would be lost | Store all tokens in Postgres `organisations` columns; rehydrate on each request |
| 250 MB uncompressed function size limit | `googleapis` (199 MB) would likely exceed limit when combined with other deps | Use `@googleapis/drive` (2.3 MB) only |
| 4.5 MB request payload limit | File uploads through Next.js route handler still subject to this limit | For provider backends, fetch bytes from email attachment (already in memory) or Supabase Storage and re-upload via SDK. Do NOT proxy uploads through Next.js for large files — use direct SDK upload from the inbound webhook handler or background process. |
| No native bindings | Some SDKs require native modules (e.g., `@azure/msal-node-extensions` for local key storage) | All three recommended packages are pure JS/TypeScript — no native bindings. Do NOT add `@azure/msal-node-extensions` (uses OS credential stores, incompatible with Vercel). |
| Cold start latency | Large packages increase cold start | Scoped packages (`@googleapis/drive`, not `googleapis`) minimize this. |

---

## Version Compatibility

| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| `@googleapis/drive` | ^20.1.0 | Node.js 18+, Next.js App Router | Pure TS/JS — no native bindings. Works in Vercel serverless. |
| `google-auth-library` | ^10.6.1 | Node.js 18+, `@googleapis/drive` | Peer dependency of `@googleapis/drive`. Install explicitly for `OAuth2Client` import. |
| `@azure/msal-node` | ^5.0.5 | Node.js 18+, Next.js App Router | Pure JS — no native bindings. ICachePlugin for external token persistence. |
| `@microsoft/microsoft-graph-client` | ^3.0.7 | `@azure/msal-node`, Node.js 18+ | v3 is the current major. Works with MSAL auth provider pattern. |
| `dropbox` | ^10.34.0 | Node.js 18+, Next.js App Router | Works in ESM and CJS environments. |

---

## Sources

- [npm registry — @googleapis/drive v20.1.0](https://www.npmjs.com/package/@googleapis/drive) — version confirmed, 2.3 MB unpacked size (HIGH confidence)
- [npm registry — googleapis v171.4.0](https://www.npmjs.com/package/googleapis) — 199 MB unpacked size confirmed via `npm show --json` (HIGH confidence)
- [npm registry — google-auth-library v10.6.1](https://www.npmjs.com/package/google-auth-library) — version confirmed (HIGH confidence)
- [npm registry — @azure/msal-node v5.0.5](https://www.npmjs.com/package/@azure/msal-node) — version confirmed (HIGH confidence)
- [npm registry — @microsoft/microsoft-graph-client v3.0.7](https://www.npmjs.com/package/@microsoft/microsoft-graph-client) — version confirmed (HIGH confidence)
- [npm registry — dropbox v10.34.0](https://www.npmjs.com/package/dropbox) — version confirmed (HIGH confidence)
- [Google Drive API Scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth) — `drive.file` scope is minimum permission, restricts to app-created files (HIGH confidence)
- [Dropbox OAuth Guide](https://developers.dropbox.com/oauth-guide) — `token_access_type=offline` required for refresh tokens (HIGH confidence)
- [DropboxAuth SDK docs](https://dropbox.github.io/dropbox-sdk-js/DropboxAuth.html) — `checkAndRefreshAccessToken`, `setRefreshToken`, `setAccessTokenExpiresAt` methods confirmed (HIGH confidence)
- [MSAL Node token caching — Microsoft Learn](https://learn.microsoft.com/en-us/entra/msal/javascript/node/caching) — `ICachePlugin` interface, `beforeCacheAccess`/`afterCacheAccess` pattern (HIGH confidence)
- [MSAL Node best practices for serverless — Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/780890/best-practices-for-using-msal-node-and-microsoft-g) — recommendation to persist cache to external storage (MEDIUM confidence — Q&A not official docs, consistent with official caching guide)
- [Upload large files — Microsoft Graph SDKs](https://learn.microsoft.com/en-us/graph/sdks/large-file-upload) — `OneDriveLargeFileUploadTask` for files > 4 MB (HIGH confidence)
- [Vercel function size limit — Vercel KB](https://vercel.com/kb/guide/troubleshooting-function-250mb-limit) — 250 MB uncompressed, not configurable (HIGH confidence)
- [Authorization for OneDrive API via Microsoft Graph](https://learn.microsoft.com/en-us/onedrive/developer/rest-api/getting-started/graph-oauth?view=odsp-graph-online) — `/common` authority for personal + M365 accounts, `offline_access` scope for refresh tokens (HIGH confidence)

---

*Stack research for: Prompt v5.0 — Third-Party Cloud Storage Integrations (Google Drive, OneDrive, Dropbox)*
*Researched: 2026-02-28*
*Confidence: HIGH — all package versions verified against npm registry; bundle sizes verified via npm show --json; OAuth2 scope requirements and token refresh patterns verified against official provider documentation*
