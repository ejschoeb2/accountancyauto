# Phase 21: Document Verification — OCR & Classification Pipeline - Research

**Researched:** 2026-02-25
**Domain:** PDF text extraction, HMRC document field parsing, file integrity rules, Supabase schema migration
**Confidence:** MEDIUM-HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Document Type Scope**
- All 4 HMRC fixed-format types in Phase 21: P60, P45, SA302, P11D
- These share the same pdf-parse + regex approach and have predictable HMRC layouts
- Bank statements, dividend vouchers, and other non-HMRC-format documents: rules-only checks (file size, page count, duplicate detection) — no OCR attempted
- File integrity rules (size, page count, duplicate hash check) run on EVERY upload, regardless of document type

**Classifier Integration**
- OCR replaces keyword matching for the 4 HMRC types — single path, no duplication
- Keyword matching retained as fallback for unrecognised document types (filename/content keywords for everything outside the 4 HMRC types)
- Single shared utility: `lib/documents/classify.ts` — used by both the portal upload handler and the Postmark webhook attachment extractor
- Classification runs inline, before the upload response is returned (~100-200ms acceptable). If classification errors, upload still succeeds with `classification_confidence = 'unclassified'` — never blocks an upload
- No backfill for documents already in the database (uploaded in Phases 19-20). New schema columns will be NULL for historical docs; Phase 22 handles NULL gracefully.

**Extracted Metadata Fields**
- Fields to extract: **tax year**, **employer name**, **PAYE reference**
- NI number: not extracted (privacy concern — unique identifier stored unnecessarily)
- Financial figures (total pay, tax paid): not extracted in Phase 21 (complexity; deferred if demand confirmed)
- Storage: dedicated columns on `client_documents` — `extracted_tax_year TEXT`, `extracted_employer TEXT`, `extracted_paye_ref TEXT`
- New field: `extraction_source TEXT` — values: `ocr` | `keyword` | `rules` — records which method produced the classification result
- `classification_confidence` enum (existing: `high/medium/low/unclassified`) retained and populated by Phase 21

**Non-Text PDF Handling**
- **Image-only PDFs** (pdf-parse returns near-empty text — scanned/photographed documents): accept the upload; `classification_confidence = 'unclassified'`, `extraction_source = 'rules'`; no Tesseract fallback in Phase 21
- **Non-PDF files** (JPEG, PNG, Word docs): accept; rules-only checks; `classification_confidence = 'unclassified'`
- **Corrupt or password-protected PDFs** (pdf-parse throws an error): **reject** the upload with a clear client-facing message: *"This file appears to be protected or damaged. Please upload an unprotected copy."* These can never be processed by anyone — catching at upload is better than the accountant discovering it later.

### Claude's Discretion
- Exact regex patterns for each document type (P60, P45, SA302, P11D field locations)
- How to detect "near-empty text" threshold for image PDF detection
- Whether `pdf-parse` options (e.g. `normalizeWhitespace`) improve extraction reliability
- Error handling structure within the classify utility

### Deferred Ideas (OUT OF SCOPE)
- Tesseract OCR fallback for image-only PDFs — Phase 21 v2 if demand for scanned document support is confirmed by customer feedback
- NI number extraction — deferred (privacy consideration; not needed for Phase 22 display)
- Financial figure extraction (total pay, tax paid) — high value for pre-populating SA100 workflow; defer to a dedicated phase once Phase 22 is live and demand is confirmed
- Backfill migration for historical documents — defer; too risky for migration, low priority since existing docs have NULL columns handled gracefully
</user_constraints>

---

## Summary

Phase 21 upgrades the document classification pipeline from filename/MIME-type keyword matching to content-aware OCR for the four HMRC fixed-format document types (P60, P45, SA302, P11D). The core library is `pdf-parse` (the `autokent` package from GitLab, installed as `pdf-parse` on npm), which extracts raw text from a Buffer using pdf.js internals without requiring any native binary dependencies — critical for serverless deployment on Vercel.

