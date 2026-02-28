# Phase 27: Dropbox Integration - Research

**Researched:** 2026-02-28
**Domain:** Dropbox JavaScript SDK v10, OAuth2 offline access, DropboxAuth token lifecycle, filesGetTemporaryLink
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DRPBX-01 | Accountant connects Dropbox from Settings via OAuth2; authorization URL includes `token_access_type=offline`; callback rejects and shows error if no refresh token in exchange response | `getAuthenticationUrl(redirectUri, state, 'code', 'offline')` produces the correct URL; SDK's `getAccessTokenFromCode()` returns `token.result.refresh_token` which is null/absent when `token_access_type=offline` was omitted — validate presence before storing; OAuth callback route pattern mirrors Phase 25 (Google Drive) |
| DRPBX-02 | `DropboxProvider` implements `StorageProvider` interface; uses `checkAndRefreshAccessToken()` with Postgres-rehydrated `DropboxAuth` instance; downloads via `filesGetTemporaryLink` (4-hour TTL) | `DropboxAuth` constructor accepts `{ clientId, clientSecret, accessToken, refreshToken, accessTokenExpiresAt }`; `checkAndRefreshAccessToken()` auto-refreshes when expired; `filesGetTemporaryLink({ path })` returns `{ result: { link } }` with 4-hour TTL — verified from Dropbox SDK docs |
| DRPBX-03 | All uploads scoped to `/Apps/Prompt/` — provider-enforced app folder boundary | App Folder access type restricts Dropbox API calls to `/Apps/{appname}/` only — enforced by Dropbox platform, not application code; paths in API calls use relative paths from app folder root (e.g., `/client_name/filing_type/year/file.ext` maps to `/Apps/Prompt/client_name/...` at the Dropbox level) |
| DRPBX-04 | Portal upload route, Postmark inbound handler, and DSAR export updated to route through `DropboxProvider` when `storage_backend = 'dropbox'` | Three call sites already identified: `app/api/portal/[token]/upload/route.ts`, `app/api/postmark/inbound/route.ts` (processAttachments), `app/api/clients/[id]/documents/dsar/route.ts`; pattern is identical to Phase 25 (replace `uploadDocument()` with `resolveProvider(orgConfig).upload()`); DSAR route switches from `getSignedDownloadUrl()` to `resolveProvider(orgConfig).getBytes()` |
| DRPBX-05 | Accountant can disconnect Dropbox from Settings; encrypted token columns cleared; `storage_backend` reset to `supabase`; subsequent uploads go to Supabase Storage | Disconnect = UPDATE organisations SET `dropbox_refresh_token_enc = NULL`, `dropbox_access_token_enc = NULL`, `storage_backend = 'supabase'`, `storage_backend_status = NULL` WHERE id = orgId; disconnect card is a Settings UI component (shared pattern with Phase 25 Google Drive disconnect) |
</phase_requirements>

---

## Summary

Phase 27 implements Dropbox as a third storage backend, following the same provider pattern established by Phase 25 (Google Drive). The technical domain is significantly simpler than Phase 26 (OneDrive/MSAL) because the official `dropbox` npm package (v10.x) provides a single `DropboxAuth` class with a built-in `checkAndRefreshAccessToken()` method that handles the entire refresh lifecycle. Unlike Google Drive's `withTokenRefresh` wrapper (custom-built in Phase 25), Dropbox's SDK manages token refresh internally — the pattern is: rehydrate a `DropboxAuth` instance from Postgres-stored encrypted tokens, call `checkAndRefreshAccessToken()`, then make the API call, then persist any updated access token back.

The app folder access model is a material advantage over OneDrive: when a Dropbox app is registered with "App Folder" access type, Dropbox enforces the `/Apps/{appname}/` boundary at the API level. There is no need to self-enforce a path prefix in application code as OneDrive required. Files uploaded to `/client_name/filing/year/file.ext` via the API are automatically stored under `/Apps/Prompt/client_name/filing/year/file.ext` in the user's Dropbox. This satisfies DRPBX-03 without any custom path-scoping logic.

