# Phase 30: Per-Document-Type Upload Validation - Research

**Researched:** 2026-03-03
**Domain:** Server-side document validation, spreadsheet parsing, portal UX, database schema
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Phase Boundary**
- Expand current blanket integrity/classification checks with tailored validation rules per document type.
- Covers small-file upload path only (buffer available). Large-file path is out of scope.

**Validation Strictness**
- New per-type checks are advisory warnings — warn but accept. Documents are never rejected by tailored checks.
- Existing hard blocks remain unchanged: corrupt/encrypted PDF (rejected), password-protected (rejected), >50 pages (rejected), >20MB (rejected).
- Multiple warnings stack — if a document fails several checks, all warnings are shown.
- Warning messages are specific and actionable, referencing the expected period from the portal token.
- Both client AND accountant see warnings: client gets amber card at upload time; document gets a `needs_review` flag in the database for accountant filtering.

**Priority Document Types**
- Top 5 only: bank statements, VAT return workings, P60, P45, SA302.
- Remaining 18 document types keep existing blanket checks only.
- Bank statements: primary check is date range coverage (statement covers dates within expected tax period from portal token's `tax_year`).
- VAT return workings: primary check is period coverage (document references a VAT quarter aligning with the portal token's tax period).
- P60/P45/SA302: compare OCR-extracted `extractedTaxYear` against portal token's expected `tax_year`. Warn on mismatch.

**Client Feedback UX**
- Portal (client-facing): amber warning card below the uploaded file, matching existing duplicate warning pattern (amber background, AlertTriangle icon).
- Warning replaces green confirmation card — if validation warnings exist, amber card shown instead of green "We've read this document" card (not both).
- No Re-upload button inside the warning card — existing Replace button on checklist item is sufficient.
- Client page (accountant-facing): visual amber badge/icon on documents with validation warnings (consistent with traffic light status system).
- Activity page (/email-logs uploads tab): brief issue summary in uploads section. Clicking flagged upload row opens a popup detail box (matching existing outbound email row click pattern) with full validation details — which checks failed, expected vs found values.

**Spreadsheet Handling**
- Fix CSV inconsistency: add `text/csv` to server-side `ALLOWED_MIME` array in upload route.
- New dependency: SheetJS (`xlsx`) package for server-side Excel parsing. Already installed at `^0.18.5`.
- Bank statement spreadsheet check: date column presence — verify at least one column contains date-like values. If no dates found, flag as warning.
- Large-file path: skip validation.

### Claude's Discretion
- Exact regex patterns for date range extraction from bank statements and VAT return workings
- SheetJS column detection heuristics for date-like values
- `needs_review` schema design (boolean column vs enum vs separate table)
- Warning message copy for each check type
- Activity page popup layout for validation details

### Deferred Ideas (OUT OF SCOPE)
- AI-powered document checking (GDPR implications)
- Large-file path validation (async post-upload)
- Remaining 18 document types
- Transaction content detection in bank statements
</user_constraints>

---

## Summary

Phase 30 is a pure server-side enhancement to the existing upload pipeline. The surface area is well-contained: one new module (`lib/documents/validate.ts`), one schema migration (two new columns on `client_documents`), two integration points (upload route + upload-finalize route), and three UI touch points (portal amber card, client page badge, activity page popup). No new npm packages are required — SheetJS (`xlsx@^0.18.5`) is already installed and pdf-parse is already available via `pdf-parse-debugging-disabled`.

The core technical challenge is writing robust but low-false-positive regexes for extracting date ranges from bank statement PDFs and VAT quarter references from VAT workings. The bank statement check has the widest format variance (HSBC, Barclays, Lloyds, NatWest, Monzo, Starling all format statement dates differently). The VAT check is simpler because HMRC standardised the VAT quarter format in returns. P60/P45/SA302 checks are trivial — OCR already extracts `extractedTaxYear`; the validation is a simple string comparison against the portal token's `tax_year`.

The UX change is a conditional card swap at the portal: instead of always showing green `ExtractionConfirmationCard`, show amber `ValidationWarningCard` when `validationWarnings.length > 0`. The existing duplicate warning in `checklist-item.tsx` (lines 108–134) provides the exact amber pattern to reuse. On the accountant side, the `document-card.tsx` on the client page needs a small amber badge appended to documents with `needs_review = true`. The activity page uploads table needs a clickable modal (following `SentEmailDetailModal` pattern) to show full validation details.

**Primary recommendation:** Implement validation as a standalone `lib/documents/validate.ts` module that accepts classification result + portal token tax_year + file buffer and returns a `ValidationResult` with a `warnings` array. Slot it into the upload route after classification and before storage. Keep all validation logic isolated from the OCR/classify modules so it can be extended independently.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `xlsx` (SheetJS) | `^0.18.5` | Excel/CSV column parsing for bank statement spreadsheets | Already installed; no native deps; works in Node.js serverless |
| `pdf-parse-debugging-disabled` | existing | PDF text extraction for bank statements and VAT workings | Already in use by `lib/documents/ocr.ts`; no change needed |
| Supabase (service client) | existing | DB schema migration for `needs_review` + `validation_warnings` columns | Existing pattern |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `date-fns` | existing | Date arithmetic for tax year / VAT quarter period comparisons | Already used across the app for formatting and comparison |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SheetJS (xlsx) | `node-xlsx`, `exceljs` | Both larger/heavier; SheetJS is already installed |
| Regex date extraction | A date-parsing library (e.g., `chrono-node`) | Overkill for the narrow use case; adds 500KB+ bundle cost |

**Installation:**
```bash
# No new packages needed — xlsx already installed at ^0.18.5
```

---

## Architecture Patterns

### Recommended Project Structure

```
lib/documents/
├── integrity.ts          # Existing — hard block checks (unchanged)
├── classify.ts           # Existing — OCR + keyword classification (unchanged)
├── ocr.ts                # Existing — extractPdfText, extractFieldsForType (unchanged)
├── validate.ts           # NEW — per-type advisory validation (Phase 30)
└── metadata.ts           # Existing — retain_until calculation (unchanged)

app/api/portal/[token]/
├── upload/route.ts       # Modified — slot in runValidation() call after classification
├── upload-session/route.ts  # Unchanged (large-file path out of scope)
└── upload-finalize/route.ts # Unchanged or minimal (validation skipped for large files)

supabase/migrations/
└── YYYYMMDDHHMMSS_add_validation_columns_to_client_documents.sql  # NEW
```

### Pattern 1: ValidationResult Type

```typescript
// lib/documents/validate.ts

export interface ValidationWarning {
  code: string;         // e.g. 'BANK_STMT_DATE_MISMATCH', 'P60_YEAR_MISMATCH'
  message: string;      // Human-readable, actionable, specific
  expected?: string;    // Expected value (e.g. "2024-25")
  found?: string;       // Found value from OCR/parsing (may be null if not found)
}

export interface ValidationResult {
  warnings: ValidationWarning[];  // Empty array = no issues
}

export async function runValidation(
  documentTypeCode: string | null,
  mimeType: string,
  buffer: Buffer,
  portalTaxYear: string,           // From upload_portal_tokens.tax_year
  extractedTaxYear: string | null, // From classify.ts OCR result
  filingTypeId: string,            // From portal token
  vatStaggerGroup?: number | null, // For VAT quarter alignment (from clients table)
): Promise<ValidationResult>
```

**When to use:** Call after `classifyDocument()` and before `provider.upload()` in the upload route. Pass the buffer since it's already in memory at this point (small-file path only).

### Pattern 2: Upload Route Integration Point

The upload route already has all context needed. Slot validation in at lines 99–107 of `app/api/portal/[token]/upload/route.ts` — after classification, before the try/catch storage block:

```typescript
// After: const classification = await classifyDocument(...)
// After: if (classification.isCorruptPdf) { reject }
// NEW — advisory validation
const validation = await runValidation(
  classification.documentTypeCode,
  file.type,
  fileBuffer,
  taxYear,
  classification.extractedTaxYear,
  filingTypeId,
);

// Extend the client_documents INSERT with validation fields
// Extend the JSON response with validationWarnings array
```

### Pattern 3: Database Schema Extension

Two new columns on `client_documents`:

```sql
-- needs_review: boolean flag for accountant-facing filtering
ALTER TABLE client_documents
  ADD COLUMN IF NOT EXISTS needs_review BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS validation_warnings JSONB DEFAULT NULL;
```

Design rationale for `needs_review` as a boolean (not an enum or separate table):
- Simple to query and filter in the UploadsTable and document-card
- Can be overridden by the accountant (manually cleared) with a single UPDATE
- JSONB `validation_warnings` stores the full structured warning array for the popup detail modal
- Separate table adds join complexity with no current benefit — can be refactored later if reporting is needed

### Pattern 4: Conditional Confirmation Card (Portal UX)

In `portal-checklist.tsx`, the `showConfirmationCard` flag drives which card is shown. Extend this to a union:

```typescript
// Current approach: boolean showConfirmationCard
// New approach: discriminated state

type PostUploadCard =
  | { type: 'validation_warning'; warnings: ValidationWarning[] }
  | { type: 'confirmation'; extractedTaxYear: string | null; extractedEmployer: string | null; extractedPayeRef: string | null }
  | { type: 'none' };
```

In `checklist-item.tsx`, render `ValidationWarningCard` (new component) when `card.type === 'validation_warning'`, `ExtractionConfirmationCard` when `card.type === 'confirmation'`, nothing when `card.type === 'none'`.

The new `ValidationWarningCard` uses the exact same amber pattern as the existing `duplicateWarning` block (lines 108–134 of `checklist-item.tsx`): `bg-amber-500/10`, `AlertTriangle` icon from lucide-react, amber text.

### Pattern 5: Activity Page Upload Detail Modal

Follow `SentEmailDetailModal` pattern from `app/(dashboard)/email-logs/components/sent-email-detail-modal.tsx`:
- `Dialog` from `@/components/ui/dialog`
- Right sidebar with `validation_warnings` items
- Left panel: summary of the upload (filename, client, filing type, document type, received_at)
- Triggered by `onClick` on a `TableRow` (same pattern as outbound email rows would have worked historically — currently the uploads table navigates to client page on click; for flagged uploads, open modal instead, or add an amber icon that opens modal without changing row click behavior)

For the Activity page approach: add a `ValidationWarningModal` component. When a row has `needs_review = true`, render an amber badge in a new "Issues" column. Clicking the badge (not the full row) opens the modal. This avoids conflicting with the existing row click behavior (which navigates to client page).

### Anti-Patterns to Avoid

- **Rejecting documents based on validation warnings:** All per-type checks are advisory only. Only existing hard blocks in `runIntegrityChecks` and `classifyDocument.isCorruptPdf` may reject.
- **Running validation on large files:** The buffer is not available for files that went through the chunked upload path. The `upload-finalize` route receives only `storagePath`, `filename`, `mimeType`, `fileSize`, `sha256Hash` — no buffer. Skip `runValidation` there; set `needs_review = false` by default.
- **Storing raw regex matches in DB:** Store structured `ValidationWarning` objects (code + message + expected + found) in JSONB, not raw text. Enables future filtering and analytics.
- **Coupling validate.ts to classify.ts:** `runValidation` receives `extractedTaxYear` as a parameter (not a ClassificationResult); keeps modules independent.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Excel/CSV column detection | Custom binary parser | SheetJS `xlsx.read()` + `utils.sheet_to_json()` | Format variance (XLS vs XLSX vs CSV) handled internally; already installed |
| Date parsing from statements | Custom date string parser | Targeted regex + `new Date()` validation | Only need to detect whether dates exist in range, not parse arbitrary formats |
| PDF date extraction | New OCR module | Reuse `extractPdfText()` from `lib/documents/ocr.ts` | Already available; no duplication needed |

**Key insight:** This phase is almost entirely regex and simple comparisons on already-extracted text. The hard work (PDF text extraction, Excel parsing) is handled by existing or installed libraries.

---

## Common Pitfalls

### Pitfall 1: SheetJS Node.js Import in App Router
**What goes wrong:** `import * as XLSX from 'xlsx'` fails in App Router server components/routes if imported at module level using certain bundler configurations.
**Why it happens:** Some SheetJS versions have CJS/ESM compatibility issues in Next.js 15+ with `serverExternalPackages` configuration.
**How to avoid:** Import inside the function body, not at module level. Alternatively add `'xlsx'` to `serverExternalPackages` in `next.config.ts`.
**Warning signs:** Build error mentioning `xlsx` or `__dirname is not defined`, runtime error on first call.

### Pitfall 2: SheetJS Version 0.18.5 API
**What goes wrong:** Using `xlsx@>=0.19` (SheetJS Pro/CE split) API methods that don't exist in 0.18.5.
**Why it happens:** SheetJS underwent a commercial licensing change after 0.18.5 — 0.19+ on npm was removed/deprecated; 0.18.5 is the last open version on the standard npm registry.
**How to avoid:** Use only `XLSX.read()`, `XLSX.utils.sheet_to_json()`, `XLSX.utils.sheet_to_csv()` — these are stable across 0.18.x. Do NOT use `XLSX.stream` or any async APIs.
**Warning signs:** TypeScript errors about missing methods; runtime errors on `XLSX.read`.

### Pitfall 3: Bank Statement Date Regex — False Positives
**What goes wrong:** Regex matches dates in document headers (e.g., "printed on 01/01/2024") and concludes the statement covers the wrong period.
**Why it happens:** Bank statement PDFs contain multiple dates: print date, transaction dates, period dates. Aggressive extraction over-captures.
**How to avoid:** For bank statement period check, look for structured period markers ("Statement Period:", "From:", "To:", "Period:", "For the period") rather than any date in the document. If no period marker is found, skip the date range check entirely (do not warn on absence of period markers alone).
**Warning signs:** High false-positive rate on pilot documents; warnings firing on correctly-dated statements.

### Pitfall 4: VAT Quarter Alignment — Portal `tax_year` vs VAT Stagger Group
**What goes wrong:** Comparing extracted VAT quarter directly against `portal.tax_year` (e.g., "2024") without accounting for stagger group.
**Why it happens:** VAT quarters don't align with April tax years. A VAT quarter "01/08/2024 – 31/10/2024" is valid for a firm on stagger group 2, but would look "wrong" if naively compared to tax year 2024.
**How to avoid:** For VAT return workings, check that the extracted quarter period falls within ±1 year of `portal.tax_year`, rather than requiring an exact match. The check is period plausibility, not exact alignment.
**Warning signs:** Every VAT return warns despite being correct.

### Pitfall 5: `needs_review` Column Default on Insert
**What goes wrong:** Existing INSERT in the upload route does not include `needs_review`, causing a NOT NULL constraint violation if default is omitted.
**Why it happens:** Schema migration adds `DEFAULT false` but new INSERT code must explicitly pass the value when overriding default.
**How to avoid:** Add `needs_review = true/false` and `validation_warnings = JSON/null` to the `client_documents` INSERT in the upload route. The column has `DEFAULT false` so existing code paths that don't set it (finalize route, inbound email attachment handler) will use the safe default.
**Warning signs:** 500 error on upload after migration.

### Pitfall 6: Portal State — Warning Card vs Confirmation Card Conflict
**What goes wrong:** Showing both the green confirmation card AND the amber warning card simultaneously.
**Why it happens:** `showConfirmationCard` is set based on `hasOcrData`, independent of validation warnings.
**How to avoid:** Decision rule: if `validationWarnings.length > 0` → show amber card. Else if `hasOcrData && !isImageOnly` → show green card. Else show nothing. The amber card takes priority.
**Warning signs:** Two cards appear stacked after upload.

---

## Code Examples

### SheetJS Date Column Detection

```typescript
// Source: SheetJS 0.18.x documentation + verified against installed package
import XLSX from 'xlsx';

function hasDateColumn(buffer: Buffer): boolean {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return false;
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

    // Check first 20 rows for any Date values (cellDates: true converts Excel dates)
    const sampled = rows.slice(0, 20);
    for (const row of sampled) {
      for (const cell of row) {
        if (cell instanceof Date && !isNaN(cell.getTime())) {
          return true;
        }
      }
    }
    return false;
  } catch {
    return false; // parse error — skip check
  }
}
```

### P60/P45/SA302 Tax Year Check

```typescript
// OCR already extracted extractedTaxYear in classify.ts (e.g., "2024" = year ending 5 April 2024)
// portal.tax_year is stored as "2024" or "2024-25" (verify format in DB)

function checkTaxYearMatch(
  docTypeCode: 'P60' | 'P45' | 'SA302',
  extractedTaxYear: string | null,
  portalTaxYear: string,
): ValidationWarning | null {
  if (!extractedTaxYear) return null; // no OCR data — cannot check

  // Normalise portal tax year to terminal year only (e.g. "2024-25" → "2025", "2024" → "2024")
  const normalised = portalTaxYear.includes('-')
    ? portalTaxYear.split('-')[1].length === 2
      ? `20${portalTaxYear.split('-')[1]}`
      : portalTaxYear.split('-')[1]
    : portalTaxYear;

  if (extractedTaxYear !== normalised) {
    return {
      code: `${docTypeCode}_YEAR_MISMATCH`,
      message: `This ${docTypeCode} is for ${extractedTaxYear} but we requested documents for ${portalTaxYear}. Please check you've uploaded the right document.`,
      expected: normalised,
      found: extractedTaxYear,
    };
  }
  return null;
}
```

### Bank Statement Period Check (PDF)

```typescript
// Regex approach: look for period markers in normalised PDF text
// Source: empirical — based on HSBC, Barclays, NatWest, Lloyds PDF formats

