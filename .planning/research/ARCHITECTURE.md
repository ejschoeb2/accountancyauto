# Architecture Research: v4.0 Document Collection

**Domain:** UK Accounting SaaS — Document collection layer on existing Next.js + Supabase platform
**Researched:** 2026-02-23
**Confidence:** HIGH — patterns verified against Supabase official documentation and official Next.js documentation. Storage RLS and signed URL patterns confirmed against Supabase JS SDK reference. Token portal pattern derived from established presigned-upload patterns and Supabase service-role upload URL generation.

> Prior v3.0 multi-tenancy architecture (RLS patterns, subdomain routing, JWT hook, migration strategy) is fully documented in `ARCHITECTURE.md` at the repo root. This document covers only the v4.0 additions.

---

## System Overview

```
                          Vercel (existing deployment)
        ┌────────────────────────────────────────────────────────────┐
        │                                                            │
        │  Existing dashboard routes (authenticated)                 │
        │  /clients/[id] — filing cards now show document counts     │
        │  /dashboard    — activity feed shows recent uploads        │
        │                                                            │
        │  NEW: /portal/[token]   (PUBLIC — no Supabase auth)        │
        │  Upload portal served as App Router page group             │
        │  Token resolved → client + filing context from DB          │
        │                                                            │
        │  Existing: /api/postmark/inbound    (extended)             │
        │  NEW attachment extraction step appended to pipeline        │
        │                                                            │
        │  NEW: /api/cron/retention          (Vercel cron, daily)    │
        │  Flags documents past 6-year retention window              │
        │                                                            │
        │  NEW Server Actions:                                        │
        │  lib/documents/storage.ts   — signed URL generation        │
        │  lib/documents/portal.ts    — token validation + creation  │
        │  lib/documents/retention.ts — flag + DSAR export           │
        └──────────────────┬──────────────────────────┬─────────────┘
                           │                          │
              ┌────────────▼────────────┐   ┌─────────▼──────────┐
              │   Supabase Postgres     │   │  Supabase Storage   │
              │                         │   │  (private bucket)   │
              │  NEW tables:            │   │                     │
              │  document_types         │   │  orgs/{org_id}/     │
              │  filing_doc_reqs        │   │    clients/         │
              │  client_documents       │   │      {client_id}/   │
              │  document_access_log    │   │        {filing}/    │
              │  upload_portal_tokens   │   │          {year}/    │
              │                         │   │            file.pdf │
              └─────────────────────────┘   └────────────────────┘
```

---

## Component Responsibilities

| Component | Status | Responsibility |
|-----------|--------|---------------|
| `/api/postmark/inbound/route.ts` | MODIFIED | Add attachment extraction + Storage upload after existing email insert |
| `lib/documents/storage.ts` | NEW | All Supabase Storage interactions: upload, signed URL generation, deletion |
| `lib/documents/portal.ts` | NEW | Token creation, validation, portal context resolution |
| `lib/documents/metadata.ts` | NEW | `client_documents` CRUD, document classification |
| `lib/documents/retention.ts` | NEW | Retention flag logic, DSAR ZIP export |
| `app/(portal)/portal/[token]/page.tsx` | NEW | Public upload portal — no layout wrapping from dashboard |
| `app/(portal)/portal/[token]/components/` | NEW | Checklist UI, dropzone, upload progress |
| `app/api/portal/[token]/upload/route.ts` | NEW | API Route Handler accepting multipart upload from portal |
| `app/api/cron/retention/route.ts` | NEW | Vercel cron job — daily retention flag scan |
| `app/(dashboard)/clients/[id]/components/filing-management.tsx` | MODIFIED | Add document count badge + expandable document list per filing card |
| `app/(dashboard)/clients/[id]/components/documents-panel.tsx` | NEW | Document list with signed URL download, metadata |
| `app/(dashboard)/dashboard/components/activity-feed.tsx` | NEW | Real-time upload activity across org |
| `supabase/migrations/YYYYMMDD_document_collection_schema.sql` | NEW | All new tables + Storage bucket creation + RLS policies |

---

## New Database Tables

### document_types

Global reference table (no `org_id`). Describes the types of documents that can be collected.

```sql
CREATE TABLE public.document_types (
  id          text    PRIMARY KEY,  -- e.g. 'bank_statements', 'vat_returns'
  name        text    NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
-- RLS: TO authenticated USING (true)  -- read-only reference data, same as filing_types
```

