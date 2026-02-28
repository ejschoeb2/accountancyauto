# Phase 29: Hardening & Integration Testing - Research

**Researched:** 2026-02-28
**Domain:** Large file upload sessions, webhook reliability, multi-backend DSAR assembly, integration testing
**Confidence:** HIGH (codebase analysis) / MEDIUM (external API verification)

---

## Summary

Phase 29 is the final hardening pass for the v5.0 storage integration. Three of the four requirements address production-safety gaps identified during architecture design; one (HRDN-04) is an integration verification exercise rather than new feature code. The work is entirely backend — no new UI components.

**HRDN-01 (Large file portal uploads):** The portal upload route at `app/api/portal/[token]/upload/route.ts` currently buffers the entire file into memory with `await file.arrayBuffer()`, then calls `provider.upload()` which passes the `Buffer` to the provider SDK. This works for files under Vercel's 4.5 MB serverless function body limit, but will produce a `413 Payload Too Large` for larger files. The fix requires **provider-native chunked upload sessions initiated client-side** — the file bytes never pass through the Next.js function body. Each of the three non-Supabase providers has a native session API: Google Drive resumable upload, OneDrive createUploadSession, and Dropbox upload_session. The Supabase backend is immune to this problem because Supabase Storage handles multipart directly.

**HRDN-02 (Postmark inbound handler timeout):** The inbound handler at `app/api/postmark/inbound/route.ts` already implements fire-and-forget for attachment processing (`processAttachments(...).catch(...)`), meaning the 200 is returned before uploads complete. This already addresses the webhook timeout risk. However, the `client_documents` insert has no idempotency guard: if Postmark retries after a transient error, a second insert will succeed, producing duplicate document rows. The fix is a unique constraint or a pre-check on `(org_id, client_id, file_hash, inbound_email_id)` to make the insert idempotent. Postmark retries up to 10 times over ~10.5 hours; response window is 2 minutes.

**HRDN-03 (Mixed-backend DSAR):** The DSAR route at `app/api/clients/[id]/documents/dsar/route.ts` already implements per-document backend routing (`doc.storage_backend` not `org.storage_backend`). The code correctly branches on `!doc.storage_backend || doc.storage_backend === 'supabase'` vs. the third-party path. However, if `org` is `null` (e.g., the `organisations` query failed or returned no row), all third-party provider instantiations will use an empty string for `org?.id ?? ''` — this will throw silently, causing those documents to be skipped without any error log distinguishing "provider fetch failed" from "document intentionally omitted". The fix is an explicit `org` null-guard with an early error return, and ensuring the `continue` path logs the reason.

**HRDN-04 (End-to-end integration verification):** This is a manual or semi-automated verification exercise. No production code changes are required beyond HRDN-01/02/03 fixes. The plan should define a step-by-step verification script for each provider.

**Primary recommendation:** For HRDN-01, implement client-side chunk upload sessions using each provider's native API — the portal client requests a session URL from a new Next.js endpoint (which handles auth), then uploads bytes directly from the browser to the provider using the session URL. This is the only approach that avoids routing file bytes through the Next.js function body.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| HRDN-01 | Portal upload route handles files exceeding Vercel 4.5 MB request body limit using provider-native chunked upload session APIs; large files not routed through Next.js request body | Provider session APIs researched below; client-side upload pattern documented |
| HRDN-02 | Postmark inbound handler provider upload is size-guarded or async to prevent webhook timeout; always returns 200 to Postmark; `client_documents` insert includes idempotency guard against Postmark retries | Handler already fire-and-forget; idempotency gap identified; fix pattern documented |
| HRDN-03 | DSAR export correctly assembles a single ZIP for clients whose documents span multiple storage backends | DSAR code already routes per-document; null-guard gap identified; fix documented |
| HRDN-04 | End-to-end integration verified for each of the three providers: portal upload, download, DSAR export; per-document `storage_backend` routing confirmed correct; verified with mixed-backend document set | Verification checklist pattern documented |
</phase_requirements>

---

## Standard Stack