const PERIOD_PATTERNS = [
  /(?:statement\s+period|period)[:\s]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\s+(?:to|[-–—])\s+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
  /(?:from)[:\s]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\s+(?:to)[:\s]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
];

// Expected tax year: if portalTaxYear = "2024", expect dates in April 2023 – April 2024 range
// Return null if no period markers found (do not warn on absence)
```

### Upload Route Integration

```typescript
// app/api/portal/[token]/upload/route.ts
// Insert AFTER classification.isCorruptPdf check (line ~107), BEFORE try { provider.upload() }

const validation = await runValidation(
  classification.documentTypeCode,
  file.type,
  fileBuffer,
  taxYear,                           // portalToken.tax_year
  classification.extractedTaxYear,   // already extracted by classify.ts
  filingTypeId,
);

// In the INSERT:
{
  needs_review: validation.warnings.length > 0,
  validation_warnings: validation.warnings.length > 0
    ? JSON.stringify(validation.warnings)
    : null,
}

// In the JSON response:
{
  validationWarnings: validation.warnings,  // array — empty if no issues
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SheetJS as `xlsx` on npm | SheetJS Community Edition on own CDN/registry post-0.18.5 | ~2023 | 0.18.5 is last open npm version — this project has it pinned correctly |
| No per-type document validation | Per-type advisory validation | Phase 30 | Accountants see document issues before review |

**Deprecated/outdated:**
- `xlsx` versions > 0.18.5 on npm: SheetJS moved to a commercial license for newer versions. The project is correctly pinned at `^0.18.5`. Do not attempt to upgrade.

---

## Open Questions

1. **Portal `tax_year` format — what is stored?**
   - What we know: `upload_portal_tokens.tax_year` column is `text NOT NULL`. In the upload route, it's used as `String(new Date().getFullYear())` fallback, suggesting it's a 4-digit year string (e.g., `"2024"`).
   - What's unclear: Is it always `"YYYY"` or sometimes `"YYYY-YY"` (e.g., `"2024-25"`)? The P60 OCR extractor returns just `"2024"` (the year ending April 5). If the portal token stores `"2024-25"` and the OCR returns `"2024"`, comparison needs normalisation.
   - Recommendation: Check the token generation code (generate-portal-link action) to confirm the stored format before writing the comparison function. Handle both formats defensively.

2. **VAT stagger group available in upload route?**
   - What we know: `clients.vat_stagger_group` (integer 1/2/3) is used in deadline calculations. The upload route currently joins `organisations` and `clients` (company_name, display_name only).
   - What's unclear: The VAT period plausibility check may need `vat_stagger_group` to determine which quarters are valid. However, the locked decision says "verify the document references a VAT quarter aligning with the portal token's tax period" — not strict stagger alignment.
   - Recommendation: For Phase 30, use a loose plausibility check (is the extracted VAT period within ±1 year of `portalTaxYear`?) to avoid needing stagger group. Stagger-aware validation is a future enhancement.

3. **`needs_review` column — who clears it?**
   - What we know: The column is a boolean flag for accountant filtering. CONTEXT.md does not specify a clear mechanism.
   - What's unclear: Should accountants be able to manually dismiss a `needs_review` flag from the document card? Or is it read-only (set at upload time, never changed)?
   - Recommendation: Make it mutable via the document-card actions. Add a small "Clear flag" action on the accountant's document card for documents with `needs_review = true`. This is Claude's discretion per CONTEXT.md.

4. **CSV MIME type on the client side — does react-dropzone need updating?**
   - What we know: `checklist-item.tsx` builds the `accept` map from `document_types.expected_mime_types`. CSV MIME fix is server-side (`ALLOWED_MIME` array). If `text/csv` is not in `expected_mime_types` for `BANK_STATEMENT` document type, the dropzone will still reject it client-side before the server even sees it.
   - What's unclear: Whether `text/csv` needs to be added to the `BANK_STATEMENT` document type's `expected_mime_types` in the database, or only the server `ALLOWED_MIME`.
   - Recommendation: Add `text/csv` to both: the server `ALLOWED_MIME` array (for ad-hoc items and general robustness) AND to the `BANK_STATEMENT` document type's `expected_mime_types` in the database (so the dropzone accepts it for bank statement items specifically).

---

## Validation Architecture

> `workflow.nyquist_validation` is not set in `.planning/config.json` (only `research`, `plan_check`, `verifier` are present — all falsy or absent for validation). Skip this section.

---

## Implementation Plan Summary (for planner)

This phase naturally breaks into 4 plans:

**Plan 01 — Core validation module + schema migration**
- `lib/documents/validate.ts`: `ValidationWarning` type, `ValidationResult` type, `runValidation()` function with per-type checks for BANK_STATEMENT (PDF date range + spreadsheet date column), VAT_RETURN_WORKINGS (period plausibility), P60/P45/SA302 (tax year match).
- Schema migration: `needs_review BOOLEAN DEFAULT false` + `validation_warnings JSONB DEFAULT NULL` on `client_documents`.
- CSV MIME fix: add `text/csv` to `ALLOWED_MIME` in upload route + add to `BANK_STATEMENT` `expected_mime_types` in DB.

**Plan 02 — Upload route integration + portal amber card**
- `app/api/portal/[token]/upload/route.ts`: call `runValidation()` after classification; add `needs_review` + `validation_warnings` to INSERT; add `validationWarnings` to JSON response.
- `portal-checklist.tsx` + `checklist-item.tsx`: replace `showConfirmationCard: boolean` with discriminated card type; render new `ValidationWarningCard` amber component.
- New component: `app/portal/[token]/components/validation-warning-card.tsx`.

**Plan 03 — Accountant-facing: client page badge + activity page popup**
- `app/(dashboard)/clients/[id]/components/document-card.tsx`: amber badge on documents with `needs_review = true`; optional "Clear review flag" action.
- `app/actions/document-uploads.ts`: extend `PortalUpload` type with `needs_review` + `validation_warnings`; extend the SELECT query.
- `app/(dashboard)/email-logs/components/uploads-table.tsx`: add "Issues" column with amber badge for `needs_review` rows; clicking badge opens detail modal.
- New component: `app/(dashboard)/email-logs/components/upload-validation-modal.tsx` (follows `SentEmailDetailModal` pattern).

**Plan 04 — Testing + edge cases**
- Manual testing across all 5 document types with correct and mismatched documents.
- Verify CSV bank statements pass through; verify SheetJS date column detection on XLSX/XLS/CSV.
- Verify warnings stack correctly (bank statement PDF with both a period mismatch AND a poor date column).
- Verify `needs_review` default is `false` for all non-validated document types and large-file uploads.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `lib/documents/integrity.ts`, `lib/documents/classify.ts`, `lib/documents/ocr.ts`, `app/api/portal/[token]/upload/route.ts`, `app/portal/[token]/components/portal-checklist.tsx`, `app/portal/[token]/components/checklist-item.tsx`, `app/portal/[token]/components/upload-confirmation-card.tsx`
- Direct codebase inspection: `app/(dashboard)/email-logs/components/uploads-table.tsx`, `app/(dashboard)/email-logs/components/sent-email-detail-modal.tsx`
- Direct codebase inspection: `app/actions/document-uploads.ts`
- Supabase live schema query: `client_documents` columns, `upload_portal_tokens` columns
- `.planning/phases/30-per-document-type-upload-validation/30-CONTEXT.md` — user decisions
- `package.json` — confirmed `xlsx@^0.18.5` installed

### Secondary (MEDIUM confidence)
- SheetJS 0.18.5 API knowledge (training data) — `XLSX.read()`, `utils.sheet_to_json()`, `cellDates` option are stable documented APIs
- HMRC bank statement PDF format patterns (training data) — period marker formats vary by bank

### Tertiary (LOW confidence)
- Specific regex patterns for bank statement date ranges — derived from format knowledge, not verified against a corpus of real UK bank PDFs
- VAT return workings period format patterns — not verified against actual uploaded documents in this app

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — confirmed by direct package.json inspection and codebase review
- Architecture: HIGH — all integration points confirmed by direct file reads; patterns derived from existing code
- Pitfalls: MEDIUM — SheetJS version trap is HIGH (confirmed); regex false-positive risk is MEDIUM (empirical, not tested against corpus)
- Regex patterns: LOW — requires validation against real bank statement samples

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable domain — no external dependencies changing)