Downloads use `filesGetTemporaryLink()`, which produces a 4-hour TTL URL — the closest model to the existing Supabase signed URL (300s) and produces a directly downloadable link without server proxying (unlike Google Drive's `drive.file` scope which requires a server proxy). The DSAR export can call `getBytes()` which fetches the temporary link and then the bytes, consistent with the existing pattern.

**Primary recommendation:** Use the `dropbox` npm package (v10.x). Structure Phase 27 as three plans: (1) install `dropbox`, add `dropbox_token_expires_at` migration, build `DropboxProvider`; (2) OAuth2 connect/callback routes + Settings connect card; (3) update portal upload, inbound handler, and DSAR export routes, plus disconnect action.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `dropbox` | ^10.34.0 (latest; last published ~3 years ago but stable) | Dropbox API v2 client — `DropboxAuth`, `Dropbox`, `filesUpload`, `filesGetTemporaryLink` | Official Dropbox SDK; includes `DropboxAuth` with `checkAndRefreshAccessToken()` built in; supports Node.js serverless; 4.77 MB uncompressed but no Vercel function size risk (well under 250 MB limit) |
| `lib/crypto/tokens.ts` | Already built (Phase 24) | `encryptToken()` / `decryptToken()` for storing Dropbox tokens in Postgres | Established pattern for all `_enc` columns |
| `lib/documents/storage.ts` | Already built (Phase 24) | `StorageProvider` interface + `resolveProvider()` factory | Dropbox case added to factory switch |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@supabase/supabase-js` admin client | ^2.95.3 (already installed) | Read org's encrypted token columns; persist refreshed tokens | Required inside `DropboxProvider` constructor and after `checkAndRefreshAccessToken()` |
| Node.js `crypto` (built-in) | Node 20 | `encryptToken` / `decryptToken` via `lib/crypto/tokens.ts` | Already used — no new dependency |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `dropbox` SDK | Raw `fetch` to Dropbox API v2 | SDK provides typed responses, automatic token refresh via `checkAndRefreshAccessToken()`, and correctly structured multipart uploads; hand-rolling these is significant work with high edge-case risk |
| `dropbox` SDK | `dropbox-v2-api` (unofficial wrapper) | Unofficial package with 4 unresolved CVEs; the official SDK is the correct choice |

**Installation:**
```bash
npm install dropbox
```

---

## Architecture Patterns

### Recommended Project Structure

```
lib/
├── storage/
│   ├── token-refresh.ts        # Already built (Phase 25) — Google-specific; DO NOT reuse
│   └── dropbox.ts              # NEW — DropboxProvider class
├── documents/
│   └── storage.ts              # UPDATE — add 'dropbox' case to resolveProvider()
└── crypto/
    └── tokens.ts               # Already built (Phase 24) — used inside DropboxProvider

app/
├── api/
│   ├── auth/
│   │   └── dropbox/
│   │       ├── connect/
│   │       │   └── route.ts    # NEW — generates Dropbox OAuth URL, redirects
│   │       └── callback/
│   │           └── route.ts    # NEW — exchanges code, validates refresh_token presence, stores encrypted tokens
│   ├── portal/[token]/upload/
│   │   └── route.ts            # UPDATE — use resolveProvider(orgConfig).upload()
│   ├── postmark/inbound/
│   │   └── route.ts            # UPDATE — processAttachments uses resolveProvider(orgConfig)
│   └── clients/[id]/documents/
│       ├── dsar/
│       │   └── route.ts        # UPDATE — use resolveProvider(orgConfig).getBytes()
│       └── route.ts            # UPDATE (if download route uses getSignedDownloadUrl directly)
└── (dashboard)/settings/
    └── components/
        └── dropbox-connect-card.tsx  # NEW — connect/disconnect UI card (added to Storage tab in Phase 28)
```

**Note on Settings UI:** Phase 28 adds the full Storage tab to `settings-tabs.tsx`. Phase 27's scope is limited to the backend routes and a standalone connect card component that Phase 28 wires into the tab. The Settings page in Phase 27 needs a minimal "Connect Dropbox" button that triggers the OAuth flow.

### Pattern 1: DropboxAuth Rehydration from Postgres

**What:** On each Vercel function invocation, reconstruct a `DropboxAuth` instance from encrypted token columns stored in Postgres. Call `checkAndRefreshAccessToken()` before any API call. After refresh, persist the new access token and expiry back to Postgres.

**When to use:** Every time `DropboxProvider` methods (`upload`, `getDownloadUrl`, `getBytes`, `delete`) are called.

**Source:** Dropbox SDK documentation — `DropboxAuth` constructor accepts `{ clientId, clientSecret, accessToken, refreshToken, accessTokenExpiresAt }`.

```typescript
// lib/storage/dropbox.ts
import { Dropbox, DropboxAuth } from 'dropbox';
import { createAdminClient } from '@/lib/supabase/admin';
import { encryptToken, decryptToken } from '@/lib/crypto/tokens';
import type { StorageProvider, UploadParams } from '@/lib/documents/storage';

export class DropboxProvider implements StorageProvider {
  private orgId: string;

  constructor(orgConfig: { id: string }) {
    this.orgId = orgConfig.id;
  }

  private async getAuthClient(): Promise<{ dbx: Dropbox; auth: DropboxAuth }> {
    const admin = createAdminClient();
    const { data: org } = await admin
      .from('organisations')
      .select('dropbox_access_token_enc, dropbox_refresh_token_enc, dropbox_token_expires_at')
      .eq('id', this.orgId)
      .single();

    if (!org?.dropbox_refresh_token_enc) {
      throw new Error('Dropbox not connected for this organisation');
    }

    const auth = new DropboxAuth({
      clientId: process.env.DROPBOX_APP_KEY!,
      clientSecret: process.env.DROPBOX_APP_SECRET!,
      accessToken: org.dropbox_access_token_enc
        ? decryptToken(org.dropbox_access_token_enc)
        : undefined,
      refreshToken: decryptToken(org.dropbox_refresh_token_enc),
      accessTokenExpiresAt: org.dropbox_token_expires_at
        ? new Date(org.dropbox_token_expires_at)
        : undefined,
    });

    // Let SDK handle refresh when needed
    await auth.checkAndRefreshAccessToken();

    // Persist refreshed tokens back to Postgres
    const newAccessToken = auth.getAccessToken();
    const newExpiresAt = auth.getAccessTokenExpiresAt();
    if (newAccessToken) {
      await admin.from('organisations').update({
        dropbox_access_token_enc: encryptToken(newAccessToken),
        dropbox_token_expires_at: newExpiresAt?.toISOString() ?? null,
        storage_backend_status: 'active',
      }).eq('id', this.orgId);
    }

    const dbx = new Dropbox({ auth });
    return { dbx, auth };
  }

  async upload(params: UploadParams): Promise<{ storagePath: string }> {
    const { dbx } = await this.getAuthClient();
    const ext = params.originalFilename.split('.').pop()?.toLowerCase() ?? 'bin';
    const uuid = crypto.randomUUID();
    // Path is relative to app folder root — Dropbox prepends /Apps/Prompt/ automatically
    const path = `/${params.clientId}/${params.filingTypeId}/${params.taxYear}/${uuid}.${ext}`;

    await (dbx as any).filesUpload({
      path,
      contents: params.file,
      mode: { '.tag': 'add' },
      autorename: false,
    });

    return { storagePath: path };
  }

  async getDownloadUrl(storagePath: string): Promise<{ url: string }> {
    const { dbx } = await this.getAuthClient();
    const response = await (dbx as any).filesGetTemporaryLink({ path: storagePath });
    return { url: response.result.link };
  }

  async getBytes(storagePath: string): Promise<Buffer> {
    const { url } = await this.getDownloadUrl(storagePath);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Dropbox getBytes failed: ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }

  async delete(storagePath: string): Promise<void> {
    const { dbx } = await this.getAuthClient();
    await (dbx as any).filesDeleteV2({ path: storagePath });
  }
}
```

### Pattern 2: OAuth2 Connect Route with offline Enforcement

**What:** Generate the Dropbox authorization URL with `token_access_type=offline`. On callback, validate that the exchange response includes a `refresh_token` before storing anything. If `refresh_token` is absent (e.g., user connected without offline parameter), reject the exchange and surface an error.

**Critical:** `token_access_type=offline` must be the 4th argument to `getAuthenticationUrl()`. The SDK signature is:
```
getAuthenticationUrl(redirectUri, state, authType, tokenAccessType, scope, ...)
```

```typescript
// app/api/auth/dropbox/connect/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { DropboxAuth } from 'dropbox';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrgContext } from '@/lib/auth/org-context';

export async function GET(request: NextRequest) {
  const { orgId } = await getOrgContext();
  const state = crypto.randomUUID(); // CSRF token

  // Store state in organisations for validation on callback
  const admin = createAdminClient();
  await admin.from('organisations')
    .update({ dropbox_oauth_state: state })
    .eq('id', orgId);

  const auth = new DropboxAuth({
    clientId: process.env.DROPBOX_APP_KEY!,
  });

  const authUrl = await auth.getAuthenticationUrl(
    process.env.DROPBOX_REDIRECT_URI!,
    state,
    'code',        // response_type
    'offline',     // token_access_type — REQUIRED for refresh token
  );

  return NextResponse.redirect(authUrl as string);
}
```

```typescript
// app/api/auth/dropbox/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { DropboxAuth } from 'dropbox';
import { createAdminClient } from '@/lib/supabase/admin';
import { encryptToken } from '@/lib/crypto/tokens';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  // Validate state (CSRF)
  const admin = createAdminClient();
  // ... lookup org by state, validate match ...

  const auth = new DropboxAuth({
    clientId: process.env.DROPBOX_APP_KEY!,
    clientSecret: process.env.DROPBOX_APP_SECRET!,
  });

  const tokenResponse = await auth.getAccessTokenFromCode(
    process.env.DROPBOX_REDIRECT_URI!,
    code!
  );

  const result = tokenResponse.result as any;
  const refreshToken = result.refresh_token;

  // DRPBX-01: Reject if no refresh token (means token_access_type=offline was not in auth URL)
  if (!refreshToken) {
    // Redirect to Settings with error — do NOT store short-lived access-only token
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=storage&error=dropbox_no_refresh_token`
    );
  }

  const accessToken = result.access_token;
  const expiresIn = result.expires_in; // seconds from now
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  await admin.from('organisations').update({
    dropbox_refresh_token_enc: encryptToken(refreshToken),
    dropbox_access_token_enc: encryptToken(accessToken),
    dropbox_token_expires_at: expiresAt.toISOString(),
    storage_backend: 'dropbox',
    storage_backend_status: 'active',
    dropbox_oauth_state: null, // Clear CSRF token
  }).eq('id', orgId);

  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=storage`);
}
```

### Pattern 3: resolveProvider Factory Update

**What:** Add the `'dropbox'` case to `resolveProvider()` in `lib/documents/storage.ts`.

```typescript
// lib/documents/storage.ts — resolveProvider() updated
export function resolveProvider(orgConfig: OrgStorageConfig): StorageProvider {
  switch (orgConfig.storage_backend) {
    case 'supabase':
    default:
      return new SupabaseStorageProvider();
    case 'google_drive':
      return new GoogleDriveProvider(orgConfig);   // Phase 25
    case 'onedrive':
      return new OneDriveProvider(orgConfig);       // Phase 26
    case 'dropbox':
      return new DropboxProvider(orgConfig);        // Phase 27 — this plan
  }
}
```

### Pattern 4: Disconnect Action

**What:** Clear all Dropbox token columns and reset `storage_backend` to `'supabase'`.

```typescript
// app/actions/settings.ts — new action
export async function disconnectDropbox(): Promise<{ error?: string }> {
  const { orgId, orgRole } = await getOrgContext();
  if (orgRole !== 'admin') return { error: 'Admin only' };

  const admin = createAdminClient();
  const { error } = await admin.from('organisations').update({
    dropbox_refresh_token_enc: null,
    dropbox_access_token_enc: null,
    dropbox_token_expires_at: null,
    storage_backend: 'supabase',
    storage_backend_status: null,
  }).eq('id', orgId);

  if (error) return { error: error.message };
  return {};
}
```

### Anti-Patterns to Avoid

- **Storing Dropbox tokens without calling `encryptToken()`:** Every `dropbox_*_enc` column write MUST go through `encryptToken()`. Never write plaintext tokens to any DB column.
- **Skipping the `refresh_token` presence check on callback:** The entire point of DRPBX-01 is to catch the case where the auth URL did not include `token_access_type=offline`. If `refresh_token` is null/undefined in the callback response, reject immediately — do not store the short-lived access token.
- **Reading `org.storage_backend` to route downloads:** Downloads must use `doc.storage_backend` from the `client_documents` row, not the org's current `storage_backend`. Orgs can switch backends; document routing must reflect which backend was active at upload time.
- **Constructing `Dropbox` directly without going through `DropboxAuth`:** `new Dropbox({ auth })` using a rehydrated `DropboxAuth` is the correct pattern. Do not pass `accessToken` directly to `new Dropbox({ accessToken })` — this skips token refresh.
- **Not persisting the refreshed access token back to Postgres:** After `checkAndRefreshAccessToken()` runs, `auth.getAccessToken()` and `auth.getAccessTokenExpiresAt()` return the new values. These must be encrypted and persisted back to `organisations` so the next Vercel function invocation has a fresh token.
- **Using hardcoded paths starting with `/Apps/Prompt/`:** When a Dropbox app is registered with "App Folder" access type, the API root is already the app folder. Paths passed to the API should start with `/` relative to the app folder (e.g., `/client_id/filing/year/file.pdf`). Prepending `/Apps/Prompt/` would produce `/Apps/Prompt/Apps/Prompt/...`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Access token refresh | Manual POST to `https://api.dropbox.com/oauth2/token` | `auth.checkAndRefreshAccessToken()` | SDK handles expiry detection, PKCE vs secret-based refresh, error classification |
| OAuth URL generation | Manual string construction with `token_access_type=offline` | `auth.getAuthenticationUrl(uri, state, 'code', 'offline')` | SDK ensures correct parameter encoding; manual construction risks typos that silently produce online tokens |
| File upload multipart | Manual multipart/octet-stream construction | `dbx.filesUpload({ path, contents })` | Binary content upload with typed response; SDK handles HTTP content-type headers |
| Temporary download link | Manual `fetch` to Dropbox content endpoints | `dbx.filesGetTemporaryLink({ path })` | Returns a 4-hour TTL link; SDK validates response type |

