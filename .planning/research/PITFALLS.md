# Pitfalls Research

**Domain:** Document collection added to an existing multi-tenant UK accounting SaaS (Supabase Storage, Postmark attachment extraction, token-based client upload portal, UK GDPR compliance, HMRC retention)
**Researched:** 2026-02-23
**Confidence:** HIGH (Supabase Storage docs, Postmark docs, ICO guidance, HMRC manuals, OWASP; patterns verified against current codebase)

---

## Scope Note

This file supersedes the previous PITFALLS.md (which covered multi-tenancy migration for v3.0). These pitfalls are specific to the v4.0 Document Collection milestone — adding Supabase Storage, Postmark attachment extraction, a token-based client upload portal, document classification, UK GDPR compliance, and HMRC retention enforcement to an already multi-tenant system.

**Phase references used throughout:**
- Phase 18 = Document Collection Foundation (schema, storage, compliance groundwork, privacy policy amendments)
- Phase 19 = Collection Mechanisms (passive inbound extraction, active client portal, classification, dashboard surfacing)

---

## Critical Pitfalls

Mistakes that cause data breaches, regulatory violations, or require architectural rewrites.

---

### Pitfall 1: `storage.objects` RLS Policies Not Written — Private Bucket Is Still Accessible

**What goes wrong:**
You create a private Supabase Storage bucket (`documents`), which correctly disables the public CDN URL. You then add organisation-scoped RLS to every database table. But you forget that Supabase Storage uses a separate RLS system on the `storage.objects` table in the `storage` schema — and by default that table has NO policies. Without policies, the Supabase Storage API rejects all uploads and downloads by non-service-role clients, so the feature appears broken. The typical response is to make the bucket public, which instead exposes every uploaded document with a predictable URL.

Even with a private bucket and correctly written `storage.objects` RLS, if the policy does not constrain to the authenticated user's `org_id`, a user from Org A can download a document belonging to Org B simply by guessing or constructing the correct storage path.

**Why it happens:**
- Database RLS and storage RLS are managed separately. Adding `org_id` isolation to all application tables does not protect objects in `storage.objects`.
- The Supabase Dashboard's "private" toggle gives a false sense of security. Private only disables public CDN URLs — it does not create any RLS policies.
- Developers test uploads using the service role key (which bypasses RLS), see it working, and ship without testing with an authenticated user JWT.

**How to avoid:**
Write storage RLS policies on `storage.objects` that enforce both authentication and org-scoped path prefix checks:

```sql
-- Only allow authenticated users to read objects in their own org's folder
CREATE POLICY "org_documents_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = 'orgs'
    AND (storage.foldername(name))[2] = (auth.jwt() -> 'app_metadata' ->> 'org_id')
  );

-- Only allow authenticated users to insert into their own org's folder
CREATE POLICY "org_documents_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = 'orgs'
    AND (storage.foldername(name))[2] = (auth.jwt() -> 'app_metadata' ->> 'org_id')
  );

-- Service role bypasses RLS — used for cron deletion, DSAR export, attachment ingestion
```

For the token-based client portal (unauthenticated uploads), service-role API routes must handle the upload server-side — never expose the Supabase storage client to the browser for unauthenticated uploads. The portal route validates the token, extracts the org_id from the portal_tokens table, then uploads via service role with the full org-scoped path. See Pitfall 6 for token-side details.

**Warning signs:**
- Storage uploads work with service role key but fail with authenticated user session
- Developer solves upload failures by switching bucket to public
- No policies visible on `storage.objects` table in Supabase Dashboard
- Fetching another org's file path with a valid (but different-org) JWT returns 200

**Phase to address:** Phase 18 (Foundation) — storage RLS must be in place before any document is uploaded to the bucket. Do not proceed to Phase 19 without testing cross-org file access from client SDK with two different org users.

---

### Pitfall 2: Signed URLs Generated Without Expiry Bound — Documents Downloadable Indefinitely

**What goes wrong:**
You generate a signed URL to serve a document to the accountant: `supabase.storage.from('documents').createSignedUrl(path, 86400)`. The accountant copies the URL and pastes it into a shared Slack message, a client email, or an email chain forwarded outside the firm. The signed URL continues to work for 24 hours (or 604800 seconds if someone uses 7 days). Worse, once a signed URL is generated, Supabase has no mechanism to revoke it — the URL goes directly to the underlying S3 infrastructure and bypasses all RLS policies for its lifetime.

**Why it happens:**
- Signed URLs feel like a safe middle ground (not fully public) but the expiry is the only control mechanism once issued.
- Long expiry windows are chosen for convenience ("so the user doesn't need to reload").
- The RLS bypass nature of signed URLs (they authenticate against S3 directly, not via Supabase RLS) is not documented prominently and surprises developers.

**How to avoid:**
- Use short signed URL expiry: 300 seconds (5 minutes) for document preview/download. Never exceed 3600 seconds for anything other than bulk export.
- Never cache signed URLs on the client or in the database. Generate fresh ones server-side on each document access request.
- Log every signed URL generation in `document_access_log` (who requested it, when, for which document) — this satisfies the GDPR audit trail requirement and provides forensic visibility.
- For DSAR ZIP exports, generate a signed URL for the ZIP with a 1-hour expiry and send the link via email. Revoke by deleting the ZIP object from storage after download or expiry.

