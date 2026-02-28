# Phase 26: Microsoft OneDrive Integration - Research

**Researched:** 2026-02-28
**Domain:** MSAL Node.js, Microsoft Graph API, OneDrive file operations, MSAL token cache persistence
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ONDRV-01 | Accountant connects OneDrive from Settings via MSAL OAuth2 using `/common` authority, supporting both M365 business and personal Microsoft accounts | `ConfidentialClientApplication` with `authority: 'https://login.microsoftonline.com/common'` and `getAuthCodeUrl()` + `acquireTokenByCode()` covers both account types from a single app registration; verified in official MSAL Node docs |
| ONDRV-02 | MSAL token cache serialized as JSON blob, encrypted, persisted to `organisations.ms_token_cache_enc` between Vercel invocations via `ICachePlugin` | `ICachePlugin.beforeCacheAccess` / `afterCacheAccess` pattern documented; `tokenCache.serialize()` returns a storable string; `tokenCache.deserialize()` rehydrates it; custom Postgres-backed `ICachePlugin` replaces the built-in in-memory cache |
| ONDRV-03 | All uploads constrained to `Apps/Prompt/` enforced in application code (`Files.ReadWrite.AppFolder` unavailable for M365 business accounts) | Confirmed: `Files.ReadWrite.AppFolder` is personal-account-only; self-enforce `Apps/Prompt/` path using `PUT /me/drive/root:/Apps/Prompt/{path}:/content` — works for both personal and business with `Files.ReadWrite` scope |
| ONDRV-04 | `AADSTS53003` Conditional Access error caught in OAuth callback and surfaced in Settings as actionable message directing accountant to obtain IT admin consent | Error manifests as `InteractionRequiredAuthError` or `ServerError` with `errorCode` containing `AADSTS53003` in the error message; catch in callback route, inspect `error.message` for `AADSTS53003`, redirect to Settings with specific error query param |
| ONDRV-05 | `OneDriveProvider` implements `StorageProvider` with `withTokenRefresh` wrapper; downloads via `@microsoft.graph.downloadUrl` | `GET /me/drive/items/{item-id}?select=id,@microsoft.graph.downloadUrl` returns a pre-auth temporary URL; use `acquireTokenSilent` inside a wrapper analogous to Phase 25's `withTokenRefresh` but adapted for MSAL token cache rehydration pattern |
| ONDRV-06 | Portal upload route, Postmark inbound handler, DSAR export all route through `OneDriveProvider` when `storage_backend = 'onedrive'` | Same call-site update pattern as Phase 25: swap `resolveProvider()` output in existing upload/download/DSAR routes; `resolveProvider()` factory already has a stub comment for `case 'onedrive'` |
| ONDRV-07 | Disconnect OneDrive clears `ms_token_cache_enc`, resets `storage_backend` to `supabase`; subsequent uploads go to Supabase | Admin client UPDATE clears `ms_token_cache_enc`, sets `storage_backend = 'supabase'`, `storage_backend_status = null`; same pattern as Google Drive disconnect |

</phase_requirements>

---

## Summary

Phase 26 builds on Phase 25's architecture (Google Drive) but uses Microsoft's MSAL Node.js SDK instead of Google's OAuth2 client. The core structural difference is how tokens are managed: Google Drive stores a refresh token as a single encrypted string and uses a thin `withTokenRefresh` wrapper to refresh the access token. OneDrive uses MSAL's opaque token cache blob — MSAL manages refresh token expiry and rotation internally, and the application's only job is to serialize/deserialize that blob to/from Postgres.

The **`ICachePlugin`** is MSAL's persistence extension point. It fires `beforeCacheAccess` before any cache read (load from Postgres, deserialize) and `afterCacheAccess` after any cache write (if `cacheHasChanged`, serialize and save to Postgres). This allows a fresh Vercel function invocation to rehydrate the full MSAL session without re-authorization. The serialized blob is a JSON string — it must be encrypted with `encryptToken()` before writing to `ms_token_cache_enc`.

The key scope decision from STATE.md pre-research is correct and verified: `Files.ReadWrite.AppFolder` is personal-account-only and unsupported for M365 business accounts. The correct scope is `Files.ReadWrite`, and the `Apps/Prompt/` path boundary is enforced in application code using the path-based Graph API (`/me/drive/root:/Apps/Prompt/{client}/{filing}/{year}/{file}:/content`). This path approach means no folder IDs need to be stored — paths work directly. OneDrive creates intermediate folders automatically when uploading via the path-based PUT endpoint.

Downloads use the `@microsoft.graph.downloadUrl` pre-authenticated temporary URL, obtained by fetching item metadata with `?select=id,@microsoft.graph.downloadUrl`. This URL is valid for a short time (minutes — exact duration undisclosed by Microsoft) and requires no Authorization header when accessed, making it suitable for browser redirect or short-lived response.