**Key insight:** The Dropbox SDK's `checkAndRefreshAccessToken()` is the principal reason to use the SDK rather than raw HTTP calls. It encapsulates the token-expired detection, refresh request, and credential update in a single awaitable call.

---

## Common Pitfalls

### Pitfall 1: Missing `token_access_type=offline` produces an online (short-lived only) token

**What goes wrong:** If `getAuthenticationUrl()` is called without `'offline'` as the 4th argument, Dropbox returns only a short-lived access token (no `refresh_token`). The token expires in ~4 hours and cannot be refreshed. All subsequent API calls fail permanently.

**Why it happens:** The Dropbox SDK's `getAuthenticationUrl` defaults to online tokens. `token_access_type=offline` must be explicitly passed as the 4th positional argument.

**How to avoid:** Validate `result.refresh_token` is present and non-empty in the callback before writing any token to the database. If absent, redirect to Settings with a specific error message (DRPBX-01 requirement).

**Warning signs:** `dropbox_refresh_token_enc` is null after OAuth flow completes; tokens expire within hours.

### Pitfall 2: App registered with "Full Dropbox" instead of "App Folder" access type

**What goes wrong:** If the Dropbox app is created with "Full Dropbox" access type, the path prefix `/Apps/Prompt/` is NOT automatically enforced by Dropbox. Files can be uploaded anywhere in the user's Dropbox. DRPBX-03 cannot be satisfied without path-scoping in application code.