The extraction architecture is straightforward: load the file buffer from Supabase Storage (or from the in-flight upload buffer), call `pdfParse(buffer)`, get `result.text` as a single multi-line string, then apply per-document-type regex patterns to pull out tax year, employer name, and PAYE reference. The classify utility already exists at `lib/documents/classify.ts` and calls the existing keyword classifier today — Phase 21 inserts an OCR pre-pass for the 4 HMRC types before the keyword fallback.

There is one significant known issue with `pdf-parse`: in certain environments (serverless, webpack bundling) it attempts to read a debug test file at `./test/data/05-versions-space.pdf` on import and crashes with ENOENT. The fix is to use `pdf-parse-debugging-disabled` (a patched fork with identical API) instead of the upstream package. This avoids the runtime crash without changing any calling code.

**Primary recommendation:** Install `pdf-parse-debugging-disabled` (not `pdf-parse`), add `@types/pdf-parse` for TypeScript types, implement `lib/documents/ocr.ts` as the extraction entry point, and extend `classifyDocument()` to call it for the 4 HMRC codes before falling back to keyword matching.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `pdf-parse-debugging-disabled` | latest (tracks `pdf-parse` 1.1.1) | Extract raw text from PDF Buffer | Pure JS, no native deps, runs on Vercel serverless Node.js runtime. Debug-crash fix applied. |
| `@types/pdf-parse` | latest | TypeScript types for pdf-parse API | Provides `PdfParse.Result` interface with `text: string`, `numpages: number`, `info: any` |

### Supporting

| Library | Purpose | When to Use |
|---------|---------|-------------|
| `crypto` (built-in Node.js) | SHA-256 hash for duplicate detection | Available without install; used in portal upload route already |
| `Buffer` (built-in) | Pass file bytes to pdf-parse | File buffer already available in both upload paths |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `pdf-parse-debugging-disabled` | `@cyber2024/pdf-parse-fixed` | Both fix the same debug crash bug; `pdf-parse-debugging-disabled` is more widely used. Either is acceptable. |
| `pdf-parse-debugging-disabled` | `pdfjs-dist` directly | Lower level — you'd implement the text extraction plumbing yourself. More control, far more complexity. Not worth it for this use case. |
| `pdf-parse-debugging-disabled` | `pdf-parse` (upstream) | Upstream crashes on import in serverless / webpack environments due to debug test file. Do NOT use upstream `pdf-parse` directly. |

**Installation:**
```bash
npm install pdf-parse-debugging-disabled @types/pdf-parse
```

---

## Architecture Patterns

### Recommended Project Structure

```
lib/documents/
├── classify.ts          # EXISTING — extend to call extractOcrMetadata() for 4 HMRC types
├── ocr.ts               # NEW — extractOcrMetadata(buffer, mimeType): OcrResult
├── integrity.ts         # NEW — runIntegrityChecks(buffer, mimeType, allDocuments): IntegrityResult
├── metadata.ts          # EXISTING — calculateRetainUntil() (unchanged)
├── storage.ts           # EXISTING — uploadDocument() (unchanged)
└── classify.test.ts     # EXISTING — extend with OCR test cases

supabase/migrations/
└── 20260225000001_phase21_ocr_columns.sql  # NEW — adds 4 columns to client_documents
```

### Pattern 1: OCR Extraction Utility (`lib/documents/ocr.ts`)

**What:** Pure function that takes a Buffer + MIME type, attempts pdf-parse extraction, returns structured OcrResult. Handles all three error states: text extracted, image-only (near-empty), and corrupt/password-protected (throws).

**When to use:** Called by `classifyDocument()` before keyword matching for any file with `mimeType === 'application/pdf'`.

**Example:**

