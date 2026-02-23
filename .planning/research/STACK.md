# Technology Stack: v4.0 Document Collection

**Project:** Prompt — v4.0 Document Collection
**Researched:** 2026-02-23
**Scope:** New dependencies and integration patterns for Supabase Storage, file upload handling, document type detection, DSAR ZIP export, and retention enforcement. Does NOT re-research existing stack.
**Overall confidence:** HIGH (SDK methods verified against official Supabase docs; package versions verified against npm registry; file upload constraints verified against Next.js GitHub issues)

---

## Existing Stack (Unchanged)

Do not re-research or alter these:

| Technology | Version | Notes |
|------------|---------|-------|
| Next.js | 16.1.6 | App Router confirmed in package.json |
| React | 19.2.3 | Confirmed in package.json |
| @supabase/supabase-js | ^2.95.3 | Auth + DB + **Storage** client — covers all Storage SDK calls |
| @supabase/ssr | ^0.8.0 | Server-side auth helpers |
| Postmark | ^4.0.5 | Inbound webhook already at /api/postmark/inbound |
| Stripe | ^20.3.1 | Billing — no changes for v4.0 |
| TipTap | ^3.19.0 | Rich text editor — no changes for v4.0 |
| Zod | ^4.3.6 | Validation — already used for request/schema validation |
| Vercel Pro | — | Cron jobs for queue/send; **4.5 MB serverless payload limit** |

---

## New Dependencies

### 1. File Type Detection: `file-type`

| Package | Version | Purpose | Install as |
|---------|---------|---------|-----------|
| `file-type` | ^21.3.0 | MIME type detection from binary magic bytes — no external service | production |

**Why this package:** Detects file type by reading the first few bytes (magic bytes/signatures), not the filename extension or the `Content-Type` header. Both can be spoofed by clients. `file-type` v21 is the actively maintained ESM-only package from sindresorhus. It supports PDF (`%PDF` prefix at `0x25 0x50 0x44 0x46`), JPEG, PNG, DOCX/XLSX (zip-based Office formats), and many others out of the box.

**Privacy rationale:** All detection is purely local — reads a slice of the uploaded buffer. No bytes leave the server. Satisfies the "no third-party document processing services" constraint.

**ESM constraint:** `file-type` v16+ is ESM-only. Next.js 13+ App Router with `"type": "module"` in package.json is compatible. If the project is CJS, use `file-type@^16` with dynamic `import()` inside an async function, or use the CJS-compatible fork `file-type-cjs` (not recommended — less maintained).

```typescript
// Usage inside a server action or route handler
import { fileTypeFromBuffer } from 'file-type';

const buffer = Buffer.from(await file.arrayBuffer());
const detected = await fileTypeFromBuffer(buffer);
// detected = { ext: 'pdf', mime: 'application/pdf' } or undefined
```

**Document classification approach (no third-party AI):** For HMRC document types (P60, P45, SA302, bank statements), classification is done by:
1. MIME type check via `file-type` (e.g. `application/pdf` vs `image/jpeg`)
2. Filename pattern matching against the `document_types` catalog (case-insensitive regex, e.g. `/p60/i`, `/sa302/i`, `/bank.?stat/i`)
3. PDF text extraction is NOT needed for v4.0 — filename + MIME is sufficient for initial classification; unclassified documents land in a "Review" state

### 2. ZIP Generation for DSAR Export: `fflate`

| Package | Version | Purpose | Install as |
|---------|---------|---------|-----------|
| `fflate` | ^0.8.2 | Server-side ZIP archive generation for DSAR export | production |

**Why `fflate` over `jszip`:** `fflate` is ~5x smaller bundle footprint than `jszip`, works natively in Node.js and browser (pure JavaScript, no native bindings), and supports synchronous ZIP generation (`zipSync`) suitable for server-side use in a route handler. As of 2025, it has ~27M weekly downloads and is actively maintained.

**Why not `archiver`:** `archiver` is a Node.js streams-based library that works well for large archives piped to a filesystem or HTTP stream, but adds complexity in a Vercel serverless environment where filesystem writes are not persistent and streaming responses require careful handling. `fflate` generates a `Uint8Array` in memory, which can be returned directly as a `Response` body — simpler for DSAR's use case (10-50 documents per client, typically under 50 MB total).