**Primary recommendation:** Use `ConfidentialClientApplication` (not `PublicClientApplication`) with a custom `ICachePlugin` backed by Postgres. Store the accountant's `homeAccountId` in the `organisations` table alongside the encrypted cache blob so `acquireTokenSilent` can be called with the correct account on each Vercel function invocation.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@azure/msal-node` | `^2.x` (latest: 2.16.x; v5 also available — see note) | MSAL OAuth2 auth code flow, token cache management, `acquireTokenSilent` | Microsoft's first-party SDK; handles token refresh, cache, Conditional Access errors; equivalent to `google-auth-library` for Google Drive |
| `@microsoft/microsoft-graph-client` | `^3.0.7` | Microsoft Graph REST client | Provides typed client for OneDrive API calls; handles request construction and auth headers |
| Node.js `crypto` (built-in) | Node 20 | AES-256-GCM encryption of MSAL cache blob | Already used by `lib/crypto/tokens.ts`; no new package needed |

**Version note on msal-node:** The STATE.md pre-research specifies `@azure/msal-node@^5.0.5`. npm shows 5.0.5 as the latest (released 2026-02-24). The `ICachePlugin` interface and `ConfidentialClientApplication` API are unchanged between v2 and v5 for this use case. Pin to `^2.16.x` for stability or use `^5.0.5` as the STATE.md decision specifies — both work. Use the STATE.md decision: `@azure/msal-node@^5.0.5`.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@microsoft/microsoft-graph-client` | `^3.0.7` | Graph API calls (upload, download, delete, folder create) | All Graph API calls; provides `Client.init()` with `authProvider` callback |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@azure/msal-node` | Raw `fetch` OAuth2 flow | MSAL handles token refresh, cache, Conditional Access error classification — building this manually would recreate MSAL. Not worth it. |
| `@microsoft/microsoft-graph-client` | Raw `fetch` to Graph REST API | `fetch` works fine for simple upload/download; Graph SDK adds typed helpers and LargeFileUploadTask. For Phase 26, raw fetch for upload/download is acceptable and avoids a large dependency. Decision: research recommends raw fetch for simple operations to avoid the 3.x SDK's potential Node.js 18 `--no-experimental-fetch` requirement. |
| `ICachePlugin` custom implementation | `DistributedCachePlugin` from MSAL | `DistributedCachePlugin` requires a session-based `IPartitionManager` — designed for multi-user web apps. Prompt's use case is one org = one MSAL account = one cache blob, so a simpler custom `ICachePlugin` is cleaner. |

**Installation:**
```bash
npm install @azure/msal-node @microsoft/microsoft-graph-client
```

---

## Architecture Patterns

### Recommended Project Structure

```
lib/
├── storage/
│   ├── token-refresh.ts        # Phase 25: Google Drive withTokenRefresh (already exists)
│   ├── msal-cache-plugin.ts    # Phase 26: ICachePlugin implementation backed by Postgres
│   └── onedrive.ts             # Phase 26: OneDriveProvider class
app/
├── api/
│   └── auth/
│       └── onedrive/
│           ├── connect/route.ts    # GET — generates MSAL auth URL, sets CSRF cookie
│           └── callback/route.ts   # GET — acquireTokenByCode, persists cache, redirects
```

### Pattern 1: ConfidentialClientApplication with ICachePlugin

**What:** Create a `ConfidentialClientApplication` instance with a custom `ICachePlugin` that reads/writes the serialized cache blob from/to Postgres for a specific org. This is the standard MSAL Node pattern for server-side applications.

**Key insight:** The `ConfidentialClientApplication` instance must be created fresh per request (not module-level) because each request needs a different org's cache blob loaded. The `ICachePlugin` provides the bridge between MSAL's in-memory cache and Postgres.

**Example:**

```typescript
// lib/storage/msal-cache-plugin.ts
import type { ICachePlugin, TokenCacheContext } from '@azure/msal-node';
import { createAdminClient } from '@/lib/supabase/admin';
import { encryptToken, decryptToken } from '@/lib/crypto/tokens';

/**
 * MSAL ICachePlugin backed by Postgres organisations.ms_token_cache_enc.
 *
 * beforeCacheAccess: loads encrypted cache blob from DB, decrypts, deserializes into MSAL memory.
 * afterCacheAccess: if cache changed, serializes MSAL memory, encrypts, persists to DB.
 *
 * One instance per org per request — never share across orgs.
 */
export class PostgresMsalCachePlugin implements ICachePlugin {
  constructor(private readonly orgId: string) {}

  async beforeCacheAccess(cacheContext: TokenCacheContext): Promise<void> {
    const admin = createAdminClient();
    const { data } = await admin
      .from('organisations')
      .select('ms_token_cache_enc')
      .eq('id', this.orgId)
      .single();

    if (data?.ms_token_cache_enc) {
      const decrypted = decryptToken(data.ms_token_cache_enc);
      cacheContext.tokenCache.deserialize(decrypted);
    }
    // If no cache exists yet (fresh connect), MSAL starts with empty in-memory cache
  }

  async afterCacheAccess(cacheContext: TokenCacheContext): Promise<void> {
    if (cacheContext.cacheHasChanged) {
      const serialized = cacheContext.tokenCache.serialize();
      const encrypted = encryptToken(serialized);
      const admin = createAdminClient();
      await admin
        .from('organisations')
        .update({ ms_token_cache_enc: encrypted })
        .eq('id', this.orgId);
    }
  }
}
```

