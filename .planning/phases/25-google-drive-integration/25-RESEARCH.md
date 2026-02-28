# Phase 25: Google Drive Integration - Research

**Researched:** 2026-02-28
**Domain:** Google Drive API v3, OAuth2 Web Server Flow, Token Refresh Architecture, Server-Proxied Downloads
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GDRV-01 | Accountant initiates Google Drive connection from Settings via OAuth2 authorization URL using `drive.file` scope only | OAuth2 web server flow documented; `drive.file` is non-sensitive (no Google verification process); `generateAuthUrl()` with `access_type=offline`, `scope`, `state` parameter for CSRF |
| GDRV-02 | OAuth2 callback route validates `state` parameter for CSRF protection, exchanges authorization code for tokens, stores encrypted refresh and access tokens in `organisations` via `encryptToken()` | `oauth2Client.getToken(code)` returns `{tokens}` containing `refresh_token` and `access_token`; state validation = compare stored state vs returned state; `encryptToken()` is ready from Phase 24 |
| GDRV-03 | Root folder `Prompt/` auto-created in accountant's Google Drive on first OAuth connect; folder ID stored in `organisations.google_drive_folder_id` | `files.create` with `mimeType: 'application/vnd.google-apps.folder'` creates a folder; response `.data.id` is the folder ID; `google_drive_folder_id` column needs migration in this phase |
| GDRV-04 | Files uploaded to human-readable folder structure: `Prompt/{client_name}/{filing_type}/{tax_year}/filename` | `files.create` with `parents: [parentFolderId]` places file in folder; sub-folder creation uses same pattern; all intermediate folders auto-created on connect or lazily at upload time |
| GDRV-05 | `withTokenRefresh(orgId, call)` utility in `lib/storage/token-refresh.ts` proactively refreshes access token before expiry; on `invalid_grant` fatal error: sets `storage_backend_status='reauth_required'`, nulls encrypted token columns, never retries | `err.response.data.error === 'invalid_grant'` detection; `oauth2Client.refreshAccessToken()` for proactive refresh; `expiry_date` on stored credentials for pre-expiry check |
| GDRV-06 | Document downloads served via server-proxied API response when Google Drive backend is active (`drive.file` scope does not produce publicly accessible temporary URLs) | `drive.files.get({fileId, alt: 'media'}, {responseType: 'stream'})` streams file bytes server-side; proxy route buffers and returns bytes; `drive.file` scope confirmed to work for files created by the app |
| GDRV-07 | Portal upload route and Postmark inbound email attachment handler route file bytes to Google Drive API when org has `storage_backend = 'google_drive'` | Portal route uses `uploadDocument()` (deprecated); upgrade to `resolveProvider(orgConfig).upload(params)` which calls `GoogleDriveProvider.upload()`; Drive API `files.create` with `parents` parameter |
| GDRV-08 | DSAR export fetches file bytes from Google Drive API for `client_documents` rows where `storage_backend = 'google_drive'` | DSAR route currently uses `getSignedDownloadUrl()` then `fetch()`; upgrade to `resolveProvider(orgConfig).getBytes(storagePath)` where `storagePath` is the Drive file ID; `GoogleDriveProvider.getBytes()` calls `files.get` with `alt=media` |
| GDRV-09 | Accountant can disconnect Google Drive from Settings; encrypted token columns cleared from `organisations`; `storage_backend` reset to `supabase` | Admin client UPDATE on `organisations`: set `_enc` columns to NULL, `storage_backend = 'supabase'`, `storage_backend_status = NULL`, `google_drive_folder_id = NULL` |
</phase_requirements>

---

## Summary

Phase 25 builds on the Phase 24 foundation (StorageProvider interface, AES-256-GCM encryption, schema columns) to implement the complete Google Drive integration. Three technical areas require care: the OAuth2 flow including CSRF state protection, the `GoogleDriveProvider` class implementing the `StorageProvider` interface, and the server-proxied download pattern required because `drive.file` scope does not produce publicly accessible URLs.

The key library choice is `@googleapis/drive@^20.1.0` (latest as of 2026-02-28) — the scoped package at ~2.3 MB versus the full `googleapis` package at 199 MB which would risk hitting Vercel's 250 MB function size limit (this decision is locked in STATE.md v5.0). The `google-auth-library` package (already a dependency of `@googleapis/drive`) handles OAuth2 token exchange and refresh via `OAuth2Client`. Token refresh must be implemented manually for the serverless context — the `tokens` event and automatic refresh are unreliable in short-lived function contexts; instead, `withTokenRefresh()` in `lib/storage/token-refresh.ts` proactively checks expiry before each API call.

The `drive.file` scope is confirmed sufficient: it allows creating files, reading files the app created, and downloading file bytes via `alt=media`. It avoids Google's restricted-scope verification process (which applies to `drive`, `drive.readonly`, and `drive.metadata`). One critical constraint: `drive.file` does NOT produce temporary public URLs — all downloads must be server-proxied. The download route must stream or buffer bytes from the Drive API and return them in the HTTP response, with the Drive file ID never exposed to the browser.