### filing_document_requirements

Maps filing types to required document types. Global reference, no `org_id`.

```sql
CREATE TABLE public.filing_document_requirements (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  filing_type_id  text    NOT NULL REFERENCES public.filing_types(id),
  document_type_id text   NOT NULL REFERENCES public.document_types(id),
  is_required     boolean NOT NULL DEFAULT true,
  display_order   int     NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (filing_type_id, document_type_id)
);
-- RLS: TO authenticated USING (true)
```

### client_documents

Core document metadata table. One row per stored file.

```sql
CREATE TABLE public.client_documents (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid        NOT NULL REFERENCES public.organisations(id),
  client_id        uuid        NOT NULL REFERENCES public.clients(id),
  filing_type_id   text        REFERENCES public.filing_types(id),
  document_type_id text        REFERENCES public.document_types(id),
  -- Storage path (NEVER expose to client directly — generate signed URLs only)
  storage_path     text        NOT NULL,
  -- Original filename from uploader
  original_filename text       NOT NULL,
  file_size_bytes  bigint,
  mime_type        text,
  -- Source of upload
  source           text        NOT NULL CHECK (source IN ('email_attachment', 'portal_upload', 'manual_upload')),
  -- Relation back to inbound email if source = email_attachment
  inbound_email_id uuid        REFERENCES public.inbound_emails(id),
  -- Relation to portal token if source = portal_upload
  portal_token_id  uuid        REFERENCES public.upload_portal_tokens(id),
  -- Tax year the document pertains to (e.g. '2025-04-06' = tax year ending April 2025)
  tax_year_end     date,
  -- Retention enforcement
  retain_until     date,        -- calculated: tax_year_end + 6 years
  retention_flagged boolean     NOT NULL DEFAULT false,
  retention_flagged_at timestamptz,
  -- Classification confidence (0.0–1.0) when auto-detected
  classification_confidence numeric(3,2),
  uploaded_at      timestamptz NOT NULL DEFAULT now(),
  uploaded_by_user_id uuid     REFERENCES auth.users(id),  -- null for portal/email uploads
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_client_documents_org_id      ON public.client_documents(org_id);
CREATE INDEX idx_client_documents_client_id   ON public.client_documents(client_id);
CREATE INDEX idx_client_documents_filing_type ON public.client_documents(filing_type_id);
CREATE INDEX idx_client_documents_retain_until ON public.client_documents(retain_until)
  WHERE retention_flagged = false;

-- RLS: standard org_id-scoped policies (same pattern as clients table)
```

### document_access_log

Audit trail — every time a signed URL is generated for a document.

```sql
CREATE TABLE public.document_access_log (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid        NOT NULL REFERENCES public.organisations(id),
  document_id    uuid        NOT NULL REFERENCES public.client_documents(id),
  accessed_by    uuid        REFERENCES auth.users(id),  -- null if system-generated
  access_type    text        NOT NULL CHECK (access_type IN ('view', 'download', 'dsar_export')),
  accessed_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_doc_access_log_org_id ON public.document_access_log(org_id);
CREATE INDEX idx_doc_access_log_doc_id ON public.document_access_log(document_id);

-- RLS: standard org_id-scoped, SELECT only for authenticated users
```

### upload_portal_tokens

Stores the state of client-facing portal links. One token per (client, filing_type, tax_year) combination.

```sql
CREATE TABLE public.upload_portal_tokens (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid        NOT NULL REFERENCES public.organisations(id),
  client_id     uuid        NOT NULL REFERENCES public.clients(id),
  filing_type_id text       REFERENCES public.filing_types(id),
  tax_year_end  date,
  -- The URL-safe token (random bytes, stored hashed)
  token_hash    text        NOT NULL UNIQUE,  -- SHA-256 of raw token
  expires_at    timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  revoked       boolean     NOT NULL DEFAULT false,
  created_by    uuid        NOT NULL REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_used_at  timestamptz
);

CREATE INDEX idx_portal_tokens_token_hash ON public.upload_portal_tokens(token_hash);
CREATE INDEX idx_portal_tokens_org_id     ON public.upload_portal_tokens(org_id);

-- RLS: authenticated users can SELECT/INSERT/UPDATE tokens for their org
-- Portal validation API uses service role client (bypasses RLS deliberately)
```