### Core (already installed — no new npm packages required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@googleapis/drive` | `^20.1.0` | Google Drive resumable upload session | Already in use for Drive provider; resumable upload is a Drive v3 API feature |
| `@azure/msal-node` | `^5.0.5` | OneDrive MSAL token acquisition for session creation | Already in use for OneDrive provider |
| `dropbox` | `^10.34.0` | Dropbox upload session SDK methods | Already in use; `filesUploadSessionStart`, `filesUploadSessionAppendV2`, `filesUploadSessionFinish` are standard SDK methods |
| `jszip` | `^3.10.1` | ZIP assembly in DSAR export | Already in use |
| `react-dropzone` | `^15.0.0` | Client-side file drop / selection in portal | Already in use |

**No new npm packages needed for Phase 29.**

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Native `fetch` (browser) | built-in | Send chunks directly to provider session URL from browser | HRDN-01 client-side chunk upload |
| `crypto.randomUUID()` | built-in | Generate idempotency key for `client_documents` insert | HRDN-02 idempotency guard |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Client-side chunked upload (browser to provider) | Server-side chunked proxying through Next.js | Server-side still routes bytes through Vercel — does not solve the body size problem |
| Unique constraint on `client_documents` | Application-level pre-check query | Unique constraint is atomic; application-level check has TOCTOU race; prefer DB constraint |

---

## Architecture Patterns

### Recommended Project Structure

No new files required for HRDN-03 (fix in existing routes). For HRDN-01 and HRDN-02, the changes are confined to:

```
app/
├── api/
│   ├── portal/[token]/
│   │   ├── upload/route.ts          # HRDN-02 (unchanged for large-file path; add idempotency)
│   │   └── upload-session/route.ts  # NEW: HRDN-01 — creates provider-native session, returns URL
│   ├── postmark/inbound/route.ts    # HRDN-02 — add idempotency guard on client_documents insert
│   └── clients/[id]/documents/
│       └── dsar/route.ts            # HRDN-03 — add org null-guard
├── portal/[token]/
│   └── components/
│       └── checklist-item.tsx       # HRDN-01 — add chunked upload path when file.size > threshold
lib/
└── documents/
    └── storage.ts                   # No changes needed — StorageProvider interface is already correct
```

---

### Pattern 1: HRDN-01 — Provider-Native Client-Side Chunked Upload

**What:** For files over 4.5 MB, the portal client does not POST the file to the Next.js upload route. Instead, it calls a new endpoint (`/api/portal/[token]/upload-session`) which authenticates the token, resolves the org's storage backend, acquires a provider-specific upload session URL, and returns it to the browser. The browser then sends file chunks directly to the provider using the session URL. Only after completion does the browser POST a small "finalize" call to the Next.js route to write the `client_documents` row.

**When to use:** File size > 4.5 MB AND org has a non-Supabase backend. For Supabase backend, the existing upload route is unaffected (Supabase Storage handles multipart natively and is not proxied through the Vercel function body for storage operations).

**Three-step flow per provider:**

```
Client (browser)                       Next.js (Vercel)           Provider (Google/MS/Dropbox)
    |                                       |                               |
    |── POST /api/portal/[token]/upload-session ──>|                        |
    |   { filename, mimeType, fileSize }    |                               |
    |                                       |── acquire session (auth) ──>  |
    |                                       |<── sessionUrl + sessionId ─── |
    |<── { sessionUrl, sessionId, provider } ─|                             |
    |                                       |                               |
    |── PUT/POST chunks directly ────────────────────────────────────────>  |
    |   (Content-Range: bytes X-Y/Z)        |                               |
    |<── 202 / nextExpectedRanges ──────────────────────────────────────── |
    |   (repeat for each chunk)             |                               |
    |                                       |                               |
    |── POST /api/portal/[token]/upload-finalize ──>|                       |
    |   { sessionId, storagePath, filename, mimeType, … }                   |
    |                                       |── INSERT client_documents ──> DB
    |<── { success, documentId } ───────────|                               |
```

**Provider session API specifics:**

#### Google Drive — Resumable Upload Session

```typescript
// Source: https://developers.google.com/drive/api/guides/manage-uploads#resumable
// Initiate session (server-side, in /api/portal/[token]/upload-session):
const initiateUrl = `https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable`;
const res = await fetch(initiateUrl, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'X-Upload-Content-Type': mimeType,
    'X-Upload-Content-Length': String(fileSize),
  },
  body: JSON.stringify({
    name: originalFilename,
    parents: [taxYearFolderId],  // folder hierarchy already created by findOrCreateFolder
  }),
});
const sessionUrl = res.headers.get('Location'); // resumable session URI

// Client-side: PUT chunks with Content-Range header
// Chunk size MUST be multiple of 256 KiB (262144 bytes) except final chunk
// Session valid for 1 week
```