**Warning signs:**
- Signed URL expiry > 3600 seconds anywhere in the codebase
- Signed URLs stored in application state, sessionStorage, or the database
- No `document_access_log` entries for download events
- Signed URLs passed as props into client components (where they may be serialized)

**Phase to address:** Phase 18 (Foundation) — establish the signed URL generation policy in the access log service before Phase 19 builds any download UI.

---

### Pitfall 3: Storage Path Does Not Include `org_id` — Cross-Tenant Path Collisions and Unauthorised Access

**What goes wrong:**
Storage paths are constructed from only `client_id` and `filing_type`: `clients/{client_id}/{filing_type}/{filename}`. Two orgs whose clients happen to have similar-looking IDs (unlikely with UUIDs but possible with sequential IDs or slugs) would share path namespace. More critically, if RLS on `storage.objects` is ever misconfigured or bypassed, there is no org-level segmentation in the path itself — a single RLS gap exposes all orgs' documents simultaneously.

Even with correct RLS, the `client_documents` metadata table needs the storage path to resolve the file. If the path does not contain `org_id`, a service-role query that mistakenly joins across orgs would retrieve valid paths for all orgs with no way to detect the cross-org access from the path alone.

**Why it happens:**
- Paths are designed to be human-readable and minimal. `org_id` is "handled by RLS anyway" so developers omit it.
- The path convention is established early and painful to migrate (every existing file must be moved).

**How to avoid:**
Enforce this path convention from day one and never deviate:

```
orgs/{org_id}/clients/{client_id}/{filing_type}/{tax_year}/{uuid}_{original_filename}
```

This provides defence-in-depth: even if RLS fails or is bypassed, the path itself segments by org. It also makes `storage.objects` RLS policies trivially auditable — the policy simply checks that path segment 2 equals the JWT `org_id`.

The `uuid_` prefix on the filename (generated server-side) prevents path enumeration and removes any dependence on the client-supplied filename for uniqueness.

**Warning signs:**
- Storage path convention does not include `org_id` as the first segment
- Path convention established in Phase 19 without being codified in Phase 18
- `client_documents.storage_path` column values lack `org_id` prefix
- Storage paths use client-supplied filenames directly (without UUID prefix)

**Phase to address:** Phase 18 (Foundation) — the path convention is a schema decision. Define it, document it in ARCHITECTURE.md, and write a path construction helper function before any upload code is written.

---

### Pitfall 4: Postmark Inbound Webhook Extended Without Handling Attachment Size — Vercel Function Timeout

**What goes wrong:**
The existing `/api/postmark/inbound` webhook receives the full attachment `Content` (base64-encoded bytes) inline in the JSON body. Postmark's inbound limit is 35 MB total message size. A client sends a 30 MB batch of scanned documents. The webhook receives 30 MB of base64 JSON (which decodes to ~22 MB of binary data), then attempts to decode each attachment and upload them to Supabase Storage sequentially. The Vercel serverless function has a 60-second execution limit (or 300 seconds on Pro). With a slow Supabase Storage upload on a large payload, the function times out. Postmark does not receive a 200, marks the delivery as failed, and retries — re-uploading the same attachments. Files are duplicated in Storage and `client_documents` contains duplicate entries.

**Why it happens:**
- The existing webhook is designed for text email processing (keyword detection) and is not resource-constrained.
- Postmark delivers attachments inline in the webhook JSON, unlike some other email services that provide a separate download URL.
- Vercel Pro's 300-second limit feels generous but 35 MB of sequential base64-decode + upload can exceed it under load.