**Why not Node.js built-in `zlib`:** `zlib` provides gzip/deflate but not the ZIP container format. You would need to build the ZIP structure manually. Not worth the effort when `fflate` exists.

```typescript
// Route handler for DSAR export
import { zipSync, strToU8 } from 'fflate';

const files: Record<string, Uint8Array> = {};

// Add JSON manifest
files['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2));

// Add each document (downloaded from Supabase Storage as Uint8Array)
for (const doc of documents) {
  const bytes = await downloadFromStorage(doc.storage_path);
  files[`documents/${doc.filename}`] = bytes;
}

const zipped = zipSync(files);

return new Response(zipped, {
  headers: {
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="dsar-${clientId}-${date}.zip"`,
  },
});
```

---

## No New Packages Required

The following v4.0 features work entirely with existing dependencies:

### Supabase Storage (via `@supabase/supabase-js` — already installed)

The `@supabase/supabase-js` client includes the full Storage SDK. No separate `@supabase/storage-js` install is needed — it is a transitive dependency already included. All Storage operations use `supabase.storage.from('bucket-name')`.

### Supabase Edge Function for Retention Cron

Retention enforcement runs as a Supabase Edge Function (Deno), invoked on a schedule via `pg_cron` + `pg_net`. No npm package is needed — Edge Functions use the Deno runtime and can call the Supabase Storage Admin API using the service role key.

### Token-Based Portal Links

Short-lived single-use upload tokens are stored in a `portal_tokens` Postgres table with `expires_at` and `used_at` columns. The portal route reads the token from the URL query parameter and validates it in a Server Component or Route Handler. No JWT library is needed — tokens are random UUIDs or crypto-generated strings.

### Multipart Form Data Parsing

Next.js App Router route handlers and server actions handle `FormData` natively via `request.formData()`. No `formidable`, `busboy`, or `multer` is needed in the App Router.

### MIME Type Validation (declared type)

Zod already validates request shapes. Add a string enum refinement to check that the declared `Content-Type` is in the allowed set (PDF, JPEG, PNG, DOCX). Combine with `file-type` magic byte check for defence-in-depth.

---

## Supabase Storage SDK Patterns

### Bucket Configuration

The existing Supabase project is in EU West (eu-west-2 / London) by default — bucket region follows the project region automatically and cannot be configured separately per bucket in Supabase's managed offering. **Verify the project region in the Supabase Dashboard** before creating the bucket if EU residency is a compliance requirement.

Create a **private** bucket (public: false) via migration SQL or the SDK. Private means all objects require either an authenticated session with an RLS-passing request, or a signed URL.

```sql
-- In a Supabase migration (preferred — infrastructure as code)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'client-documents',
  'client-documents',
  false,                          -- private
  10485760,                       -- 10 MB per file (adjust per business requirement)
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
);
```

**Storage path convention (org-scoped):**

```
{org_id}/{client_id}/{filing_type}/{year}/{filename}
```

Example: `b3f2a1.../client-abc.../corp-tax/2025/SA302-2025.pdf`

This makes RLS policies trivial — check `(storage.foldername(name))[1] = get_org_id()::text`.

### Upload from Server Action (Postmark inbound attachments)

For passive collection (Postmark webhook extracts attachments), the upload happens server-side using the admin client to bypass RLS. The Postmark webhook already uses the service role for DB writes.

```typescript
// Server-side upload in the inbound webhook handler
import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();
const path = `${orgId}/${clientId}/${filingType}/${year}/${filename}`;

const { data, error } = await supabase.storage
  .from('client-documents')
  .upload(path, fileBuffer, {        // fileBuffer: Buffer | Uint8Array | ArrayBuffer
    contentType: detectedMime,       // from file-type detection
    upsert: false,                   // reject duplicate paths — force unique filenames
    cacheControl: '3600',
  });
