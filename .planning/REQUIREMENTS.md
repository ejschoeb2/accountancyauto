# Requirements: Prompt v4.0 — Document Collection

**Defined:** 2026-02-23
**Core Value:** Accountants spend hours every month manually chasing clients for records and documents. This system automates that entirely while keeping the accountant in full control of messaging and timing.

## v4.0 Requirements

Requirements for the Document Collection milestone. Each maps to roadmap phases 18–19.

### Schema & Storage (DOCS)

- [ ] **DOCS-01**: System has a seeded `document_types` catalog of HMRC document types (P60, P45, P11D, SA302, bank statement, dividend voucher, etc.) with `retention_years`, `retention_anchor` (filing_period_end / relationship_end), expected format metadata, and classification hints
- [ ] **DOCS-02**: System has a `filing_document_requirements` table mapping document types to filing types with mandatory/conditional flags and condition descriptions (e.g. "required if client is a director")
- [ ] **DOCS-03**: `client_documents` table stores document metadata per org: client_id, filing_type, document_type_id, storage_path, original_filename, received_at, `tax_period_end_date`, `classification_confidence` (HIGH/MEDIUM/LOW/UNCLASSIFIED), source (inbound_email / portal_upload / manual), uploader, `retention_hold`, `retention_flagged`
- [ ] **DOCS-04**: `document_access_log` table records every document access and download: user_id, document_id, action (view / download / delete), session context, timestamp; INSERT-only RLS for authenticated users
- [ ] **DOCS-05**: Supabase Storage private bucket exists (`prompt-documents`) with org-scoped path convention (`orgs/{org_id}/clients/{client_id}/{filing_type}/{tax_year}/{uuid}_{ext}`) and explicit `storage.objects` RLS policies scoped to JWT `app_metadata.org_id` using path-prefix check
- [ ] **DOCS-06**: `upload_portal_tokens` table stores SHA-256 hashed tokens (raw token never stored) scoped to org_id + client_id + filing_type with `expires_at`, `used_at`, and revocation support; minimum 256-bit entropy on generation

### Compliance & Policy (COMP)

- [ ] **COMP-01**: Privacy policy at `/privacy` updated inline with all 7 identified gaps: documents/files as a new data category in Section 3; 6-year statutory carve-out in Section 9 retention (UK GDPR Art. 17(3)(b) + HMRC record-keeping obligations); broadened processing scope in Section 4 to include document storage and client portal; firm's clients added as recognised data subjects interacting with the portal; Supabase sub-processor entry updated to include file storage; Terms Section 6 qualified to permit financial documents (P60, SA302, bank statements, dividend vouchers) as necessary for the service
- [ ] **COMP-02**: Retention enforcement cron (Supabase Edge Function, weekly) sets `retention_flagged = true` on `client_documents` rows where `tax_period_end_date` + `retention_years` < now, honours `retention_hold` flag (skips flagging during active HMRC enquiries), never auto-deletes, and notifies org admin by email when documents are flagged
- [ ] **COMP-03**: DSAR export generates a ZIP archive containing all `client_documents` files for a given client plus a JSON manifest (document metadata, access log entries), downloadable from the client detail page

### Passive Collection (PASS)

- [ ] **PASS-01**: Postmark inbound webhook extracts attachments from client emails and uploads them to Supabase Storage using the org-scoped path convention, creating a `client_documents` row with source = `inbound_email`; attachment extraction runs after the `inbound_emails` row is stored so webhook always returns 200 regardless of Storage outcome
- [ ] **PASS-02**: Uploaded documents are classified against the `document_types` catalog based on filename and MIME type; `classification_confidence` is recorded; LOW and UNCLASSIFIED items are flagged for accountant review and do not auto-mark checklist items as received

### Active Collection (ACTV)