### Pattern 2: Creating a ConfidentialClientApplication Per Request

**What:** The MSAL client is created per request with the org-specific cache plugin injected. The client reads the cache via `beforeCacheAccess` on the first `acquireTokenSilent` call.

**Example:**

```typescript
// lib/storage/onedrive.ts (inside OneDriveProvider)
import {
  ConfidentialClientApplication,
  type Configuration,
} from '@azure/msal-node';
import { PostgresMsalCachePlugin } from './msal-cache-plugin';

function createMsalClient(orgId: string): ConfidentialClientApplication {
  const config: Configuration = {
    auth: {
      clientId: process.env.MS_CLIENT_ID!,
      authority: 'https://login.microsoftonline.com/common',
      clientSecret: process.env.MS_CLIENT_SECRET!,
    },
    cache: {
      cachePlugin: new PostgresMsalCachePlugin(orgId),
    },
  };
  return new ConfidentialClientApplication(config);
}
```

**Critical:** Do NOT create the `ConfidentialClientApplication` at module level. The `PostgresMsalCachePlugin` constructor takes `orgId` — this must be passed at request time. Module-level init would also fail if `MS_CLIENT_ID` is absent at build time (same lazy-init pattern as Stripe client and Google OAuth2 client).

### Pattern 3: acquireTokenSilent with Cache Rehydration

**What:** After the `ConfidentialClientApplication` is created with the `PostgresMsalCachePlugin`, `acquireTokenSilent` triggers `beforeCacheAccess` (load from Postgres) automatically, uses the refresh token to obtain a fresh access token, then triggers `afterCacheAccess` (save updated cache to Postgres).

**Example:**

```typescript
// Inside OneDriveProvider methods
async function getAccessToken(orgId: string, homeAccountId: string): Promise<string> {
  const msalClient = createMsalClient(orgId);
  const tokenCache = msalClient.getTokenCache();

  // getAccountByHomeId triggers beforeCacheAccess — loads cache from Postgres
  const account = await tokenCache.getAccountByHomeId(homeAccountId);
  if (!account) {
    // This means the token cache is missing or the homeAccountId is wrong
    // Set storage_backend_status = 'reauth_required' and throw
    throw new Error('OneDrive session not found — reconnection required');
  }

  const response = await msalClient.acquireTokenSilent({
    account,
    scopes: ['Files.ReadWrite', 'offline_access'],
  });

  // afterCacheAccess fires automatically if tokens were refreshed
  return response!.accessToken;
}
```

**homeAccountId storage:** The `homeAccountId` from the initial `acquireTokenByCode` response MUST be stored in `organisations` so it can be retrieved on subsequent Vercel invocations. Add `ms_home_account_id TEXT DEFAULT NULL` column to `organisations`.

### Pattern 4: OAuth2 Connect + Callback Flow

**What:** The connect route generates a MSAL auth URL with CSRF state cookie; the callback exchanges the code, acquires the initial token set (which populates the cache), serializes and persists the cache, then redirects to Settings.

**Example:**

```typescript
// app/api/auth/onedrive/connect/route.ts
import { ConfidentialClientApplication } from '@azure/msal-node';
import { randomBytes } from 'crypto';

export async function GET() {
  // Lazy init — not at module level
  const msalClient = new ConfidentialClientApplication({
    auth: {
      clientId: process.env.MS_CLIENT_ID!,
      authority: 'https://login.microsoftonline.com/common',
      clientSecret: process.env.MS_CLIENT_SECRET!,
    },
  });

  const state = randomBytes(32).toString('hex');
  const authUrl = await msalClient.getAuthCodeUrl({
    scopes: ['Files.ReadWrite', 'offline_access'],
    redirectUri: process.env.MS_REDIRECT_URI!,
    state,
    prompt: 'consent', // Ensures refresh token is included; forces account picker
  });

  const response = NextResponse.redirect(authUrl);
  response.cookies.set('ms_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  return response;
}
```

```typescript
// app/api/auth/onedrive/callback/route.ts (key logic)
const tokenResponse = await msalClient.acquireTokenByCode({
  code: code!,
  redirectUri: process.env.MS_REDIRECT_URI!,
  scopes: ['Files.ReadWrite', 'offline_access'],
});

// tokenResponse.account.homeAccountId — store this in organisations
// The token cache is now populated in memory; afterCacheAccess will persist it
```

**AADSTS53003 handling:** The `acquireTokenByCode` call will throw if Conditional Access blocks the token issuance. Catch the error and inspect `error.message` for the string `'AADSTS53003'`:

```typescript
try {
  const tokenResponse = await msalClient.acquireTokenByCode({ ... });
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('AADSTS53003')) {
    return NextResponse.redirect(
      '/settings?tab=storage&error=conditional_access_blocked'
    );
  }
  return NextResponse.redirect('/settings?tab=storage&error=auth_failed');
}
```

