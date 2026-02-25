# Phase 22: Document Verification — Portal Feedback & Dashboard Summary - Research

**Researched:** 2026-02-25
**Domain:** Next.js UI (portal + dashboard) / Supabase inline editing / React state management
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Portal upload feedback
- When OCR succeeds (extracted_tax_year / extracted_employer / extracted_paye_ref populated): show a clean confirmation card with labelled rows — document type, tax year, employer, PAYE ref
- When OCR fails, document is image-only, or classification is 'unclassified': show generic "Document uploaded successfully" — no mention of extraction failure, no empty field rows
- Card layout: labelled rows format (not inline text, not sentence format)
- Duplicate detection: warn the client BEFORE accepting — "This file looks identical to one already uploaded. Are you sure?" (uses file_hash from Phase 21). User must confirm before the upload proceeds

#### Dashboard extraction display
- Location: on the document row within the filing card (not a separate panel, not the filing card header)
- Fields shown: all three inline without collapsing — tax year, employer, PAYE ref all visible at a glance
- Inline editing: accountant can click any field to edit it inline; corrections save to the same client_documents columns (extracted_tax_year, extracted_employer, extracted_paye_ref)
- No filing-level summary: per-document rows are sufficient; no aggregate completeness indicator needed

#### Extraction source labelling (accountant view)
- extraction_source ('ocr' / 'keyword' / 'rules'): hidden entirely — not shown in the UI
- Exception 1 — image-only PDFs (extraction_source='rules', isImageOnly=true): show a subtle "Scanned PDF" badge or scan icon on the document row so the accountant knows OCR couldn't run
- Exception 2 — rules-only / extraction failure (unclassified, no readable content): show a "Review needed" warning badge prompting the accountant to follow up with the client

#### NULL / historical document handling
- Documents uploaded before Phase 21 (all extraction fields null, extraction_source='keyword'): hide the extraction section entirely — show filename and document type only, no empty rows, no placeholder text
- Inline edit availability: yes — accountant can manually enter tax year, employer, and PAYE ref even for historical documents with null values
- extraction_source after manual entry: update to 'manual' (new CHECK constraint value needed — add 'manual' to the extraction_source CHECK constraint)

#### Claude's Discretion
- Exact badge/icon design for "Scanned PDF" and "Review needed" indicators
- Inline edit interaction pattern (click-to-edit vs edit button) — follow existing editable cell pattern from DESIGN.md
- API endpoint design for saving edited extraction fields
- Whether the duplicate upload warning is a modal or an inline banner in the portal

### Deferred Ideas (OUT OF SCOPE)
- NI number display — deferred (privacy consideration; decided in Phase 21 research)
- Financial figure extraction (total pay, tax paid) — defer to a dedicated phase once Phase 22 is live and demand is confirmed
- Filing-level completeness summary ("3 of 4 required documents received") — the accountant confirmed per-document rows are sufficient for now
</user_constraints>

---

## Summary

Phase 22 surfaces Phase 21's OCR extraction data across two distinct UI surfaces: the client-facing upload portal and the accountant-facing document dashboard. The technical work divides cleanly into three sub-problems: (1) returning extraction data from the upload API response and rendering a conditional confirmation card in the portal, (2) expanding the `ClientDocument` type and document row rendering in `DocumentCard` to show inline extraction fields with status badges, and (3) implementing inline editing of extraction fields with a new API action and a `extraction_source = 'manual'` migration.

The entire phase is UI and thin-API work built directly on top of Phase 21's schema and classifyDocument output. No new npm packages are needed. All patterns are established in the existing codebase: the inline div+span badge pattern from `ConfidenceBadge`, the `useTransition` + optimistic-update pattern from `ChecklistModal`, the `click-to-edit` Input pattern from DESIGN.md, and the `action`-dispatch pattern already on the documents POST route. The duplicate-before-upload warning is the only behavioural change to the upload flow; everything else is additive rendering.

The highest-risk area is the migration to add `'manual'` to the `extraction_source` CHECK constraint: it must use `ALTER TABLE ... DROP CONSTRAINT ... ADD CONSTRAINT` rather than `ADD COLUMN IF NOT EXISTS`, because PostgreSQL CHECK constraints cannot be altered in-place. The inline editing API action must use the session-scoped Supabase client (not service) so RLS enforces org ownership, consistent with all other mutation routes.