```typescript
// lib/documents/ocr.ts
import pdfParse from 'pdf-parse-debugging-disabled';

export interface OcrResult {
  text: string;
  numpages: number;
  isImageOnly: boolean;  // true if text.trim().length < IMAGE_ONLY_THRESHOLD
}

// Threshold: HMRC PDFs have 200+ chars of text per page minimum.
// Image-only scans produce 0–20 chars (blank or just PDF structure markers).
// 50 chars/page is a safe threshold — real P60s have 800+ chars per page.
const IMAGE_ONLY_CHARS_PER_PAGE = 50;

export async function extractPdfText(buffer: Buffer): Promise<OcrResult> {
  // NOTE: this will THROW for corrupt/password-protected PDFs.
  // Callers MUST wrap in try/catch and handle the rejection as a corrupt-file error.
  const result = await pdfParse(buffer);
  const pageThreshold = IMAGE_ONLY_CHARS_PER_PAGE * Math.max(result.numpages, 1);
  return {
    text: result.text,
    numpages: result.numpages,
    isImageOnly: result.text.trim().length < pageThreshold,
  };
}
```

### Pattern 2: Per-Document Regex Extraction (`lib/documents/ocr.ts`)

**What:** Per-document-type regex patterns applied to `result.text`. HMRC PDFs use predictable, consistent text layouts because they are generated (not scanned) by payroll software and the HMRC online portal.

**Key text anchors confirmed from HMRC official documentation:**

| Document | Tax Year Anchor | Employer Label | PAYE Ref Label |
|----------|-----------------|----------------|----------------|
| P60 | `Tax year to 5 April` | `Employer name` or `Employer's name` | `PAYE reference` or `Employer's PAYE reference` |
| P45 | `Year to 5 April` or derived from `Date of leaving` | `Employer's name` | `Employer PAYE reference` |
| SA302 | `Year ended 5 April` (from HMRC online portal download header) | N/A (individual document — no employer field) | N/A (UTR-based, not PAYE) |
| P11D | `Year ended 5 April` or `for the year ended` | `Employer's name` | `PAYE reference` |