**Why it happens:** Dropbox has two access types: "App Folder" (provider-enforced scope) and "Full Dropbox" (unrestricted). The app type is set at Dropbox App Console creation and cannot be changed later.

**How to avoid:** The Dropbox app MUST be registered with "App Folder" access type in the Dropbox App Console. Document this as a user setup requirement (manual step in the PLAN.md). Verify: after connecting, upload a test file and check it appears under `/Apps/{appname}/` in the user's Dropbox.

**Warning signs:** Files appear at the root of Dropbox rather than `/Apps/Prompt/`; DRPBX-03 violation.

### Pitfall 3: `dropbox_token_expires_at` column is missing from the schema

**What goes wrong:** The Phase 24 migration added `dropbox_refresh_token_enc` and `dropbox_access_token_enc` to `organisations` but NOT `dropbox_token_expires_at`. Without this column, `checkAndRefreshAccessToken()` cannot determine if a proactive refresh is needed and will always call the Dropbox token endpoint on every API call (one extra round-trip per function invocation).

**Why it happens:** The Phase 24 schema migration was defined before the full Dropbox token lifecycle was researched. Google has `google_token_expires_at` (added in Phase 25). Dropbox needs an equivalent.

**How to avoid:** Phase 27 Plan 01 must include a schema migration to add `dropbox_token_expires_at TIMESTAMPTZ DEFAULT NULL` to `organisations`. Verify before writing `DropboxProvider`.