---

## Supabase Storage Configuration

### Bucket Setup

One private bucket for all document files, created via migration:

```sql
-- In Supabase dashboard or via management API at project init:
-- Bucket name: 'client-documents'
-- Public: false (private — all access via signed URLs only)
-- File size limit: 50MB per file
-- Allowed MIME types: pdf, image/*, application/msword, etc.
```

Bucket creation cannot be done in a SQL migration. Use the Supabase dashboard or the management REST API in a setup script. The bucket name `client-documents` should be stored in an env var: `SUPABASE_STORAGE_BUCKET_DOCUMENTS`.

### Storage Path Convention

```
orgs/{org_id}/clients/{client_id}/{filing_type_id}/{tax_year}/{filename}

Example:
orgs/a1b2c3d4.../clients/e5f6g7h8.../corporation_tax_payment/2025/company_accounts.pdf
```

The `{filename}` segment uses a generated UUID with the original extension to avoid path collisions and prevent filename-based enumeration:
```
{uuid}.{ext}  -- e.g. 3f8a12bc.pdf
```

Original filename is preserved in `client_documents.original_filename`, not in the storage path.

### Storage RLS Policies

These policies are on `storage.objects` (not a regular Postgres table). They restrict which rows authenticated users can read. The portal upload flow uses service-role client (bypasses storage RLS entirely) so portal users do not need Supabase auth.

```sql
-- SELECT: authenticated users can only read objects under their org_id path
CREATE POLICY "client_documents_select_own_org"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'client-documents'
    AND (storage.foldername(name))[1] = 'orgs'
    AND (storage.foldername(name))[2] = (auth.jwt() ->> 'org_id')
  );

-- INSERT: authenticated users can upload into their org's path only
CREATE POLICY "client_documents_insert_own_org"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'client-documents'
    AND (storage.foldername(name))[1] = 'orgs'
    AND (storage.foldername(name))[2] = (auth.jwt() ->> 'org_id')
  );

-- DELETE: authenticated users can delete within their org's path
CREATE POLICY "client_documents_delete_own_org"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'client-documents'
    AND (storage.foldername(name))[1] = 'orgs'
    AND (storage.foldername(name))[2] = (auth.jwt() ->> 'org_id')
  );

-- NOTE: The portal upload flow bypasses these policies entirely.
-- It uses the service-role client to call storage.upload() server-side.
-- Never expose the service-role key to the portal client.
```

**Confidence:** HIGH — `storage.foldername(name)` returns an array where `[1]` is the first folder segment, `[2]` is the second. This array indexing pattern is confirmed in official Supabase storage helper function docs and community examples. The JWT `org_id` claim is already established in v3.0 via the custom access token hook.

**Important caveat (MEDIUM confidence):** Supabase sometimes rewrites `storage.foldername(name)` to `storage.foldername(tables.name)` if multiple tables in the query have a `name` column. Use `storage.foldername(objects.name)` to be explicit if this ambiguity arises.

---

## Data Flows

### Flow 1: Passive Collection — Postmark Email Attachment

```
Client sends email with PDF attachment
    |
    v
Postmark delivers to inbound address
    |
    v
POST /api/postmark/inbound?token=<secret>
    |
    +--> [EXISTING] Parse email, match client by From address
    |    Store in inbound_emails table
    |    Run keyword detection
    |
    +--> [NEW] If Attachments.length > 0:
         For each attachment (Content is base64):
           |
           +--> Decode base64 → Buffer
           |
           +--> Determine storage path:
           |    orgs/{org_id}/clients/{client_id}/{filing_type}/{tax_year}/{uuid}.{ext}
           |
           +--> serviceClient.storage
           |      .from('client-documents')
           |      .upload(storagePath, buffer, { contentType, upsert: false })
           |
           +--> Insert into client_documents:
                { org_id, client_id, filing_type_id, storage_path,
                  original_filename: attachment.Name,
                  file_size_bytes: attachment.ContentLength,
                  mime_type: attachment.ContentType,
                  source: 'email_attachment',
                  inbound_email_id: inboundEmail.id }
```

**Key point:** Attachment extraction happens in the same webhook request as the email store. Postmark base64-encodes attachment content in the webhook payload (`attachment.Content`). A `Buffer.from(content, 'base64')` converts it to bytes for Storage upload. The service client bypasses RLS — the org_id must be explicitly set on the `client_documents` row.