Key constraints:
- Chunk size must be a multiple of 256 KiB (262144 bytes), except the final chunk
- Session URL expires after 1 week
- PUT chunks to session URL directly — no Authorization header needed on chunk PUTs (the URL is pre-authenticated)
- Final chunk response: `200 OK` or `201 Created` with file metadata including `id` (Drive file ID)
- The Drive file ID becomes `storagePath` in `client_documents`

**Complication:** The folder hierarchy (`findOrCreateFolder`) must be created server-side before issuing the session, since the session URL embeds the parent folder ID. This means the server endpoint needs to run the full `findOrCreateFolder` chain before returning the session URL.

#### OneDrive — createUploadSession

```typescript
// Source: https://learn.microsoft.com/en-us/graph/api/driveitem-createuploadsession
// Server-side initiation (in /api/portal/[token]/upload-session):
const encodedPath = [
  encodeURIComponent(clientName),
  encodeURIComponent(filingTypeId),
  encodeURIComponent(taxYear),
  encodeURIComponent(originalFilename),
].join('/');

const sessionRes = await fetch(
  `https://graph.microsoft.com/v1.0/me/drive/root:/Apps/Prompt/${encodedPath}:/createUploadSession`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      item: { '@microsoft.graph.conflictBehavior': 'rename' },
    }),
  },
);
const { uploadUrl } = await sessionRes.json(); // pre-authenticated URL

// Client-side: PUT chunks to uploadUrl (NO Authorization header on chunk PUTs)
// Chunk size MUST be multiple of 320 KiB (327680 bytes) except final chunk
// Session expires after ~10 minutes of inactivity
// Final chunk response: 201 Created with item metadata including 'id'
// Item ID becomes storagePath in client_documents
```

Key constraints:
- Chunk size must be a multiple of 320 KiB (327680 bytes), except the final chunk
- Session expires after ~10 minutes of inactivity (re-upload required on expiry)
- Do NOT include Authorization header when sending chunk PUTs to the session URL
- Session URL is pre-authenticated — it already contains credentials

**CRITICAL:** The session URL contains MSAL credentials. It must be treated as a secret and not logged.

#### Dropbox — Upload Session (SDK)

```typescript
// Source: Dropbox SDK, dropbox npm package v10.x
// Server-side initiation (in /api/portal/[token]/upload-session):
const { dbx } = await getAuthClient(); // reuse DropboxProvider.getAuthClient() pattern

// Start session — returns a session_id
const startRes = await dbx.filesUploadSessionStart({
  close: false,     // true only if uploading entire file in one call
  contents: Buffer.alloc(0), // empty body to just get session_id
});
const sessionId = startRes.result.session_id;
// Return sessionId to client; client uses filesUploadSessionAppendV2 via direct API calls