- [ ] **ACTV-01**: Accountant can generate a token-based portal link for a specific client + filing type from the client detail page; link expires after a configurable period (default 30 days); regenerating a link revokes the previous token
- [ ] **ACTV-02**: Client upload portal at `/portal/[token]` is a Prompt-branded page showing the accountant's firm name as context ("Your accountant, Smith & Co, has requested..."); accessible via token link with no login required; validates token server-side on every request; expired tokens show a clear expiry message with contact instructions
- [ ] **ACTV-03**: Portal shows a checklist of required documents for the specific filing drawn from `filing_document_requirements`; clients can upload files against checklist items (multiple files per item), add a short note, and see a progress indicator (X of Y items provided); files upload directly to Supabase Storage via signed upload URL (browser → Storage, never through Next.js server)
- [ ] **ACTV-04**: Accountant can customise the default checklist per client-filing pair from the client detail page: toggle items on/off, add ad-hoc items; customisations persist across years

### Dashboard Integration (DASH)

- [ ] **DASH-01**: Filing type cards on the client detail page show a document count and most recent submission date; expanding the card reveals the document list with filename, document type, confidence badge, received date, source, and a download button that generates a 300-second signed URL and logs the access in `document_access_log`; raw storage paths are never exposed
- [ ] **DASH-02**: Dashboard activity feed shows recent document submissions across all org clients (portal uploads and inbound email attachments), with click-through navigation to the relevant client page
- [ ] **DASH-03**: Accountant receives an in-app notification when a client uploads documents via the portal, showing client name, number of items uploaded, and items still outstanding

## v5.0 Requirements (Deferred)

### Automated chasing

- **CHAS-01**: Automated email sequences chase clients who have not completed their upload checklist — initial request, follow-ups at configurable intervals, pause on full submission
- **CHAS-02**: Client responsiveness profiling: accountant rates each client's typical responsiveness to seed the chasing sequence timing

### Document intelligence

- **INTEL-01**: OCR/field extraction for HMRC fixed-format documents (P60, P45, SA302) — extract key fields without third-party AI; all processing on Prompt's infrastructure
- **INTEL-02**: Auto-update checklist when records arrive by email and are confidently classified

## Out of Scope

| Feature | Reason |
|---------|--------|
| E-signatures | Separate product category — document for v6+ |
| Client account logins for portal | Token-based (magic link) is industry standard and significantly reduces scope |
| Virus scanning / ClamAV | Deferred; magic byte validation covers most spoofing; re-evaluate if compliance demand arises |
| OCR / data extraction | Dext's entire product; deferred to v5.0 INTEL requirements |
| iXBRL / CT600 filing | Multi-year undertaking; Prompt collects source documents only |
| Permanent / public document URLs | UK GDPR violation — always signed URLs with expiry |
| HMRC API integration (MTD/ITSA) | Practice management scope, not filing submission |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DOCS-01 | Phase 18 | Pending |
| DOCS-02 | Phase 18 | Pending |
| DOCS-03 | Phase 18 | Pending |
| DOCS-04 | Phase 18 | Pending |
| DOCS-05 | Phase 18 | Pending |
| DOCS-06 | Phase 18 | Pending |
| COMP-01 | Phase 18 | Pending |
| COMP-02 | Phase 19 | Pending |
| COMP-03 | Phase 19 | Pending |
| PASS-01 | Phase 19 | Pending |
| PASS-02 | Phase 19 | Pending |
| ACTV-01 | Phase 19 | Pending |
| ACTV-02 | Phase 19 | Pending |
| ACTV-03 | Phase 19 | Pending |
| ACTV-04 | Phase 19 | Pending |
| DASH-01 | Phase 19 | Pending |
| DASH-02 | Phase 19 | Pending |
| DASH-03 | Phase 19 | Pending |

**Coverage:**
- v4.0 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0 ✓

Phase 18 covers: DOCS-01, DOCS-02, DOCS-03, DOCS-04, DOCS-05, DOCS-06, COMP-01 (7 requirements)
Phase 19 covers: PASS-01, PASS-02, ACTV-01, ACTV-02, ACTV-03, ACTV-04, DASH-01, DASH-02, DASH-03, COMP-02, COMP-03 (11 requirements)

---
*Requirements defined: 2026-02-23*
*Last updated: 2026-02-23 — traceability confirmed after roadmap creation; 100% coverage verified*