**How to avoid:**
1. Add a per-attachment size cap (e.g. reject attachments > 20 MB with a logged warning, still return 200 to Postmark).
2. Process attachments asynchronously: store the raw Postmark payload in `inbound_emails.raw_postmark_data` (already done), return 200 immediately, then process attachments via a separate edge function or queue job.
3. Add idempotency on `inbound_emails.message_id` (Postmark's `MessageID` field): before inserting, check if this MessageID already exists. If it does, skip processing and return 200.
4. Implement deduplication in `client_documents`: before inserting, check for existing rows with the same `inbound_email_id` and `original_filename`. If found, skip the upload.

**Warning signs:**
- Postmark webhook logs show repeated delivery attempts for the same MessageID
- Duplicate rows in `client_documents` with the same `inbound_email_id`
- Vercel function logs show timeout errors on the inbound route
- No check on `inbound_emails.message_id` uniqueness before insert

**Phase to address:** Phase 19 (Collection Mechanisms) — but the idempotency constraint (`UNIQUE(message_id)` on `inbound_emails`, `UNIQUE(inbound_email_id, original_filename)` on `client_documents`) should be defined in Phase 18 migrations.

---

### Pitfall 5: Privacy Policy Not Updated Before Document Storage Goes Live — UK GDPR Transparency Violation

**What goes wrong:**
The current privacy policy covers reminder emails and contact data only. Phase 18 adds document storage and Phase 19 adds a client-facing upload portal. If either goes live without the policy being updated, the system is processing personal data (financial documents, identification documents, tax records) in ways not disclosed to data subjects. Under UK GDPR Article 13/14 (transparency principle) and Article 5(1)(a) (lawfulness, fairness, transparency), this is a violation regardless of whether harm occurs.

ICO enforcement records show fines for inadequate transparency even where no data breach occurred. The Data (Use and Access) Act 2025 (in force 19 June 2025) has not changed this obligation — the transparency principle is unchanged in the new regime.

**Why it happens:**
- Privacy policy updates feel like a task that can be done "alongside" or "after" the technical work.
- The seven specific gaps were identified at the end of v3.0 (documented in ROADMAP.md Phase 2 → Phase 3) but are easy to deprioritise when technical tasks dominate.
- Developers think "no one reads the privacy policy" — but the obligation is to the ICO, not to users' reading habits.

**How to avoid:**
The privacy policy amendments are a hard dependency for Phase 18. The seven identified gaps must all be resolved before any storage bucket receives a real document:

1. Add documents/files as a data category in Section 3, naming what types are stored and why.
2. Add the 6-year statutory carve-out in Section 9 (Article 17(3)(b) UK GDPR exemption — legal obligation under TMA 1970 s.12B and FA 1998 Sch.18 para.21).
3. Broaden the processing scope in Section 4 to include document storage and client portal interactions.
4. Add the firm's clients (the accounting practice's own clients) as a recognised category of data subject for portal interactions.
5. Update the Supabase sub-processor entry to include file storage as a distinct use.
6. Qualify Terms Section 6's special category data restriction: P60s, SA302s, bank statements, and dividend vouchers are necessary for the stated service purpose and are therefore permitted.
7. Add retention periods specific to document types (6 years for HMRC-relevant documents; shorter for working documents not required for a filed return).

**Warning signs:**
- Storage bucket created but privacy policy still says "specifically for sending reminders" as the processing scope
- Phase 18 migrations run in production with no corresponding privacy policy deployment
- Client portal token links sent to a client before the policy is updated
- `document_types` catalog includes financial documents not mentioned in the policy

**Phase to address:** Phase 18 (Foundation) — must be completed AND deployed before the first document is stored. This is a deployment dependency, not just a code dependency.

---

### Pitfall 6: Upload Portal Token Is Reusable, Guessable, or Leaked via Referrer Header

**What goes wrong:**
Three distinct failure modes in one pattern family:

**Reuse:** The portal token is not invalidated after a client submits their documents. The link remains active until expiry, so a forwarded email or shared link allows anyone to add or view documents for that client-filing pair.

**Brute force:** The token is a short numeric code (e.g. 6 digits), a sequential ID, or a UUID without rate limiting. An automated script can enumerate valid tokens and access other clients' portals. HackerOne report #252544 demonstrates this class of attack on token-gated pages.

**Referrer leak:** The portal page at `prompt.app/portal?token=abc123xyz` includes any third-party analytics (e.g. Plausible, Segment, Google Analytics), or the page has an external link. The browser sends the full URL including the token in the `Referer` header when the user navigates to an external resource. The token is now logged in the third party's servers. This is a documented HackerOne bug class (reports #252544, #342693, #6884).

**Why it happens:**
- "No login required" is a feature, but it creates a token-as-credential model that requires explicit security consideration.
- Token expiry feels sufficient — developers don't consider the token-as-shareable-link problem.
- Analytics scripts are added globally to the Next.js layout without considering that some routes contain sensitive tokens in query parameters.