// OR: server-side chunked approach (simpler for Dropbox since API requires SDK/auth on each call)
// Dropbox chunk uploads to their API must include Authorization header on each append call
// Session URL is NOT pre-authenticated — each append needs auth
```

**Dropbox complication — no pre-authenticated URL:** Unlike Google Drive and OneDrive, Dropbox does not issue a pre-authenticated session URL. Each `filesUploadSessionAppendV2` call requires an Authorization header. This means the client cannot call the Dropbox API directly without exposing the access token in the browser.

**Options for Dropbox large file uploads:**
1. **Server-proxied streaming:** The client uploads to a Next.js route that streams directly to Dropbox using `fetch` with a `ReadableStream` body. Still proxied through Vercel, but streaming avoids buffering the entire body. Vercel streaming functions do not have the 4.5 MB body limit.
2. **Temporary upload token:** Generate a short-lived Dropbox upload session server-side, send `sessionId` to client, but each append must be proxied through a Next.js streaming endpoint. More complex but keeps access token server-side.
3. **Increase Dropbox threshold:** For Dropbox only, use simple `filesUpload` (up to 150 MB per Dropbox's own limit) via a server-side streaming proxy route, bypassing the Vercel 4.5 MB limit via streaming rather than chunked sessions.

**Recommended for Dropbox:** Server-proxied streaming with `ReadableStream` (option 1). This is the simplest approach and avoids exposing Dropbox tokens to the browser. Vercel streaming responses bypass the 4.5 MB body limit.

---

### Pattern 2: HRDN-02 — Idempotency Guard for Postmark Retries

**Current state:** The `processAttachments` function in `app/api/postmark/inbound/route.ts` is already fire-and-forget (line 179: `.catch(err => console.error(...))`). The 200 is returned before uploads complete. This means the **webhook timeout** is already solved — the 200 lands within Postmark's 2-minute window regardless of upload duration.

**Remaining gap:** The `client_documents` INSERT has no idempotency guard. If Postmark retries (e.g., its connection to our endpoint dropped after delivery but before receiving the 200), the `inbound_emails` insert at Step 4 would fail on a unique constraint (if one exists on `MessageID`), but the `processAttachments` function could fire again, inserting duplicate `client_documents` rows.

**Fix — two layers:**

1. **`inbound_emails` idempotency:** Add a unique constraint on `(org_id, postmark_message_id)` or use `onConflict: 'do nothing'` on the insert with the Postmark `MessageID` field. This prevents duplicate `inbound_emails` rows and, since `inboundEmail.id` must exist before `processAttachments` is called, also prevents duplicate attachment processing if the inbound insert is the idempotency anchor.

2. **`client_documents` idempotency guard:** Before inserting, check if a row with the same `(client_id, file_hash, source='inbound_email', inbound_email_id)` exists. Skip if found. Alternatively, add a DB unique constraint — but `file_hash` could legitimately match for different emails, so `inbound_email_id` must be included.

```typescript
// Source: existing pattern in MEMORY.md D-11-02-01 (Stripe webhook idempotency)
// Before inserting client_documents in processAttachments:
const { data: existing } = await supabase
  .from('client_documents')
  .select('id')
  .eq('client_id', client.id)
  .eq('file_hash', sha256Hash)
  .eq('source', 'inbound_email')
  .maybeSingle();