**Primary recommendation:** Build in plan order: (1) schema migration for `google_drive_folder_id` and `google_token_expires_at`, (2) `GoogleDriveProvider` class implementing `StorageProvider`, (3) `withTokenRefresh()` wrapper, (4) OAuth2 connect/callback routes and Settings UI, (5) update portal upload + inbound + DSAR routes, (6) disconnect action and re-auth banner in layout.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@googleapis/drive` | `^20.1.0` (latest, published ~2026-02-07) | Drive API v3 calls (upload, download, folder create) | Scoped package at ~2.3 MB vs full `googleapis` 199 MB; exactly the same API surface for Drive; locked decision in STATE.md |
| `google-auth-library` | `^9.x` (peer dep of @googleapis/drive) | OAuth2Client for auth URL, code exchange, token refresh | Official Google auth library; bundled via @googleapis/drive peer dependency; `OAuth2Client.generateAuthUrl()`, `.getToken()`, `.setCredentials()`, `.refreshAccessToken()` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js `crypto` (built-in) | Node 20 | AES-256-GCM encryption via `lib/crypto/tokens.ts` from Phase 24 | Already exists; never import separately for token encryption |
| `@supabase/supabase-js` | `^2.95.3` (already installed) | Admin client for updating `organisations` token columns | Use admin client for all organisations token writes (bypasses RLS) |

### Alternatives Considered (and why rejected, per STATE.md)

| Instead of | Could Use | Why Rejected |
|------------|-----------|-------------|
| `@googleapis/drive@^20.1.0` | Full `googleapis` | Full package is 199 MB; Vercel function limit is 250 MB; too close to the limit — locked in STATE.md |
| Server-proxied download | Generating a temporary sharing link | `drive.file` scope cannot create public sharing links; sharing requires broader `drive` scope |
| Lazy OAuth2Client construction | Module-level instantiation | Module-level crashes Next.js build if env vars absent; follow same pattern as Stripe client (D-11-05-01) |

**Installation:**
```bash
npm install @googleapis/drive
```
(`google-auth-library` is a peer dependency and will be installed automatically)

---

## Architecture Patterns

### Recommended Project Structure

```
lib/
├── storage/
│   ├── provider.ts           # (Phase 24) StorageProvider interface — already exists
│   ├── token-refresh.ts      # (Phase 25 new) withTokenRefresh() utility
│   └── google-drive.ts       # (Phase 25 new) GoogleDriveProvider class
├── documents/
│   └── storage.ts            # (Phase 24) resolveProvider() factory — add google_drive case
├── crypto/
│   └── tokens.ts             # (Phase 24) encryptToken/decryptToken — already exists
app/
├── api/
│   └── auth/
│       └── google-drive/
│           ├── connect/route.ts    # (Phase 25 new) generate OAuth2 URL + set state cookie
│           └── callback/route.ts  # (Phase 25 new) exchange code, store tokens, create folder
└── (dashboard)/
    └── settings/
        └── components/
            └── storage-card.tsx   # (Phase 25 new) Google Drive connect/disconnect card
```

Note: `lib/storage/` and `lib/documents/storage.ts` — the StorageProvider interface was placed in `lib/documents/storage.ts` in Phase 24. The `GoogleDriveProvider` implementation should be a separate file (e.g. `lib/storage/google-drive.ts`) to keep file sizes manageable. The `resolveProvider()` factory in `lib/documents/storage.ts` needs to be updated to import and return `GoogleDriveProvider` for the `google_drive` case.

### Pattern 1: OAuth2 Web Server Flow with CSRF State Protection

**What:** The OAuth2 "web server" flow for user-facing authorization. The app generates a random `state` token, stores it in an HttpOnly cookie (short TTL), redirects to Google, receives the callback with `code` and `state`, validates `state`, then exchanges `code` for tokens.

**When to use:** Any user-facing OAuth2 integration where the user must authorize the app on Google's consent screen.

**Source:** Google Identity docs — https://developers.google.com/identity/protocols/oauth2/web-server

**Example — Connect Route (generate auth URL):**
```typescript
// app/api/auth/google-drive/connect/route.ts
import { google } from '@googleapis/drive';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

function getOAuth2Client() {
  // Lazy init — mirrors Stripe client pattern (D-11-05-01)
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI!, // e.g. https://app.getprompt.app/api/auth/google-drive/callback
  );
}

