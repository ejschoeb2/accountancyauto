# Phase 21: Document Verification — OCR & Classification Pipeline - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Upgrade the document classification pipeline so it reads document content rather than just filenames. Extract structured metadata (tax year, employer name, PAYE reference) from the four fixed-format HMRC document types using pdf-parse + regex. Add schema columns to store this data. Run file integrity rules on every upload regardless of document type. This is a backend pipeline phase — no user-facing output yet (that is Phase 22).

</domain>

<decisions>
## Implementation Decisions

### Document Type Scope
- All 4 HMRC fixed-format types in Phase 21: P60, P45, SA302, P11D
- These share the same pdf-parse + regex approach and have predictable HMRC layouts
- Bank statements, dividend vouchers, and other non-HMRC-format documents: rules-only checks (file size, page count, duplicate detection) — no OCR attempted
- File integrity rules (size, page count, duplicate hash check) run on EVERY upload, regardless of document type

### Classifier Integration
- OCR replaces keyword matching for the 4 HMRC types — single path, no duplication
- Keyword matching retained as fallback for unrecognised document types (filename/content keywords for everything outside the 4 HMRC types)
- Single shared utility: `lib/documents/classify.ts` — used by both the portal upload handler and the Postmark webhook attachment extractor
- Classification runs inline, before the upload response is returned (~100-200ms acceptable). If classification errors, upload still succeeds with `classification_confidence = 'unclassified'` — never blocks an upload
- No backfill for documents already in the database (uploaded in Phases 19-20). New schema columns will be NULL for historical docs; Phase 22 handles NULL gracefully.

### Extracted Metadata Fields
- Fields to extract: **tax year**, **employer name**, **PAYE reference**
- NI number: not extracted (privacy concern — unique identifier stored unnecessarily)
- Financial figures (total pay, tax paid): not extracted in Phase 21 (complexity; deferred if demand confirmed)
- Storage: dedicated columns on `client_documents` — `extracted_tax_year TEXT`, `extracted_employer TEXT`, `extracted_paye_ref TEXT`
- New field: `extraction_source TEXT` — values: `ocr` | `keyword` | `rules` — records which method produced the classification result
- `classification_confidence` enum (existing: `high/medium/low/unclassified`) retained and populated by Phase 21

### Non-Text PDF Handling
- **Image-only PDFs** (pdf-parse returns near-empty text — scanned/photographed documents): accept the upload; `classification_confidence = 'unclassified'`, `extraction_source = 'rules'`; no Tesseract fallback in Phase 21
- **Non-PDF files** (JPEG, PNG, Word docs): accept; rules-only checks; `classification_confidence = 'unclassified'`
- **Corrupt or password-protected PDFs** (pdf-parse throws an error): **reject** the upload with a clear client-facing message: *"This file appears to be protected or damaged. Please upload an unprotected copy."* These can never be processed by anyone — catching at upload is better than the accountant discovering it later.

### Claude's Discretion
- Exact regex patterns for each document type (P60, P45, SA302, P11D field locations)
- How to detect "near-empty text" threshold for image PDF detection
- Whether `pdf-parse` options (e.g. `normalizeWhitespace`) improve extraction reliability
- Error handling structure within the classify utility

</decisions>

<specifics>
## Specific Ideas

- The corrupt/password-protected rejection is a client-facing error path — the message should be clear and actionable, matching the tone of other portal messages
- `extraction_source` was explicitly requested to make Phase 22's display logic clean: "Tax year extracted via OCR" vs "Classified by filename" are meaningfully different to show the accountant
- P60 tax year field: HMRC standard text is "Tax year to 5 April [year]" — this is the primary regex anchor

</specifics>

<deferred>
## Deferred Ideas

- Tesseract OCR fallback for image-only PDFs — Phase 21 v2 if demand for scanned document support is confirmed by customer feedback
- NI number extraction — deferred (privacy consideration; not needed for Phase 22 display)
- Financial figure extraction (total pay, tax paid) — high value for pre-populating SA100 workflow; defer to a dedicated phase once Phase 22 is live and demand is confirmed
- Backfill migration for historical documents — defer; too risky for migration, low priority since existing docs have NULL columns handled gracefully

</deferred>

---

*Phase: 21-document-verification-ocr-classification-pipeline*
*Context gathered: 2026-02-25*
