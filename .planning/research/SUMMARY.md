# Project Research Summary

**Project:** Prompt — v4.0 Document Collection
**Domain:** Document collection portal for UK accounting practice management SaaS
**Researched:** 2026-02-23
**Confidence:** HIGH (all four research files verified against official Supabase docs, HMRC internal manuals, ICO guidance, OWASP, and npm registry)

---

## Executive Summary

Prompt v4.0 adds structured document collection on top of an already-complete multi-tenant reminder platform. The approach builds a private Supabase Storage bucket (EU West) where documents arrive via two channels: passively from Postmark inbound email attachments (zero client friction — clients who already reply to reminders have their documents captured automatically), and actively via a token-based client upload portal (no login, no app download required). The competitive differentiation is tight integration with the existing UK filing deadline engine: the client portal shows exactly the documents needed for a client's specific SA100, CT600, VAT return, or Companies House filing — not a generic checklist. This fills a gap no competitor in the UK accounting SaaS market has addressed.

The minimal footprint of this milestone is a key strength: only two new npm packages are required (`file-type@^21.3.0` for magic byte MIME detection, `fflate@^0.8.2` for DSAR ZIP export). All other capabilities — storage, document serving, token validation, cron scheduling — use existing dependencies already in the stack. The Vercel 4.5 MB serverless payload limit is a hard architectural constraint that is not configurable. This makes the signed upload URL pattern mandatory, not optional: the portal client receives a signed URL from the Next.js server and uploads directly to Supabase Storage, bypassing Next.js entirely. Attempting to proxy large files through Next.js will fail for any document over 4.5 MB.

The critical risks in this milestone are legal and compliance-based, not primarily technical. The privacy policy must be updated and deployed before a single document is stored (UK GDPR Art. 13/14 transparency obligation). HMRC retention must use `tax_period_end_date` as the anchor (not `received_at`) with a `retention_hold` flag for active enquiries — destroying records under an HMRC enquiry is a criminal offence. Storage RLS is a separate system from database RLS; a private bucket without `storage.objects` policies rejects all uploads, and the typical "fix" (switching to a public bucket) creates a data breach. The `createSignedUploadUrl` SDK method has a known service_role bug (`owner=null`) — use `storage.upload()` directly with the service role client for portal uploads instead. Token security requires 256-bit entropy, SHA-256 hashing at rest, revocability via database, and referrer suppression on the portal page. All of these have clear, implementable solutions documented in the research.

---

## Key Findings

### Recommended Stack

Only two new packages are needed for the entire v4.0 milestone. The existing `@supabase/supabase-js` (already at `^2.95.3`) includes the full Storage SDK — no separate install is needed. `FormData` parsing for uploads is handled natively by the App Router with `request.formData()`, removing the need for `multer`, `formidable`, or `busboy`. Retention cron runs as a Supabase Edge Function (Deno) invoked by `pg_cron`, which keeps the logic inside the Supabase project boundary and avoids the need for a Vercel cron endpoint for this operation.

See `STACK.md` for full integration patterns, SDK code examples, and Vercel constraint details.

**New dependencies (production only):**
- `file-type@^21.3.0`: Magic byte MIME detection — detects PDF, JPEG, PNG, DOCX/XLSX from binary content; no external service; pure server-side; ESM-only (compatible with Next.js App Router)
- `fflate@^0.8.2`: DSAR ZIP generation — pure JavaScript, no native bindings; returns `Uint8Array` directly suitable for a `Response` body; 5x smaller than `jszip`; works in both Vercel serverless and Supabase Edge Functions