### Pattern 5: OneDrive Upload via Path-Based PUT

**What:** Use the Graph REST API path-based endpoint to upload files directly to `Apps/Prompt/{client}/{filing}/{year}/{filename}` without pre-creating folders. OneDrive auto-creates the folder hierarchy on PUT.

**Upload endpoint:**
```
PUT https://graph.microsoft.com/v1.0/me/drive/root:/Apps/Prompt/{client_name}/{filing_type}/{tax_year}/{filename}:/content
Authorization: Bearer {access_token}
Content-Type: {mimeType}
[body: file bytes]
```

**Key advantage over Google Drive:** No `findOrCreateFolder` helper needed. OneDrive's path-based PUT creates all intermediate folders automatically. The response includes the item `id`, which becomes the `storagePath` stored in `client_documents.storage_path`.

**For files > 4 MB:** Use `POST /me/drive/root:/path/to/file:/createUploadSession` then PUT byte ranges. See Phase 29 (HRDN-01) for chunked upload sessions — Phase 26 uses simple PUT for files ≤ 4 MB.

### Pattern 6: Download via @microsoft.graph.downloadUrl

**What:** To get a pre-authenticated temporary download URL, fetch the item metadata with `$select=id,@microsoft.graph.downloadUrl`. The URL is valid for a short time (minutes, exact duration undisclosed by Microsoft) and requires no Authorization header when accessed.

**Example:**

```typescript
// GET /me/drive/items/{itemId}?$select=id,@microsoft.graph.downloadUrl
const response = await fetch(
  `https://graph.microsoft.com/v1.0/me/drive/items/${storagePath}?$select=id,%40microsoft.graph.downloadUrl`,
  { headers: { Authorization: `Bearer ${accessToken}` } }
);
const data = await response.json();
const downloadUrl = data['@microsoft.graph.downloadUrl'];
// downloadUrl is pre-authenticated — return it directly as the download URL
```

**Note:** The `@` in `@microsoft.graph.downloadUrl` must be URL-encoded as `%40` when used in a `$select` query parameter. The response JSON key is literally `@microsoft.graph.downloadUrl`.

### Anti-Patterns to Avoid

- **Module-level `ConfidentialClientApplication`:** Must be created per-request with the org-specific `cachePlugin`. Module-level fails at build time without env vars and cannot be per-org.
- **Sharing one MSAL cache blob across all orgs:** Each org has its own `ms_token_cache_enc` column. Never load another org's cache into a client.
- **Using `@azure/msal-browser` in server code:** Browser-only, crashes in Node.js serverless. This is in the project's Out of Scope list for a reason.
- **Deriving storage path from org config at download time:** Always use `doc.storage_backend` from `client_documents`, never `org.storage_backend`. This is a global rule established in Phase 24.
- **Using `Files.ReadWrite.AppFolder` scope:** Not supported for M365 business accounts. Use `Files.ReadWrite` with path-based `Apps/Prompt/` enforcement instead.
- **Encrypting individual tokens before storing in MSAL cache:** MSAL manages its own cache format internally. Do NOT attempt to encrypt individual access or refresh tokens — encrypt the entire serialized cache blob as a unit via `encryptToken(cacheContext.tokenCache.serialize())`.
- **Not storing `homeAccountId`:** Without it, `getAccountByHomeId()` cannot look up the account after cache deserialization, making `acquireTokenSilent` impossible.
- **Assuming `@microsoft.graph.downloadUrl` is cacheable:** It expires within minutes. Always fetch it fresh before returning to the client.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth2 token exchange, refresh, silent renewal | Custom refresh token rotation logic | `@azure/msal-node` `ConfidentialClientApplication.acquireTokenSilent()` | MSAL handles refresh token rotation, multi-account, Conditional Access challenges, and silent renewal with proactive refresh |
| Token cache persistence | Manual JSON serialization and update logic | `ICachePlugin` interface with `cacheContext.tokenCache.serialize()` | MSAL's cache format is opaque and versioned — serialize() / deserialize() is the only stable interface |
| CSRF state validation | Session store or database | HttpOnly cookie (same pattern as Phase 25 Google Drive) | Stateless, no server-side session storage needed; 10-minute TTL prevents replay |
| Folder creation before upload | `findOrCreateFolder` equivalent (needed in Google Drive) | Path-based PUT `PUT /me/drive/root:/path/to/file:/content` | OneDrive creates intermediate folders automatically; no folder ID tracking needed |

**Key insight:** The biggest difference from Google Drive is that MSAL's token cache is a black box — the correct approach is to treat the serialized blob as an opaque string. Do not try to parse or modify individual tokens within the cache.

---

## Common Pitfalls

### Pitfall 1: MSAL `common` Authority and Token Validation

**What goes wrong:** Using the `/common` authority endpoint means the token issuer (`iss` claim) in the returned JWT will be either `https://login.microsoftonline.com/{tenant-id}/v2.0` (M365 business) or `https://login.microsoftonline.com/9188040d-6c67-4c5b-b112-36a304b66dad/v2.0` (personal account). If the callback route validates the issuer strictly, personal account tokens will be rejected.