export async function GET(request: Request) {
  const oauth2Client = getOAuth2Client();
  const state = crypto.randomBytes(32).toString('hex'); // CSRF token

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/drive.file'],
    state,
    prompt: 'consent', // Force consent screen to always return refresh_token
  });

  const response = NextResponse.redirect(authUrl);
  // Store state in HttpOnly cookie; short TTL (10 min) prevents replay
  response.cookies.set('google_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  return response;
}
```

**CRITICAL — `prompt: 'consent'`:** Without this, Google only returns a refresh_token on the VERY FIRST authorization. If the user has previously authorized the app (or if the token was revoked), subsequent authorizations WITHOUT `prompt: 'consent'` will not return a new refresh_token. Always include `prompt: 'consent'` to guarantee a fresh refresh_token is returned.

**Example — Callback Route (exchange code, store tokens, create root folder):**
```typescript
// app/api/auth/google-drive/callback/route.ts
import { google } from '@googleapis/drive';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { encryptToken } from '@/lib/crypto/tokens';
import { getOrgContext } from '@/lib/auth/org-context';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  const storedState = request.cookies.get('google_oauth_state')?.value;

  // CSRF validation — reject if state mismatch
  if (!returnedState || !storedState || returnedState !== storedState) {
    return NextResponse.redirect('/settings?error=invalid_state');
  }

  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code!);
  // tokens: { access_token, refresh_token, expiry_date, token_type, scope }

  if (!tokens.refresh_token) {
    // This should not happen with prompt=consent, but guard anyway
    return NextResponse.redirect('/settings?error=no_refresh_token');
  }

  const { orgId } = await getOrgContext();
  const admin = createAdminClient();

  // Create the root Prompt/ folder in the user's Drive
  oauth2Client.setCredentials(tokens);
  const driveClient = google.drive({ version: 'v3', auth: oauth2Client });
  const folder = await driveClient.files.create({
    requestBody: {
      name: 'Prompt',
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id',
  });
  const rootFolderId = folder.data.id!;

  // Encrypt tokens before writing to DB — never write plaintext
  await admin.from('organisations').update({
    storage_backend: 'google_drive',
    storage_backend_status: 'active',
    google_access_token_enc: encryptToken(tokens.access_token!),
    google_refresh_token_enc: encryptToken(tokens.refresh_token),
    google_token_expires_at: new Date(tokens.expiry_date!).toISOString(),
    google_drive_folder_id: rootFolderId,
  }).eq('id', orgId);

  const response = NextResponse.redirect('/settings?tab=storage&connected=google_drive');
  response.cookies.delete('google_oauth_state'); // consume state — prevent replay
  return response;
}
```

### Pattern 2: withTokenRefresh() — Proactive Token Refresh Wrapper

**What:** A wrapper function that checks if the stored access token will expire within 5 minutes, refreshes it if so, then executes the Drive API call. On `invalid_grant` (fatal error), it sets `storage_backend_status = 'reauth_required'`, nulls the token columns, and re-throws — no retry.

**Why critical:** Serverless functions cannot rely on the `tokens` event or automatic refresh because each invocation is stateless. The OAuth2Client must be reconstructed from stored credentials on every call.

**`invalid_grant` detection:** `err.response?.data?.error === 'invalid_grant'` — this is the documented detection pattern per Google's error codes and community-verified in the googleapis GitHub issues.

**Source:** https://github.com/googleapis/google-api-nodejs-client/issues/2494

**Example:**
```typescript
// lib/storage/token-refresh.ts
import { google } from '@googleapis/drive';
import { createAdminClient } from '@/lib/supabase/admin';
import { encryptToken, decryptToken } from '@/lib/crypto/tokens';

interface GoogleCredentials {
  access_token_enc: string;
  refresh_token_enc: string;
  expires_at: string; // ISO timestamp
  org_id: string;
}

export async function withTokenRefresh<T>(
  creds: GoogleCredentials,
  call: (auth: ReturnType<typeof buildOAuth2Client>) => Promise<T>
): Promise<T> {
  const oauth2Client = buildOAuth2Client();

  // Proactively refresh if token expires within 5 minutes
  const expiresAt = new Date(creds.expires_at).getTime();
  const fiveMinFromNow = Date.now() + 5 * 60 * 1000;

  let accessToken = decryptToken(creds.access_token_enc);
  if (expiresAt < fiveMinFromNow) {
    const refreshToken = decryptToken(creds.refresh_token_enc);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      accessToken = credentials.access_token!;
      // Persist the refreshed token
      const admin = createAdminClient();
      await admin.from('organisations').update({
        google_access_token_enc: encryptToken(credentials.access_token!),
        google_token_expires_at: new Date(credentials.expiry_date!).toISOString(),
        storage_backend_status: 'active',
      }).eq('id', creds.org_id);
    } catch (err: any) {
      if (err.response?.data?.error === 'invalid_grant') {
        // Fatal: token revoked, password changed, or 50-token limit hit
        const admin = createAdminClient();
        await admin.from('organisations').update({
          storage_backend_status: 'reauth_required',
          google_access_token_enc: null,
          google_refresh_token_enc: null,
          google_token_expires_at: null,
        }).eq('id', creds.org_id);
      }
      throw err; // Always re-throw — caller must handle
    }
  }

  oauth2Client.setCredentials({ access_token: accessToken });
  try {
    return await call(oauth2Client);
  } catch (err: any) {
    if (err.response?.data?.error === 'invalid_grant') {
      // Catch invalid_grant at call time too (e.g. access token revoked mid-flight)
      const admin = createAdminClient();
      await admin.from('organisations').update({
        storage_backend_status: 'reauth_required',
        google_access_token_enc: null,
        google_refresh_token_enc: null,
        google_token_expires_at: null,
      }).eq('id', creds.org_id);
    }
    throw err;
  }
}
```

### Pattern 3: GoogleDriveProvider — StorageProvider Implementation

**What:** Implements the `StorageProvider` interface from Phase 24 (`lib/documents/storage.ts`) using the Google Drive API.

**Key implementation notes:**
- `storagePath` for Google Drive = the Drive file ID (not a path string like Supabase)
- `upload()`: creates intermediate folders lazily, then calls `files.create()` with `parents`
- `getDownloadUrl()`: NOT used for Google Drive — returns a sentinel indicating server-proxy required. The download route calls `getBytes()` directly instead.
- `getBytes()`: calls `files.get({ fileId, alt: 'media' }, { responseType: 'stream' })` and collects the stream into a Buffer
- The provider constructor takes `orgId` and loads tokens from DB lazily

**Example — Core upload and getBytes:**
```typescript
// lib/storage/google-drive.ts
import { google } from '@googleapis/drive';
import { Readable } from 'stream';
import { createAdminClient } from '@/lib/supabase/admin';
import { decryptToken } from '@/lib/crypto/tokens';
import { withTokenRefresh } from './token-refresh';
import type { StorageProvider, UploadParams } from '@/lib/documents/storage';