**Critical version and config details:**
- Vercel 4.5 MB payload limit is hard and unaffected by `serverActions.bodySizeLimit` in production — confirmed via multiple GitHub issues (#57501, #53087, #77505)
- `createSignedUploadUrl` has a known bug when called with service_role: `owner` field is set to null, causing downstream permission issues. Use `storage.upload()` with the admin client for portal uploads instead.
- Storage bucket must be created via the Supabase Dashboard or management API (not via SQL migration) — bucket creation SQL is not supported in the migration runner
- No new environment variables required — existing `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` cover all storage operations
- EU West (Ireland) bucket region follows project region automatically — verify project region before creating bucket if GDPR adequacy is a deployment requirement

**What NOT to add:**
- Third-party document processing services (AWS Textract, Google Document AI) — financial documents cannot leave the EU or be processed by third-party AI
- `uploadthing` — wraps a SaaS over Supabase Storage, adds a third-party data processor
- `pdf-parse` or `pdfjs-dist` — not needed; filename + MIME type classification is sufficient for v4.0
- `multer` / `formidable` — these are Pages Router/Express patterns; App Router handles `FormData` natively

### Expected Features

**Must ship for v4.0 launch (table stakes — product is incomplete or non-compliant without these):**
- Private document storage with org-scoped access control — signed URLs only, no public paths
- Client upload portal (no login, no app) with filing-type-specific checklist
- Passive collection — extend existing Postmark inbound webhook to extract and store email attachments
- Documents surfaced inline in filing type cards on client detail view
- Checklist per filing type with manual override capability
- 6/5-year HMRC retention enforcement — companies 6yr from accounting period end, individuals 5yr from Jan 31
- Retention hold flag for active HMRC enquiries (auto-deletion when enquiry is open is a criminal offence)
- DSAR export — ZIP + JSON manifest covering documents, inbound emails, email log, client profile, and audit log
- Audit trail (document_access_log) for every signed URL generation — required for GDPR compliance
- Privacy policy amendments (7 identified gaps) — hard deployment gate before any document is stored

**Should have (competitive differentiators in the UK market):**
- Auto-classification of uploaded documents by filename patterns + MIME type with confidence scoring
- Checklist auto-generated from client profile (conditional items: P60 for PAYE, self-employment accounts for sole traders, etc.)
- Per-client checklist customisation (toggle items on/off, add ad-hoc items)
- Deadline-anchored document requests (upload link embedded in reminder email via `{{upload_link}}` placeholder)
- Dashboard activity feed showing recent uploads across all clients
- Retention enforcement cron with flagging and accountant review before deletion (not auto-delete)

**Defer to v4.x (validate core collection first):**
- `{{upload_link}}` placeholder in reminder templates (requires reminder template system extension)
- Dashboard activity feed (build when practice size warrants it, >20 active clients)
- Improved classification (ML-based or richer heuristics) — only if accountant feedback identifies misclassification as a friction point
- Bulk download (ZIP) of all documents per filing-year for accountants

**Explicit anti-features (do not build in v4.0):**
- OCR / data extraction — requires near-100% accuracy for tax purposes; Dext is the dedicated product for this
- E-signatures — separate product category with UK eIDAS compliance complexity
- Client portal login / document history — industry pattern is magic links, not client accounts; token-based access is the right approach
- Google Drive / Dropbox sync — OAuth integration per provider, high maintenance surface area
- ZIP upload — security risk (zip bombs, path traversal); multi-file drag-and-drop is better UX
- AI-generated document summaries — hallucination risk on financial data; accountants are trained to read these documents

**Key competitive position:** No competitor in UK accounting SaaS (TaxDome, Karbon, Senta, Dext) integrates document collection with a UK-specific filing deadline engine. Prompt's checklist for an SA100 client differs from a CT600 client by default. Documents are linked to specific filing years. Passive collection from email replies is completely unique in the category.

See `FEATURES.md` for the full HMRC document catalog, filing-type-to-document mappings, prioritisation matrix, and competitor feature table.

### Architecture Approach

The architecture adds one private Supabase Storage bucket, five new database tables, four new `lib/documents/` modules, a new `(portal)` route group, and extensions to two existing routes (`/api/postmark/inbound` and the filing management dashboard component). No existing tables are modified except `lib/types/database.ts`. Storage RLS and database RLS are managed entirely separately — `storage.objects` requires its own policies that are independent of the application table RLS. All upload flows use the service role client server-side; raw storage paths never leave the server; client components receive only ephemeral signed URLs. The portal token system uses 256-bit entropy tokens, SHA-256 hashes stored in the database, `expires_at` + `revoked` columns for lifecycle management, and double validation on every upload request.

See `ARCHITECTURE.md` for complete table schemas, data flow diagrams, component responsibilities, code patterns, and anti-patterns to avoid.

**Major new components:**

| Component | Status | Responsibility |
|-----------|--------|---------------|
| `supabase/migrations/*_document_schema.sql` | NEW | All 5 new tables + Storage RLS policies |
| `lib/documents/storage.ts` | NEW | Supabase Storage: upload, signed URL generation, deletion |
| `lib/documents/portal.ts` | NEW | Token creation, validation, revocation |
| `lib/documents/metadata.ts` | NEW | `client_documents` CRUD + attachment extraction helper |
| `lib/documents/retention.ts` | NEW | Retention calculation, DSAR ZIP export |
| `lib/documents/classify.ts` | NEW | Auto-classification: filename/MIME to document_type_id |
| `app/(portal)/portal/[token]/page.tsx` | NEW | Public upload portal — no auth session |
| `app/api/portal/[token]/upload/route.ts` | NEW | Multipart upload handler with token re-validation |
| `app/api/cron/retention/route.ts` | NEW | Daily retention flag scan |
| `app/(dashboard)/clients/[id]/components/documents-panel.tsx` | NEW | Document list with signed URL download |
| `/api/postmark/inbound/route.ts` | MODIFIED | Add attachment extraction as Step 6 (non-critical, non-blocking) |

**New database tables (all requiring explicit RLS):**
1. `document_types` — global reference catalog (no `org_id`, read-only for authenticated users)
2. `filing_document_requirements` — maps filing types to expected document types
3. `client_documents` — one row per stored file, with `org_id`, `client_id`, `tax_period_end_date`, `retain_until`, `retention_hold`, `classification_confidence`
4. `document_access_log` — INSERT-only audit trail; every signed URL generation logged
5. `upload_portal_tokens` — stores `token_hash` (SHA-256), `expires_at`, `revoked`, `last_used_at`

**Storage path convention (must be established in Phase 18 before any upload code is written):**
```
orgs/{org_id}/clients/{client_id}/{filing_type_id}/{tax_year}/{uuid}.{ext}
```
The `{uuid}` filename is server-generated. Original filename is stored in `client_documents.original_filename` only — never used as the storage key.

### Critical Pitfalls

Research identified 10 critical pitfalls. The top 5 that require preventive action before any document is stored in production:

1. **Storage RLS not written — private bucket rejects all SDK calls** — Storage RLS on `storage.objects` is a separate system from database RLS. Creating a private bucket does not create any policies; without them, all non-service-role uploads and downloads are rejected. The typical "fix" of switching to a public bucket creates a data breach. Write org-scoped policies using `storage.foldername(name)` array indexing before Phase 19 begins. Test with a real authenticated user JWT (not service role) to confirm policies work. See PITFALLS.md Pitfall 1.

2. **Privacy policy not updated before documents are stored in production — UK GDPR transparency violation** — Seven specific gaps in the current policy must be closed: financial document data category, 6-year statutory retention carve-out, updated processing scope, accounting firm clients as a data subject category, Supabase storage as a sub-processor use, special category data qualification in Terms, and document-type-specific retention periods. This is not a post-launch task. It is a hard deployment gate. The ICO has fined organisations for inadequate transparency even without a data breach. See PITFALLS.md Pitfall 5.

3. **HMRC retention anchored to `received_at` instead of `tax_period_end_date`** — The 6-year retention period runs from the end of the accounting period the documents relate to, not from when the document was received. Using `received_at` produces incorrect deletion dates. Additionally, documents under an active HMRC enquiry must never be deleted automatically — destroying records under enquiry is a criminal offence under TMA 1970 s.20BB. The `client_documents` schema must include `tax_period_end_date` and `retention_hold` columns from Phase 18. The retention cron must check `WHERE retention_hold = false`. See PITFALLS.md Pitfall 8.

4. **Portal token stored as plaintext / insufficient entropy** — Three failure modes: (a) plaintext storage means a database breach exposes all active tokens; (b) UUIDs or short codes can be brute-forced; (c) analytics scripts on the portal page leak the token via `Referer` header to third-party servers. Use `crypto.randomBytes(32)` (256-bit entropy), store `sha256(rawToken)` only, exclude `/portal/*` from all analytics, add `<meta name="referrer" content="no-referrer">` to the portal layout. See PITFALLS.md Pitfall 6.

5. **`createSignedUploadUrl` service_role bug — use `storage.upload()` for portal uploads** — When `createSignedUploadUrl` is called with the service role client, the `owner` field is set to null, which can cause downstream permission issues. For the portal upload flow (where the server uploads on behalf of the unauthenticated client), use `storage.upload()` with the admin client directly. `createSignedUploadUrl` is appropriate when the authenticated browser client uploads directly, but the portal flow handles this server-side. See STACK.md and ARCHITECTURE.md Pitfall 5.

**Additional critical pitfalls to address in Phase 18 schema design:**
- Storage path must include `org_id` as first segment — not just handled by RLS, but defence-in-depth if RLS is misconfigured
- Signed URLs must be <= 300 seconds expiry for document access; every generation must be logged in `document_access_log`
- `document_access_log` must be INSERT-only for authenticated users (no UPDATE or DELETE via RLS) — audit trail integrity
- DSAR export must cover all personal data categories, not just `client_documents` (also: `inbound_emails`, `email_log`, `clients` profile, `audit_log`)
- Postmark webhook must be idempotent (`UNIQUE(message_id)` on `inbound_emails`) to prevent duplicate documents on retry
- Server-side MIME validation must use magic bytes (`file-type`), not the `Content-Type` request header (trivially spoofable)

---

## Implications for Roadmap

Research clearly supports a two-phase build for v4.0. The dependency graph is firm: Phase 18 (Foundation) creates every artifact Phase 19 (Collection Mechanisms) depends on. No work in Phase 19 can begin safely until Phase 18 is complete and verified.

### Phase 18: Document Collection Foundation

**Rationale:** Every artifact needed by the collection mechanisms must exist before building them. Schema errors discovered in Phase 19 require migrations against tables that already contain data. The privacy policy, storage bucket, and `storage.objects` RLS policies are deployment dependencies — they must be live before the first document arrives. The token security model, retention schema design, and storage path convention are decisions that are painful to reverse after Phase 19 code is written.

**Delivers:**
- All 5 new database tables (`document_types`, `filing_document_requirements`, `client_documents`, `document_access_log`, `upload_portal_tokens`) with full schema including `tax_period_end_date`, `retention_hold`, `classification_confidence`
- `document_types` and `filing_document_requirements` seed data for SA100, CT600, VAT, and Companies House filing types (HMRC document catalog from FEATURES.md)
- Private Supabase Storage bucket (`client-documents`) with EU West region verification
- `storage.objects` RLS policies (SELECT, INSERT, DELETE by authenticated org-scoped users; service role bypasses for cron/webhook/portal)
- `lib/documents/storage.ts` — core storage utility (upload, signed URL generation, deletion)
- `lib/documents/metadata.ts` — `client_documents` insert/query helpers + `calculateRetainUntil()` utility
- `lib/documents/portal.ts` skeleton — token create/validate/revoke interface
- `lib/types/database.ts` additions for all new tables
- Privacy policy updated (7 identified gaps closed) and deployed — hard gate before any document is stored in production
- Storage path convention documented and codified in a path construction helper

**Addresses:** Table stakes (document storage with access control, retention date calculation, audit trail), compliance foundation (privacy policy, DSAR data model design)

**Avoids:** Pitfalls 1 (missing storage RLS), 3 (storage path without org_id), 5 (privacy policy not updated), 6 (portal token schema — hash stored, not plaintext), 8 (retention using wrong anchor date — `tax_period_end_date` established in schema), 9 (DSAR export data model defined before data is collected), 10 (classification confidence column in schema)

**Research flag:** Skip deeper research — all patterns are fully specified in ARCHITECTURE.md with verified SQL. Storage RLS `storage.foldername()` array indexing is confirmed against official Supabase docs. Token schema (SHA-256 hash, 256-bit entropy, `expires_at`, `revoked`) is fully specified in ARCHITECTURE.md Token Security Model section.

**Verification gates before moving to Phase 19:**
- Upload a test file using an authenticated user JWT; confirm it is stored at `orgs/{org_id}/...`
- Attempt to access that file from a different org's authenticated JWT; confirm 403
- Confirm privacy policy is live at `/privacy` with all 7 amendments present
- Confirm all `client_documents` rows have `tax_period_end_date` and `retention_hold` columns present with correct types

### Phase 19: Collection Mechanisms

**Rationale:** Builds all active and passive collection on top of the Phase 18 foundation. The Postmark webhook extension, portal upload flow, classification logic, and dashboard surfacing are all independent workstreams that can proceed in parallel once Phase 18 is deployed. The DSAR export and retention cron are lower complexity and can be built toward the end of this phase.

**Delivers:**
- Extended Postmark inbound webhook: Step 6 that extracts base64 attachments, decodes, validates magic bytes, uploads via admin client, inserts `client_documents` row (non-blocking — email stored even if attachment upload fails)
- Client upload portal (`/portal/[token]`): public route, no auth, filing-type-specific checklist, drag-and-drop, upload progress; token double-validation on every request; `<meta name="referrer" content="no-referrer">` in portal layout
- Portal upload API route: multipart parse, magic byte MIME validation, size cap enforcement, service role upload, `client_documents` insert, accountant notification trigger
- Server action for portal token generation (accountant side): `crypto.randomBytes(32)`, SHA-256 hash stored, raw token shown once and never persisted
- Documents panel on client detail view: document count badge per filing card, expandable list with signed URL download (300-second expiry), upload timestamp, classification label + confidence badge
- Accountant notification on upload: Postmark email via existing sender; configurable per-accountant
- Per-client checklist customisation UI: toggle items on/off, add ad-hoc items
- Auto-classification (`lib/documents/classify.ts`): filename pattern matching against `document_types` catalog, combined with MIME type from `file-type`; confidence stored as `high`/`medium`/`low`/`unclassified`; LOW and UNCLASSIFIED documents flagged for accountant review
- Retention enforcement cron (Vercel cron or Supabase Edge Function): flag documents where `retain_until < NOW() AND retention_hold = false AND retention_flagged = false`; notify org admin; no auto-deletion
- DSAR export: ZIP + JSON manifest covering all personal data categories (documents, inbound_emails, email_log, client profile, audit_log); initiatable from client detail page; uses `fflate.zipSync()`; signed URL with 3600-second expiry for the ZIP download

**Uses:** `file-type@^21.3.0` (magic byte validation in upload routes), `fflate@^0.8.2` (DSAR export), `storage.upload()` with admin client for portal uploads (not `createSignedUploadUrl` due to service_role bug), `crypto.randomBytes(32)` for token generation

**Avoids:** Pitfalls 4 (Postmark webhook idempotency — `UNIQUE(message_id)` check before processing), 6 (referrer suppression + rate limiting on token validation), 7 (magic byte validation — `file-type` used in upload routes), 8 (retention cron checks `retention_hold`, flags rather than deletes, notifies before action), 9 (DSAR covers all data categories)

**Research flag:** Skip deeper research for most of Phase 19 — all flows are fully documented with code in ARCHITECTURE.md. The one area with MEDIUM confidence is auto-classification: filename-based heuristics work for unambiguous patterns (P60, SA302, bank_statement) but false positives are possible with generic filenames. Design the classifier to default to `unclassified` when confidence is low; never auto-mark a checklist requirement as "received" on a LOW-confidence classification.

### Phase Ordering Rationale

- Phase 18 is a strict prerequisite for Phase 19: every piece of Phase 19 code (upload handlers, portal page, classification logic, retention cron) depends on tables, storage bucket, and RLS policies created in Phase 18. Do not begin Phase 19 development until Phase 18 schema migrations are deployed and verified against both service role and authenticated user scenarios.
- Privacy policy deployment is a hard gate within Phase 18: the bucket and tables can be created in a staging environment before the policy is live, but the production bucket must not receive any real client documents until the policy is deployed. This is not a code dependency — it is a legal deployment dependency.
- Within Phase 19, the passive collection flow (Postmark webhook extension) and the active collection flow (portal + upload API) are independent and can be built in parallel. Both depend on the same Phase 18 foundation; they do not depend on each other.
- The DSAR export and retention cron are the lowest-risk features in Phase 19 (no user-facing flow, no token validation) and can be built last without blocking any other Phase 19 work.

### Research Flags

**Phases needing deeper research during planning:** None identified. All patterns are officially documented. The ARCHITECTURE.md file contains ready-to-implement SQL schemas, TypeScript code patterns, and data flow diagrams for every component.

**Areas with MEDIUM confidence that warrant validation during implementation:**
- Auto-classification accuracy: rule-based heuristics work for clearly-named files but the classifier must default to `unclassified` aggressively; validate against a sample of real client filenames before setting confidence thresholds
- `storage.foldername(name)` array indexing: confirmed in Supabase docs and community examples, but the ambiguous-column issue (`storage.foldername(tables.name)` rewrite) should be verified empirically with `storage.foldername(objects.name)` explicit form
- DSAR ZIP memory limit: for clients with >50 documents, `fflate.zipSync()` in-memory may approach Vercel's 256 MB function limit; if this is reached, fall back to streaming ZIP to a temp Storage path

**Standard patterns (skip research-phase for all other aspects):**
- Storage RLS policies: fully verified against official Supabase storage docs
- Portal token security: fully specified in ARCHITECTURE.md Token Security Model section
- Retention calculation: HMRC CH14600 and TMA 1970 s12B verified; formula is `tax_period_end_date + 6 years` (companies) or `january_31_deadline + 5 years` (individuals)
- Postmark attachment extraction: existing webhook already parses the payload; base64 decode and storage upload is a straightforward extension

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Package versions verified against npm registry; Supabase SDK methods verified against official JS reference docs; Vercel 4.5 MB limit verified against multiple confirmed GitHub issues; `createSignedUploadUrl` service_role bug verified against storage-js issue #186 |
| Features | HIGH (HMRC domain) / MEDIUM (competitor UX) | HMRC document catalog verified against gov.uk; retention law verified against CH14600 and TMA 1970 s12B; filing-to-document mappings verified against multiple accountant checklist sources; competitor portal UX based on public documentation and feature pages — patterns corroborated across multiple sources |
| Architecture | HIGH | Storage RLS patterns verified against official Supabase storage docs; `storage.foldername()` array indexing confirmed in official helper function docs; token security model (database-token vs HMAC) rationale is well-documented; signed URL expiry guidance is conservative per security best practice |
| Pitfalls | HIGH | All 10 critical pitfalls grounded in official sources: Supabase storage docs, ICO guidance, HMRC CH14600, OWASP File Upload Cheat Sheet, HackerOne disclosures for referrer leak; `createSignedUploadUrl` bug verified against storage-js GitHub; privacy policy gaps verified against ICO transparency principle guidance and Data (Use and Access) Act 2025 |

**Overall confidence: HIGH**

### Gaps to Address

- **5/6-year retention split by client type:** Companies use 6 years from accounting period end (CH14600); individuals use 5 years from 31 January filing deadline (TMA 1970 s12B). The `client_documents` schema needs either a `retention_years` column or the `retain_until` calculation to derive from the `filing_type_id`. Resolve how to store this distinction before Phase 18 migration is written — the `retain_until` column value depends on it.

- **Retention period for AML/KYC documents:** MLR 2017 requires 5 years from end of business relationship, not end of filing year. If AML documents are stored in the same `client-documents` bucket, the retention calculation must handle this as a separate rule. Either exclude AML documents from the standard cron or add a `retention_rule` column to `client_documents`. Clarify scope before Phase 18 schema is finalised.

- **DSAR export size limit:** The current design uses `fflate.zipSync()` in-memory. This works for typical clients (<50 documents). For edge cases with many years of documents, this may exceed Vercel's 256 MB function memory limit. A streaming-to-temp-storage fallback should be designed before Phase 19 DSAR implementation, even if not built initially. Note the current ARCHITECTURE.md references `JSZip` in one section but the research recommends `fflate` — these must be reconciled in Phase 18 before any DSAR code is written.

- **Bucket creation mechanism:** Supabase bucket creation cannot be done via SQL migration (unlike table creation). It must be done via the Supabase Dashboard or management REST API. This is a manual step in the Phase 18 deployment process that must be documented clearly. The `SUPABASE_STORAGE_BUCKET_DOCUMENTS` env var should be added to `ENV_VARIABLES.md`.

- **Classification confidence thresholds:** The `classification_confidence` column is typed as `numeric(3,2)` in the schema but PITFALLS.md recommends an enum (`high`/`medium`/`low`/`unclassified`). Decide on the type before Phase 18 migration is written. An enum is simpler to display and query; a numeric value allows future ML score storage. Recommend: store both (`classification_confidence_score numeric(3,2)`, `classification_label text CHECK (IN ('high','medium','low','unclassified'))`).

---

## Sources

### Primary (HIGH confidence — official documentation)

- [Supabase Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control) — storage.objects RLS requirements, private bucket behaviour
- [Supabase Storage Helper Functions](https://supabase.com/docs/guides/storage/schema/helper-functions) — `storage.foldername()` array indexing
- [Supabase Storage: createSignedUrl](https://supabase.com/docs/reference/javascript/storage-from-createsignedurl) — expiry parameter, revocation limitations
- [Supabase Storage: createSignedUploadUrl](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl) — signed upload URL flow
- [Supabase Storage: Standard Uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads) — upload method accepts Buffer/Uint8Array/ArrayBuffer
- [Supabase Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions) — pg_cron + pg_net pattern for retention cron
- [HMRC CH14600 Corporation Tax Record Retention](https://www.gov.uk/hmrc-internal-manuals/compliance-handbook/ch14600) — 6 years from end of accounting period
- [ICO Right of Access (DSAR)](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-of-access/) — SAR scope and 30-day response requirement
- [ICO Storage Limitation Principle](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/storage-limitation) — UK GDPR retention obligations
- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) — MIME type spoofing, magic byte validation
- [P45, P60, P11D — GOV.UK](https://www.gov.uk/paye-forms-p45-p60-p11d) — HMRC document catalog verification
- [SA302 — GOV.UK](https://www.gov.uk/sa302-tax-calculation) — SA302 format and usage
- [file-type on npm](https://www.npmjs.com/package/file-type) — v21.3.0 latest, ESM-only, 200+ formats
- [fflate on npm](https://www.npmjs.com/package/fflate) — v0.8.2, pure JS, 27M weekly downloads
- [Next.js GitHub #57501](https://github.com/vercel/next.js/issues/57501) — Vercel 4.5 MB hard payload limit confirmed

### Secondary (MEDIUM confidence — community consensus, multiple corroborating sources)

- [Supabase storage-js #186](https://github.com/supabase/storage-js/issues/186) — `createSignedUploadUrl` service_role `owner=null` bug
- [HackerOne #252544](https://hackerone.com/reports/252544) — token referrer leak via analytics
- Competitor portal analysis: Karbon, TaxDome, Senta, Dext, Uku, Financial Cents — public documentation and feature pages
- UK accountant document checklist sources: a-wise.co.uk, AbraTax, GoSimpleTax — corroborating SA100/CT600 document requirements
- [fflate vs jszip npm trends](https://npmtrends.com/fflate-vs-jszip-vs-node-zip-vs-yauzl-vs-zip) — comparative maintenance and download metrics
- [UK Document Retention Guide](https://yousign.com/blog/document-retention-policies-uk-compliance) — GDPR/HMRC retention overlap

### Tertiary (LOW confidence — single source or inference)

- Email body parsing for document context classification — exploratory; no verified implementation sources; deferred to v4.x
- ML-based document classification approaches — high complexity, low verified sources for UK accounting document types specifically

---

*Research completed: 2026-02-23*
*Ready for roadmap: yes*