**Postmark attachment size limit:** Postmark inbound webhook payloads have a 25MB total limit. Files above this cannot arrive via email. The webhook must return 200 regardless (even on partial attachment failure) to prevent Postmark retries.

### Flow 2: Active Collection — Client Portal Upload

```
Accountant generates portal link for a client + filing type
    |
    v
Server Action: lib/documents/portal.ts → createPortalToken()
    Generate 32-byte random token (crypto.randomBytes)
    Store SHA-256 hash in upload_portal_tokens table
    Return raw token (shown to accountant once, then lost)
    |
    v
Accountant sends link to client:
    https://{org}.app.domain.com/portal/{rawToken}
    |
    v
Client opens /portal/[token] (PUBLIC Next.js route)
    |
    +--> Server Component resolves token:
    |    Hash the URL token → look up upload_portal_tokens by token_hash
    |    Validate: not revoked, not expired
    |    Load: client name, filing type, tax_year, checklist items
    |    (Uses service role client — no Supabase auth session from client)
    |
    +--> Render checklist UI with dropzone per document type
    |
    v
Client selects file and submits form
    |
    v
POST /api/portal/[token]/upload (Next.js API Route Handler)
    |
    +--> Re-validate token (same hash lookup — server-side, not trusting client)
    |
    +--> Parse multipart body (request.formData())
    |
    +--> Validate file: size, MIME type, scan (if ClamAV integration added later)
    |
    +--> serviceClient.storage.from('client-documents').upload(storagePath, fileBuffer)
    |
    +--> Insert into client_documents
         { source: 'portal_upload', portal_token_id: token.id, ... }
    |
    v
Accountant notification:
    +--> Insert notification record or call Postmark to email accountant
    +--> Dashboard activity feed reflects new upload
```

**Why API Route Handler instead of Server Action for the upload:** File uploads from unauthenticated forms require multipart parsing which `request.formData()` handles well in a Route Handler. Server Actions work but add overhead for large files. A dedicated Route Handler at `/api/portal/[token]/upload` is cleaner.

**Why the portal does not use Supabase client-side upload:** The portal visitor is not a Supabase auth user. They cannot satisfy the storage RLS policies. The API Route Handler runs server-side with the service role client and uploads on their behalf. The raw token in the URL is the authentication mechanism.

### Flow 3: Accountant Views Documents (Dashboard)

```
Accountant navigates to /clients/[id]
    |
    v
filing-management.tsx loads document counts per filing type
    |
    +--> Query client_documents grouped by filing_type_id:
         SELECT filing_type_id, COUNT(*), MAX(uploaded_at)
         FROM client_documents
         WHERE client_id = ? AND org_id = ?
         (RLS enforces org scoping via authenticated user's JWT)
    |
    v
Document count badge shown on each filing card
Accountant clicks "View documents" on a filing card
    |
    v
documents-panel.tsx loads document list for that filing
    |
    v
Accountant clicks "Download" on a specific document
    |
    v
Server Action: lib/documents/storage.ts → getSignedUrl()
    |
    +--> adminClient.storage
    |      .from('client-documents')
    |      .createSignedUrl(storagePath, 3600)  -- 1-hour expiry
    |
    +--> Insert into document_access_log
    |    { document_id, accessed_by: userId, access_type: 'download' }
    |
    +--> Return signed URL to client component
    |
    v
Browser redirects to signed URL → file downloads
```

**Key point:** The `storage_path` from `client_documents` is NEVER sent to the client component. Only the signed URL is returned. The signed URL is opaque (contains a token, not a path). After 1 hour the URL is invalid. The `document_access_log` insert is fire-and-forget — do not block the response on it.

### Flow 4: DSAR Export

```
Accountant requests DSAR export for a client
    |
    v
Server Action: lib/documents/retention.ts → exportDsarZip()
    |
    +--> Query all client_documents for the client
    |
    +--> For each document:
    |    adminClient.storage.from('client-documents').download(storagePath)
    |    Returns Blob/Buffer
    |
    +--> Build ZIP archive using JSZip:
    |    zip.file(original_filename, buffer)
    |    Add manifest.json: { client_id, exported_at, documents: [...] }
    |
    +--> Insert document_access_log rows (access_type: 'dsar_export')
    |
    +--> Return ZIP as NextResponse with Content-Disposition: attachment
         OR write to temp storage path and return a short-lived signed URL
```