**How to avoid:**
1. **Token generation:** Use `crypto.randomBytes(32).toString('hex')` (64-character hex = 256 bits of entropy). Never use UUIDs (too recognisable) or short codes (too enumerable).
2. **Token storage:** Store a SHA-256 hash of the token in the database, not the token itself. Verify by hashing the submitted token and comparing. This way a database breach doesn't expose valid tokens.
3. **Token scope:** Tokens must be scoped to a specific `client_id` + `filing_type` + `org_id` tuple. A token for one filing must not grant access to any other.
4. **Single-use for sensitive actions:** Uploads can be additive (multiple uploads during the token's valid window is fine), but once the accountant marks the checklist complete, invalidate the token.
5. **Expiry:** 30 days maximum. Store `expires_at` in the `portal_tokens` table and check on every request.
6. **Rate limiting:** Apply rate limiting on the token validation endpoint: max 5 failed attempts per IP per minute, then 429 with exponential backoff.
7. **Referrer suppression:** Set `<meta name="referrer" content="no-referrer">` in the portal page `<head>`. Verify no analytics scripts fire on portal routes — exclude `/portal` from any global analytics.
8. **Token not in server logs:** Postmark includes the token in the upload link sent to the client. Ensure portal URL construction uses POST bodies or query parameter stripping before logging.

**Warning signs:**
- `portal_tokens` table stores plain-text token (not hash)
- Token is a UUID or short numeric code
- Portal page includes any `<script>` from a third-party analytics domain
- Token expiry is not checked on every request (checked only at link click, not at upload time)
- No rate limiting on the token validation route
- Token appears in Vercel access logs

**Phase to address:** Phase 18 (Foundation) — portal_tokens table schema and security model; Phase 19 (Collection Mechanisms) — portal route implementation and rate limiting.

---

### Pitfall 7: Files Stored Without Server-Side MIME Type Validation — Malware Upload Vector

**What goes wrong:**
The client upload portal accepts files via a browser file input with `accept=".pdf,.doc,.docx,.xlsx,.csv"`. The browser enforces this loosely (it can be bypassed with DevTools or a direct HTTP request). The server receives the upload, reads `Content-Type: application/pdf` from the request headers, and stores the file. But `Content-Type` is set by the browser and trivially spoofable. An attacker uploads `malware.exe` with `Content-Type: application/pdf` and a `.pdf` extension. The file is stored in Supabase Storage. An accountant generates a signed URL and downloads it, expecting a PDF.

Even without malicious intent, this creates data quality problems: clients routinely misname files (e.g. a .pages file renamed to .pdf) that cannot be opened by the accountant's tools.

**Why it happens:**
- Browser-side `accept` attribute feels like validation.
- The server trusts the `Content-Type` header from the multipart upload.
- OWASP's File Upload Cheat Sheet documents this as one of the most common upload vulnerabilities.

**How to avoid:**
Perform multi-layer validation server-side in the Phase 19 upload route:

```typescript
// Layer 1: Extension allowlist (case-insensitive)
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.xlsx', '.xls', '.csv', '.png', '.jpg', '.jpeg', '.tiff']);
const ext = path.extname(file.name).toLowerCase();
if (!ALLOWED_EXTENSIONS.has(ext)) {
  return { error: 'File type not accepted' };
}

// Layer 2: File signature (magic bytes) — read first 8 bytes
const buffer = await file.slice(0, 8).arrayBuffer();
const bytes = new Uint8Array(buffer);
// PDF: %PDF (25 50 44 46)
// ZIP/Office: PK (50 4B) — docx/xlsx are ZIP-based
const isPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
const isZip = bytes[0] === 0x50 && bytes[1] === 0x4B;
// ... etc for each allowed type
if (!isPdf && !isZip && /* ... */) {
  return { error: 'File content does not match expected format' };
}

// Layer 3: Size cap — reject files > 50 MB
if (file.size > 50 * 1024 * 1024) {
  return { error: 'File too large. Maximum size is 50 MB.' };
}
```

Never execute uploaded files. Store uploads in Supabase Storage (which does not serve files with execute permissions). Generate a server-side UUID filename — never use the original filename as the storage key. Store the original filename separately in `client_documents.original_filename` for display purposes only.

**Warning signs:**
- Upload route trusts the `Content-Type` request header as the source of truth
- No magic byte check on file content
- Original client-supplied filename used as the storage path key
- No file size limit enforced server-side
- `accept` attribute on `<input type="file">` treated as the security boundary

**Phase to address:** Phase 19 (Collection Mechanisms) — upload route implementation. Allowlist definition in Phase 18 (in the `document_types` catalog, which specifies expected MIME types per document type).

---

### Pitfall 8: HMRC 6-Year Retention Requirement Not Implemented — Active Deletion Too Early

**What goes wrong:**
Retention enforcement is designed as "delete after 6 years from the relevant tax year end." The cron job calculates this as `document.received_at + 6 years`. A P60 for tax year 2024/25 received in May 2025 would be deleted in May 2031. But the HMRC requirement is that records are kept until the sixth anniversary of the end of the **accounting period they relate to**, not the date they were received. The accounting period for 2024/25 ends 5 April 2025. The sixth anniversary is 5 April 2031. Using `received_at` gives a correct-ish result in this case, but for documents received late (e.g. a bank statement for Q1 2024 received in 2026), the calculation is 2032, when the legal requirement ended in 2030.

The subtler risk: deleting documents that are under an active HMRC enquiry. Once HMRC opens an enquiry, records must be retained until the enquiry concludes — potentially well beyond 6 years. The cron job has no way to know about open enquiries.

**Why it happens:**
- "6 years" sounds simple, but the anchor date is the tax period end, not the document receipt date.
- HMRC enquiry awareness requires either manual intervention or integration with HMRC systems (which does not exist).
- Automated retention enforcement is built to be fire-and-forget; edge cases like active enquiries are not considered.

**How to avoid:**
1. Store `tax_period_end_date` on `client_documents` at the time of upload/classification. This is the anchor for the 6-year calculation.
2. Retention formula: `delete_after = tax_period_end_date + 6 years`, not `received_at + 6 years`.
3. Add a `retention_hold` boolean to `client_documents`. Accountant can set this flag on any document to prevent automated deletion (for open enquiry or litigation hold scenarios).
4. Cron must check `WHERE retention_hold = false AND delete_after < NOW()` — never delete held documents.
5. The retention cron must NOT delete immediately — it should flag documents as `deletion_pending`, notify the accountant, and give a 30-day window for review. Actual deletion occurs at the end of that window if no hold is placed.
6. Log every deletion in `document_access_log` with `action = 'deleted_retention_enforcement'` for audit trail.

**Warning signs:**
- Retention calculation uses `received_at` as the anchor rather than `tax_period_end_date`
- No `retention_hold` column on `client_documents`
- Retention cron deletes documents immediately without a review window
- No accountant notification before documents are deleted
- No deletion audit trail in `document_access_log`

**Phase to address:** Phase 18 (Foundation) — `client_documents` schema must include `tax_period_end_date` and `retention_hold`. Retention cron design must be specified (even if not implemented until later).

---

### Pitfall 9: DSAR Export Misses Documents — Partial Compliance

**What goes wrong:**
An accounting firm's client submits a Subject Access Request (SAR) under UK GDPR Article 15. The accountant triggers the DSAR export for that client from the client detail page. The export produces a ZIP containing files from `client_documents` and metadata from the `document_access_log`. But the SAR also covers personal data held in:
- `inbound_emails` (the client's email content and body)
- `email_log` (what emails were sent to this client and when)
- The client's contact details and filing metadata in `clients`
- Any notes or audit entries in `audit_log` relating to this client

If the DSAR export only covers uploaded documents, the response is incomplete. Under UK GDPR, an incomplete SAR response is itself a breach — the ICO considers it the same as not responding. The 30-day (one calendar month) deadline still applies.

**Why it happens:**
- DSAR export is designed to answer "what documents do you hold about this client?"
- The broader personal data scope (email content, sent reminders, audit trail) is not considered during document collection feature design.
- Each data type lives in a different table, and pulling them all together requires deliberate cross-table joining.

**How to avoid:**
Design the DSAR export as a comprehensive personal data export, not just a document export. The export ZIP must include:

```
dsar-{client_id}-{date}/
  manifest.json            — all included data categories, dates, counts
  documents/               — all files from client_documents
    {filename}             — original files
    index.json             — metadata for each file
  email-history/
    sent-emails.json       — all outbound emails from email_log for this client
    inbound-emails.json    — all inbound emails from inbound_emails for this client
  client-profile/
    profile.json           — name, email, filing assignments, deadline overrides
  audit-trail/
    access-log.json        — all document_access_log entries for this client
    audit-log.json         — all audit_log entries for this client_id
```

The manifest.json must state the date range covered and any data categories that were searched but found empty.

**Warning signs:**
- DSAR export only queries `client_documents` and not `inbound_emails`, `email_log`, or `audit_log`
- No manifest.json in the export
- No automation — the export requires manual SQL queries
- DSAR export not accessible from the client detail page (requiring admin SQL access means it cannot meet the 30-day window reliably)

**Phase to address:** Phase 18 (Foundation) — DSAR export data model and format defined before any data is collected. Phase 19 or later — export mechanism built.

---

### Pitfall 10: Document Classification Confidence Not Stored — Wrong Type Labels Surface in UI

**What goes wrong:**
The classification logic identifies a file as "P60" based on the filename `p60_final_2024.pdf` with high confidence. But another file, `bank statement march.pdf`, is classified as "bank statement" based solely on the filename string match — which has lower reliability. Both are stored with the same `document_type_id` label in `client_documents`, with no indication of classification reliability. The accountant sees both files labelled confidently in the dashboard.

The P60 classification is correct. The "bank statement" classification might be wrong — it could be a credit card statement, a savings account summary, or a completely mislabelled file. The accountant, trusting the automatic label, does not review the file before using it in the filing preparation. An incorrect document type leads to the wrong document being requested from the client, or worse, a wrong assumption about what was received.

**Why it happens:**
- Classification systems are designed to label. The concept of "I don't know" is not built into the initial schema.
- Low-confidence classifications look identical to high-confidence ones in the data model.
- MIME type + filename matching is coarser than it appears: many HMRC documents (SA302, P60, tax computations) are all PDFs with non-standardised filenames.

**How to avoid:**
1. Store `classification_confidence` (enum: `high`, `medium`, `low`, `unclassified`) on `client_documents`.
2. Classification logic must be explicit about its evidence:
   - HIGH: filename matches known HMRC patterns AND magic bytes match expected format
   - MEDIUM: filename matches OR MIME type matches but not both
   - LOW: one weak signal (e.g. a word in the filename)
   - UNCLASSIFIED: no match against any document type in catalog
3. In the UI, show classification confidence. LOW and UNCLASSIFIED documents must be flagged for accountant review, not quietly labelled.
4. Never auto-mark a filing requirement as "received" based on a LOW-confidence classification. Require accountant confirmation.
5. Allow the accountant to manually correct the classification label — store `classification_override` separately from `classification_auto`.

**Warning signs:**
- `client_documents` has no `classification_confidence` column
- All documents surface in the dashboard with equal visual weight regardless of classification certainty
- Auto-marking of "records received" triggers on LOW-confidence classifications
- No "unclassified — review needed" state in the document checklist UI

**Phase to address:** Phase 18 (Foundation) — schema must include confidence column; Phase 19 (Collection Mechanisms) — classification logic must populate it; dashboard must surface review flags.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Using `received_at` instead of `tax_period_end_date` for retention anchor | Simpler schema, no need to classify tax year | Documents deleted too early or too late; HMRC compliance gap | Never |
| Making storage bucket public during development | Eliminates RLS debugging | Every document exposed with predictable URL; extremely painful to revert once in production | Never — use service role for dev testing instead |
| Storing plain-text portal token in `portal_tokens` table | Simpler to debug | Database breach exposes all valid tokens → any client's documents accessible | Never |
| Generating signed URLs with 7-day expiry | Fewer page reloads | Signed URLs forwarded outside the firm; no revocation possible | Only for DSAR bulk export (1 hour max), immediately invalidated after download |
| Skipping magic byte validation and trusting `Content-Type` header | Simpler upload route | Malformed or malicious files accepted; accountant downloads unexpected content | Never — magic byte check is 10 lines of code |
| DSAR export covers only `client_documents` | Faster to implement | SAR response is incomplete; ICO enforcement risk | Never — partial SAR response is itself a violation |
| Privacy policy updates deferred until "after launch" | Ship faster | Processing personal data outside the declared scope; ICO transparency violation; legal liability for the firm | Never |
| Single storage path without `org_id` prefix | Cleaner URLs | Defence-in-depth lost; any RLS misconfiguration exposes all orgs' documents | Never |

---

## Integration Gotchas

Common mistakes when connecting to existing services or extending existing handlers.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Postmark inbound webhook | Adding attachment extraction in the same synchronous handler that currently returns 200 immediately | Store the Postmark payload immediately, return 200, process attachments asynchronously via a separate function/queue triggered from the stored payload |
| Postmark inbound webhook | Not checking `Attachments` array for null or empty before iterating | Guard with `if (!payload.Attachments?.length) return` before attachment processing loop |
| Postmark inbound webhook | Trusting `ContentType` field from Postmark as ground truth for file type | ContentType comes from the sending email client and is not verified; validate magic bytes server-side |
| Postmark inbound webhook | Processing the same email twice when Postmark retries | Add `UNIQUE(message_id)` constraint on `inbound_emails` and check before processing |
| Supabase Storage signed URL | Generating signed URL client-side using the browser Supabase client | The storage policy must allow the authenticated user to `createSignedUrl` — easier to generate server-side in a Server Action and return the short-lived URL |
| Supabase Storage | Uploading client-supplied filename as the storage key | Always generate a server-side UUID filename; store original in `client_documents.original_filename` |
| Client portal route (unauthenticated) | Using the authenticated Supabase client in the portal API route | The portal route has no user session; use service role client with the org_id extracted from the validated token row |
| Client portal route | Token validation not atomic — read-then-write creates race condition | Use a single `UPDATE portal_tokens SET last_used_at = NOW() WHERE token_hash = $1 AND expires_at > NOW() RETURNING *` — if no rows returned, token is invalid |
| `document_access_log` | Skipping log writes for "minor" operations like list views | Every access (including list views) must be logged; the log is the GDPR audit trail for DSAR and ICO enquiries |

---

## Performance Traps

Patterns that work at small scale but fail as data grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Generating signed URLs for every document in a list view | List of 50 documents triggers 50 sequential signed URL API calls; page load > 5 seconds | Generate signed URLs lazily on demand (user clicks "Download"), not on list render | At ~20+ documents per client filing |
| No index on `client_documents(client_id, filing_type_id)` | Dashboard document counts cause sequential table scans | Add composite index on `(org_id, client_id, filing_type_id)` in Phase 18 migration | At ~500+ documents across all clients |
| Retention cron queries all `client_documents` without index on `delete_after` | Cron runs slowly, potentially timing out | Add index on `(delete_after, retention_hold)` where `retention_hold = false` (partial index) | At ~10,000+ documents |
| DSAR export generates ZIP in-memory in a serverless function | Large exports (client with many years of documents) exhaust function memory | Generate ZIP as a stream, upload directly to a temp Supabase Storage path, return a signed URL | At ~50+ files per DSAR export |
| Storage path includes the original filename with unicode/spaces | Storage API errors on non-ASCII filenames; inconsistent URL encoding | Always use `{uuid}_{sanitised_extension}` as the storage key; map to original filename via DB | First non-ASCII filename encountered |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Portal token in server-side access logs | Token leaked to log aggregation systems (Vercel logs, Datadog, etc.); anyone with log access can access any client's portal | Strip token from URL before logging; use `X-Forwarded-Token` header pattern or POST body for token submission |
| Signed URL returned in a JSON API response that is cached | CDN or browser caches the signed URL; served stale after expiry causes confusing errors, but worse, caches it alive longer than intended | Set `Cache-Control: no-store` on any API response containing a signed URL |
| Analytics scripts on portal route | Token leaked via `Referer` header to analytics provider | Exclude `/portal/*` from analytics tracking; add `<meta name="referrer" content="no-referrer">` |
| Service role key used in a client component | Service role bypasses all RLS; if exposed via the browser it compromises every tenant's data | Service role key must never appear in `NEXT_PUBLIC_` env vars or client-side code; only used in server actions, API routes, and edge functions |
| `document_access_log` writable by authenticated users | An accountant could delete or modify audit entries, compromising the GDPR audit trail | RLS on `document_access_log` must be INSERT-only for authenticated users — never UPDATE or DELETE |
| Cross-org IDOR via `client_documents` ID | A user who knows a document UUID could access it via the download API if org_id is not checked | Every document download API must verify `org_id` from JWT matches the document's `org_id` in addition to relying on RLS |
| Retention cron runs as service role and deletes without checking retention_hold | Documents under HMRC enquiry hold are destroyed | Cron query must include `AND retention_hold = false`; log every deletion; send notification before deletion |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Expired token shows generic 404 or 500 error | Client confused, contacts accountant, delays document collection | Show a clear expiry message: "This link has expired. Please contact your accountant to request a new one." Include the firm name in the message. |
| Low-confidence classification silently labelled as document type | Accountant trusts wrong label; uses wrong document in filing preparation | Show classification confidence badge; flag LOW and UNCLASSIFIED for review with a distinct visual state |
| Document checklist shows all filing requirements for every client | Clients who are employees see Corporation Tax document requirements that don't apply to them | Per-client checklist customisation: toggle items off for inapplicable requirements; portal shows only enabled items |
| Upload progress not shown for large files | Client unsure if upload succeeded; submits again; creates duplicates | Show upload progress bar; confirm each file individually; show final confirmation screen |
| Accountant notified of every single file upload | Email noise if client uploads 10 files in one session | Batch notifications: debounce to one notification per session/hour rather than one per file |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces specific to this milestone.

- [ ] **Supabase Storage bucket created:** Does it have RLS policies on `storage.objects`? Private bucket + no RLS = all uploads rejected. Test with an authenticated user JWT, not service role.
- [ ] **Privacy policy updated:** Are all 7 identified gaps from ROADMAP.md Phase 2 resolved? Is the updated policy deployed before any document is stored in production?
- [ ] **Portal token works:** Is the stored value a SHA-256 hash of the token (not the token itself)? Does it expire? Is rate limiting on the validation route implemented?
- [ ] **Classification has confidence levels:** Does `client_documents` have a `classification_confidence` column? Do LOW/UNCLASSIFIED documents require accountant review before auto-marking "received"?
- [ ] **DSAR export is complete:** Does it include `inbound_emails`, `email_log`, `clients` profile, and `audit_log` — not just `client_documents`?
- [ ] **Retention uses tax period end date:** Is `tax_period_end_date` on `client_documents`? Is there a `retention_hold` flag? Does the cron notify before deleting?
- [ ] **Attachment extraction is idempotent:** Is there a `UNIQUE(message_id)` constraint on `inbound_emails`? Would Postmark retries create duplicate files?
- [ ] **File upload has server-side validation:** Are magic bytes checked (not just `Content-Type` header)? Is there a file size cap enforced server-side? Are storage keys UUID-based (not client filenames)?
- [ ] **Signed URLs are short-lived:** Are all signed URLs generated with <= 300 second expiry? Is every generation logged in `document_access_log`?
- [ ] **Storage paths include org_id as first segment:** Do all `client_documents.storage_path` values follow `orgs/{org_id}/clients/...`?
- [ ] **document_access_log is INSERT-only:** Is UPDATE and DELETE blocked by RLS for authenticated users?

---

## Recovery Strategies

| Incident | Recovery Cost | Recovery Steps |
|----------|---------------|----------------|
| Storage bucket made public during development, left public in production | HIGH | 1. Immediately switch bucket to private. 2. Audit Supabase access logs for any file downloads. 3. Rotate any signed URLs that were generated. 4. Notify ICO if real client documents were exposed (72-hour breach notification window under UK GDPR). |
| Privacy policy not updated before documents stored in production | MEDIUM | 1. Update and deploy privacy policy immediately. 2. Document the gap duration in a remediation log. 3. Assess whether affected data subjects need to be notified under UK GDPR transparency obligations. 4. Seek legal advice on ICO notification. |
| Portal token leaked via referrer header to analytics | MEDIUM | 1. Rotate all active portal tokens immediately (expire them). 2. Remove analytics from portal routes. 3. Add `<meta name="referrer" content="no-referrer">` to portal layout. 4. Request analytics provider delete the captured URLs. |
| Retention cron deleted documents still under HMRC enquiry | CRITICAL | 1. Immediately disable retention cron. 2. Check Supabase Storage version history (if enabled) for deleted objects. 3. Notify affected accounting firms. 4. Consult solicitor — destruction of records under enquiry is a criminal offence under TMA 1970 s.20BB. 5. Add `retention_hold` flag and re-enable cron only after testing. |
| Duplicate documents from Postmark webhook retries | LOW | 1. Add `UNIQUE(message_id)` constraint on `inbound_emails`. 2. Query for duplicate rows sharing `inbound_email_id` + `original_filename`. 3. Delete Storage objects for duplicates. 4. Remove duplicate `client_documents` rows. |
| Wrong document type classification led to incorrect filing assumption | MEDIUM | 1. Allow accountants to manually correct classification. 2. Audit all classifications where `classification_confidence = 'low'`. 3. Add confidence badge to dashboard UI. 4. Require accountant confirmation before auto-marking "records received" for LOW confidence matches. |
| Cross-org file access via misconfigured storage RLS | CRITICAL | 1. Immediately revoke service role client key and rotate. 2. Audit `document_access_log` and Supabase Storage access logs. 3. Fix `storage.objects` RLS policies. 4. Notify ICO within 72 hours (personal data breach). 5. Notify affected data subjects. |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| `storage.objects` RLS not written | Phase 18 | Test cross-org download with two separate authenticated JWTs; confirm 403 |
| Signed URLs without expiry bound | Phase 18 | Grep codebase for `createSignedUrl` and assert second argument (expiry) <= 300; check access log entries |
| Storage path without org_id prefix | Phase 18 | Check all `client_documents.storage_path` values follow `orgs/{org_id}/...`; SQL assertion |
| Postmark webhook timeout / no idempotency | Phase 18 (schema constraints), Phase 19 (async processing) | Add `UNIQUE(message_id)` to migration; test by replaying same webhook payload twice |
| Privacy policy not updated before go-live | Phase 18 (as hard deployment dependency) | Confirm policy is live at /privacy before any document is stored in production; milestone gate |
| Portal token reuse / brute force / referrer leak | Phase 18 (token schema), Phase 19 (portal route) | Pen test: verify token stored as hash; confirm rate limiting; check network tab for referrer on portal page |
| No server-side MIME/magic byte validation | Phase 19 | Upload a .exe renamed to .pdf; confirm rejection; upload legit PDF; confirm acceptance |
| HMRC retention wrong anchor date | Phase 18 | Schema review: `tax_period_end_date` column exists; retention formula audited in cron spec |
| DSAR export misses data categories | Phase 18 (design) | Walk through DSAR export for a test client; confirm `inbound_emails`, `email_log`, `audit_log` present |
| Classification confidence not stored | Phase 18 (schema), Phase 19 (classifier) | Verify `classification_confidence` column in `client_documents`; UI shows review flag for low-confidence |

---

## Sources

- [Supabase Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control) — storage.objects RLS requirements, private bucket behaviour
- [Supabase Storage Buckets Fundamentals](https://supabase.com/docs/guides/storage/buckets/fundamentals) — private vs public bucket access model
- [Supabase Storage Create Signed URL](https://supabase.com/docs/reference/javascript/storage-from-createsignedurl) — signed URL expiry and revocation limitations
- [Supabase Security Pentesting Guide 2025](https://github.com/orgs/supabase/discussions/38690) — RLS misconfiguration patterns from real pentests
- [Supabase 170+ Apps Security Flaw (Missing RLS)](https://byteiota.com/supabase-security-flaw-170-apps-exposed-by-missing-rls/) — real-world impact of missing storage RLS
- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) — MIME type spoofing, magic byte validation, allowlist approach
- [Postmark Inbound Attachment Limits](https://postmarkapp.com/support/article/1056-what-are-the-attachment-and-email-size-limits) — 35 MB total inbound size limit, base64 inline content
- [Postmark Parse an Email](https://postmarkapp.com/developer/user-guide/inbound/parse-an-email) — attachment content structure, Content field
- [ICO Storage Limitation Principle](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/storage-limitation) — UK GDPR retention and deletion obligations
- [ICO Right of Access (DSAR)](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-of-access/) — SAR scope and 30-day response requirement
- [ICO Time Limits for DSAR Responses](https://ico.org.uk/for-the-public/time-limits-for-responding-to-data-protection-rights-requests/) — one calendar month deadline
- [HMRC CH14600 Corporation Tax Record Retention](https://www.gov.uk/hmrc-internal-manuals/compliance-handbook/ch14600) — 6 years from end of accounting period
- [HMRC Record Retention and Disposal Policy](https://www.gov.uk/government/publications/hmrc-records-management-and-retention-and-disposal-policy/records-management-and-retention-and-disposal-policy) — 6 year + current standard retention period
- [UK Document Retention Guide GDPR and HMRC](https://yousign.com/blog/document-retention-policies-uk-compliance) — overlap and tension between GDPR data minimisation and HMRC mandatory retention
- [ICO UK GDPR and EU Adequacy](https://ico.org.uk/for-organisations/data-protection-and-the-eu/) — EU adequacy decisions renewed December 2025; Ireland (EU West) adequacy confirmed
- [Token Leakage via Referrer Header (HackerOne)](https://hackerone.com/reports/252544) — referrer leak of sensitive tokens to analytics
- [Password Reset Token Leak via Referrer (HackerOne)](https://hackerone.com/reports/342693) — documented attack class
- [IDOR via Brute Force (PortSwigger)](https://portswigger.net/web-security/access-control/idor) — IDOR enumeration of token-gated resources
- [UK Data Protection Reform 2025](https://www.dataprotectionreport.com/2025/07/uk-data-protection-reform-what-you-need-to-know-and-do/) — Data (Use and Access) Act 2025 does not change transparency obligations
- [ICO Enforcement 2025 Analysis](https://www.urmconsulting.com/blog/analysis-of-ico-enforcement-action-january-june-2025) — fines for non-compliance including inadequate transparency

---

*Pitfalls research for: Prompt v4.0 Document Collection*
*Researched: 2026-02-23*
*Confidence: HIGH — storage RLS patterns verified against Supabase official docs; UK GDPR/ICO guidance verified against official ICO sources; HMRC retention verified against HMRC internal manual CH14600; token security patterns verified against OWASP and HackerOne disclosures; all pitfalls traced to specific failure modes in the existing codebase or confirmed attack patterns*