**Why it happens:** The `/common` authority does not have a fixed tenant ID — it routes to the user's actual tenant. Server-side token validation must accept multiple issuers.

**How to avoid:** Do NOT validate the JWT issuer in the callback route. Trust MSAL to validate the token internally — MSAL handles `/common` authority issuer validation. If you add your own JWT verification layer, use `validateAuthority: false` in MSAL config or accept `*` issuers.

**Warning signs:** Callback redirects to error page for personal Microsoft accounts but not M365 accounts (or vice versa).

### Pitfall 2: Missing `offline_access` Scope

**What goes wrong:** Without `offline_access` in the scopes array, Microsoft does not issue a refresh token. The MSAL cache will contain only an access token (1-hour TTL). After expiry, `acquireTokenSilent` fails and the accountant must reconnect.

**Why it happens:** `offline_access` is required to request a refresh token from the Microsoft identity platform. It is NOT included by default.

**How to avoid:** Always include `'offline_access'` in the scopes array for both `getAuthCodeUrl` and `acquireTokenByCode`:
```typescript
scopes: ['Files.ReadWrite', 'offline_access']
```

**Warning signs:** `acquireTokenSilent` fails with `InteractionRequiredAuthError` 1 hour after initial connect.

### Pitfall 3: MSAL Cache Not Persisted After acquireTokenByCode

**What goes wrong:** The `PostgresMsalCachePlugin` is only injected when creating the `ConfidentialClientApplication`. If the callback route creates a `ConfidentialClientApplication` WITHOUT the cache plugin (e.g., as a temporary client just for token exchange), `afterCacheAccess` never fires and the cache is never written to Postgres.

**Why it happens:** The callback route might create a minimal MSAL client without a `cachePlugin` for the initial `acquireTokenByCode` call.