export class GoogleDriveProvider implements StorageProvider {
  constructor(private readonly orgId: string, private readonly rootFolderId: string) {}

  async upload(params: UploadParams): Promise<{ storagePath: string }> {
    const admin = createAdminClient();
    const { data: org } = await admin.from('organisations')
      .select('google_access_token_enc, google_refresh_token_enc, google_token_expires_at')
      .eq('id', this.orgId)
      .single();
    if (!org?.google_access_token_enc) throw new Error('Google Drive not connected');

    return withTokenRefresh(
      { access_token_enc: org.google_access_token_enc, refresh_token_enc: org.google_refresh_token_enc!, expires_at: org.google_token_expires_at!, org_id: this.orgId },
      async (auth) => {
        const drive = google.drive({ version: 'v3', auth });
        // Ensure folder structure exists: Prompt/{client_name}/{filing_type}/{tax_year}/
        const folderId = await ensureFolderPath(drive, this.rootFolderId, [
          params.clientName, // Add clientName to UploadParams
          params.filingTypeId,
          params.taxYear,
        ]);
        // Upload file into the leaf folder
        const readable = Readable.from(params.file);
        const file = await drive.files.create({
          requestBody: {
            name: params.originalFilename,
            parents: [folderId],
          },
          media: { mimeType: params.mimeType, body: readable },
          fields: 'id',
        });
        return { storagePath: file.data.id! }; // Drive file ID is the storagePath
      }
    );
  }

  async getBytes(storagePath: string): Promise<Buffer> {
    const admin = createAdminClient();
    const { data: org } = await admin.from('organisations')
      .select('google_access_token_enc, google_refresh_token_enc, google_token_expires_at')
      .eq('id', this.orgId)
      .single();
    if (!org?.google_access_token_enc) throw new Error('Google Drive not connected');

    return withTokenRefresh(
      { access_token_enc: org.google_access_token_enc, refresh_token_enc: org.google_refresh_token_enc!, expires_at: org.google_token_expires_at!, org_id: this.orgId },
      async (auth) => {
        const drive = google.drive({ version: 'v3', auth });
        const res = await drive.files.get(
          { fileId: storagePath, alt: 'media' },
          { responseType: 'stream' }
        );
        return streamToBuffer(res.data as unknown as NodeJS.ReadableStream);
      }
    );
  }

  async getDownloadUrl(_storagePath: string): Promise<{ url: string }> {
    // drive.file scope cannot generate public URLs — must use server-proxy via getBytes()
    // This method must not be called for Google Drive; the download route calls getBytes() directly
    throw new Error('getDownloadUrl() is not available for Google Drive backend. Use server-proxy download route.');
  }

  async delete(storagePath: string): Promise<void> {
    const admin = createAdminClient();
    const { data: org } = await admin.from('organisations')
      .select('google_access_token_enc, google_refresh_token_enc, google_token_expires_at')
      .eq('id', this.orgId)
      .single();
    if (!org?.google_access_token_enc) throw new Error('Google Drive not connected');

    return withTokenRefresh(
      { access_token_enc: org.google_access_token_enc, refresh_token_enc: org.google_refresh_token_enc!, expires_at: org.google_token_expires_at!, org_id: this.orgId },
      async (auth) => {
        const drive = google.drive({ version: 'v3', auth });
        await drive.files.delete({ fileId: storagePath });
      }
    );
  }
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}
```

### Pattern 4: Server-Proxied Download Route

**What:** Because `drive.file` scope cannot produce public URLs, the existing download action in `app/api/clients/[id]/documents/route.ts` (the `action === 'download'` handler) must detect the storage backend and return file bytes directly when the backend is `google_drive`.

**When to use:** Any time `doc.storage_backend === 'google_drive'` in the download action.

**Approach:** The download handler currently calls `getSignedDownloadUrl()` and returns the URL to the client. For Google Drive, it must instead call `provider.getBytes()`, write the bytes to the response, and return a `Content-Disposition: attachment` response directly. The Drive file ID must never be returned to the browser.

```typescript
// In app/api/clients/[id]/documents/route.ts — download action
if (doc.storage_backend === 'google_drive') {
  const { data: orgData } = await serviceSupabase.from('organisations')
    .select('id, storage_backend, google_drive_folder_id')
    .eq('id', doc.org_id)
    .single();
  const provider = resolveProvider({ id: orgData.id, storage_backend: orgData.storage_backend });
  const bytes = await provider.getBytes(doc.storage_path); // storage_path = Drive file ID

  // Log access before returning bytes
  await serviceSupabase.from('document_access_log').insert({ ... });

  return new Response(bytes, {
    headers: {
      'Content-Type': doc.mime_type ?? 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${doc.original_filename}"`,
    },
  });
}
// Existing Supabase path unchanged
const { signedUrl } = await getSignedDownloadUrl(doc.storage_path);
return NextResponse.json({ signedUrl });
```

### Pattern 5: Re-Auth Banner in Dashboard Layout

**What:** When `storage_backend_status = 'reauth_required'`, a persistent banner appears in the dashboard layout linking to Settings > Storage. Follows the existing read-only mode banner pattern.

**How:** In `app/(dashboard)/layout.tsx`, add an additional query to `organisations` to check `storage_backend_status`. If `reauth_required`, render a banner above the main content.

```typescript
// In dashboard layout — add to org query
const { data: org } = await supabase
  .from('organisations')
  .select('name, storage_backend_status')
  .eq('id', orgId)
  .single();