```

### Signed Upload URL Pattern (Active Portal: Client Upload)

For the client-facing upload portal (no auth, token-based), DO NOT send the file through the Next.js server. Use a signed upload URL instead. This avoids the Vercel 4.5 MB payload limit and removes the server as a file transit point.

**Two-step flow:**
1. Client presents token → Next.js route handler validates token → generates signed upload URL
2. Client uploads directly from browser to Supabase Storage using the signed URL (no Next.js server involvement in the file transfer)

```typescript
// Step 1: Route handler generates signed upload URL (server)
// POST /api/portal/upload-url
const adminClient = createAdminClient();
const path = `${orgId}/${clientId}/${filingType}/${year}/${sanitizedFilename}`;

const { data, error } = await adminClient.storage
  .from('client-documents')
  .createSignedUploadUrl(path);
// data = { signedUrl: string, token: string, path: string }

// Step 2: Client uploads directly (browser)
// Using the standard fetch API — no Supabase client needed on browser for this step
const formData = new FormData();
formData.append('file', selectedFile);

await fetch(data.signedUrl, {
  method: 'PUT',
  body: selectedFile,
  headers: { 'Content-Type': selectedFile.type },
});
```

**Why signed upload URL rather than passing through Next.js:**
- Vercel serverless functions have a 4.5 MB payload limit (hard, not configurable via `serverActions.bodySizeLimit` in production — multiple confirmed issues on the Next.js GitHub tracker)
- Client documents (PDFs, scanned images) routinely exceed 4.5 MB
- Signed upload URLs expire (max ~2 hours) and are single-path — scope is already constrained by the validated portal token

### Signed Download URL (Accountant accessing documents)

Accountants access documents via short-lived signed URLs generated server-side. Never expose the raw storage path to the browser.

```typescript
// In a Server Action or Route Handler
const supabase = createClient(); // authenticated SSR client (respects RLS)

const { data, error } = await supabase.storage
  .from('client-documents')
  .createSignedUrl(storagePath, 300); // 300 seconds = 5 minutes
// data = { signedUrl: string }
```

**Expiry guidance:**
- Download links for inline preview: 300 seconds (5 minutes)
- DSAR ZIP download link: 3600 seconds (1 hour) — user may need time to download a large file
- No permanent public URLs — always regenerate on demand

### Storage RLS Policy

```sql
-- storage.objects RLS for org-scoped private bucket
-- Pattern: first path segment = org_id

CREATE POLICY "org_scoped_access" ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'client-documents'
    AND (storage.foldername(name))[1] = (auth.jwt()->'app_metadata'->>'org_id')
  )
  WITH CHECK (
    bucket_id = 'client-documents'
    AND (storage.foldername(name))[1] = (auth.jwt()->'app_metadata'->>'org_id')
  );