**How to avoid:** The callback route MUST create the `ConfidentialClientApplication` with the `PostgresMsalCachePlugin` configured (providing the `orgId` from the logged-in user's org). After `acquireTokenByCode` completes, `afterCacheAccess` fires automatically if the cache has changed — this persists the initial token set to Postgres.

**Warning signs:** `ms_token_cache_enc` is `NULL` in the database after the OAuth connect flow completes.

### Pitfall 4: `acquireTokenSilent` Fails on Empty Cache

**What goes wrong:** If `ms_token_cache_enc` is `NULL` or the `homeAccountId` stored in `organisations` does not match any account in the deserialized cache, `getAccountByHomeId()` returns `null` and `acquireTokenSilent` throws.

**Why it happens:** Cache was not persisted correctly, the encryption key was rotated, or the `homeAccountId` was not stored correctly after initial connect.

**How to avoid:** Check `account === null` after `getAccountByHomeId()` and set `storage_backend_status = 'reauth_required'` explicitly, then throw. The re-auth banner (Phase 28) will surface this to the accountant.

**Warning signs:** Upload/download fails with "OneDrive session not found" error for all uploads, not intermittently.

### Pitfall 5: AADSTS53003 Not Caught Specifically

**What goes wrong:** Conditional Access errors thrown during `acquireTokenByCode` are caught as generic errors and displayed as "authentication failed" — accountant has no actionable guidance.

**Why it happens:** AADSTS53003 is a server error thrown as a standard `Error` with the error code embedded in `error.message`. It does not throw a dedicated typed class in MSAL Node.

**How to avoid:** After catching any error in the callback route, inspect `error.message.includes('AADSTS53003')` before the generic fallback:
```typescript
catch (error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes('AADSTS53003')) {
    return NextResponse.redirect('/settings?tab=storage&error=conditional_access_blocked');
  }
  return NextResponse.redirect('/settings?tab=storage&error=auth_failed');
}
```
The Settings UI must handle `error=conditional_access_blocked` with a specific message: "Your IT admin has blocked this app with a Conditional Access policy. Ask your IT admin to grant consent for Prompt in Azure Active Directory."

**Warning signs:** M365 accounts with Conditional Access policies see a generic "something went wrong" error instead of actionable guidance.

### Pitfall 6: `homeAccountId` Not Stored in `organisations`

**What goes wrong:** After the initial OAuth connect, the `homeAccountId` from `tokenResponse.account.homeAccountId` is not persisted. On subsequent requests, `getAccountByHomeId()` has no ID to look up, causing all `acquireTokenSilent` calls to fail.

**Why it happens:** The callback route stores the cache blob but forgets to also store the `homeAccountId`.

**How to avoid:** The `organisations` table needs a `ms_home_account_id TEXT DEFAULT NULL` column (add in the Phase 26 schema migration). Store `tokenResponse.account.homeAccountId` there during the callback. Both `ms_home_account_id` and `ms_token_cache_enc` must be written in the same DB update.

**Warning signs:** Uploads fail immediately after initial connect even though the cache blob is present in the DB.

### Pitfall 7: Path Encoding in Graph API Requests

**What goes wrong:** Client names or filing types containing special characters (spaces, apostrophes, slashes) break the path-based Graph API URL.

**Why it happens:** The Graph API path-based syntax (`/me/drive/root:/Apps/Prompt/{client_name}:/content`) uses colon-delimited path encoding. Spaces and special characters in the path must be URL-encoded.

**How to avoid:** URL-encode path segments: `encodeURIComponent(clientName)` for each path segment before assembling the URL. Do NOT encode the `/` separators between segments.

**Warning signs:** 400 or 404 errors from Graph API for clients with spaces or special characters in their name.

---

## Code Examples

Verified patterns from official sources:

### ICachePlugin Implementation (Postgres-backed)

```typescript
// Source: Microsoft Learn — Token caching in MSAL Node
// https://learn.microsoft.com/en-us/entra/msal/javascript/node/caching
import type { ICachePlugin, TokenCacheContext } from '@azure/msal-node';
import { createAdminClient } from '@/lib/supabase/admin';
import { encryptToken, decryptToken } from '@/lib/crypto/tokens';

export class PostgresMsalCachePlugin implements ICachePlugin {
  constructor(private readonly orgId: string) {}

  async beforeCacheAccess(cacheContext: TokenCacheContext): Promise<void> {
    const admin = createAdminClient();
    const { data } = await admin
      .from('organisations')
      .select('ms_token_cache_enc')
      .eq('id', this.orgId)
      .single();

    if (data?.ms_token_cache_enc) {
      cacheContext.tokenCache.deserialize(decryptToken(data.ms_token_cache_enc));
    }
  }

  async afterCacheAccess(cacheContext: TokenCacheContext): Promise<void> {
    if (cacheContext.cacheHasChanged) {
      const encrypted = encryptToken(cacheContext.tokenCache.serialize());
      await createAdminClient()
        .from('organisations')
        .update({ ms_token_cache_enc: encrypted })
        .eq('id', this.orgId);
    }
  }
}
```

### ConfidentialClientApplication with Cache Plugin

```typescript
// Source: Microsoft Learn — ConfidentialClientApplication + ICachePlugin
import { ConfidentialClientApplication } from '@azure/msal-node';
import { PostgresMsalCachePlugin } from './msal-cache-plugin';

// NEVER call this at module level — lazy per-request
function createMsalClient(orgId: string): ConfidentialClientApplication {
  return new ConfidentialClientApplication({
    auth: {
      clientId: process.env.MS_CLIENT_ID!,
      authority: 'https://login.microsoftonline.com/common',
      clientSecret: process.env.MS_CLIENT_SECRET!,
    },
    cache: {
      cachePlugin: new PostgresMsalCachePlugin(orgId),
    },
  });
}
```

### acquireTokenSilent with homeAccountId

```typescript
// Source: Microsoft Learn — Accounts in MSAL Node
// https://learn.microsoft.com/en-us/entra/msal/javascript/node/accounts
async function getOneDriveAccessToken(orgId: string, homeAccountId: string): Promise<string> {
  const msalClient = createMsalClient(orgId); // triggers beforeCacheAccess on first use
  const tokenCache = msalClient.getTokenCache();

  const account = await tokenCache.getAccountByHomeId(homeAccountId);
  if (!account) {
    await createAdminClient()
      .from('organisations')
      .update({ storage_backend_status: 'reauth_required' })
      .eq('id', orgId);
    throw new Error('OneDrive account not found in cache — reauthorization required');
  }

  const result = await msalClient.acquireTokenSilent({
    account,
    scopes: ['Files.ReadWrite', 'offline_access'],
  });
  // afterCacheAccess fires automatically if tokens were refreshed

  return result!.accessToken;
}
```

### OneDrive Simple Upload (< 4 MB)

```typescript
// Source: Microsoft Learn — OneDrive upload docs + Graph API reference
// https://learn.microsoft.com/en-us/onedrive/developer/rest-api/api/driveitem_put_content
async function uploadToOneDrive(
  accessToken: string,
  pathSegments: { clientName: string; filingType: string; taxYear: string; filename: string },
  fileBuffer: Buffer,
  mimeType: string
): Promise<{ itemId: string }> {
  const { clientName, filingType, taxYear, filename } = pathSegments;
  const encodedPath = [
    encodeURIComponent(clientName),
    encodeURIComponent(filingType),
    encodeURIComponent(taxYear),
    encodeURIComponent(filename),
  ].join('/');

  const url = `https://graph.microsoft.com/v1.0/me/drive/root:/Apps/Prompt/${encodedPath}:/content`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': mimeType,
    },
    body: fileBuffer,
  });

  if (!response.ok) {
    throw new Error(`OneDrive upload failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  return { itemId: data.id }; // item ID is the storagePath in client_documents
}
```

### Download via @microsoft.graph.downloadUrl

```typescript
// Source: Microsoft Learn — Download driveItem content
// https://learn.microsoft.com/en-us/graph/api/driveitem-get-content?view=graph-rest-1.0
async function getOneDriveDownloadUrl(accessToken: string, itemId: string): Promise<string> {
  const url = `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}?$select=id,%40microsoft.graph.downloadUrl`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to get OneDrive item metadata: ${response.status}`);
  }

  const data = await response.json();
  const downloadUrl = data['@microsoft.graph.downloadUrl'];
  if (!downloadUrl) {
    throw new Error('OneDrive downloadUrl not returned — item may not be accessible');
  }

  return downloadUrl; // Pre-authenticated URL, valid for minutes, no Authorization header needed
}
```

### AADSTS53003 Error Detection in Callback

```typescript
// Source: Microsoft Learn — Handle errors in MSAL.js + community-verified pattern
// https://learn.microsoft.com/en-us/entra/identity-platform/msal-error-handling-js
try {
  const tokenResponse = await msalClient.acquireTokenByCode({
    code: code!,
    redirectUri: process.env.MS_REDIRECT_URI!,
    scopes: ['Files.ReadWrite', 'offline_access'],
  });
  // success path
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('AADSTS53003')) {
    return NextResponse.redirect(
      new URL('/settings?tab=storage&error=conditional_access_blocked', request.url)
    );
  }
  console.error('OneDrive OAuth callback error:', error);
  return NextResponse.redirect(
    new URL('/settings?tab=storage&error=auth_failed', request.url)
  );
}
```

---

## Comparison with Phase 25 (Google Drive)

Phase 26 is structurally analogous to Phase 25 but with these key differences that affect implementation:

| Aspect | Google Drive (Phase 25) | OneDrive (Phase 26) |
|--------|------------------------|---------------------|
| SDK | `@googleapis/drive` (includes `google-auth-library`) | `@azure/msal-node` + `@microsoft/microsoft-graph-client` |
| Token storage | Separate `access_token_enc` + `refresh_token_enc` + `expires_at` columns | Single `ms_token_cache_enc` blob (MSAL cache) + `ms_home_account_id` |
| Token refresh | Manual `withTokenRefresh` wrapper with proactive expiry check | `acquireTokenSilent` handles refresh internally; cache updated via `afterCacheAccess` |
| `withTokenRefresh` equivalent | Exists in `lib/storage/token-refresh.ts` | The `PostgresMsalCachePlugin` + `acquireTokenSilent` IS the equivalent; no separate wrapper file needed |
| Folder model | Creates `Prompt/` root folder on connect; stores folder ID; uses `findOrCreateFolder` for hierarchy | No folder creation on connect; path-based PUT creates hierarchy automatically |
| Stored folder reference | `google_drive_folder_id` column on `organisations` | No folder ID column needed — path is self-describing |
| Download approach | `getDownloadUrl()` throws — must use `getBytes()` server proxy | `getDownloadUrl()` returns `@microsoft.graph.downloadUrl` — pre-auth URL works directly |
| Error on token expiry | `invalid_grant` error code from Google | `InteractionRequiredAuthError` from MSAL |
| Conditional Access | N/A | `AADSTS53003` in error message |
| Schema columns needed | `google_drive_folder_id`, `google_token_expires_at` (Phase 25) | `ms_home_account_id` (new); `ms_token_cache_enc` already exists from Phase 24 |

---

## Schema Migration Required

Phase 26 needs one new column on `organisations`. The `ms_token_cache_enc` column already exists (Phase 24 STOR-03). Only `ms_home_account_id` is new:

```sql
ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS ms_home_account_id TEXT DEFAULT NULL;
```

`ms_home_account_id` stores the MSAL `homeAccountId` string from `tokenResponse.account.homeAccountId` after the initial `acquireTokenByCode`. This enables `getAccountByHomeId()` on subsequent invocations.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ADAL (Active Directory Authentication Library) | MSAL (Microsoft Authentication Library) | 2020 — ADAL officially deprecated | MSAL supports both personal and work accounts via `/common` authority; ADAL did not |
| Storing refresh token as a plain string | MSAL token cache blob (opaque JSON) | MSAL v1+ | MSAL manages token rotation, multi-resource tokens, and cache format internally |
| `Files.ReadWrite.AppFolder` scope | `Files.ReadWrite` with path enforcement | Always — AppFolder was never supported for business | Use `Files.ReadWrite`; enforce `Apps/Prompt/` path in application code |
| ADFS / tenant-specific authority | `/common` authority for multi-tenant apps | Azure AD v2 endpoint | Single app registration supports personal and M365 business accounts |

**Deprecated/outdated:**
- `@azure/identity` for user OAuth2 flows: correct for machine-to-machine (managed identities, service principals) but not for user OAuth2 delegated flows. Use `@azure/msal-node` for user flows.
- `@azure/msal-browser`: browser-only package; crashes in Node.js. Never import in Next.js server code.
- `adal-node`: deprecated, no longer maintained. Use `@azure/msal-node`.

---

## Open Questions

1. **`@microsoft/microsoft-graph-client` vs raw `fetch` for Graph API calls**
   - What we know: The Graph SDK (3.x) provides a typed client and `LargeFileUploadTask` helper. Raw `fetch` works for all simple PUT/GET/DELETE operations.
   - What's unclear: The Graph SDK docs mention that Node.js 18 users should add `--no-experimental-fetch` flag. This is a potential friction point with Next.js 16's runtime.
   - Recommendation: Use raw `fetch` for Phase 26 uploads, downloads, and deletes. This avoids the SDK dependency and potential Node.js 18 fetch conflicts. Only adopt the Graph SDK if `LargeFileUploadTask` is needed (Phase 29 HRDN-01). The Graph client package can be installed optionally later.

2. **`reauth_required` handling for MSAL — what replaces `invalid_grant` detection?**
   - What we know: For Google Drive, the `invalid_grant` error from Google signals permanent token revocation, handled in `withTokenRefresh`. For MSAL, `acquireTokenSilent` throws `InteractionRequiredAuthError` when the refresh token is expired or revoked.
   - What's unclear: Whether MSAL's `InteractionRequiredAuthError` should always trigger `reauth_required`, or only on specific sub-codes.
   - Recommendation: Catch `InteractionRequiredAuthError` from `acquireTokenSilent` and treat it as permanent reauth required (same as `invalid_grant` for Google). Set `storage_backend_status = 'reauth_required'`, clear `ms_token_cache_enc` and `ms_home_account_id`. Import `InteractionRequiredAuthError` from `@azure/msal-node` for type-checking.

3. **Phase 26 Settings UI card for OneDrive connect/disconnect**
   - What we know: Phase 28 owns the full Settings UI (TOKEN-01). Phase 26 only needs the OAuth connect/callback routes and the `OneDriveProvider` class.
   - Recommendation: Phase 26 does NOT build the Settings UI card — that is Phase 28's responsibility. The connect route (`/api/auth/onedrive/connect`) and disconnect server action are Phase 26 deliverables, but the card rendering is Phase 28.

---

## Validation Architecture

> `workflow.nyquist_validation` is `false` in `.planning/config.json` — skip this section.

---

## Sources

### Primary (HIGH confidence)
- Microsoft Learn — Token caching in MSAL Node: https://learn.microsoft.com/en-us/entra/msal/javascript/node/caching
- Microsoft Learn — Acquiring tokens in MSAL Node: https://learn.microsoft.com/en-us/entra/msal/javascript/node/acquire-token-requests
- Microsoft Learn — Accounts in MSAL Node: https://learn.microsoft.com/en-us/entra/msal/javascript/node/accounts
- Microsoft Learn — Download driveItem content (Graph API): https://learn.microsoft.com/en-us/graph/api/driveitem-get-content?view=graph-rest-1.0
- Microsoft Learn — Create upload session (Graph API): https://learn.microsoft.com/en-us/graph/api/driveitem-createuploadsession?view=graph-rest-1.0
- Microsoft Learn — What is an App Folder (OneDrive): https://learn.microsoft.com/en-us/onedrive/developer/rest-api/concepts/special-folders-appfolder?view=odsp-graph-online
- Microsoft Q&A — Files.ReadWrite.AppFolder personal-only confirmation: https://learn.microsoft.com/en-us/answers/questions/1418013/when-is-api-permission-(delegated)-files-readwrite
- STATE.md v5.0 pre-research decisions — `@azure/msal-node`, `/common` authority, `ICachePlugin`, `Files.ReadWrite` scope choices locked before Phase 26

### Secondary (MEDIUM confidence)
- Microsoft Learn — Handle errors in MSAL.js: https://learn.microsoft.com/en-us/entra/identity-platform/msal-error-handling-js (AADSTS53003 detection pattern)
- Microsoft Learn — Uploading files to OneDrive: https://learn.microsoft.com/en-us/onedrive/developer/rest-api/concepts/upload?view=odsp-graph-online (4 MB simple PUT limit)
- npm — @azure/msal-node version 5.0.5 (latest): confirmed via WebSearch 2026-02-28
- Phase 25 PLAN files (25-01, 25-02, 25-03): OAuth connect/callback pattern, GoogleDriveProvider structure — directly analogous

### Tertiary (LOW confidence)
- AADSTS53003 error code inclusion in `error.message` (vs typed property): confirmed by multiple Q&A sources but official MSAL Node docs do not show a typed `AADSTS53003` property; string inspection is the pragmatic approach.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — `@azure/msal-node` is Microsoft's official SDK; version 5.0.5 confirmed on npm 2026-02-28; ICachePlugin documented in official Microsoft Learn
- Architecture: HIGH — ICachePlugin pattern documented with working code examples; `Files.ReadWrite.AppFolder` limitation verified in official Microsoft Q&A and permissions reference; path-based PUT confirmed in Graph API docs; download URL pattern confirmed in official Graph docs
- Pitfalls: MEDIUM-HIGH — AADSTS53003 string detection is LOW (no typed property in official docs); other pitfalls (offline_access scope, homeAccountId storage, cache not persisted without cachePlugin) are HIGH confidence based on official docs

**Research date:** 2026-02-28
**Valid until:** 2026-03-28 (MSAL and Graph API are stable; ICachePlugin interface is unlikely to change in a 30-day window)