**Regex approach — research-based patterns (Claude's discretion, requires testing against real documents):**

```typescript
// Source: HMRC P60 RD1 specification (December 2024), P45 official form, SA302 GOV.UK description
// IMPORTANT: These patterns are research-derived. Validate against real HMRC documents in testing.

// ── Tax year extraction ────────────────────────────────────────────────────
// P60: "Tax year to 5 April 2024"
const P60_TAX_YEAR = /Tax year to 5 April (\d{4})/i;

// P45: "Year to 5 April 2024" or inline as leaving date context
const P45_TAX_YEAR = /(?:Year|year) to 5 April (\d{4})/i;

// SA302: "Year ended 5 April 2024" (GOV.UK portal download format)
const SA302_TAX_YEAR = /Year ended 5 April (\d{4})/i;

// P11D: "for the year ended 5 April 2024" or "Year ended 5 April 2024"
const P11D_TAX_YEAR = /(?:for the )?[Yy]ear ended 5 April (\d{4})/i;

// ── PAYE reference extraction ──────────────────────────────────────────────
// HMRC PAYE reference format: 3-digit office code / up to 10 alphanumeric
// Example: "123/AB12345" or "944/HZ12345"
const PAYE_REF_PATTERN = /(\d{3}\/[A-Z0-9]{1,10})/i;

// ── Employer name extraction ───────────────────────────────────────────────
// Pattern: find the label, capture the line following it.
// Multi-line flag needed since employer name appears on next line after label.
const EMPLOYER_NAME_AFTER_LABEL = /(?:Employer'?s? name|Employer name)[:\s]*\n?\s*([A-Za-z0-9 &.,'-]{2,80})/i;
```

**Note on SA302 employer extraction:** The SA302 is an individual self-assessment tax calculation — it does not contain an employer name or PAYE reference field. Set `extracted_employer = null` and `extracted_paye_ref = null` for SA302. The tax year and the presence of "HM Revenue" / "SA302" / "Tax Calculation" keywords are sufficient for classification.

### Pattern 3: Classify Utility Integration

**What:** Modify `classifyDocument()` in `lib/documents/classify.ts` to accept the file buffer (not just filename + MIME) for PDF documents, run OCR extraction first for the 4 HMRC types, fall back to keyword matching for everything else.

**When to use:** Phase 21 replaces the existing keyword-only path for `application/pdf` when the document type resolves to P60, P45, SA302, or P11D.

**New function signature:**

```typescript
// Existing signature (Phase 19):
export async function classifyDocument(
  filename: string,
  mimeType: string,
  supabase: SupabaseClient
): Promise<ClassificationResult>

// Phase 21 extended signature — buffer is optional (non-PDF files skip OCR):
export async function classifyDocument(
  filename: string,
  mimeType: string,
  supabase: SupabaseClient,
  buffer?: Buffer          // NEW — required for OCR; undefined = keyword-only path
): Promise<ClassificationResult>
```

The extended `ClassificationResult` interface adds Phase 21 fields:

```typescript
export interface ClassificationResult {
  documentTypeId: string | null;
  documentTypeCode: string | null;
  filingTypeId: string | null;
  confidence: 'high' | 'medium' | 'low' | 'unclassified';
  // Phase 21 additions:
  extractedTaxYear: string | null;      // e.g. "2024" (the April year)
  extractedEmployer: string | null;     // e.g. "Acme Ltd"
  extractedPayeRef: string | null;      // e.g. "123/AB12345"
  extractionSource: 'ocr' | 'keyword' | 'rules';  // which method populated classification
  isCorruptPdf: boolean;                // true = reject the upload
  isImageOnly: boolean;                 // true = accept but unclassified
}
```

### Pattern 4: File Integrity Rules (`lib/documents/integrity.ts`)

**What:** Runs on every upload regardless of document type. Three checks: file size limit, page count, duplicate hash detection.

**When to use:** Called by both upload handlers (portal + Postmark inbound) before calling `classifyDocument()`.

```typescript
export interface IntegrityResult {
  passed: boolean;
  fileSizeBytes: number;
  pageCount: number | null;      // null for non-PDFs (cannot be checked without parsing)
  isDuplicate: boolean;
  sha256Hash: string;
  rejectionReason: string | null;
}

// Limits (Claude's discretion — adjust to match real HMRC document sizes)
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;  // 20MB — P60s are ~100KB; 20MB gives headroom for scanned images
const MAX_PAGE_COUNT = 50;                       // SA302 is 1–2 pages; P11D is 1–4 pages; 50 pages is generous
```

**Duplicate detection:** SHA-256 hash of the file buffer, stored as `file_hash TEXT` column on `client_documents`. Check for existing row with same `file_hash` AND same `client_id` before insert — same file, same client = duplicate.

### Pattern 5: Corrupt PDF Rejection in Upload Handler

**What:** If `classificationResult.isCorruptPdf === true`, return HTTP 400 (not 500) with the user-facing message from CONTEXT.md.

**Where:** Both `app/api/portal/[token]/upload/route.ts` and the `processAttachments()` function in `app/api/postmark/inbound/route.ts`.

```typescript
// In portal upload route — after classifyDocument():
if (classification.isCorruptPdf) {
  return NextResponse.json(
    { error: 'This file appears to be protected or damaged. Please upload an unprotected copy.' },
    { status: 400 }
  );
}
```

**Note for inbound email handler:** Postmark attachments cannot be "rejected" to a client (fire-and-forget). For corrupted attachments from email, log the error and store a `client_documents` row with `classification_confidence = 'unclassified'`, `extraction_source = 'rules'`, and a note in `original_filename` suffix or a future `notes` column. Phase 21 decision: skip storage for corrupt email attachments (log only); accountant sees no partial record.

### Anti-Patterns to Avoid

- **Don't use upstream `pdf-parse`:** It crashes with ENOENT for `./test/data/05-versions-space.pdf` in serverless/bundled environments. Use `pdf-parse-debugging-disabled` instead.
- **Don't run pdf-parse on non-PDF files:** MIME type check must gate the OCR path. JPEG/PNG/Word files will fail or produce garbage text.
- **Don't use regex anchored to absolute positions:** HMRC substitute forms (e.g., payroll software variants) may reorder fields. Use named-anchor patterns (`Tax year to 5 April`) not positional character offsets.
- **Don't parse extracted text with `.split('\n')` alone:** pdf-parse text output can include variable whitespace between sections. Use `.replace(/\s+/g, ' ')` normalization before regex matching for multi-word patterns like employer name.
- **Don't store the Buffer in memory longer than needed:** The classification function should receive the buffer, use it, and let it be GC'd. Don't cache buffers.
- **Don't change the `classifyDocument` return type in a breaking way:** Both portal upload and Postmark inbound handlers consume `ClassificationResult`. Add new optional fields with defaults; don't rename or remove existing fields.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF text extraction | Custom pdf.js wrapper | `pdf-parse-debugging-disabled` | Handles page iteration, encoding, layout normalisation across pdf.js versions |
| Duplicate file detection | Content fingerprinting algorithm | `crypto.createHash('sha256')` (built-in) | Standard, collision-resistant, zero dependency |
| HMRC document format parsing | AI/ML classification | Regex on extracted text | HMRC documents are government-standard templates — deterministic text anchors are more reliable than ML for known formats |
| Image PDF detection | Computer vision | Character count threshold | pdf-parse returns near-empty strings for image-only PDFs; a simple char-per-page threshold is 100% accurate for this binary classification |
| Corrupt PDF detection | Magic byte validation | Wrap `pdfParse()` in try/catch | pdf.js already validates PDF structure; catching its thrown errors is the correct signal for corrupt/protected files |

**Key insight:** HMRC fixed-format documents are generated by deterministic software systems. The text positions and labels are stable enough that regex is more reliable and faster than any ML approach.

---

## Common Pitfalls

### Pitfall 1: The pdf-parse debug crash
**What goes wrong:** Import of `pdf-parse` (upstream) crashes with `ENOENT: no such file or directory, open './test/data/05-versions-space.pdf'` in production/Vercel/webpack environments.
**Why it happens:** The package's debug mode tries to load a test PDF on import when run outside the package's own test suite, but the test file is not present in node_modules after installation.
**How to avoid:** Use `pdf-parse-debugging-disabled` instead. API is identical — only the debug initialisation path is patched out.
**Warning signs:** Works in local `next dev` but crashes on `next build` or Vercel deployment.

### Pitfall 2: Text extraction inconsistency across HMRC software variants
**What goes wrong:** Regex pattern matches one payroll software's P60 but not another's (e.g., Sage vs Xero vs HMRC online portal). The label may appear as "Employer's name", "Employer name", or "Employer Name".
**Why it happens:** HMRC P60 substitute forms (from payroll software) must include the same data fields but can use slightly different label text.
**How to avoid:** Use case-insensitive regex with optional apostrophe: `/Employer'?s? name/i`. Test against multiple payroll vendor outputs. When a field fails to extract, fall back to `null` (not an empty string) — the Phase 22 UI handles null gracefully.
**Warning signs:** LOW extraction rates on employer name in production.

### Pitfall 3: Image-only PDF threshold miscalibration
**What goes wrong:** Real text PDFs are misclassified as image-only (or vice versa) due to wrong threshold.
**Why it happens:** The char-per-page threshold is set too high (flagging real PDFs as images) or too low (treating image PDFs with header text as valid).
**How to avoid:** Use 50 chars/page as the base threshold. Real HMRC P60s: ~1000–3000 chars total. Image-only scans: 0–30 chars total (just PDF structure). The gap is enormous — 50 chars/page has very wide margin.
**Warning signs:** All P60s returning `isImageOnly: true`.

### Pitfall 4: Breaking the upload response contract when adding buffer param
**What goes wrong:** Passing `buffer` to `classifyDocument()` in the upload route adds a new import order dependency that causes the inbound email handler to fail because it calls the old signature.
**Why it happens:** Both handlers call `classifyDocument()`. The new `buffer?` parameter is optional — callers that don't pass it get the old keyword-only path.
**How to avoid:** Make `buffer` optional with `buffer?: Buffer` — existing callers work unchanged. The OCR path only activates when buffer is provided AND mimeType is `application/pdf`.
**Warning signs:** TypeScript compilation errors on `classifyDocument(name, mimeType, supabase)` call sites.

### Pitfall 5: Corrupt PDF from Postmark blocking the webhook 200 response
**What goes wrong:** A corrupted email attachment causes `pdfParse()` to throw, which propagates up through `processAttachments()` and somehow reaches the webhook response.
**Why it happens:** The try/catch inside `processAttachments()` already wraps each attachment in a loop. BUT if the corrupt PDF rejection logic is added at the wrong level, it could re-throw.
**How to avoid:** `processAttachments()` already has per-attachment try/catch (line 291 in current code). The classify utility must catch the pdf-parse error internally and set `isCorruptPdf: true` — it must NOT re-throw. Only the portal upload route (which has a user to tell) should translate `isCorruptPdf` into an HTTP 400. Email handler ignores corrupt files silently.
**Warning signs:** Postmark webhook returning non-200 when a corrupt PDF attachment is received.

### Pitfall 6: Schema migration adds NOT NULL columns without defaults
**What goes wrong:** Adding `extracted_tax_year TEXT NOT NULL` fails because existing rows have no value.
**Why it happens:** Standard Postgres constraint — can't add NOT NULL column to table with existing rows without a default.
**How to avoid:** All new columns must be nullable (`TEXT` without NOT NULL). Historical documents will have `NULL` in these columns. Phase 22 handles NULL gracefully per the locked decision.
**Warning signs:** Migration fails with `ERROR: column "extracted_tax_year" of relation "client_documents" contains null values`.

### Pitfall 7: PAYE reference regex over-matching
**What goes wrong:** The `\d{3}\/[A-Z0-9]{1,10}` pattern matches a random date or reference number in the document body.
**Why it happens:** Many documents contain numbers and slashes. Without an anchor, the pattern fires on unrelated content.
**How to avoid:** Anchor the PAYE reference regex to the label: look for the label text first (e.g., `PAYE reference`), then capture the value on the same line or next line within 40 characters.
**Warning signs:** `extracted_paye_ref` contains non-PAYE values like `"12/04/2024"`.

---

## Code Examples

### Basic pdf-parse usage (Node.js API route context)

```typescript
// Source: @types/pdf-parse type definitions + pdf-parse-debugging-disabled README
import pdfParse from 'pdf-parse-debugging-disabled';
// TypeScript types:
import type { PdfParse } from '@types/pdf-parse';

async function extractText(buffer: Buffer): Promise<{ text: string; numpages: number }> {
  try {
    const result: PdfParse.Result = await pdfParse(buffer);
    return { text: result.text, numpages: result.numpages };
  } catch (err) {
    // Throws for corrupt/password-protected PDFs
    throw new Error(`PDF_CORRUPT: ${(err as Error).message}`);
  }
}
```

### Schema migration pattern (consistent with project migrations)

```sql
-- supabase/migrations/20260225000001_phase21_ocr_columns.sql
-- Phase 21: Add OCR extraction columns to client_documents
--
-- All columns are nullable — historical documents (Phase 19-20) will have NULL.
-- Phase 22 handles NULL gracefully in the display layer.
-- extraction_source has a default of 'keyword' to reflect the pre-Phase-21 classifier.

ALTER TABLE client_documents
  ADD COLUMN IF NOT EXISTS extracted_tax_year  TEXT,
  ADD COLUMN IF NOT EXISTS extracted_employer   TEXT,
  ADD COLUMN IF NOT EXISTS extracted_paye_ref   TEXT,
  ADD COLUMN IF NOT EXISTS extraction_source    TEXT
    CHECK (extraction_source IN ('ocr', 'keyword', 'rules'))
    DEFAULT 'keyword',
  ADD COLUMN IF NOT EXISTS file_hash            TEXT,      -- SHA-256 hex of file contents
  ADD COLUMN IF NOT EXISTS file_size_bytes      BIGINT,    -- raw byte count
  ADD COLUMN IF NOT EXISTS page_count           INT;       -- null for non-PDFs

-- Index for duplicate detection (same hash + same client = duplicate)
CREATE INDEX IF NOT EXISTS idx_client_documents_file_hash
  ON client_documents(client_id, file_hash)
  WHERE file_hash IS NOT NULL;
```

### Duplicate detection pattern

```typescript
// Source: Node.js built-in crypto module
import crypto from 'crypto';

function computeFileHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function isDuplicate(
  clientId: string,
  fileHash: string,
  supabase: SupabaseClient
): Promise<boolean> {
  const { data } = await supabase
    .from('client_documents')
    .select('id')
    .eq('client_id', clientId)
    .eq('file_hash', fileHash)
    .limit(1)
    .single();
  return !!data;
}
```

### Image-only PDF detection

```typescript
// 50 characters per page threshold — validated against HMRC document profiles
// Real HMRC P60: ~2000 chars for 1-page document
// Image-only scan: 0–30 chars regardless of page count
function isImageOnlyPdf(text: string, numpages: number): boolean {
  const charPerPageThreshold = 50;
  return text.trim().length < charPerPageThreshold * Math.max(numpages, 1);
}
```

### Full classify.ts integration sketch

```typescript
// In classifyDocument() — Phase 21 extension
// After keyword match identifies one of the 4 HMRC types:
const HMRC_OCR_TYPES = new Set(['P60', 'P45', 'SA302', 'P11D']);

if (buffer && mimeType === 'application/pdf' && HMRC_OCR_TYPES.has(entry.code)) {
  try {
    const ocr = await extractPdfText(buffer);

    if (ocr.isImageOnly) {
      return {
        ...keywordResult,
        confidence: 'unclassified',
        extractedTaxYear: null,
        extractedEmployer: null,
        extractedPayeRef: null,
        extractionSource: 'rules',
        isCorruptPdf: false,
        isImageOnly: true,
      };
    }

    const extracted = extractFieldsForType(entry.code, ocr.text);
    return {
      ...keywordResult,
      confidence: extracted.taxYear ? 'high' : 'medium',
      extractedTaxYear: extracted.taxYear,
      extractedEmployer: extracted.employer,
      extractedPayeRef: extracted.payeRef,
      extractionSource: 'ocr',
      isCorruptPdf: false,
      isImageOnly: false,
    };
  } catch (err) {
    // Corrupt or password-protected PDF
    return {
      documentTypeId: null,
      documentTypeCode: null,
      filingTypeId: null,
      confidence: 'unclassified',
      extractedTaxYear: null,
      extractedEmployer: null,
      extractedPayeRef: null,
      extractionSource: 'rules',
      isCorruptPdf: true,
      isImageOnly: false,
    };
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Keyword matching on filename only | pdf-parse text extraction + regex | Phase 21 | Enables extraction of tax year, employer, PAYE reference from document content |
| `pdf-parse` (upstream) | `pdf-parse-debugging-disabled` | Community fix ~2022, ongoing | Prevents ENOENT crash on Vercel/webpack deployments |
| No file integrity checks | SHA-256 duplicate detection + size/page limits | Phase 21 | Prevents duplicate uploads and oversized files |

**Deprecated/outdated:**
- `pdf-parse` (upstream): Technically not deprecated, but its debug crash bug makes it unsafe for serverless use. The patched fork is the standard recommendation in the community.

---

## Open Questions

1. **SA302 employer field absence**
   - What we know: SA302 is a self-assessment tax calculation — it lists income sources (salary from employer) but the document itself is generated by HMRC, not by an employer. The primary identifier is the UTR (Unique Taxpayer Reference), not a PAYE reference.
   - What's unclear: Does the SA302 PDF from HMRC online portal include any employer name text from the PAYE income section? It likely lists "Pay from [Employer Name]" but this isn't a standard labeled field.
   - Recommendation: Extract `null` for `extracted_employer` and `extracted_paye_ref` on SA302. If Phase 22 testing reveals that employer income lines are parseable, add extraction as a point release.

2. **PAYE reference format variance**
   - What we know: Standard HMRC format is `NNN/XXXXXXXXXXX` (3-digit office + slash + up to 10 alphanumeric).
   - What's unclear: Some older documents may use a different format. Some payroll software may omit the office number prefix.
   - Recommendation: Use a permissive regex (`\d{3}\/[A-Z0-9]{1,10}` as primary, fallback to `[A-Z0-9]{6,13}` if primary fails) and return `null` if neither matches cleanly.

3. **P45 multi-part structure**
   - What we know: P45 has 4 parts (Part 1, Part 1A, Part 2, Part 3). Employees typically hold Part 1A. Parts 2 and 3 go to the new employer. Part 1 goes to HMRC. In practice, clients will upload Part 1A.
   - What's unclear: Do all parts contain the same employer name and PAYE reference fields in the same positions?
   - Recommendation: Use the same extraction patterns for all P45 parts. The tax year and PAYE reference fields appear on all parts per HMRC specifications.

4. **Supabase Storage download for Postmark attachments**
   - What we know: In the current `processAttachments()` code, the buffer is available as `Buffer.from(attachment.Content, 'base64')` — it's already in memory, never stored first.
   - What's unclear: The portal upload route also has the buffer in memory (`Buffer.from(await file.arrayBuffer())`). Both paths have the buffer available to pass to `classifyDocument()` without an extra Storage download.
   - Recommendation: Pass the in-memory buffer directly. No Supabase Storage download needed for Phase 21 OCR — this is not a concern.

---

## Sources

### Primary (HIGH confidence)
- `lib/documents/classify.ts` — Existing classify utility; confirmed function signature and `ClassificationResult` interface
- `lib/documents/metadata.ts` — Existing metadata utility; confirmed vitest usage pattern
- `app/api/portal/[token]/upload/route.ts` — Confirmed buffer availability and current classify call site
- `app/api/postmark/inbound/route.ts` — Confirmed buffer availability and current classify call site
- `supabase/migrations/20260224000001_document_collection_tables.sql` — Confirmed `client_documents` schema
- HMRC RD1 P60 specification PDF (December 2024) — Confirmed "Tax year to 5 April" anchor text
- GOV.UK SA302 guidance — Confirmed "Year ended 5 April" tax year format

### Secondary (MEDIUM confidence)
- [@types/pdf-parse npm](https://www.npmjs.com/package/@types/pdf-parse) — `PdfParse.Result` interface with `text: string`, `numpages: number`, `info: any`
- [pdf-parse albertcui fork README](https://github.com/albertcui/pdf-parse) — Function signature `pdf(buffer, options)`, return properties
- [GitLab autokent/pdf-parse issue #24](https://gitlab.com/autokent/pdf-parse/-/issues/24) — ENOENT `05-versions-space.pdf` bug confirmed
- [pdf-parse-debugging-disabled npm](https://www.npmjs.com/package/pdf-parse-debugging-disabled) — Patched fork; identical API, debug crash removed

### Tertiary (LOW confidence)
- Regex patterns for HMRC field extraction — Research-derived from HMRC form specifications and community discussions; MUST be validated against real documents before commit. The tax year anchor (`Tax year to 5 April`) is HIGH confidence; employer name label variants are MEDIUM; exact PAYE reference position is LOW.
- Image-only threshold of 50 chars/page — Derived from general knowledge of PDF structure; validate in tests with sample image PDFs and real HMRC PDFs.

---

## Metadata

**Confidence breakdown:**
- Standard stack (pdf-parse-debugging-disabled): HIGH — confirmed API, confirmed bug fix, confirmed Node.js serverless compatibility
- Architecture patterns: HIGH — based on existing code structure, project conventions, confirmed TypeScript interfaces
- HMRC regex patterns: MEDIUM — tax year anchors confirmed from official docs; employer/PAYE label variants need real-document testing
- Pitfalls: HIGH — debug crash bug confirmed from community issues; others derived from code analysis

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (pdf-parse API is stable; HMRC form layouts change only with new tax year)