**Warning signs:** `auth.getAccessTokenExpiresAt()` returns undefined after rehydration; unnecessary token refresh calls on every API invocation.

### Pitfall 4: SDK version is 3+ years old — verify critical API shapes before use

**What goes wrong:** The `dropbox` npm package (v10.34.0) was last published approximately 3 years ago. Method signatures or response shapes could differ from current Dropbox API v2 documentation.

**Why it happens:** Dropbox froze SDK development while maintaining API v2 compatibility. The SDK is still functional but TypeScript types may lag behind API additions.

**How to avoid:** For `filesGetTemporaryLink`, `filesUpload`, and `filesDeleteV2`, verify the exact response shape with a quick `console.log` during development. The `result` property on SDK responses wraps the actual API response. Cast to `any` where necessary to bypass outdated TypeScript definitions. This is LOW risk — these endpoints are stable API v2 endpoints.

**Warning signs:** TypeScript type errors on method calls; `response.result` vs `response` confusion.

### Pitfall 5: CSRF state parameter not validated on callback

**What goes wrong:** If the OAuth callback does not validate the `state` parameter, a malicious redirect could complete a Dropbox connection for an attacker's account, giving them write access to the org's documents.

**Why it happens:** OAuth `state` validation is optional in the protocol but required for security. Dropbox passes the state parameter through unchanged.

