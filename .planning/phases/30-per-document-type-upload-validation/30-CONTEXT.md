# Phase 30: Per-Document-Type Upload Validation - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Expand the current blanket integrity/classification checks with tailored validation rules for each document type, so wrong or inadequate uploads are caught before reaching the accountant. Covers the small-file upload path only (buffer available). Large-file path (upload-session/finalize) is out of scope for this phase.

</domain>

<decisions>
## Implementation Decisions

### Validation Strictness
- New per-type checks are **advisory warnings** — warn but accept. Documents are never rejected by tailored checks.
- Existing hard blocks remain unchanged: corrupt/encrypted PDF (rejected), password-protected (rejected), >50 pages (rejected), >20MB (rejected).
- Multiple warnings stack — if a document fails several checks, all warnings are shown (not just the most important one).
- Warning messages are **specific and actionable** — e.g., "This bank statement doesn't appear to cover April 2025 – March 2026. Please check you've uploaded the right statement."
- Both client AND accountant see warnings: client gets amber card at upload time; document gets a `needs_review` flag in the database for accountant filtering.

### Priority Document Types
- **Top 5 only** in this phase: bank statements, VAT return workings, P60, P45, SA302.
- Remaining 18 document types keep the existing blanket checks — tailored checks deferred.
- **Bank statements**: primary check is date range coverage — verify the statement covers dates within the expected tax period (from portal token's tax_year).
- **VAT return workings**: primary check is period coverage — verify the document references a VAT quarter aligning with the portal token's tax period.
- **P60 / P45 / SA302**: compare OCR-extracted tax year against portal token's expected tax_year. Warn on mismatch (e.g., "This P60 is for 2024 but we requested documents for 2025").

### Client Feedback UX
- **Portal (client-facing)**: amber warning card below the uploaded file, matching the existing duplicate warning pattern (amber background, warning icon, specific message).
- **Warning replaces green confirmation card** — if validation warnings exist, the amber card is shown instead of the green "We've read this document" card (not both).
- No Re-upload button inside the warning card — the existing Replace button on the checklist item is sufficient.
- **Client page (accountant-facing)**: visual amber badge/icon on documents with validation warnings (consistent with traffic light status system).
- **Activity page (/email-logs)**: brief issue summary in the uploads section. Clicking the flagged upload row opens a **popup detail box** (matching the existing outbound email row click pattern) with full validation details — which checks failed, expected vs found values.

### Spreadsheet Handling
- **Fix CSV inconsistency**: add `text/csv` to the server-side `ALLOWED_MIME` array in the upload route. Bank statement CSVs are common (online banking exports).
- **New dependency**: SheetJS (`xlsx`) package for server-side Excel parsing. Standard Node.js Excel parser, ~2MB, no native deps, works in serverless.
- **Bank statement spreadsheet check**: date column presence — verify at least one column contains date-like values. If no dates found, flag as warning. Simple, low false-positive rate across different bank formats.
- **Large-file path**: skip validation for this phase. Files >4MB go directly to cloud providers (Google Drive/OneDrive) — no buffer available. Async post-upload validation deferred.

### Claude's Discretion
- Exact regex patterns for date range extraction from bank statements and VAT return workings
- SheetJS column detection heuristics for date-like values
- `needs_review` schema design (boolean column vs enum vs separate table)
- Warning message copy for each check type
- Activity page popup layout for validation details

</decisions>

<specifics>
## Specific Ideas

- Activity page upload detail popup should match the existing outbound email detail popup pattern (same component pattern, click-to-open)
- Warning messages should reference the expected period from the portal token so the client knows exactly what's needed
- The amber warning card on the portal uses the same visual language as the existing duplicate warning (amber background, AlertTriangle icon)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/documents/integrity.ts`: existing integrity check pipeline — new per-type checks slot in after these pass
- `lib/documents/classify.ts`: classification + OCR pipeline — already extracts tax year for P60/P45/SA302/P11D; new checks can consume these extracted values
- `lib/documents/ocr.ts`: `extractPdfText()` + `extractFieldsForType()` — text extraction already available for PDF documents
- `app/portal/[token]/components/upload-confirmation-card.tsx`: green confirmation card — will be conditionally replaced by amber warning card
- `app/portal/[token]/components/checklist-item.tsx`: existing duplicate warning amber card pattern (lines 108-134) — reusable for validation warnings
- `pdf-parse-debugging-disabled`: already installed for PDF text extraction

### Established Patterns
- Upload route returns JSON response with classification fields — extend with `validationWarnings` array
- `classifyDocument()` accepts optional buffer — per-type validation follows the same optional-buffer pattern
- Amber warning card in checklist-item.tsx uses `bg-amber-500/10` + `AlertTriangle` icon + action buttons — standard warning pattern
- Activity page uses popup detail boxes for outbound email rows — reuse for upload detail

### Integration Points
- `app/api/portal/[token]/upload/route.ts` (line 92-107): after integrity checks + classification, before storage upload — insert validation step here
- `client_documents` table: needs `needs_review` flag (new column) + `validation_warnings` (JSONB for structured warning data)
- Portal response JSON: extend with `validationWarnings` array for client-side rendering
- Activity page uploads section: extend row rendering with warning summary + popup detail

</code_context>

<deferred>
## Deferred Ideas

- **AI-powered document checking** — using Claude/LLM to semantically validate document content. Discussed pre-phase: material GDPR implications (external API, DPA required, Art. 22 risk). Better as a future opt-in org-level feature with consent flows.
- **Large-file path validation** — async post-upload validation for files >4MB that go direct to cloud providers. Requires downloading file back from provider.
- **Remaining 18 document types** — tailored checks for dividend vouchers, share registers, CT600 accounts, payroll summaries, etc.
- **Transaction content detection** — verifying bank statements actually contain transaction data (dates, amounts, running balances) vs just a cover page.

</deferred>

---

*Phase: 30-per-document-type-upload-validation*
*Context gathered: 2026-03-03*