**Recommendation:** For small document sets (< 50 files), generate the ZIP in-memory and stream it back. For larger exports, write the ZIP to a temp path in Storage (`orgs/{org_id}/_exports/{uuid}.zip`) and return a 5-minute signed URL. The temp export file can be cleaned up by the retention cron.

### Flow 5: Retention Enforcement

```
Daily Vercel cron → GET /api/cron/retention
    |
    +--> adminClient query:
    |    SELECT * FROM client_documents
    |    WHERE retain_until < CURRENT_DATE
    |    AND retention_flagged = false
    |
    +--> For each document:
    |    UPDATE client_documents SET retention_flagged = true, retention_flagged_at = now()
    |
    +--> (Phase 19+) Notify org admin via email that documents need review
    |    (Do NOT auto-delete — accountant must confirm deletion for HMRC compliance)
```

**Retention logic:** `retain_until` = `tax_year_end + 6 years`. HMRC requires records to be kept for 6 years from the end of the accounting period for Corporation Tax and Self Assessment. This system flags but does not delete — deletion is a manual accountant action after review.

---

## Token Security Model

The upload portal uses a database-token pattern (not JWT or HMAC). This is the appropriate pattern when:
- The token must be revocable (revoked column on the row)
- The token must expire on a known date (expires_at column)
- The token scope must be narrowly defined (client + filing + tax year)

### Token Lifecycle

```
1. Generation (server-side, authenticated accountant):
   rawToken = crypto.randomBytes(32)        -- 256 bits of randomness
   urlToken  = rawToken.toString('base64url') -- URL-safe base64
   hash      = crypto.createHash('sha256').update(rawToken).digest('hex')
   INSERT INTO upload_portal_tokens (token_hash, ...)

2. URL sent to client:
   https://{org}.app.domain.com/portal/{urlToken}
   Raw token travels in URL — TLS encrypts in transit

3. Portal page load (server component):
   hash = sha256(urlToken)
   SELECT * FROM upload_portal_tokens WHERE token_hash = hash
   Validate: not revoked, not expired

4. Portal upload (API route):
   Re-validate token (same hash lookup — do not trust cached state)
   Update last_used_at on the token row

5. Revocation:
   UPDATE upload_portal_tokens SET revoked = true WHERE id = ?
   Existing URL immediately becomes invalid on next use
```

### Security Properties

| Property | Implementation |
|----------|---------------|
| Unguessability | 32 random bytes = 2^256 search space |
| In-transit confidentiality | TLS (HTTPS enforced by Vercel) |
| Storage at rest | Hash stored, raw token never persisted |
| Revocability | `revoked` boolean — instant invalidation |
| Expiry | `expires_at` column, checked on every use |
| Scope | Token is bound to client + filing + tax year, validated on every use |
| Replay resistance | Token can only be used for the bound (client, filing, year) |

**Not used:** HMAC signed tokens. HMAC is appropriate for stateless verification (webhook signatures). The portal needs revocability — once a client has submitted their documents, the accountant should be able to invalidate the link. Stateless HMAC tokens cannot be revoked without additional state, which negates the benefit. Database-token is the correct choice.

---

## Signed URL Generation Pattern

```typescript
// lib/documents/storage.ts
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET_DOCUMENTS ?? 'client-documents'
const SIGNED_URL_EXPIRY_SECONDS = 60 * 60  // 1 hour

/**
 * Generate a signed URL for download.
 * NEVER call this from a client component directly.
 * Always call from a server action or server component.
 */
export async function getDocumentSignedUrl(storagePath: string): Promise<string> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRY_SECONDS)

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to generate signed URL: ${error?.message}`)
  }

  return data.signedUrl
}

/**
 * Upload a file server-side (for portal uploads and email attachments).
 * Uses admin/service role — bypasses Storage RLS.
 */
export async function uploadDocument(
  storagePath: string,
  data: Buffer | Uint8Array,
  contentType: string
): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin
    .storage
    .from(BUCKET)
    .upload(storagePath, data, { contentType, upsert: false })

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`)
  }
}
```