```

The admin/service role bypasses RLS entirely — use it in the Postmark webhook handler and the retention cron function.

---

## Retention Enforcement: Supabase Edge Function + pg_cron

**Pattern:** Supabase Edge Function invoked weekly by `pg_cron` via `pg_net.http_post`.

The Edge Function queries `client_documents` for records where `retention_expires_at < NOW()` and `deleted_at IS NULL`, then calls `supabase.storage.from('client-documents').remove([...paths])` and marks the DB rows as deleted. This matches the pattern described in official Supabase cron + Edge Function documentation.

```sql
-- pg_cron schedule (run in Supabase SQL Editor or migration)
SELECT cron.schedule(
  'retention-enforcement',
  '0 3 * * 1',  -- 03:00 UTC every Monday
  $$
  SELECT net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/retention-enforcement',
    headers := '{"Authorization": "Bearer <service-role-key>", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

**Key consideration:** Store the service role key in Supabase Vault (`vault.secrets`) rather than hardcoded in the cron SQL. The official Supabase docs recommend this approach for security.

---

## File Upload Constraints (Vercel Production)

| Constraint | Value | Source |
|------------|-------|--------|
| Vercel serverless payload limit | 4.5 MB | Verified: multiple Next.js GitHub issues (#57501, #53087) |
| `serverActions.bodySizeLimit` | Unreliable in production | Confirmed broken in Vercel Pro environment (GitHub Discussion #77505) |
| Supabase Storage bucket file size limit | Configurable per bucket (set `file_size_limit` in SQL) | Official Supabase docs |
| Recommended maximum per document | 10 MB | Business decision — covers most PDF/scan sizes; well within Supabase limits |

**Recommendation for passive collection (Postmark inbound):** Postmark attachments arrive as base64 in the webhook JSON body. Decode server-side and upload via admin client. No file size issue — Postmark's own attachment limit is 10 MB per email and the webhook POST to the server is the full payload. If this becomes a constraint, store large attachments via signed URL pattern instead.

**Recommendation for active collection (client portal):** Always use the signed upload URL pattern. The Next.js server only validates the token and generates the signed URL (tiny payload) — the file never passes through Next.js.

---

## Installation

```bash
# New production dependency — MIME type detection
npm install file-type@^21.3.0

# New production dependency — DSAR ZIP export
npm install fflate@^0.8.2
```

No other new packages are required for v4.0.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| MIME detection | `file-type` | Manual magic byte comparison | `file-type` already handles 200+ formats; manual implementation only covers formats we explicitly code for; maintenance burden |
| MIME detection | `file-type` | `mmmagic` (libmagic binding) | Requires native binary compilation; fails on Vercel serverless (no native build environment) |
| MIME detection | `file-type` | `magic-bytes.js` | Less maintained, fewer formats, lower download count |
| ZIP generation | `fflate` | `jszip` | `fflate` is faster, smaller, and uses threads in async mode. `jszip` still blocks main thread during decompression despite async API |
| ZIP generation | `fflate` | `archiver` | `archiver` is stream-oriented (pipe to filesystem or HTTP); awkward in Vercel serverless where filesystem is ephemeral; `fflate` returns `Uint8Array` directly |
| ZIP generation | `fflate` | `adm-zip` | `adm-zip` reads/writes to filesystem; incompatible with Vercel serverless |
| Storage | Supabase Storage | Vercel Blob | Vercel Blob lacks mature signed URL support for private files (open feature request as of 2025). Supabase Storage is already in the stack; keeping storage co-located with the database reduces latency and avoids another billing relationship |
| Upload flow | Signed upload URL (client → Supabase direct) | Proxy upload through Next.js server action | Vercel 4.5 MB hard limit makes server proxy impractical for document uploads; signed upload URLs are the official Supabase recommendation for this scenario |
| Retention cron | Supabase Edge Function + pg_cron | Vercel cron calling Next.js API route | Retention touches Supabase Storage (delete) + DB (mark deleted); running it as a Supabase Edge Function keeps it within the same project, avoids external HTTP call overhead, and uses service role key stored in Supabase Vault |

---

## What NOT to Add

| Do Not Add | Why |
|------------|-----|
| Third-party document processing services (AWS Textract, Google Document AI, etc.) | Privacy constraint: client financial documents cannot leave the EU or be processed by third-party AI. Classification by filename + MIME type is sufficient for v4.0. |
| `uploadthing` | Wraps file upload into an opinionated SaaS. Adds a third-party data processor and billing relationship. Not needed when Supabase Storage already provides all required capabilities. |
| `pdf-parse` or `pdfjs-dist` for text extraction | Not needed for v4.0 classification (filename + MIME sufficient). Heavy dependencies. Deferred to a future phase if structured data extraction becomes a requirement. |
| `sharp` for image processing | No image manipulation needed in v4.0. Documents are stored as-is. |
| `multer` or `formidable` | These are Pages Router / Express patterns. App Router handles `FormData` natively with `request.formData()`. |
| Separate `@supabase/storage-js` install | Already a transitive dependency of `@supabase/supabase-js`. Installing it separately risks version conflicts. |
| Redis / queue for upload processing | At Prompt's scale, synchronous upload + classification in the route handler is sufficient. Async queue adds operational complexity for no measurable benefit at <1000 documents/day. |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `file-type@^21.3.0` | Next.js 16 (ESM supported) | ESM-only; works in App Router server components and route handlers. If CJS issues arise, use dynamic `import('file-type')` inside async function. |
| `fflate@^0.8.2` | Node.js 14+, Deno (Edge Functions) | Pure JS — no native bindings; works in Vercel serverless and Supabase Edge Functions without modification. |
| `@supabase/supabase-js@^2.95.3` | Storage SDK included | No separate storage package needed. `supabase.storage` is fully available on both anon (user-scoped) and service role clients. |

---

## Environment Variables Required for v4.0

No new environment variables are required for the storage integration. The existing `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` cover all Storage SDK calls.

Optional additions:
```bash
# If using Supabase Vault for the retention cron Edge Function
# (recommended over hardcoding service role key in pg_cron SQL)
# Configure via Supabase Dashboard → Vault → Secrets — not an env var
```

---

## Integration Points with Existing Code

| Existing File | Change for v4.0 |
|---------------|----------------|
| `app/api/postmark/inbound/route.ts` | Add attachment extraction: decode base64 → detect MIME with `file-type` → upload to `client-documents` bucket via admin client → insert `client_documents` DB row |
| `lib/supabase/admin.ts` | No change — existing `createAdminClient()` is used for all Storage admin operations (upload, remove) |
| `lib/supabase/server.ts` | No change — existing SSR client used for generating signed download URLs (RLS enforces org isolation) |
| `middleware.ts` | No change — token-based portal routes are public paths that bypass auth middleware, add to the matcher exclusion list |
| New: `app/api/portal/upload-url/route.ts` | POST handler: validate portal token → generate signed upload URL → return to client |
| New: `app/portal/[token]/page.tsx` | Public page (no auth): show client checklist, file picker, upload to signed URL |
| New: `app/api/dsar/export/route.ts` | GET handler: fetch all client documents → download from Storage → `fflate.zipSync()` → return ZIP response |
| New: `supabase/functions/retention-enforcement/index.ts` | Deno Edge Function: query expired docs → `storage.remove()` → mark rows deleted |

---

## Sources

- [Supabase Storage JavaScript API — createSignedUrl](https://supabase.com/docs/reference/javascript/storage-from-createsignedurl) — method signature, expiry options (HIGH confidence)
- [Supabase Storage JavaScript API — createSignedUploadUrl](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl) — signed upload pattern (HIGH confidence)
- [Supabase Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control) — storage.objects RLS, private buckets (HIGH confidence)
- [Supabase Storage — Standard Uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads) — upload method accepts File, Blob, ArrayBuffer, Buffer (HIGH confidence)
- [Supabase Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions) — pg_cron + pg_net pattern for retention cron (HIGH confidence)
- [file-type on npm](https://www.npmjs.com/package/file-type) — v21.3.0 latest, ESM-only, 200+ formats (HIGH confidence)
- [fflate on npm](https://www.npmjs.com/package/fflate) — v0.8.2, pure JS, 27M weekly downloads (HIGH confidence)
- [fflate vs jszip npm trends](https://npmtrends.com/fflate-vs-jszip-vs-node-zip-vs-yauzl-vs-zip) — comparative download counts and maintenance status (MEDIUM confidence)
- [Next.js GitHub #57501 — App Router body size limit](https://github.com/vercel/next.js/issues/57501) — 4.5 MB Vercel hard limit confirmed (HIGH confidence — multiple reports)
- [Next.js GitHub Discussion #77505 — bodySizeLimit broken in production](https://github.com/vercel/next.js/discussions/77505) — unreliable in production Vercel (HIGH confidence)
- [Vercel Blob — signed URL feature request](https://github.com/vercel/storage/issues/544) — signed URL not yet supported (MEDIUM confidence — may have changed)
- [Signed URL file uploads with Next.js and Supabase — Medium](https://medium.com/@olliedoesdev/signed-url-file-uploads-with-nextjs-and-supabase-74ba91b65fe0) — practical pattern for signed upload URL flow (MEDIUM confidence — community source, verified against official docs)

---

*Stack research for: Prompt v4.0 — Document Collection*
*Researched: 2026-02-23*
*Confidence: HIGH — package versions verified against npm registry; Supabase SDK methods verified against official docs; Vercel payload limits verified against multiple confirmed GitHub issues; ZIP library recommendation based on npm trends data*