**Primary recommendation:** Three focused plans — (1) portal duplicate warning + confirmation card, (2) dashboard document row OCR display with status badges, (3) inline edit of extraction fields + schema migration for `'manual'` source.

---

## Standard Stack

All libraries are already installed. No new dependencies required.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | already installed | Portal page (server component) + API route changes | Existing architecture |
| React `useState` / `useTransition` | React 19 | Client-side editing state + optimistic updates | Already used in `DocumentCard` / `ChecklistModal` |
| Supabase JS client | already installed | Inline edit save via browser client | Existing `createClient()` pattern |
| Tailwind CSS | already installed | Badge and card styling | Existing design system |
| sonner (toast) | already installed | Success/error feedback on save | Already used throughout dashboard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | already installed | Badge icons (Scan, AlertTriangle) | For "Scanned PDF" and "Review needed" badges |
| react-dropzone | already installed | Already on `ChecklistItem` — no changes needed | No change needed |

**Installation:** None required — all dependencies present.

---

## Architecture Patterns

### Recommended File Structure

```
app/
├── api/
│   ├── portal/[token]/upload/route.ts   # MODIFY: return extraction fields in response
│   └── clients/[id]/documents/route.ts  # MODIFY: add 'update-extraction' action to POST
├── portal/[token]/
│   └── components/
│       ├── portal-checklist.tsx         # MODIFY: pass extraction data down; handle duplicate pre-check
│       ├── checklist-item.tsx           # MODIFY: add confirmation card rendering
│       └── upload-confirmation-card.tsx # CREATE: extraction result card (portal)
└── (dashboard)/clients/[id]/components/
    └── document-card.tsx                # MODIFY: ClientDocument type + row rendering + inline edit

supabase/migrations/
└── 20260225000002_add_manual_extraction_source.sql  # CREATE: add 'manual' to CHECK constraint
```

### Pattern 1: Upload Response Extension (Portal Confirmation Card)

**What:** The portal upload API currently returns `{ success, documentId, originalFilename, documentTypeCode, documentTypeLabel, confidence }`. Phase 22 adds extraction fields to this response so the portal client can render the confirmation card without a second fetch.

**When to use:** Anytime the API already has the data the client needs — avoid a round-trip.

**The extraction data is already in the `classification` object at the time of INSERT** — just add it to the JSON response:

```typescript
// app/api/portal/[token]/upload/route.ts — response object additions
return NextResponse.json({
  success: true,
  documentId: docRow?.id,
  originalFilename: file.name,
  documentTypeCode: classification.documentTypeCode,
  documentTypeLabel: classification.documentTypeCode ?? 'Document',
  confidence: classification.confidence,
  // Phase 22 additions:
  extractedTaxYear: classification.extractedTaxYear,
  extractedEmployer: classification.extractedEmployer,
  extractedPayeRef: classification.extractedPayeRef,
  isImageOnly: classification.isImageOnly,
});
```

**Confidence:** HIGH — the `classification` object already holds these fields (see `ClassificationResult` interface in `lib/documents/classify.ts`).

### Pattern 2: Duplicate Pre-Check Before Upload (Portal)

**What:** Before sending the file to the upload route, compute a SHA-256 hash client-side and call a pre-check endpoint. If a duplicate exists, show a confirmation dialog/banner before proceeding.

**When to use:** The Phase 21 `runIntegrityChecks` function currently rejects duplicates with HTTP 409 AFTER the file bytes have been sent. Phase 22 requirement is to warn BEFORE accepting — "Are you sure?" — meaning the client needs to know about the duplicate before the upload bytes travel.

**Implementation options:**
1. **Inline pre-check via Web Crypto API** — compute SHA-256 in the browser (`crypto.subtle.digest('SHA-256', arrayBuffer)`), call a lightweight `GET /api/portal/[token]/check-duplicate?hash=<hex>` before the main upload, show warning if duplicate found. Clean separation.
2. **Two-phase upload with proceed=true flag** — first call returns 409 with a warning body, second call includes `?confirmDuplicate=true` query param to bypass the duplicate check in `runIntegrityChecks`. Simpler backend change, slightly messier client state.