const needsReauth = org?.storage_backend_status === 'reauth_required';
```

```tsx
{needsReauth && (
  <div className="bg-red-50 border-b border-red-200 px-8 py-3">
    <div className="max-w-7xl mx-auto flex items-center justify-between">
      <p className="text-sm text-red-800">
        Your Google Drive connection has expired. Re-connect to continue storing documents.
      </p>
      <a href="/settings?tab=storage" className="text-sm font-medium text-red-900 hover:text-red-700 underline">
        Reconnect Google Drive
      </a>
    </div>
  </div>
)}
```

### Anti-Patterns to Avoid

- **NOT using `prompt: 'consent'` in generateAuthUrl:** Google only returns a `refresh_token` on first authorization. Without `prompt: 'consent'`, re-authorizations after token revocation will not return a refresh token — leaving the org permanently unable to refresh.
- **Relying on `oauth2Client` auto-refresh in serverless:** The `tokens` event and library auto-refresh only work when the same `oauth2Client` instance persists across multiple calls. In serverless, each function invocation creates a new instance. Always proactively check expiry and refresh manually.
- **Using `storage_path` as a human-readable path for Google Drive:** For Google Drive, `storage_path` on `client_documents` must be the Drive **file ID** (opaque string like `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs`), NOT a folder path. The human-readable folder structure is for the user's Drive UI only — routing in code uses the file ID.
- **Returning the Drive file ID to the browser:** The file ID in `storage_path` must never be exposed in API responses. Server-proxied download handles this — the client never sees the ID.
- **Publishing status "Testing" in production:** Google OAuth apps in "Testing" status issue refresh tokens that expire after 7 days. The OAuth consent screen must be set to "In Production" status before real firms connect. This is a hard gate.
- **Writing `_enc` columns without `encryptToken()`:** Follow Phase 24 convention — any column with `_enc` suffix must have values produced by `encryptToken()`.
- **Calling `getDownloadUrl()` for Google Drive documents:** The `getDownloadUrl()` method throws for `GoogleDriveProvider`. All download routes must check `doc.storage_backend` and call `getBytes()` for `google_drive` docs.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth2 code exchange | Manual fetch to `oauth2.googleapis.com/token` | `oauth2Client.getToken(code)` | Edge cases: error handling, URL encoding, auth header format — SDK handles all correctly |
| Access token refresh | Manual fetch with refresh_token | `oauth2Client.refreshAccessToken()` | Error codes (`invalid_grant`, `token_expired`) are normalized by the SDK |
| Drive file upload | Raw multipart HTTP request | `drive.files.create({requestBody, media})` | Resumable upload, retry on 5xx, content-length handling — SDK handles automatically |
| Folder existence check | List files by name and check response | Store folder IDs explicitly; create lazily on upload if missing | Listing is slower and racey; storing IDs at create time is O(1) |
| Buffer stream from Drive | Custom stream parser | `streamToBuffer(res.data)` pattern | Drive returns a ReadableStream; collect chunks into Buffer for JSZip compatibility |
| State/CSRF token storage | Supabase table | HttpOnly cookie (short TTL, single use) | Lower latency; no DB round-trip; consumed and deleted in callback; maxAge=600 prevents stale state |

---

## Common Pitfalls

### Pitfall 1: Missing `prompt: 'consent'` — No Refresh Token on Re-Authorization

**What goes wrong:** The accountant disconnects Google Drive and reconnects, or their token is revoked. The OAuth callback receives an `access_token` but no `refresh_token` because Google only issues the refresh token on first authorization per user per app.

**Why it happens:** Google's documentation states: "the refresh token is only returned on the first authorization." Subsequent authorizations using `access_type=offline` without `prompt=consent` do NOT re-issue the refresh_token.

**How to avoid:** Always include `prompt: 'consent'` in `generateAuthUrl()`. This forces the consent screen on every connect, which guarantees a fresh refresh token is returned.

**Warning signs:** `tokens.refresh_token` is undefined in the callback despite `access_type: 'offline'` — guard with explicit check and redirect to error.

### Pitfall 2: OAuth App in "Testing" Status — 7-Day Refresh Token Expiry

**What goes wrong:** Real accountants connect Google Drive. After 7 days, their refresh tokens expire and `invalid_grant` is returned. `withTokenRefresh()` sets `storage_backend_status = 'reauth_required'` on ALL orgs simultaneously, causing mass re-auth banner for all users.

**Why it happens:** Google OAuth consent screens with "External" user type and "Testing" publishing status issue refresh tokens that expire after 7 days (as a security measure during development).

**How to avoid:** The OAuth consent screen must be set to "In Production" status in Google Cloud Console BEFORE any production firm connects. This is a hard gate — do not deploy the Connect button to production with a Testing-status app.

**Warning signs:** Multiple orgs all hit `invalid_grant` simultaneously exactly 7 days after their connection date.

### Pitfall 3: Google Drive Folder Structure — Duplicate Folder Names

**What goes wrong:** Multiple calls to create `Prompt/ClientName/` result in multiple folders with the same name in Drive. Google Drive allows duplicate names (unlike a filesystem). The app picks one arbitrarily and loses track of the other.

**Why it happens:** `files.create` does not enforce uniqueness. Calling it twice with the same `name` and `parent` creates two folders.

**How to avoid:** Store the parent folder ID returned from `files.create` in the `organisations` table (`google_drive_folder_id`). For sub-folders (client name, filing type, tax year), either: (a) create all sub-folders eagerly at connect time (complexity explosion), or (b) create them lazily at first upload and cache the IDs. Option (b) is simpler — for the client-level folder, create on first upload for that client and store the ID in a lookup table or derive it from `client_id`. For simplicity in Phase 25, create sub-folders on every upload via `files.list` with a `q` query to find-or-create by name.

**Recommended approach:** Create intermediate folders lazily with a `findOrCreateFolder(drive, parentId, name)` helper that: (1) lists files with `q: "name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder'"`, (2) returns the first result if found, (3) creates and returns if not found.

### Pitfall 4: Drive File ID vs Supabase Storage Path in `client_documents.storage_path`

**What goes wrong:** The DSAR export or download route calls `getSignedDownloadUrl(doc.storage_path)` for a Google Drive document. `storage_path` for Google Drive is a file ID (e.g. `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs`), not a Supabase path. Passing it to the Supabase admin client throws a 404 or 400.

**Why it happens:** Both storage backends use `client_documents.storage_path` but with completely different path formats. The column was designed to hold provider-specific identifiers.

**How to avoid:** Always check `doc.storage_backend` before choosing the download method. The `resolveProvider()` factory handles this — the download route must fetch the org's storage config and use `resolveProvider(orgConfig)` rather than calling `getSignedDownloadUrl()` directly. Grep for all direct calls to `getSignedDownloadUrl()` and replace with provider-aware routing.

### Pitfall 5: Vercel Function Timeout on Large File Download Proxy

**What goes wrong:** A large PDF (10+ MB) is stored in Google Drive. The proxy download route reads the stream into a Buffer before responding. For large files, this takes longer than the Vercel function timeout (default 10 seconds for API routes; max 60 seconds with `export const maxDuration = 60`).

**Why it happens:** Buffering the entire file in memory before sending is synchronous from the client's perspective. Large files hit the timeout.

**How to avoid:** Stream the Drive response directly to the Next.js Response instead of buffering. Use `Response` with a `ReadableStream` body. For Phase 25, the simple `Buffer` approach is acceptable for the document sizes in this domain (tax documents are typically < 5 MB). Add a documented size guard (`maxDuration = 60` on download routes). Phase 29 (Hardening) is the right phase to address large-file streaming properly.

**Note on Phase 25 scope:** GDRV-06 says "server-proxied API response" — implement as buffered for simplicity in Phase 25; streaming is Phase 29.

### Pitfall 6: DSAR Mixed-Backend Assembly

**What goes wrong:** The DSAR route fetches all documents for a client. Some have `storage_backend = 'supabase'`, others `storage_backend = 'google_drive'`. The route calls `getSignedDownloadUrl()` for all — fails for Google Drive documents.

**Why it happens:** The DSAR route was written before multi-backend support. It uses `getSignedDownloadUrl()` unconditionally.

**How to avoid:** GDRV-08 requires the DSAR route to be updated to use per-document `storage_backend` routing. The fix: check `doc.storage_backend` in the document loop; call `provider.getBytes(doc.storage_path)` instead of `getSignedDownloadUrl()`. The `resolveProvider()` factory needs the org's config (including Drive token status) to construct the right provider. For Phase 25, the DSAR route must fetch the org's `storage_backend` and token columns, construct the `GoogleDriveProvider` once, and use it for all `google_drive` documents.

---

## Code Examples

Verified patterns from official sources and codebase analysis:

### Creating a Folder in Google Drive

```typescript
// Source: Google Drive API docs — https://developers.google.com/workspace/drive/api/guides/manage-uploads
const folder = await drive.files.create({
  requestBody: {
    name: 'Prompt',
    mimeType: 'application/vnd.google-apps.folder',
    // omit parents = creates in root of user's Drive
  },
  fields: 'id',
});
const folderId = folder.data.id; // Store this in organisations.google_drive_folder_id
```

### Uploading a File to a Specific Folder

```typescript
// Source: Google Drive API docs — https://developers.google.com/workspace/drive/api/guides/manage-uploads
import { Readable } from 'stream';