**How to avoid:** Store the `state` UUID in `organisations.dropbox_oauth_state` before redirecting to Dropbox. On callback, look up the org by matching `state`. Only then exchange the code for tokens. Clear `dropbox_oauth_state` after successful exchange. This is the same pattern used in Phase 25 (Google Drive).

**Note:** `dropbox_oauth_state` is a temporary column needed only during the OAuth flow — it can be TEXT DEFAULT NULL, no need for encryption.

---

## Code Examples

### DropboxAuth: full rehydration + refresh + persist cycle

```typescript
// Source: Dropbox SDK documentation — DropboxAuth class
// https://dropbox.github.io/dropbox-sdk-js/DropboxAuth.html

import { Dropbox, DropboxAuth } from 'dropbox';
import { encryptToken, decryptToken } from '@/lib/crypto/tokens';

// Rehydrate from Postgres-stored encrypted tokens
const auth = new DropboxAuth({
  clientId: process.env.DROPBOX_APP_KEY!,
  clientSecret: process.env.DROPBOX_APP_SECRET!,
  accessToken: org.dropbox_access_token_enc
    ? decryptToken(org.dropbox_access_token_enc)
    : undefined,
  refreshToken: decryptToken(org.dropbox_refresh_token_enc!),
  accessTokenExpiresAt: org.dropbox_token_expires_at
    ? new Date(org.dropbox_token_expires_at)
    : undefined,
});

// Let SDK refresh if needed (no-op if token is still valid)
await auth.checkAndRefreshAccessToken();

// Persist any refreshed token back to Postgres
const freshAccessToken = auth.getAccessToken();
const freshExpiresAt = auth.getAccessTokenExpiresAt();
if (freshAccessToken) {
  await admin.from('organisations').update({
    dropbox_access_token_enc: encryptToken(freshAccessToken),
    dropbox_token_expires_at: freshExpiresAt?.toISOString() ?? null,
  }).eq('id', orgId);
}

const dbx = new Dropbox({ auth });
```

### filesUpload (files under 150 MB — all normal accounting documents)

```typescript
// Source: Dropbox SDK documentation
// https://dropbox.github.io/dropbox-sdk-js/Dropbox.html

// Path is relative to app folder root when app type = "App Folder"
// '/client_id/filing_type/2024/abc123.pdf' → stored at /Apps/Prompt/client_id/filing_type/2024/abc123.pdf
const response = await dbx.filesUpload({
  path: `/apps/prompt/${orgId}/${clientId}/${filingTypeId}/${taxYear}/${uuid}.${ext}`,
  contents: fileBuffer, // Buffer | Uint8Array
  mode: { '.tag': 'add' },
  autorename: false,
});
// response.result.path_lower = actual storage path for retrieval
const storagePath = (response.result as any).path_lower;
```

**Note on path scope:** If app type is "App Folder", the Dropbox-visible path is already `/Apps/{appname}/`. Paths passed to the API are relative. Use a consistent path scheme like `/${orgId}/${clientId}/${filingTypeId}/${taxYear}/${uuid}.${ext}` and store exactly that as `storage_path` in `client_documents`.

### filesGetTemporaryLink

```typescript
// Source: Dropbox SDK documentation — 4-hour TTL
const response = await dbx.filesGetTemporaryLink({ path: storagePath });
const downloadUrl = (response.result as any).link;
// URL is valid for 4 hours — no server proxy needed (unlike Google Drive)
return { url: downloadUrl };
```

### OAuth callback — token exchange and refresh_token validation

```typescript
// Source: Dropbox OAuth Guide
// https://developers.dropbox.com/oauth-guide

const auth = new DropboxAuth({
  clientId: process.env.DROPBOX_APP_KEY!,
  clientSecret: process.env.DROPBOX_APP_SECRET!,
});

const tokenResponse = await auth.getAccessTokenFromCode(
  process.env.DROPBOX_REDIRECT_URI!,
  code
);
const result = tokenResponse.result as any;

// DRPBX-01: Mandatory check — reject if no refresh token
if (!result.refresh_token) {
  return NextResponse.redirect(
    `${settingsUrl}?error=dropbox_no_refresh_token`
  );
}

// Store encrypted tokens + expiry
const expiresAt = new Date(Date.now() + result.expires_in * 1000);
await admin.from('organisations').update({
  dropbox_refresh_token_enc: encryptToken(result.refresh_token),
  dropbox_access_token_enc: encryptToken(result.access_token),
  dropbox_token_expires_at: expiresAt.toISOString(),
  storage_backend: 'dropbox',
  storage_backend_status: 'active',
}).eq('id', orgId);
```