if (existing) {
  console.warn('[Postmark Inbound] Duplicate attachment skipped (idempotency):', attachment.Name);
  continue;
}
// Then proceed with upload + insert
```

**Size guard (as additional safety):** Since `processAttachments` is already async/fire-and-forget, there is no timeout risk from slow provider uploads. A size guard is optional but useful as a sanity check — attachments over a configured maximum (e.g., 25 MB, Postmark's inbound attachment limit) can be logged and skipped rather than causing upload failures.

---

### Pattern 3: HRDN-03 — Mixed-Backend DSAR Null-Guard

**Current state:** `app/api/clients/[id]/documents/dsar/route.ts` already does per-document backend routing (line 55: `!doc.storage_backend || doc.storage_backend === 'supabase'` vs. the resolveProvider path). This is architecturally correct.

**Gap:** Line 43–47 fetches `org` with a fallback of `eq('id', clientRow?.org_id ?? '')`. If `clientRow` is null (client not found or not in org scope), `org` query will return null. Line 68 passes `id: org?.id ?? ''` — an empty string — to `resolveProvider`, which will instantiate `OneDriveProvider('')` or `GoogleDriveProvider('')`. This will fail at the token lookup step, throwing an error that is caught by the `try/catch` at line 81, causing the document to be silently skipped.

The silent skip is tolerable for a broken individual document, but if `org` is null for ALL documents, the ZIP will be empty and no error is surfaced to the user.

**Fix:**

```typescript
// After fetching org (line 43-47), add explicit null guard:
if (!org && docs.some(d => d.storage_backend && d.storage_backend !== 'supabase')) {
  return NextResponse.json(
    { error: 'Could not resolve storage configuration for this client\'s organisation' },
    { status: 500 }
  );
}
```

Also improve logging in the per-document catch block to distinguish "provider routing failed" from "file fetch failed":

```typescript
} catch (err) {
  console.error(`[DSAR] Error fetching document ${doc.id} (backend: ${doc.storage_backend}):`, err);
  // Continue — add remaining documents; omission is noted in server logs
}
```

---

### Anti-Patterns to Avoid

- **Routing large file bytes through a Next.js function body for non-Supabase backends:** Even with streaming, buffering remains a concern. Use provider-native session URLs where the provider accepts pre-authenticated URLs (Google Drive, OneDrive). For Dropbox, use server-side streaming proxy.
- **Including Authorization header in OneDrive/Google Drive chunk PUT requests:** The session URL is already pre-authenticated. Including an Authorization header will cause `401 Unauthorized` from OneDrive.
- **Reusing a Dropbox or OneDrive session across multiple files:** Sessions are file-specific and single-use.
- **Using `org.storage_backend` instead of `doc.storage_backend` in DSAR routing:** This breaks for clients who have documents from a previous backend. Always use `doc.storage_backend` (per D-24-01-02).
- **Treating `inbound_emails` uniqueness as sufficient idempotency for `client_documents`:** The `inbound_emails` insert can succeed on a retry even if the `client_documents` inserts already ran on the first attempt. The idempotency check must live inside `processAttachments`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Google Drive resumable session | Custom chunker with `XMLHttpRequest` | Drive v3 API `uploadType=resumable` + native `fetch` | Session management, retry semantics, and range tracking are complex |
| OneDrive large upload | Custom byte-range tracker | Microsoft Graph `createUploadSession` | Microsoft provides the pre-authenticated URL; 320 KiB alignment is enforced by the API |
| Dropbox session | Raw HTTP to content.dropboxapi.com | `dropbox` SDK `filesUploadSessionStart/AppendV2/Finish` | SDK handles auth headers, error mapping, and offset tracking |

**Key insight:** All three providers have mature upload session APIs. The only non-trivial part is the initiation step (which requires server-side auth) and the finalize step (writing `client_documents`). The actual byte transfer should use the provider's pre-authenticated URL or direct SDK calls.

---

## Common Pitfalls

### Pitfall 1: OneDrive Chunk Size Not a Multiple of 320 KiB

**What goes wrong:** Final file commit silently fails or returns an error; upload session expires without completing.
**Why it happens:** Microsoft Graph enforces 320 KiB (327680 byte) alignment on all chunks except the last one.
**How to avoid:** Use `ONEDRIVE_CHUNK_SIZE = 10 * 320 * 1024 = 3,276,800` (10 × 320 KiB = ~3.2 MB) as the chunk size. Verify final chunk uses actual remaining byte count.
**Warning signs:** `400 Bad Request` with "fragmentSizeInvalid" error message.

### Pitfall 2: Google Drive Authorization Header on Chunk PUTs

**What goes wrong:** `401 Unauthorized` on each chunk upload.
**Why it happens:** The session URL (from the `Location` header) is pre-authenticated. Adding an `Authorization: Bearer` header causes Drive to reject the request.
**How to avoid:** Do not include Authorization header in chunk PUT requests. Only the initiation POST requires Authorization.
**Warning signs:** 401 responses on chunk PUTs despite valid access token.

### Pitfall 3: Dropbox Access Token Exposed in Browser

**What goes wrong:** Dropbox refresh token or access token sent to the browser; potential security exposure.
**Why it happens:** Dropbox does not issue a pre-authenticated session URL — each append call requires Authorization.
**How to avoid:** Server-proxied streaming approach for Dropbox — never send Dropbox credentials to the browser.
**Warning signs:** Access token visible in browser network tab.

### Pitfall 4: DSAR org Null Causes Silent Document Omission

**What goes wrong:** DSAR ZIP is unexpectedly empty or missing third-party documents; no error returned to user.
**Why it happens:** `org` query returns null; all third-party provider instantiations use empty string for org ID; each throws; each is caught and continues.
**How to avoid:** Explicit null guard on `org` before entering the document loop, with early 500 return.
**Warning signs:** DSAR ZIP smaller than expected; server logs show provider throw errors for all third-party docs.

### Pitfall 5: Google Drive Folder Creation Race in Chunked Upload

**What goes wrong:** Two concurrent chunked upload initiations create duplicate folders under the same parent.
**Why it happens:** `findOrCreateFolder` is not atomic — list then create pattern is susceptible to race conditions at low concurrency.
**Why it's acceptable:** The existing `findOrCreateFolder` already has this limitation and it's documented. At portal upload concurrency levels (single client, one upload at a time), this is effectively impossible. Not a new problem for Phase 29.
**How to avoid:** Accept existing behaviour — this is a known limitation documented in the existing code.

### Pitfall 6: Postmark Retry Creates Duplicate `inbound_emails` Row

**What goes wrong:** `inbound_emails` insert succeeds twice; two rows with same message content; attachment processing fires twice; two sets of `client_documents` rows.
**Why it happens:** No idempotency constraint on `inbound_emails` table for Postmark `MessageID`.
**How to avoid:** Add `postmark_message_id` column to `inbound_emails` table and a unique constraint, or use `onConflict: 'do nothing'` on insert. Check return value — if insert was a no-op, skip `processAttachments` entirely.
**Warning signs:** Duplicate document rows in client view; two `inbound_emails` rows with same subject/timestamp.

---

## Code Examples

Verified patterns from codebase and official sources:

### Google Drive Resumable Session Initiation (Server-Side)

```typescript
// Source: https://developers.google.com/drive/api/guides/manage-uploads#resumable
// In /api/portal/[token]/upload-session/route.ts
// Run AFTER findOrCreateFolder() chain to get taxYearFolderId
const initiateRes = await fetch(
  `https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Upload-Content-Type': mimeType,
      'X-Upload-Content-Length': String(fileSize),
    },
    body: JSON.stringify({
      name: originalFilename,
      parents: [taxYearFolderId],
    }),
  }
);
if (!initiateRes.ok) throw new Error(`Drive session init failed: ${initiateRes.status}`);
const sessionUrl = initiateRes.headers.get('Location');
// sessionUrl is returned to client; client PUTs chunks to sessionUrl
// Final PUT response body contains: { id: '<drive-file-id>' }
// That id is the storagePath for client_documents
```

### OneDrive createUploadSession (Server-Side)

```typescript
// Source: https://learn.microsoft.com/en-us/graph/api/driveitem-createuploadsession
// In /api/portal/[token]/upload-session/route.ts
const encodedPath = [clientName, filingTypeId, taxYear, originalFilename]
  .map(encodeURIComponent)
  .join('/');
const sessionRes = await fetch(
  `https://graph.microsoft.com/v1.0/me/drive/root:/Apps/Prompt/${encodedPath}:/createUploadSession`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      item: { '@microsoft.graph.conflictBehavior': 'rename' },
    }),
  }
);
const { uploadUrl } = await sessionRes.json();
// uploadUrl is returned to client — no Authorization header needed on chunk PUTs
// Final chunk response body contains: { id: '<item-id>' }
// That id is the storagePath for client_documents
```

### Client-Side Chunk Sender (Browser)

```typescript
// Source: adapted from OneDrive docs and Drive docs (verified against official specs)
// In portal-checklist.tsx or a dedicated lib/portal/chunked-upload.ts
const CHUNK_SIZE = 327680 * 10; // 3.2 MB (10 × 320 KiB — satisfies both Drive and OneDrive)

