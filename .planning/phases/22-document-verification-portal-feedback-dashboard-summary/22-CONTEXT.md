# Phase 22: Document Verification — Portal Feedback & Dashboard Summary - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Make Phase 21's OCR extraction data visible to users across two surfaces: (1) the client-facing portal — confirming what was extracted from their uploaded documents, and (2) the accountant dashboard — displaying and editing extracted metadata per document row. Financial figure extraction (total pay, tax paid) and NI number display are explicitly deferred to later phases.

</domain>

<decisions>
## Implementation Decisions

### Portal upload feedback
- When OCR succeeds (extracted_tax_year / extracted_employer / extracted_paye_ref populated): show a clean confirmation card with labelled rows — document type, tax year, employer, PAYE ref
- When OCR fails, document is image-only, or classification is 'unclassified': show generic "Document uploaded successfully" — no mention of extraction failure, no empty field rows
- Card layout: labelled rows format (not inline text, not sentence format)
- Duplicate detection: warn the client BEFORE accepting — "This file looks identical to one already uploaded. Are you sure?" (uses file_hash from Phase 21). User must confirm before the upload proceeds

### Dashboard extraction display
- Location: on the document row within the filing card (not a separate panel, not the filing card header)
- Fields shown: all three inline without collapsing — tax year, employer, PAYE ref all visible at a glance
- Inline editing: accountant can click any field to edit it inline; corrections save to the same client_documents columns (extracted_tax_year, extracted_employer, extracted_paye_ref)
- No filing-level summary: per-document rows are sufficient; no aggregate completeness indicator needed

### Extraction source labelling (accountant view)
- extraction_source ('ocr' / 'keyword' / 'rules'): hidden entirely — not shown in the UI
- Exception 1 — image-only PDFs (extraction_source='rules', isImageOnly=true): show a subtle "Scanned PDF" badge or scan icon on the document row so the accountant knows OCR couldn't run
- Exception 2 — rules-only / extraction failure (unclassified, no readable content): show a "Review needed" warning badge prompting the accountant to follow up with the client

### NULL / historical document handling
- Documents uploaded before Phase 21 (all extraction fields null, extraction_source='keyword'): hide the extraction section entirely — show filename and document type only, no empty rows, no placeholder text
- Inline edit availability: yes — accountant can manually enter tax year, employer, and PAYE ref even for historical documents with null values
- extraction_source after manual entry: update to 'manual' (new CHECK constraint value needed — add 'manual' to the extraction_source CHECK constraint)

### Claude's Discretion
- Exact badge/icon design for "Scanned PDF" and "Review needed" indicators
- Inline edit interaction pattern (click-to-edit vs edit button) — follow existing editable cell pattern from DESIGN.md
- API endpoint design for saving edited extraction fields
- Whether the duplicate upload warning is a modal or an inline banner in the portal

</decisions>

<specifics>
## Specific Ideas

- The portal confirmation card should feel like reassurance to the client — they submitted their P60 and we "understood" it. Warm, not clinical.
- Inline editing on the dashboard should follow the existing editable cell pattern already established in DESIGN.md — don't invent a new pattern.
- The "Scanned PDF" badge is for image-only PDFs specifically (not all unclassified docs) — it explains WHY there are no extracted fields without making the accountant feel something went wrong.

</specifics>

<deferred>
## Deferred Ideas

- NI number display — deferred (privacy consideration; decided in Phase 21 research)
- Financial figure extraction (total pay, tax paid) — defer to a dedicated phase once Phase 22 is live and demand is confirmed
- Filing-level completeness summary ("3 of 4 required documents received") — the accountant confirmed per-document rows are sufficient for now

</deferred>

---

*Phase: 22-document-verification-portal-feedback-dashboard-summary*
*Context gathered: 2026-02-25*