**Key invariant:** `storagePath` (the raw path in the bucket) must never be returned to client components. Client components receive only signed URLs. The mapping from `client_documents.id` to `client_documents.storage_path` happens in a server action.

---

## Files That Change in Phase 18 vs Phase 19

### Phase 18 — Foundation (must exist before Phase 19 can build)

| File/Component | Change Type | Why It Must Come First |
|---------------|-------------|----------------------|
| `supabase/migrations/*_document_schema.sql` | NEW | All other work depends on the tables |
| Supabase Storage bucket creation | NEW | Portal and webhook uploads need the bucket |
| Storage RLS policies | NEW | Determines how authenticated uploads are secured |
| `lib/types/database.ts` | MODIFIED | Add `ClientDocument`, `DocumentType`, `UploadPortalToken` interfaces |
| `lib/documents/storage.ts` | NEW | Core storage utility used by both passive and active flows |
| `lib/documents/metadata.ts` | NEW | `client_documents` insert/query helpers |
| `lib/documents/retention.ts` | NEW (skeleton) | `calculateRetainUntil()` utility used by both flows |
| `document_types` and `filing_document_requirements` seed data | NEW | Checklist on portal depends on this reference data |
| `ENV_VARIABLES.md` | MODIFIED | Document `SUPABASE_STORAGE_BUCKET_DOCUMENTS` |

### Phase 19 — Passive + Active Collection (builds on Phase 18)

| File/Component | Change Type | Depends On |
|---------------|-------------|-----------|
| `app/api/postmark/inbound/route.ts` | MODIFIED | Storage bucket, `lib/documents/storage.ts`, `client_documents` table |
| `app/(portal)/portal/[token]/page.tsx` | NEW | `upload_portal_tokens` table, `document_types`, `filing_document_requirements` |
| `app/(portal)/portal/[token]/components/` | NEW | Portal page |
| `app/api/portal/[token]/upload/route.ts` | NEW | Portal page, storage, `client_documents` table |
| `lib/documents/portal.ts` | NEW | `upload_portal_tokens` table |
| `app/(dashboard)/clients/[id]/components/filing-management.tsx` | MODIFIED | `client_documents` table, `lib/documents/storage.ts` |
| `app/(dashboard)/clients/[id]/components/documents-panel.tsx` | NEW | `filing-management.tsx` modifications, signed URL pattern |
| `app/api/cron/retention/route.ts` | NEW | `client_documents` table with `retain_until` populated |
| DSAR export action | NEW | `lib/documents/retention.ts`, `lib/documents/storage.ts` |
| Accountant notification on upload | NEW | Portal upload route |

---

## Recommended Project Structure (New Files)

```
lib/
  documents/
    storage.ts        -- Supabase Storage: upload, signed URL, delete
    metadata.ts       -- client_documents CRUD helpers
    portal.ts         -- Token create, validate, revoke
    retention.ts      -- retain_until calc, DSAR export, flagging
    classify.ts       -- Auto-classification: map filename/mime to document_type_id

app/
  (portal)/           -- NEW route group: public, no auth session required
    portal/
      [token]/
        page.tsx      -- Server component: resolve token, render checklist
        loading.tsx
        not-found.tsx -- Shown for expired/revoked tokens
        components/
          document-checklist.tsx
          upload-dropzone.tsx
          upload-progress.tsx

  api/
    portal/
      [token]/
        upload/
          route.ts    -- API Route Handler: multipart upload, token re-validation

    cron/
      retention/
        route.ts      -- Daily: flag documents past retain_until

  (dashboard)/
    clients/
      [id]/
        components/
          documents-panel.tsx   -- NEW: document list per filing with download
          portal-link-card.tsx  -- NEW: generate/revoke portal link per filing
```

---

## Architectural Patterns

### Pattern 1: Server-Only Storage Paths

**What:** `client_documents.storage_path` is read only in server actions and server components. It is never included in API responses to client components. Client components request a signed URL through a server action.

**When to use:** All document download flows.

**Example:**
```typescript
// BAD — exposes storage path to browser
return NextResponse.json({ storagePath: doc.storage_path })

// GOOD — server action generates ephemeral signed URL
'use server'
export async function downloadDocument(documentId: string) {
  const doc = await getDocument(documentId)  // server-only
  const url = await getDocumentSignedUrl(doc.storage_path)
  await logAccess(documentId, 'download')
  return url  // only the signed URL goes to the browser
}
```