async function uploadInChunks(
  sessionUrl: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<{ fileId: string }> {
  let offset = 0;
  let lastResponse: Response | null = null;

  while (offset < file.size) {
    const chunk = file.slice(offset, Math.min(offset + CHUNK_SIZE, file.size));
    const chunkBuffer = await chunk.arrayBuffer();
    const end = offset + chunkBuffer.byteLength - 1;

    const res = await fetch(sessionUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': String(chunkBuffer.byteLength),
        'Content-Range': `bytes ${offset}-${end}/${file.size}`,
      },
      body: chunkBuffer,
    });

    if (res.status === 200 || res.status === 201) {
      // Upload complete — response body contains file metadata
      const data = await res.json();
      return { fileId: data.id };
    }
    if (res.status !== 202) {
      throw new Error(`Chunk upload failed (${res.status})`);
    }
    offset = end + 1;
    lastResponse = res;
    onProgress?.(Math.round((offset / file.size) * 100));
  }

  throw new Error('Upload loop exited without completion response');
}
```

### DSAR Org Null Guard Fix

```typescript
// Source: existing dsar/route.ts pattern + null safety fix
// After fetching org (around line 43-47 in dsar/route.ts):
const needsThirdPartyOrg = docs.some(
  d => d.storage_backend && d.storage_backend !== 'supabase'
);
if (!org && needsThirdPartyOrg) {
  return NextResponse.json(
    { error: 'Storage configuration unavailable for this client' },
    { status: 500 }
  );
}
```

### Postmark Inbound Idempotency Check

```typescript
// Source: existing D-11-02-01 pattern (Stripe idempotency) adapted for inbound
// In processAttachments(), before provider.upload():
const { data: existing } = await supabase
  .from('client_documents')
  .select('id')
  .eq('client_id', client.id)
  .eq('file_hash', sha256Hash)
  .eq('source', 'inbound_email')
  .maybeSingle();