### Schema migration: dropbox_token_expires_at + dropbox_oauth_state

```sql
-- Required migration: Phase 27 Plan 01
ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS dropbox_token_expires_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS dropbox_oauth_state TEXT DEFAULT NULL;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Long-lived Dropbox access tokens (no expiry) | Short-lived access tokens + refresh tokens via `token_access_type=offline` | Dropbox deprecated long-lived tokens ~2021 | All apps must now use the offline flow; old long-lived tokens no longer issued |
| Manual refresh via `POST /oauth2/token` | `auth.checkAndRefreshAccessToken()` (SDK-managed) | SDK v10+ | SDK handles all refresh lifecycle; reduces boilerplate |
| `filesGetTemporaryLink` TTL undocumented | 4-hour TTL is fixed and not configurable | Documented in SDK and community | Plan for 4-hour expiry; do not cache these URLs |

**Deprecated/outdated:**
- Long-lived Dropbox access tokens: Dropbox deprecated these. All new apps use short-lived + refresh. If `token_access_type=online` is used, tokens expire in ~4 hours with no refresh.
- `dropbox-sdk` (separate package, not `dropbox`): Old package, do not use. The official package name is `dropbox`.

---

## Open Questions

1. **Path scheme: org-scoped or client-scoped?**
   - What we know: The Supabase path scheme is `orgs/{org_id}/clients/{client_id}/...`. For Dropbox (App Folder), the API root is already scoped to the org's Dropbox connection — every org that connects Dropbox is connecting their own Dropbox account. There is no multi-org isolation needed at the path level (each org's connection is to a different Dropbox account).
   - What's unclear: Should Dropbox paths include `org_id` in the path for consistency with Supabase, or can they start with `client_id` directly?
   - Recommendation: Use `/{clientId}/{filingTypeId}/{taxYear}/{uuid}.{ext}` — simpler, org isolation is implicit via the Dropbox account. Store exactly this relative path as `storage_path` in `client_documents`.

2. **`dropbox_oauth_state` column: add in Phase 27 or use a different CSRF mechanism?**
   - What we know: The OAuth flow needs to validate the `state` parameter. Google Drive (Phase 25) presumably used a similar mechanism — check Phase 25 implementation for precedent.
   - What's unclear: Whether Phase 25 stored state in DB or in a cookie/session.
   - Recommendation: Add `dropbox_oauth_state TEXT DEFAULT NULL` to `organisations` in the Phase 27 schema migration. This follows the same approach as Google's `state` storage. Alternative (cookie-based CSRF) is more complex with Next.js App Router.

3. **Error handling for revoked Dropbox authorisation:**
   - What we know: Users can revoke app access from their Dropbox account settings. When this happens, `checkAndRefreshAccessToken()` will throw (the refresh token is invalid). This is similar to Google's `invalid_grant`.
   - What's unclear: The exact error code/message from the Dropbox SDK when refresh fails due to revocation.
   - Recommendation: Catch errors from `checkAndRefreshAccessToken()` and check error message for revocation indicators. On any unrecoverable auth error: set `storage_backend_status = 'reauth_required'`, null the token columns, re-throw. The Phase 28 re-auth banner handles the UI.

---

## Schema Dependencies (Pre-existing from Phase 24)

The following columns already exist in `organisations` (confirmed via Supabase query):

| Column | Type | Status |
|--------|------|--------|
| `storage_backend` | `storage_backend_enum` (NOT NULL, DEFAULT 'supabase') | EXISTS |
| `storage_backend_status` | TEXT (nullable, CHECK constraint) | EXISTS |
| `dropbox_refresh_token_enc` | TEXT (nullable) | EXISTS |
| `dropbox_access_token_enc` | TEXT (nullable) | EXISTS |

**Missing columns that Phase 27 must add:**

| Column | Type | Purpose |
|--------|------|---------|
| `dropbox_token_expires_at` | `TIMESTAMPTZ DEFAULT NULL` | Enables `checkAndRefreshAccessToken()` to detect expiry without an unnecessary refresh request |
| `dropbox_oauth_state` | `TEXT DEFAULT NULL` | CSRF state parameter storage during OAuth flow |

---

## Plan Structure Recommendation

Phase 27 maps cleanly to 3 plans, mirroring the Phase 25 structure:

**Plan 27-01:** Install `dropbox` package, apply schema migration (`dropbox_token_expires_at`, `dropbox_oauth_state`), build `DropboxProvider` class in `lib/storage/dropbox.ts`, wire into `resolveProvider()` factory.
- Requirements: DRPBX-02, DRPBX-03

**Plan 27-02:** Build OAuth2 connect/callback API routes (`app/api/auth/dropbox/connect/route.ts`, `app/api/auth/dropbox/callback/route.ts`), build `DropboxConnectCard` component, add `connectDropbox` / `disconnectDropbox` server actions.
- Requirements: DRPBX-01, DRPBX-05

**Plan 27-03:** Update portal upload route, Postmark inbound handler (`processAttachments`), and DSAR export route to use `resolveProvider(orgConfig)` instead of direct `uploadDocument()` / `getSignedDownloadUrl()` calls. Also document `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`, `DROPBOX_REDIRECT_URI` in `ENV_VARIABLES.md`.
- Requirements: DRPBX-04

---

## Sources

### Primary (HIGH confidence)

- Dropbox SDK documentation — `DropboxAuth` class, `checkAndRefreshAccessToken`, `getAuthenticationUrl`, `filesGetTemporaryLink` — https://dropbox.github.io/dropbox-sdk-js/DropboxAuth.html
- Dropbox SDK documentation — `Dropbox` class methods — https://dropbox.github.io/dropbox-sdk-js/Dropbox.html
- Dropbox OAuth Guide — `token_access_type=offline`, token response format (`refresh_token`, `expires_in`), refresh mechanism — https://developers.dropbox.com/oauth-guide
- Dropbox Reference Guide — App Folder access type, provider-enforced boundary at `/Apps/{appname}/` — https://www.dropbox.com/developers/reference/developer-guide
- Project codebase — `lib/documents/storage.ts` (StorageProvider interface, `resolveProvider()` factory, confirmed `// Phase 27: case 'dropbox'` placeholder), `lib/crypto/tokens.ts` (encryptToken/decryptToken), existing call sites confirmed in `app/api/portal/[token]/upload/route.ts`, `app/api/postmark/inbound/route.ts`, `app/api/clients/[id]/documents/dsar/route.ts`
- Supabase live schema query — confirmed existing columns (`dropbox_refresh_token_enc`, `dropbox_access_token_enc`) and MISSING columns (`dropbox_token_expires_at`, `dropbox_oauth_state`)