### Pattern 2: Double Token Validation

**What:** The portal page validates the token on load (to render the checklist). The upload route re-validates on every upload request. Token state is re-read from the database each time — no caching, no client-passed context is trusted.

**When to use:** All portal upload operations.

**Rationale:** A token could be revoked between page load and upload submission. The upload route must treat the token as untrusted input.

### Pattern 3: Service Role for Cross-Boundary Writes

**What:** When unauthenticated actors (portal visitors, Postmark webhook) need to write to Storage or `client_documents`, the server-side handler uses `createAdminClient()` (service role). The handler is responsible for scoping all writes with the correct `org_id` and `client_id` — RLS will not enforce this.

**When to use:** Portal upload route, Postmark inbound webhook.

**Consequence:** These handlers must explicitly validate the security context (token, webhook secret) before performing any write. The service role key is the most privileged credential in the system.

### Pattern 4: Attachment Extraction as a Non-Critical Step

**What:** In the Postmark inbound webhook, attachment extraction is a separate step that runs after the email has been stored. If attachment upload to Storage fails, the webhook still returns 200. The inbound email record is the source of truth — attachments can be re-extracted later.

**When to use:** Postmark inbound webhook.

**Rationale:** Postmark retries on non-200 responses. An email should be stored even if Storage is temporarily unavailable. Do not let an attachment failure prevent the email record from being created.

---

## Integration Points — Existing Files That Change

### `/api/postmark/inbound/route.ts` (MODIFIED)

Current pipeline (5 steps) gets a new Step 6:

```
Current:
Step 1: Verify token
Step 2: Parse payload
Step 3: Match client by email
Step 4: Store inbound_emails row
Step 5: Auto-update records_received (conditional)

New Step 6 (after Step 4):
if (payload.Attachments?.length > 0 && client?.id) {
  for (const attachment of payload.Attachments) {
    const buffer = Buffer.from(attachment.Content, 'base64')
    const ext = mime.extension(attachment.ContentType) || 'bin'
    const uuid = crypto.randomUUID()
    const path = `orgs/${orgId}/clients/${client.id}/${detectedFilingType ?? 'unknown'}/${taxYear}/${uuid}.${ext}`
    await uploadDocument(path, buffer, attachment.ContentType)
    await insertClientDocument({ ... source: 'email_attachment' })
  }
}
```

This addition is ~40 lines of new code in the existing handler. The import of `uploadDocument` and `insertClientDocument` from `lib/documents/` keeps the route handler thin.

### `filing-management.tsx` (MODIFIED)

Currently renders one card per filing type with deadline, status badge, and action buttons. The modification adds:
- A document count badge (e.g. "3 docs") derived from a count query on `client_documents`
- An expand/collapse button that reveals `<DocumentsPanel>` below the existing card content
- A "Send portal link" button that calls the `createPortalToken` server action

The component signature and existing props remain unchanged. The documents count is fetched as a separate query so it can be loaded independently without blocking the existing filing deadline/status render.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Exposing Storage Paths

**What people do:** Return `client_documents.storage_path` in an API response or pass it as a prop to a client component.
**Why it's wrong:** Exposes the internal bucket structure. An attacker who knows the path convention (`orgs/{uuid}/clients/{uuid}/...`) could construct paths for other clients. Even if the bucket is private, the path leaks the org and client UUIDs.
**Do this instead:** Server action generates and returns a signed URL. Never pass `storage_path` to client code.

### Anti-Pattern 2: Trusting Client-Provided Token Context

**What people do:** The portal page passes `clientId`, `orgId`, and `filingTypeId` as hidden form fields to the upload endpoint. The upload endpoint reads these fields and uses them for the Storage write.
**Why it's wrong:** Anyone can submit a form with arbitrary hidden field values, uploading to any client's folder.
**Do this instead:** The upload endpoint receives only the token. It re-validates the token and derives `clientId`, `orgId`, and `filingTypeId` from the database row. Nothing from the client body is trusted for scoping.

### Anti-Pattern 3: Auto-Deleting on Retention Flag