const readable = Readable.from(fileBuffer); // Convert Buffer to Readable stream
const file = await drive.files.create({
  requestBody: {
    name: originalFilename,
    parents: [parentFolderId], // Place in specific folder
  },
  media: {
    mimeType: mimeType,
    body: readable,
  },
  fields: 'id',
});
const driveFileId = file.data.id; // Store as client_documents.storage_path
```

### Downloading a File as a Buffer

```typescript
// Source: googleapis library — responseType: 'stream' confirmed working
const res = await drive.files.get(
  { fileId: driveFileId, alt: 'media' },
  { responseType: 'stream' }
);
// Collect ReadableStream into Buffer
const buffer = await new Promise<Buffer>((resolve, reject) => {
  const chunks: Buffer[] = [];
  (res.data as unknown as NodeJS.ReadableStream)
    .on('data', chunk => chunks.push(Buffer.from(chunk)))
    .on('error', reject)
    .on('end', () => resolve(Buffer.concat(chunks)));
});
```

### Find-or-Create Folder (prevents duplicate folders)

```typescript
async function findOrCreateFolder(
  drive: ReturnType<typeof google.drive>,
  parentId: string,
  name: string
): Promise<string> {
  // Search for existing folder by name and parent
  const { data } = await drive.files.list({
    q: `name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive',
  });
  if (data.files && data.files.length > 0) {
    return data.files[0].id!;
  }
  // Create the folder
  const { data: folder } = await drive.files.create({
    requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
    fields: 'id',
  });
  return folder.id!;
}
```

### Detecting invalid_grant Error

```typescript
// Source: googleapis GitHub issues #2494 — community-verified detection pattern
try {
  await oauth2Client.refreshAccessToken();
} catch (err: any) {
  if (err.response?.data?.error === 'invalid_grant') {
    // Fatal: revoked token, password change, or 50-token limit
    // → set reauth_required, null token columns, surface banner
  }
  throw err;
}
```

### Schema Migration — New Columns for Phase 25

```sql
-- Phase 25: Add Google Drive-specific columns to organisations
-- google_drive_folder_id: the Drive folder ID of the Prompt/ root folder
-- google_token_expires_at: ISO timestamp; used by withTokenRefresh() to detect pre-expiry
ALTER TABLE organisations
  ADD COLUMN google_drive_folder_id TEXT DEFAULT NULL,
  ADD COLUMN google_token_expires_at TIMESTAMPTZ DEFAULT NULL;
```

---

## Schema Impact

The Phase 24 migration added:
- `organisations.storage_backend` (enum, default 'supabase')
- `organisations.storage_backend_status` (text + check constraint)
- `organisations.google_access_token_enc` (text)
- `organisations.google_refresh_token_enc` (text)
- `organisations.ms_token_cache_enc`, `dropbox_refresh_token_enc`, `dropbox_access_token_enc` (text)
- `client_documents.storage_backend` (enum, default 'supabase')

Phase 25 needs to ADD two additional columns to `organisations`:
- `google_drive_folder_id TEXT DEFAULT NULL` — Drive folder ID of the `Prompt/` root folder
- `google_token_expires_at TIMESTAMPTZ DEFAULT NULL` — expiry timestamp for proactive refresh

These were described as being present in the Phase 25 description ("token refresh is automatic and silent; revocation is detected") but are not in the Phase 24 migration. They must be added in a Phase 25 migration.

**`UploadParams` extension:** Phase 25 also requires `clientName` be added to the `UploadParams` interface (currently in `lib/documents/storage.ts`) to support the human-readable folder structure `Prompt/{client_name}/{filing_type}/{tax_year}/`. The portal upload route already has access to client name via the portal token's linked client. The inbound email handler has it via the matched client.

---

## Environment Variables Required

Three new environment variables needed in Vercel:

| Variable | Purpose | How to Get |
|----------|---------|-----------|
| `GOOGLE_CLIENT_ID` | OAuth2 client ID | Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth2 client secret | Same as above — shown once at creation, then hidden |
| `GOOGLE_REDIRECT_URI` | OAuth2 callback URL | Must exactly match an Authorized Redirect URI in GCP; value: `https://{app-domain}/api/auth/google-drive/callback` |

All three must be documented in `ENV_VARIABLES.md` in Phase 25.

**Google Cloud Console setup required (manual, not automatable):**
1. Create a project (or reuse existing) in Google Cloud Console
2. Enable the Google Drive API
3. Configure OAuth consent screen: External user type, add `drive.file` scope
4. Set publishing status to **"In Production"** before any real firm connects (prevents 7-day token expiry)
5. Create OAuth 2.0 Client ID credentials (Web Application type)
6. Add Authorized Redirect URI matching `GOOGLE_REDIRECT_URI`

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Full `googleapis` package (199 MB) | `@googleapis/drive` scoped package (~2.3 MB) | Scoped packages introduced in googleapis v100+ | Critical for Vercel function size limit compliance |
| Drive-only service accounts | User OAuth2 with `drive.file` scope | N/A (both exist) | Service accounts cannot access personal Drive; user OAuth2 is required for per-user Drive |
| Refresh token storage in plaintext | AES-256-GCM encrypted `_enc` columns | Phase 24 (this project) | DB breach doesn't expose Drive access |
| Public temporary URLs from Drive | Server-proxied byte response | Required by `drive.file` scope | `drive.file` cannot generate public sharing links |

**Deprecated/outdated:**
- Google Drive API v2: v3 has been the stable version for years; use `version: 'v3'` always
- `googleapis` full package for Drive-only use: use `@googleapis/drive` scoped package instead

---

## Open Questions

1. **`getDownloadUrl()` contract violation for Google Drive**
   - What we know: The `StorageProvider` interface requires `getDownloadUrl()`. For Google Drive, this cannot return a usable URL (no public URL capability with `drive.file`). The download route must be updated to check backend and call `getBytes()` instead for Google Drive.
   - What's unclear: Should `GoogleDriveProvider.getDownloadUrl()` throw, return a sentinel, or return a server-side proxy URL pointing to our own API route?
   - Recommendation: Throw with a clear error message. The download action in `app/api/clients/[id]/documents/route.ts` must be updated in Phase 25 to check `doc.storage_backend` and route accordingly. This is explicit rather than magic.

2. **UploadParams.clientName — where to get it in portal upload route**
   - What we know: The portal upload route has `portalToken.client_id` but not `client_name` in the current query.
   - What's unclear: Whether the portal token query should be expanded to join clients.display_name.
   - Recommendation: Expand the portal token SELECT to include `clients!inner(display_name)` JOIN so `clientName` is available. The inbound email handler has it via the matched client row.

3. **Lazy sub-folder creation vs eager folder tree at connect time**
   - What we know: Creating the full folder tree at connect time (`Prompt/ClientA/Corp Tax/2024/`, `Prompt/ClientB/...`) is expensive and brittle (new clients added after connect won't have folders).
   - Recommendation: Create only the `Prompt/` root folder at connect time (store its ID). Create sub-folders lazily at upload time using `findOrCreateFolder()` with a Drive API list query. This is slightly slower per-upload but simpler and always correct.

4. **`resolveProvider()` signature — does it need org tokens?**
   - What we know: Currently `resolveProvider(orgConfig: OrgStorageConfig)` takes only `{id, storage_backend}`. The `GoogleDriveProvider` needs the org ID to look up tokens internally.
   - Recommendation: Update `OrgStorageConfig` to also carry `id` (already present) — the `GoogleDriveProvider` constructor takes `orgId` and loads tokens from DB lazily. This keeps the factory clean: `case 'google_drive': return new GoogleDriveProvider(orgConfig.id, orgConfig.google_drive_folder_id!)`.

---

## Validation Architecture

Nyquist validation is `false` in `.planning/config.json` — Validation Architecture section skipped.

---

## Sources

### Primary (HIGH confidence)
- Google Drive API v3 official docs — files.create, files.get, upload types — https://developers.google.com/workspace/drive/api/reference/rest/v3/files/create, https://developers.google.com/workspace/drive/api/guides/manage-uploads, https://developers.google.com/workspace/drive/api/guides/manage-downloads
- Google Identity OAuth2 Web Server docs — authorization URL, code exchange, refresh token lifecycle — https://developers.google.com/identity/protocols/oauth2/web-server
- Google Drive API scopes docs — `drive.file` scope capabilities confirmed — https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- Google Drive files.get reference — `drive.file` listed as authorized scope for `alt=media` download — https://developers.google.com/workspace/drive/api/reference/rest/v3/files/get
- Phase 24 codebase — `lib/documents/storage.ts`, `lib/crypto/tokens.ts`, `supabase/migrations/20260228000001_storage_abstraction_layer.sql` — read directly, confirmed exact Phase 24 deliverables
- STATE.md v5.0 Decisions — `@googleapis/drive@^20.1.0` locked, `drive.file` scope locked, server-proxied downloads locked — authoritative project decisions

### Secondary (MEDIUM confidence)
- googleapis GitHub issues #2494 — `invalid_grant` detection pattern (`err.response.data.error === 'invalid_grant'`) — community-verified against official error codes
- npm search result — `@googleapis/drive` version 20.1.0 confirmed as latest (published ~2026-02-07, 57 dependents)
- Google OAuth Testing vs Production status — 7-day refresh token expiry in Testing mode — confirmed by multiple community sources (n8n forum, cdata.com, Google groups)

### Tertiary (LOW confidence)
- Vercel function size limit 250 MB — cited in REQUIREMENTS.md as the reason for choosing `@googleapis/drive` over full `googleapis`; not independently verified this session but listed in project requirements as authoritative

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — `@googleapis/drive@^20.1.0` confirmed as the scoped package; version confirmed from npm; locked in STATE.md
- Architecture: HIGH — OAuth2 flow steps verified against official Google docs; `invalid_grant` detection verified from googleapis GitHub issues; `drive.file` scope capabilities confirmed from official API reference
- Pitfalls: HIGH — `prompt: 'consent'` requirement verified from official OAuth2 docs; 7-day expiry for Testing-status apps verified from multiple community sources; `findOrCreateFolder` pattern is standard Drive API practice

**Research date:** 2026-02-28
**Valid until:** 2026-03-28 (Google OAuth2 protocol is stable; `@googleapis/drive` API surface is stable; check version before installing)