### Secondary (MEDIUM confidence)

- Dropbox community forum — confirms `checkAndRefreshAccessToken()` behavior, `clientSecret` required for non-PKCE refresh — https://github.com/dropbox/dropbox-sdk-js/issues/769
- Dropbox Blog — offline access tutorial, token exchange response format — https://dropbox.tech/developers/using-oauth-2-0-with-offline-access
- Dropbox SDK community — `files.content.read` required for `filesGetTemporaryLink`, `files.content.write` for upload — https://www.dropboxforum.com (multiple threads)
- Dropbox scope announcement — scoped apps and `files.content.read`/`files.content.write` — https://dropbox.tech/developers/now-available--scoped-apps-and-enhanced-permissions

### Tertiary (LOW confidence)

- npm package page — version 10.34.0, last published ~3 years ago, 4.77 MB package size — verification that package is not abandoned but stable
- Dropbox Blog implementation guide — code examples for Node.js OAuth flow — https://dropbox.tech/developers/oauth-code-flow-implementation-using-node-js-and-dropbox-javascript-sdk

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — `dropbox` npm package is the official SDK; API endpoints verified from official docs; token lifecycle verified from OAuth guide
- Architecture: HIGH — StorageProvider interface and factory pattern are established from Phase 24; DropboxProvider follows identical pattern to GoogleDriveProvider (Phase 25); call sites confirmed by reading source files
- Pitfalls: HIGH — Missing refresh token on callback is explicitly called out in DRPBX-01 and verified from Dropbox docs; app folder enforcement verified from Dropbox reference guide; missing `dropbox_token_expires_at` column confirmed by live schema query
- Schema gap: HIGH — Confirmed by direct Supabase SQL query that `dropbox_token_expires_at` and `dropbox_oauth_state` are not present and must be added in Phase 27

**Research date:** 2026-02-28
**Valid until:** 2026-03-28 (Dropbox API v2 is stable; SDK is frozen at v10.34.0)