**What people do:** The retention cron identifies documents past their `retain_until` date and immediately deletes them from Storage and the database.
**Why it's wrong:** HMRC and ICO expect records to be available on request during DSAR/investigation even after the primary retention period. Automatic deletion without accountant confirmation risks compliance liability. UK accounting firms also sometimes need to retain records longer for ongoing tax investigations.
**Do this instead:** Set `retention_flagged = true`. Send an email to the org admin listing flagged documents. The accountant reviews and confirms deletion manually via a UI action.

### Anti-Pattern 4: One Large Webhook Handler

**What people do:** Add all attachment extraction logic directly into the 190-line Postmark inbound route.ts, making it a 350-line god function.
**Why it's wrong:** The route already has five distinct concerns. Adding attachment extraction inline makes the function harder to test, and means a Storage error can be visually lost in unrelated code.
**Do this instead:** Extract the attachment loop to `lib/documents/metadata.ts → extractAndStoreAttachments(attachments, context)`. The route calls it as a single awaited call.

### Anti-Pattern 5: Storing Raw Tokens

**What people do:** Store the raw portal token in `upload_portal_tokens.token` for easy lookup.
**Why it's wrong:** If the database is breached, all portal tokens are immediately usable by the attacker.
**Do this instead:** Store only `token_hash = sha256(rawToken)`. The raw token is shown to the accountant once and never stored. Lookup is `WHERE token_hash = sha256(incoming_token)`.

---

## Scaling Considerations

| Scale | Storage impact | DB impact | Mitigation |
|-------|---------------|-----------|------------|
| 100 clients, 5 files each | ~500 rows, small Storage | Negligible | No action needed |
| 1,000 clients, 20 files each | ~20,000 rows, GB range | Ensure org_id + client_id indexes | Already specified above |
| 10,000 clients | 200,000+ rows, 10s of GB | Partition `client_documents` by org_id | Defer to Phase 20+ |

The Supabase free tier includes 1GB of Storage. The Pro plan includes 100GB with pay-as-you-go beyond that. For accounting documents (mostly PDFs, <5MB each), 100GB supports approximately 20,000 documents — well beyond the scale of any single UK accounting practice on the current plan.

The first bottleneck is the DSAR ZIP export for clients with hundreds of documents: fetching all files server-side and zipping in memory will hit Vercel's 256MB function memory limit. Mitigation: write the ZIP to a temp Storage path and stream it, or cap in-memory ZIP at 50 files and paginate.

---

## Sources

- [Storage Access Control | Supabase Docs](https://supabase.com/docs/guides/storage/security/access-control) — HIGH confidence
- [Storage Helper Functions | Supabase Docs](https://supabase.com/docs/guides/storage/schema/helper-functions) — HIGH confidence
- [JavaScript: Create a signed URL | Supabase Docs](https://supabase.com/docs/reference/javascript/storage-from-createsignedurl) — HIGH confidence
- [JavaScript: Create signed upload URL | Supabase Docs](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl) — HIGH confidence
- [The Storage Schema | Supabase Docs](https://supabase.com/docs/guides/storage/schema/design) — HIGH confidence
- [Storage Buckets | Supabase Docs](https://supabase.com/docs/guides/storage/buckets/fundamentals) — HIGH confidence
- [Storage RLS to restrict top level folder to UUID | Supabase Discussion #31073](https://github.com/orgs/supabase/discussions/31073) — MEDIUM confidence
- [Signed URL file uploads with NextJs and Supabase | Medium](https://medium.com/@olliedoesdev/signed-url-file-uploads-with-nextjs-and-supabase-74ba91b65fe0) — MEDIUM confidence
- [createSignedUploadUrl service role issue | Supabase storage-js #186](https://github.com/supabase/storage-js/issues/186) — MEDIUM confidence (known caveat: service role + createSignedUploadUrl has owner=null bug; use direct .upload() with service role instead)
- [Supabase Storage Inefficient Folder Operations Troubleshooting](https://supabase.com/docs/guides/troubleshooting/supabase-storage-inefficient-folder-operations-and-hierarchical-rls-challenges-b05a4d) — HIGH confidence (important anti-pattern: don't JOIN custom metadata table in storage RLS)
- [Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — HIGH confidence
- [How to Create ZIP File with Node.js | CheatCode](https://cheatcode.co/blog/how-to-create-and-download-a-zip-file-with-node-js-and-javascript) — MEDIUM confidence

---

*Architecture research for: v4.0 Document Collection — Prompt UK Accounting SaaS*
*Researched: 2026-02-23*