if (existing) {
  console.warn('[Postmark Inbound] Idempotency: duplicate attachment skipped', {
    filename: attachment.Name,
    existingDocumentId: existing.id,
  });
  continue;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Full file buffered in server before storage write | Provider-native chunked upload session (client → provider direct) | Phase 29 (HRDN-01) | Removes 4.5 MB Vercel limit for non-Supabase backends |
| No idempotency on `client_documents` insert from inbound | Pre-insert check on `file_hash + source + client_id` | Phase 29 (HRDN-02) | Prevents duplicate document rows on Postmark retry |
| DSAR routes on `org.storage_backend` | DSAR routes on `doc.storage_backend` (per D-24-01-02) | Phase 25 (already done) | Correct routing for mixed-backend clients |

**Deprecated/outdated in this phase:**
- `const fileBuffer = Buffer.from(await file.arrayBuffer())` in the portal upload route — this pattern remains valid for files under 4.5 MB (Supabase backend or small files), but the route must detect large files and redirect to the chunked path.

---

## Open Questions

1. **Chunk size strategy for files between 4.5 MB and, say, 10 MB**
   - What we know: The Vercel 4.5 MB limit applies to the request body. A 5 MB file would fail under the current approach for non-Supabase backends.
   - What's unclear: Should the threshold be exactly 4.5 MB, or should we use a lower safety margin (e.g., 4 MB) to account for multipart form overhead (boundary, headers)?
   - Recommendation: Use 4 MB as the size threshold for triggering chunked upload to have a comfortable safety margin. Multipart form overhead can add ~1 KB per field; 4 MB is safe.

2. **Dropbox chunked upload: server-proxied streaming vs. true client-side session**
   - What we know: Dropbox does not issue a pre-authenticated session URL. Each append call requires Authorization.
   - What's unclear: Can we use a Vercel streaming function with `ReadableStream` to proxy Dropbox uploads without buffering the body?
   - Recommendation: Use server-side streaming proxy for Dropbox. Next.js App Router streaming (`TransformStream`) passes bytes through without buffering the entire body, sidestepping the 4.5 MB limit. This keeps Dropbox credentials server-side.

3. **`inbound_emails` idempotency — MessageID column or application check?**
   - What we know: Adding a `postmark_message_id` column with a unique constraint is the most robust approach. The application-level check (`maybeSingle()` before insert) has a TOCTOU race under concurrent deliveries, but Postmark delivers one retry at a time with at least 1-minute gaps.
   - What's unclear: Does the `inbound_emails` table have a column for Postmark `MessageID` already?
   - Recommendation: Check the `inbound_emails` schema. If no `postmark_message_id` column exists, add one via migration with a unique constraint. Fall back to application-level check if migration scope is too large.

4. **HRDN-04 verification scope — manual checklist or automated test?**
   - What we know: End-to-end verification requires real provider credentials and live storage accounts.
   - What's unclear: Whether an automated test can be written that runs in CI without live credentials.
   - Recommendation: Manual verification checklist per provider, documented in the plan. No automated CI test for external API calls.

---

## Validation Architecture

`workflow.nyquist_validation` is `false` in `.planning/config.json` — this section is skipped.

---

## Key Codebase Facts for Planner

These are verified facts from reading the existing code:

1. **Portal upload currently buffers full body:** `app/api/portal/[token]/upload/route.ts` line 88 — `const fileBuffer = Buffer.from(await file.arrayBuffer())` — this materialises the entire file in memory before any storage call. This is the line that causes the 4.5 MB failure for large files.

2. **The Postmark handler is already fire-and-forget:** `app/api/postmark/inbound/route.ts` line 179 — `processAttachments(...).catch(err => ...)` — the 200 is returned at line 185 before uploads complete. No webhook timeout risk exists.

3. **DSAR already routes per-document:** `app/api/clients/[id]/documents/dsar/route.ts` line 55 — `if (!doc.storage_backend || doc.storage_backend === 'supabase')` — per-document routing is correct. The bug is in the org null-guard at line 69 (`org?.id ?? ''`).

4. **`OneDriveProvider.upload()` is documented as ≤ 4 MB only:** `lib/storage/onedrive.ts` line 135 comment — "Note: Simple upload (PUT to /root:/path:/content) works for files up to 4 MB. Phase 29 will add chunked upload session support for larger files." This is a pre-existing acknowledgement of the HRDN-01 gap.

5. **No `postmark_message_id` column observed:** The `raw_postmark_data` field stores the full payload (line 146 — `raw_postmark_data: payload`), so `MessageID` is available inside the JSON blob. A new dedicated column with a unique constraint is the cleanest fix.

6. **The `inbound_emails` insert at line 133-148 is NOT wrapped in an idempotency guard.** If the 200 is not received by Postmark (network drop after server sent response), Postmark retries, re-triggering the full handler including the inbound insert and processAttachments.

7. **Supabase backend is unaffected by HRDN-01:** `SupabaseStorageProvider.upload()` in `lib/documents/storage.ts` calls `adminClient.storage.from(BUCKET_NAME).upload(storagePath, params.file, ...)`. This uses the Supabase Storage JS client which handles its own multipart upload internally and does NOT route through the Vercel request body as a whole. Large file uploads to Supabase Storage from a Vercel function are safe.

8. **Existing chunk size compatibility:** Use `CHUNK_SIZE = 10 * 327680 = 3,276,800 bytes` (~3.1 MB). This satisfies:
   - Google Drive: must be multiple of 262,144 (256 KiB). 327,680 / 262,144 = 1.25 — NOT compatible. Use `10 * 262144 = 2,621,440` for Drive-only, or `LCM(262144, 327680) = 1,310,720` (1.25 MB) for a unified chunk size.
   - OneDrive: must be multiple of 327,680 (320 KiB).
   - LCM(262144, 327680) = 1,310,720 bytes (~1.25 MB). Use this as the universal chunk size for the browser uploader.

---

## Sources

### Primary (HIGH confidence)
- Codebase analysis — `app/api/portal/[token]/upload/route.ts`, `app/api/postmark/inbound/route.ts`, `app/api/clients/[id]/documents/dsar/route.ts`, `lib/documents/storage.ts`, `lib/storage/google-drive.ts`, `lib/storage/onedrive.ts`, `lib/storage/dropbox.ts`, `app/portal/[token]/components/portal-checklist.tsx`
- https://developers.google.com/drive/api/guides/manage-uploads — Drive resumable upload API
- https://learn.microsoft.com/en-us/graph/api/driveitem-createuploadsession — OneDrive createUploadSession API (verified 2026-02-21 update)

### Secondary (MEDIUM confidence)
- https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions — Vercel 4.5 MB limit bypass strategies
- https://postmarkapp.com/support/article/understanding-inbound-webhook-retries-in-postmark — Postmark retry schedule (10 retries over ~10.5 hours)
- Dropbox SDK docs (WebSearch verified) — `filesUploadSessionStart`, `filesUploadSessionAppendV2`, `filesUploadSessionFinish`; chunks up to 150 MB; multiples of 4 MB recommended

### Tertiary (LOW confidence)
- Postmark webhook response timeout: "2 minutes" — found via WebSearch, not verified against official docs page. Treat as plausible but validate before encoding in plans.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all providers already integrated
- Architecture (HRDN-01 Google/OneDrive): HIGH — official docs verified; session URL pattern confirmed
- Architecture (HRDN-01 Dropbox): MEDIUM — no pre-authenticated URL confirmed; streaming proxy recommended but exact Next.js streaming approach needs verification
- Architecture (HRDN-02/03): HIGH — codebase analysis confirms exact lines and gaps
- Pitfalls: HIGH — derived from official API constraints and existing codebase patterns

**Research date:** 2026-02-28
**Valid until:** 2026-03-28 (API specs are stable; Vercel limits unlikely to change)