**Recommendation:** Option 2 is simpler — add `confirmDuplicate: boolean` to the form data; the upload route passes it to `runIntegrityChecks` to skip the duplicate check when true. The portal shows a warning state (inline banner or modal — Claude's discretion) with a "Yes, upload anyway" and "Cancel" button. No new API endpoint needed.

```typescript
// Client side: portal-checklist.tsx
const handleUpload = async (itemId: string, file: File, confirmDuplicate = false) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('checklistItemId', itemId);
  if (confirmDuplicate) formData.append('confirmDuplicate', 'true');

  const res = await fetch(`/api/portal/${rawToken}/upload`, { method: 'POST', body: formData });

  if (res.status === 409) {
    // Show duplicate warning — store pending file in state, prompt user to confirm
    setPendingDuplicate({ itemId, file });
    return;
  }
  // ...
};
```

```typescript
// Upload route: read confirmDuplicate flag and skip duplicate check
const confirmDuplicate = formData.get('confirmDuplicate') === 'true';
const integrity = await runIntegrityChecks(fileBuffer, file.type, portalToken.client_id, supabase, confirmDuplicate);
```

**Note:** `runIntegrityChecks` needs a `skipDuplicate` parameter adding. Check `lib/documents/integrity.ts` for its current signature before implementing.

**Confidence:** HIGH — this is entirely within the existing upload flow.

### Pattern 3: Conditional Confirmation Card (Portal)

**What:** After a successful upload, `ChecklistItem` currently shows only a filename + green checkmark. Phase 22 adds an `ExtractionConfirmationCard` sub-component that renders only when OCR fields are present.

**Show condition:** `extractedTaxYear !== null || extractedEmployer !== null || extractedPayeRef !== null`
**Hide condition:** All three are null OR `isImageOnly === true` OR `confidence === 'unclassified'`

**Card structure (labelled rows, warm tone per CONTEXT.md):**
```tsx
// app/portal/[token]/components/upload-confirmation-card.tsx
interface ExtractionConfirmationCardProps {
  documentTypeLabel: string;
  extractedTaxYear: string | null;
  extractedEmployer: string | null;
  extractedPayeRef: string | null;
}

function ExtractionConfirmationCard({ documentTypeLabel, extractedTaxYear, extractedEmployer, extractedPayeRef }: ExtractionConfirmationCardProps) {
  const rows = [
    { label: 'Document type', value: documentTypeLabel },
    extractedTaxYear ? { label: 'Tax year', value: extractedTaxYear } : null,
    extractedEmployer ? { label: 'Employer', value: extractedEmployer } : null,
    extractedPayeRef ? { label: 'PAYE reference', value: extractedPayeRef } : null,
  ].filter(Boolean);

  return (
    <div className="mt-2 rounded-md bg-green-50 border border-green-100 px-3 py-2 space-y-1">
      <p className="text-xs font-medium text-green-700 mb-1">We've read this document</p>
      {rows.map(row => (
        <div key={row!.label} className="flex items-baseline gap-2">
          <span className="text-xs text-gray-500 w-28 shrink-0">{row!.label}</span>
          <span className="text-xs font-medium text-gray-800">{row!.value}</span>
        </div>
      ))}
    </div>
  );
}
```

**Confidence:** HIGH — established pattern from existing `ConfidenceBadge` and card layout in `DocumentCard`.

### Pattern 4: ClientDocument Type Extension (Dashboard)

**What:** The `ClientDocument` interface in `document-card.tsx` must gain the Phase 21 columns. The GET `/api/clients/[id]/documents` SELECT query must also include them.

**Current SELECT (line 22, documents route):**
```
id, filing_type_id, document_type_id, original_filename, received_at, classification_confidence, source, created_at, retention_flagged, document_types(code, label)
```

**Phase 22 SELECT addition:**
```
..., extracted_tax_year, extracted_employer, extracted_paye_ref, extraction_source, page_count
```

Note: `file_hash`, `file_size_bytes` are not needed in the dashboard display — omit them to keep the payload lean.

**Updated ClientDocument interface:**
```typescript
interface ClientDocument {
  id: string;
  filing_type_id: string;
  document_type_id: string | null;
  original_filename: string;
  received_at: string | null;
  classification_confidence: 'high' | 'medium' | 'low' | 'unclassified';
  source: 'portal_upload' | 'inbound_email' | 'manual';
  created_at: string;
  retention_flagged: boolean;
  document_types: DocumentType | null;
  // Phase 22 additions:
  extracted_tax_year: string | null;
  extracted_employer: string | null;
  extracted_paye_ref: string | null;
  extraction_source: 'ocr' | 'keyword' | 'rules' | 'manual' | null;
  page_count: number | null;
}
```

**Confidence:** HIGH — direct extension of existing type.

### Pattern 5: Status Badges on Document Row (Dashboard)

**What:** Two new badge conditions on document rows in `DocumentCard`:
- "Scanned PDF" — when `extraction_source === 'rules'` AND `page_count` is null (image-only PDF signal; `page_count` is null only for portal uploads that are image-only, since `runIntegrityChecks` populates it and image-only PDFs have extractable page structure but no text)
- "Review needed" — when `classification_confidence === 'unclassified'` AND `extracted_tax_year === null`

**Implementation:** Follow the existing `ConfidenceBadge` inline div+span pattern (DESIGN.md, D-11-04-01). Do NOT use the `Badge` shadcn component — use `<div className="px-2 py-0.5 rounded-md inline-flex items-center ..."><span ...>` pattern.

```typescript
// Scanned PDF: amber/neutral tone — explains absence without implying error
// extraction_source='rules' + page_count=null is the reliable signal for image-only portal uploads
// For inbound, page_count is always null by design (D-21-03-02) — need isImageOnly signal
// BUT: isImageOnly is not stored on client_documents. The reliable proxy is:
//   extraction_source = 'rules' + classification_confidence = 'unclassified' + document_type_id IS NOT NULL
//   (type was identified by keyword, but OCR found no text → image-only)

// Simpler: extraction_source='rules' AND page_count IS NULL covers portal image-only uploads.
// For inbound image-only: page_count IS NULL AND extraction_source='rules' also works
//   because sha256Hash is computed inline (D-21-03-03) but extraction_source='rules' is set
//   when isImageOnly=true in classify.ts → extraction_source gets 'rules' in both paths.

const isScannedPdf = doc.extraction_source === 'rules' && doc.document_type_id !== null;
const isReviewNeeded = doc.classification_confidence === 'unclassified' && doc.document_type_id === null;
```

**Confidence:** MEDIUM — the `isScannedPdf` signal via `extraction_source='rules'` is correct based on the `classify.ts` code (both image-only and unclassified-with-no-text paths set `extractionSource: 'rules'`). The distinction between "scanned PDF" (type identified, can't read) and "review needed" (not classified at all) is: `document_type_id !== null` (keyword matched, OCR failed → scanned) vs `document_type_id === null` (no match at all → review needed).

### Pattern 6: Inline Editing of Extraction Fields (Dashboard)

**What:** Accountant clicks a field value (or an edit icon) to enter edit mode — field becomes an Input. On blur or Enter, saves. On Escape, cancels.

**Follow DESIGN.md editable cell pattern:** `h-8` height input, `autoFocus` on mount, click-to-edit preferred over separate edit button.

**State model per document row** (must not share state across rows):

```typescript
interface ExtractionEditState {
  field: 'extracted_tax_year' | 'extracted_employer' | 'extracted_paye_ref' | null;
  value: string;
  saving: boolean;
}
```

Because `DocumentCard` renders documents as a list, each document row needs its own edit state. Options:
1. Extract each document row into a sub-component `<DocumentRow>` with local state — cleanest
2. Keep all rows in `DocumentCard` with a `Map<documentId, ExtractionEditState>` — workable but heavier

**Recommendation:** Create a `DocumentRow` sub-component within `document-card.tsx` (not a separate file — consistent with `ChecklistModal` pattern of co-locating sub-components in the same file).

**Save action — API design:**

Add a new action to the existing `POST /api/clients/[id]/documents` route (consistent with the existing `action: 'download'` dispatch pattern):

```typescript
// In documents/route.ts POST handler — new action branch
if (action === 'update-extraction') {
  const { documentId, field, value } = body;
  // Validate field is one of the three allowed columns
  const ALLOWED_FIELDS = ['extracted_tax_year', 'extracted_employer', 'extracted_paye_ref'] as const;
  if (!ALLOWED_FIELDS.includes(field)) {
    return NextResponse.json({ error: 'Invalid field' }, { status: 400 });
  }
  const { error } = await supabase
    .from('client_documents')
    .update({
      [field]: value || null,              // empty string → null
      extraction_source: 'manual',
    })
    .eq('id', documentId)
    .eq('client_id', clientId);            // belt-and-braces ownership check
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
```

**Key point:** Use session-scoped `createClient()` (not service) so RLS enforces org ownership. The session client already has the `client_documents` UPDATE policy scoped to the authenticated user's org.

**Confidence:** HIGH — exact same route/dispatch pattern as the existing download action.

### Pattern 7: `extraction_source = 'manual'` Schema Migration

**What:** The Phase 21 migration adds a CHECK constraint `extraction_source IN ('ocr', 'keyword', 'rules')`. Adding `'manual'` requires altering the constraint.

**PostgreSQL ALTER TABLE CHECK constraint:** You cannot modify an existing CHECK constraint in-place. You must:
1. `ALTER TABLE client_documents DROP CONSTRAINT IF EXISTS <constraint_name>` — find the constraint name first
2. `ALTER TABLE client_documents ADD CONSTRAINT <name> CHECK (extraction_source IN ('ocr', 'keyword', 'rules', 'manual'))`

**Alternative:** Use a named constraint in the migration so it's easy to reference:
```sql
-- 20260225000002_add_manual_extraction_source.sql
ALTER TABLE client_documents
  DROP CONSTRAINT IF EXISTS client_documents_extraction_source_check;

ALTER TABLE client_documents
  ADD CONSTRAINT client_documents_extraction_source_check
  CHECK (extraction_source IN ('ocr', 'keyword', 'rules', 'manual'));
```

**Warning:** The auto-generated constraint name from `ADD COLUMN ... CHECK (...)` in Supabase/PostgreSQL follows the pattern `{table}_{column}_check`. Verify the actual constraint name before writing the migration:
```sql
SELECT conname FROM pg_constraint
WHERE conrelid = 'client_documents'::regclass
  AND conname LIKE '%extraction_source%';
```

**Confidence:** HIGH — standard PostgreSQL DDL, verified against Postgres docs.

### Anti-Patterns to Avoid

- **Fetching OCR fields in a separate API call after upload:** Unnecessary round-trip — the upload route already has the `classification` result. Add the fields to the existing response.
- **Showing empty labelled rows for null OCR fields in the portal:** CONTEXT.md explicitly requires hiding the section when all fields are null — generic "Document uploaded successfully" only.
- **Using the `Badge` shadcn component for status badges:** DESIGN.md and MEMORY.md (D-11-04-01) prescribe the inline `div+span` pattern, not `Badge`.
- **Using service client for inline edit saves:** Must use session-scoped `createClient()` so RLS enforces org scoping. Service client would allow cross-org writes.
- **Storing `isImageOnly` as a separate column:** The `extraction_source='rules'` value + document_type_id presence already encodes this — no new column needed.
- **Nested `<button>` elements in document rows:** DocumentCard already uses `div[role=button]` for the expand trigger (per D-20-02 pattern). Edit fields inside rows must use `<input>` with click handler, not nested buttons.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SHA-256 hash in browser for duplicate pre-check | Custom hash lib | Web Crypto API `crypto.subtle.digest('SHA-256', buf)` | Built into every modern browser; no npm dependency |
| Inline edit save with loading state | Custom reducer | `useState` + `useTransition` | Existing pattern in `ChecklistModal`; `useTransition` keeps UI responsive during network call |
| Toast notifications on save | Custom alert component | `sonner` (`toast.success`, `toast.error`) | Already used throughout dashboard |
| Confirmation dialog for duplicate | Custom modal | Inline warning state in `ChecklistItem` or shadcn `Dialog` | Dialog already imported in `DocumentCard`; inline state avoids extra modal for a common flow |

**Key insight:** Everything needed is already in the codebase or in the browser platform. Phase 22 is a rendering and thin-API phase — no new infrastructure.

---

## Common Pitfalls

### Pitfall 1: CHECK Constraint Name Unknown
**What goes wrong:** Migration tries to `DROP CONSTRAINT client_documents_extraction_source_check` but the actual auto-generated name differs. Migration fails in production with "constraint does not exist" error.
**Why it happens:** PostgreSQL names inline `CHECK` constraints as `{table}_{column}_check` but Supabase may suffix them differently.
**How to avoid:** Query `pg_constraint` before writing the migration to confirm the exact name. Use `DROP CONSTRAINT IF EXISTS` defensively.
**Warning signs:** Migration succeeds locally (where the constraint name was checked) but fails on remote (if constraint was created differently).

### Pitfall 2: Portal Duplicate Warning — Race Condition on State
**What goes wrong:** User drops a file, duplicate check triggers, warning shown. User drops another file on a different checklist item before dismissing the warning. State becomes inconsistent — wrong file gets confirmed or uploaded twice.
**Why it happens:** `pendingDuplicate` state is at the `PortalChecklist` level but multiple `ChecklistItem` components can trigger uploads concurrently.
**How to avoid:** Disable all upload areas while a duplicate warning is pending (set a `duplicatePending: boolean` flag in `PortalChecklist` that disables `ChecklistItem` uploads). Alternatively, keep `pendingDuplicate` at the item level so each item manages its own warning.
**Warning signs:** Complex state shape with per-item pending flags.

### Pitfall 3: Inline Edit — Blur vs Click-Outside Conflict
**What goes wrong:** User is editing a field. They click the save button (or another interactive element). `onBlur` fires before `onClick`, triggering a save or cancel action — the click is swallowed.
**Why it happens:** Browser fires `blur` before `click` in the event order.
**How to avoid:** Use `onMouseDown` with `preventDefault()` on save/cancel buttons to prevent blur from firing, then handle the action in `onClick`. Or use `onKeyDown` for Enter/Escape and rely on blur for save-on-focus-loss.
**Warning signs:** Clicking the save button sometimes doesn't save; the input loses focus but no action fires.

### Pitfall 4: documents GET Route — SELECT Missing Phase 21 Columns
**What goes wrong:** `DocumentCard` fetches documents but `extracted_tax_year`, `extracted_employer`, etc. are not in the SELECT. Dashboard shows no extraction data even though DB has it.
**Why it happens:** The current SELECT in `app/api/clients/[id]/documents/route.ts` does not include Phase 21 columns.
**How to avoid:** Update the SELECT string in the route AND update the `ClientDocument` TypeScript interface together in the same commit. Run `npm run build` to catch type mismatches.
**Warning signs:** TypeScript errors about `extracted_tax_year` not existing on `ClientDocument`.

### Pitfall 5: `extraction_source = 'manual'` Written Before Migration Applied
**What goes wrong:** The `update-extraction` API action sets `extraction_source: 'manual'` but the migration adding `'manual'` to the CHECK constraint hasn't been applied. The UPDATE is rejected by Postgres with a check constraint violation.
**Why it happens:** Migrations and code deployed out of order.
**How to avoid:** The schema migration must be in the same plan or an earlier plan than the API action. Migration must be applied to remote before the API code is deployed.
**Warning signs:** 500 error from the update-extraction action; Postgres error `check constraint "client_documents_extraction_source_check" violated`.

### Pitfall 6: Portal Confirmation Card Shown for 'unclassified' Documents
**What goes wrong:** A document is classified with `confidence: 'unclassified'` but all three extraction fields happen to be populated (edge case: keyword matched, OCR ran partially). The confirmation card renders, confusing the client.
**Why it happens:** The show condition only checks for null fields, not confidence level.
**How to avoid:** Show condition: `extractedTaxYear !== null && confidence !== 'unclassified'`. If the confidence is unclassified, fall back to generic "Document uploaded successfully" even if some fields are populated.

---

## Code Examples

### SHA-256 in Browser for Duplicate Pre-Check

```typescript
// Web Crypto API — no npm dependency
// Source: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest
async function sha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
```

**Confidence:** HIGH — Web Crypto API is available in all modern browsers and Next.js client components.

### Inline Edit Field (Click-to-Edit Pattern)

```typescript
// Following DESIGN.md editable cell pattern — h-8, autoFocus, blur saves
function EditableField({
  value,
  onSave,
  placeholder,
}: { value: string | null; onSave: (val: string | null) => void; placeholder: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');

  const handleSave = () => {
    setEditing(false);
    onSave(draft.trim() || null);
  };

  if (editing) {
    return (
      <Input
        className="h-8 min-w-[120px]"
        value={draft}
        autoFocus
        onChange={e => setDraft(e.target.value)}
        onBlur={handleSave}
        onKeyDown={e => {
          if (e.key === 'Enter') handleSave();
          if (e.key === 'Escape') { setEditing(false); setDraft(value ?? ''); }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      className="text-xs text-gray-700 hover:underline hover:text-violet-600 cursor-text text-left"
      onClick={() => setEditing(true)}
    >
      {value ?? <span className="text-muted-foreground italic">{placeholder}</span>}
    </button>
  );
}
```

### Schema Migration for `'manual'` Value

```sql
-- supabase/migrations/20260225000002_add_manual_extraction_source.sql
-- Add 'manual' to extraction_source CHECK constraint
-- (constraint was added as inline CHECK in 20260225000001_phase21_ocr_columns.sql)

ALTER TABLE client_documents
  DROP CONSTRAINT IF EXISTS client_documents_extraction_source_check;

ALTER TABLE client_documents
  ADD CONSTRAINT client_documents_extraction_source_check
  CHECK (extraction_source IN ('ocr', 'keyword', 'rules', 'manual'));
```

**Confidence:** HIGH — standard PostgreSQL DDL.

### Badge Pattern (Inline div+span, per DESIGN.md D-11-04-01)

```typescript
// "Scanned PDF" badge — amber/neutral tone
<div className="px-2 py-0.5 rounded-md inline-flex items-center gap-1 bg-amber-500/10">
  <Scan className="size-3 text-amber-600" />
  <span className="text-xs font-medium text-amber-600">Scanned PDF</span>
</div>

// "Review needed" badge — warning tone
<div className="px-2 py-0.5 rounded-md inline-flex items-center gap-1 bg-status-warning/10">
  <AlertTriangle className="size-3 text-status-warning" />
  <span className="text-xs font-medium text-status-warning">Review needed</span>
</div>
```

**Note:** `AlertTriangle` is available from `lucide-react`. `Scan` may not be — check the lucide-react version installed. Alternative: `ScanLine`, `FileSearch`, or a plain eye icon.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Generic "Document uploaded" after every upload | Conditional extraction confirmation card | Phase 22 | Client gets meaningful confirmation when OCR succeeds |
| Extraction fields invisible in UI | Inline visible on document rows, editable | Phase 22 | Accountant can verify and correct OCR output |
| `extraction_source` CHECK is 3 values | 4 values including 'manual' | Phase 22 | Tracks provenance of manual corrections |

**Deprecated/outdated:**
- `documentTypeLabel: classification.documentTypeCode ?? 'Document'` in the upload route response — this is a bug in the existing code (using `documentTypeCode` for `documentTypeLabel`). Phase 22 should fix this when modifying the response object; look up the label from `document_types` or pass it separately.

---

## Open Questions

1. **Exact PostgreSQL constraint name for `extraction_source`**
   - What we know: Phase 21 migration used inline `CHECK (extraction_source IN (...))` syntax
   - What's unclear: Whether Supabase names it `client_documents_extraction_source_check` or something else
   - Recommendation: Query `pg_constraint` at the start of the migration plan task; use `DROP CONSTRAINT IF EXISTS` as a safety net in any case

2. **`Scan` icon availability in lucide-react version installed**
   - What we know: The project uses lucide-react (already imported in DocumentCard — `ChevronDown`, `Download`, etc.)
   - What's unclear: Whether `Scan` or `ScanLine` is available in the installed version
   - Recommendation: Check `node_modules/lucide-react` icon list or use `FileSearch2` as fallback

3. **`runIntegrityChecks` signature — where is `skipDuplicate` added?**
   - What we know: It lives in `lib/documents/integrity.ts` and is called only from the portal upload route (D-21-03-01)
   - What's unclear: Whether the function signature change needs to stay backward compatible with other callers
   - Recommendation: Add optional `options?: { skipDuplicate?: boolean }` parameter — backward compatible

---

## Plan Breakdown Recommendation

Phase 22 should be structured as **3 plans**:

### Plan 22-01: Portal Duplicate Warning + Extraction Confirmation Card
**Scope:**
- `runIntegrityChecks` — add `skipDuplicate` option
- `app/api/portal/[token]/upload/route.ts` — add extraction fields + `isImageOnly` to response
- `app/portal/[token]/components/portal-checklist.tsx` — duplicate pre-check state, confirm/cancel flow
- `app/portal/[token]/components/checklist-item.tsx` — show confirmation card post-upload
- `app/portal/[token]/components/upload-confirmation-card.tsx` — new component (extraction confirmation)
- `app/portal/[token]/components/progress-bar.tsx` — no change needed

### Plan 22-02: Dashboard Document Row — OCR Fields Display + Status Badges
**Scope:**
- `supabase/migrations/20260225000002_add_manual_extraction_source.sql` — add 'manual' to CHECK constraint
- `app/api/clients/[id]/documents/route.ts` — update SELECT to include Phase 21 columns
- `app/(dashboard)/clients/[id]/components/document-card.tsx`:
  - Extend `ClientDocument` interface
  - Add `DocumentRow` sub-component (renders extraction fields, Scanned PDF badge, Review needed badge)
  - Inline edit fields (EditableField sub-component)
  - Save call via `action: 'update-extraction'`

### Plan 22-03: Inline Edit API Action
**Scope:**
- `app/api/clients/[id]/documents/route.ts` — add `update-extraction` action to POST handler
- Wiring verification: edit → API → DB → response → optimistic update in DocumentCard

**Note:** Plans 22-02 and 22-03 could merge into one plan since they both modify `document-card.tsx` and `documents/route.ts`. The split is at the planner's discretion based on complexity assessment.

---

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `app/api/portal/[token]/upload/route.ts` — confirmed existing response shape and classification fields available
- Codebase inspection: `lib/documents/classify.ts` — confirmed `ClassificationResult` interface with all Phase 21 fields
- Codebase inspection: `supabase/migrations/20260225000001_phase21_ocr_columns.sql` — confirmed schema columns and CHECK constraint syntax
- Codebase inspection: `app/(dashboard)/clients/[id]/components/document-card.tsx` — confirmed `ClientDocument` type, badge pattern, `ConfidenceBadge`, `useTransition` usage
- Codebase inspection: `app/portal/[token]/components/portal-checklist.tsx` + `checklist-item.tsx` — confirmed upload flow and current response consumption
- Codebase inspection: `DESIGN.md` — confirmed editable cell pattern (h-8, autoFocus), inline div+span badge pattern (D-11-04-01)
- Codebase inspection: `.planning/STATE.md` — confirmed Phase 21 decisions (D-21-01-01 through D-21-03-03) and NULL handling requirements

### Secondary (MEDIUM confidence)
- PostgreSQL documentation: CHECK constraint ALTER requires DROP + ADD (cannot modify in-place) — standard PostgreSQL DDL, no version caveats
- MDN Web Docs: `crypto.subtle.digest('SHA-256', buffer)` available in all modern browsers and Node.js — standard Web Crypto API

### Tertiary (LOW confidence)
- Lucide-react `Scan` icon availability — not verified against installed version; may need fallback

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed; no new dependencies
- Architecture: HIGH — all patterns directly derived from existing codebase code inspection
- Pitfalls: HIGH — all pitfalls derived from existing code paths and Phase 21 decisions
- Schema migration: HIGH — standard PostgreSQL DDL

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (stable — no fast-moving external dependencies)
