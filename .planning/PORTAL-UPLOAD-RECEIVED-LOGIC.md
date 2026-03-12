# Portal Upload → Received Logic Rework

## Problem

When a client uploads a document via the portal, the system immediately treats it as "received" — the checklist row gets a green check and, once all mandatory items have a matched document, `records_received_for` auto-updates on the client row. This happens regardless of the document's verdict (needs_review, low confidence, etc.). The validation/verification pipeline built in Phase 30 is effectively bypassed for the purpose of marking records as received.

## Goal

Portal uploads should **attach** to the checklist row (showing the file, date, verdict) but should **not** count as "received". The checkbox should show an **amber/pending** state instead of green. Accountant uploads (`source: 'manual'`) continue to auto-tick as received (green check).

In the future, a new Upload Checks setting will allow portal uploads with a good enough verdict to auto-tick — but that setting is not implemented yet. For now, all portal uploads are amber/pending by default.

---

## Architecture Context

### How "received" currently works

1. **`DocumentCard`** (`app/(dashboard)/clients/[id]/components/document-card.tsx`) loads documents for a filing type from the `client_documents` table.

2. **`findMatchingDocument(documentTypeId)`** (line ~947) finds ANY document with a matching `document_type_id`:
   ```ts
   const findMatchingDocument = (documentTypeId: string): ClientDocument | undefined => {
     return documents.find(doc => doc.document_type_id === documentTypeId);
   };
   ```

3. **`renderChecklistRow(item)`** (line ~1030) determines checked state:
   ```ts
   const matchedDoc = findMatchingDocument(item.documentTypeId);
   const isChecked = !!matchedDoc || item.manuallyReceived;
   ```
   When `isChecked` is true, the row gets a green `CheckButton` (`variant="success"`) and the label gets `line-through`.

4. **`renderDocCells()`** (line ~969) renders the row with the checkbox. Currently:
   ```tsx
   <CheckButton checked={isChecked} variant={isChecked ? 'success' : 'default'} disabled={disableCheck} />
   ```
   When a matched doc exists, `disableCheck` is `true` (checkbox is locked green).

5. **Received count** (line ~816-823): counts items where `!!matchedDoc || item.manuallyReceived`.

6. **All-received trigger** (line ~826-844): when ALL mandatory items satisfy the above condition, `onRequiredAllReceivedChange(true)` fires → `filing-management.tsx` adds the filing type to `records_received_for` on the client row.

### Key types

- **`ClientDocument.source`**: `'portal_upload' | 'manual'` — distinguishes portal vs accountant uploads.
- **`ClientDocument.needs_review`**: `boolean` — set by validation pipeline.
- **`ClientDocument.classification_confidence`**: `'high' | 'medium' | 'low' | 'unclassified'`.

### Verdict labels (from `getVerdict()` in document-card.tsx)

| Verdict | Condition | "Good enough" for future auto-receive? |
|---|---|---|
| `Review needed` | `needs_review === true` | No |
| `Low confidence` | confidence is `low` or `unclassified` | No |
| `Scanned PDF` | `extraction_source === 'rules'` | Maybe (medium) |
| `Manual` | `source === 'manual'` | N/A (always received) |
| `Likely match` | confidence is `medium` | Maybe |
| `Verified` | confidence is `high`, no issues | Yes |

---

## Implementation Plan

### Step 1: Add `'amber'` variant to `CheckButton`

**File:** `components/ui/check-button.tsx`

Add a third variant `'amber'` alongside `'default'` and `'success'`. This variant represents "document attached but not yet confirmed as received".

```tsx
// Current variant type:
variant?: "default" | "success"

// Change to:
variant?: "default" | "success" | "amber"
```

Add amber colour block in the `colors` logic:

```tsx
const colors = variant === "success"
  ? { bg: "bg-green-500/10 hover:bg-green-500/20", icon: "text-green-600" }
  : variant === "amber"
  ? { bg: "bg-amber-500/10 hover:bg-amber-500/20", icon: "text-amber-600" }
  : { bg: "bg-status-neutral/10 hover:bg-status-neutral/20", icon: "text-blue-500" };
```

For the amber variant when checked, show an **uncertain icon** instead of a checkmark. Import `AlertCircle` from lucide-react and use it:

```tsx
import { Check, Minus, AlertCircle } from "lucide-react"

// In the render:
{isIndeterminate ? (
  <Minus className={cn("size-5", colors.icon)} />
) : isChecked && variant === "amber" ? (
  <AlertCircle className={cn("size-5", colors.icon)} />
) : isChecked ? (
  <Check className={cn("size-5", colors.icon)} />
) : null}
```

### Step 2: Introduce `isDocReceived()` helper in `document-card.tsx`

**File:** `app/(dashboard)/clients/[id]/components/document-card.tsx`

Create a helper that determines whether a matched document should count as "received" (green check) or just "attached/pending" (amber):

```ts
/** A matched document counts as "received" only if:
 *  - it was uploaded manually by the accountant (source === 'manual'), OR
 *  - it was manually marked received via the checklist
 *  Portal uploads are always "pending" until the accountant confirms.
 *  (Future: auto_receive_verified setting will let verified portal uploads count.) */
function isDocReceived(doc: ClientDocument): boolean {
  return doc.source === 'manual';
}
```

This is deliberately simple right now. The future setting will add a second branch here.

### Step 3: Update `renderDocCells()` — checkbox variant logic

**File:** `app/(dashboard)/clients/[id]/components/document-card.tsx` (line ~969)

Currently the function signature is:
```ts
const renderDocCells = (
  doc: ClientDocument, label: string, isChecked: boolean,
  rowKey: string, disableCheck: boolean, onCheck?: () => void
) => { ... }
```

Change the `CheckButton` inside from:
```tsx
<CheckButton checked={isChecked} variant={isChecked ? 'success' : 'default'} disabled={disableCheck} onCheckedChange={onCheck} />
```

To:
```tsx
<CheckButton
  checked={isChecked}
  variant={isChecked ? 'success' : (doc.source === 'portal_upload' ? 'amber' : 'default')}
  disabled={disableCheck}
  onCheckedChange={onCheck}
/>
```

But this isn't quite right because `isChecked` needs to change too. See next step.

### Step 4: Update `renderChecklistRow()` — split "attached" vs "received"

**File:** `app/(dashboard)/clients/[id]/components/document-card.tsx` (line ~1029)

Current logic:
```ts
const matchedDoc = findMatchingDocument(item.documentTypeId);
const isChecked = !!matchedDoc || item.manuallyReceived;
// ...
if (matchedDoc) {
  return renderDocCells(matchedDoc, item.label, isChecked, rowKey, true);
}
```

New logic — a portal upload with a doc attached is NOT "checked" (received) unless also `manuallyReceived`:
```ts
const matchedDoc = findMatchingDocument(item.documentTypeId);
const docReceived = matchedDoc ? isDocReceived(matchedDoc) : false;
const isChecked = (matchedDoc && docReceived) || item.manuallyReceived;
const isPendingPortalUpload = !!matchedDoc && !docReceived && !item.manuallyReceived;

if (matchedDoc) {
  // Portal upload pending: show amber checkbox, label NOT struck through, clicking toggles manuallyReceived
  // Received doc (manual upload or manually confirmed): green checkbox, label struck through, disabled
  return renderDocCells(
    matchedDoc,
    item.label,
    isChecked,
    rowKey,
    isPendingPortalUpload ? false : true,  // allow clicking amber to confirm
    isPendingPortalUpload ? () => handleManualToggle(item) : undefined,
    isPendingPortalUpload,  // NEW param: pass pending state for variant logic
  );
}
```

Update `renderDocCells` signature to accept an optional `isPending` param:
```ts
const renderDocCells = (
  doc: ClientDocument, label: string, isChecked: boolean,
  rowKey: string, disableCheck: boolean, onCheck?: () => void,
  isPending?: boolean,  // NEW
) => {
```

And update the CheckButton inside:
```tsx
<CheckButton
  checked={isPending ? true : isChecked}
  variant={isPending ? 'amber' : isChecked ? 'success' : 'default'}
  disabled={disableCheck}
  onCheckedChange={onCheck}
/>
```

When `isPending` is true, the label should NOT be struck through (the file is there but not confirmed):
```tsx
<span className={`text-sm ${isChecked && !isPending ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
  {label}
</span>
```

### Step 5: Update received count and all-received logic

**File:** `app/(dashboard)/clients/[id]/components/document-card.tsx`

**Received count** (line ~816-823) — portal uploads no longer count:
```ts
useEffect(() => {
  if (loading) return;
  const total = effectiveChecklist.length;
  const received = effectiveChecklist.filter(item => {
    const matchedDoc = findMatchingDocument(item.documentTypeId);
    const docReceived = matchedDoc ? isDocReceived(matchedDoc) : false;
    return (matchedDoc && docReceived) || item.manuallyReceived;
  }).length;
  onReceivedCountChange?.(received, total);
}, [effectiveChecklist, documents, loading]);
```

**All-received trigger** (line ~829-844) — same change:
```ts
const allReceived = mandatoryItems.every(
  item => {
    const matchedDoc = documents.find(d => d.document_type_id === item.documentTypeId);
    const docReceived = matchedDoc ? isDocReceived(matchedDoc) : false;
    return (matchedDoc && docReceived) || item.manuallyReceived;
  }
);
```

**`selectAll` / `deselectAll`** (line ~669+) — these bulk-toggle `manuallyReceived`. The `selectAll` function currently skips items with a matched doc. It should now also select portal-upload items (since they're pending):
```ts
const toUpdate = effectiveChecklist.filter(item => {
  const matchedDoc = findMatchingDocument(item.documentTypeId);
  const docReceived = matchedDoc ? isDocReceived(matchedDoc) : false;
  return !(matchedDoc && docReceived) && !item.manuallyReceived;
});
```

**`setGroupManuallyReceived`** (line ~763) — same filter update:
```ts
const toUpdate = items.filter(item => {
  const matchedDoc = findMatchingDocument(item.documentTypeId);
  return !(matchedDoc && isDocReceived(matchedDoc));
});
```

### Step 6: Update `renderExtraRow()` for consistency

**File:** `app/(dashboard)/clients/[id]/components/document-card.tsx` (line ~1075)

Extra documents (unmatched to checklist) currently render as always checked. For portal uploads that are unmatched, they should also show amber:

```ts
const renderExtraRow = (doc: ClientDocument) => {
  const rowKey = `extra-${doc.id}`;
  const label = doc.document_types?.label || doc.original_filename;
  const isPending = doc.source === 'portal_upload' && !isDocReceived(doc);
  return renderDocCells(doc, label, !isPending, rowKey, true, undefined, isPending);
};
```

---

## Future: Auto-Receive Verified Setting

### Overview

A new option in the Upload Checks card (`app/(dashboard)/settings/components/upload-checks-card.tsx`) will allow orgs to opt in to auto-receiving portal uploads that have a "good enough" verdict.

### Database

Add a new boolean column to `organisations`:
```sql
ALTER TABLE organisations
  ADD COLUMN auto_receive_verified boolean NOT NULL DEFAULT false;
```

This is a simple on/off toggle, separate from the existing `upload_check_mode` dropdown (which controls what processing runs). The toggle only makes sense when checks are enabled (`upload_check_mode !== 'none'`).

### Settings UI

Add a toggle/checkbox below the upload check mode dropdown in `upload-checks-card.tsx`:
- **Label:** "Auto-confirm verified uploads"
- **Description:** "When enabled, portal uploads with a 'Verified' verdict are automatically marked as received. Uploads that need review or have low confidence remain pending for manual confirmation."
- **Only visible when** `upload_check_mode !== 'none'`

### Settings action

Add `setAutoReceiveVerified(enabled: boolean)` in `app/actions/settings.ts`, mirroring `setUploadCheckMode`.

### DocumentCard changes

The `isDocReceived()` helper would expand:
```ts
function isDocReceived(doc: ClientDocument, autoReceiveVerified: boolean): boolean {
  if (doc.source === 'manual') return true;
  if (!autoReceiveVerified) return false;
  // Auto-receive only if verdict is "good enough"
  if (doc.needs_review) return false;
  if (doc.classification_confidence === 'low' || doc.classification_confidence === 'unclassified') return false;
  if (doc.classification_confidence === 'high' && !doc.needs_review) return true;
  return false;  // medium confidence, scanned PDF, etc. — still pending
}
```

### Prop threading

The `auto_receive_verified` value needs to reach `DocumentCard`:
- `clients/[id]/page.tsx` → fetch org setting → pass to `FilingManagement`
- `FilingManagement` → pass to `DocumentCard`
- `DocumentCard` → use in `isDocReceived()`

Alternatively, `DocumentCard` already fetches the user session to get `orgId` (line ~444). It could fetch the setting directly from the `organisations` table using the client-side Supabase client.

---

## Files to Modify (Current Scope — No Future Setting)

| File | Change |
|---|---|
| `components/ui/check-button.tsx` | Add `'amber'` variant with `AlertCircle` icon |
| `app/(dashboard)/clients/[id]/components/document-card.tsx` | Add `isDocReceived()` helper; update `renderDocCells` signature; update `renderChecklistRow`; update received count, all-received trigger, selectAll, deselectAll, setGroupManuallyReceived, renderExtraRow |

No database migrations needed. No new props needed on `FilingManagement` or `DocumentCard` — the `source` field already exists on `ClientDocument`.

## Files NOT to Modify

- `document-preview-modal.tsx` — no changes needed
- `filing-management.tsx` — `handleRequiredDocsAllReceived` is already reactive; it just won't fire as often now
- Upload API routes — no changes; `source` is already set correctly at insert time
- Settings UI — future scope only

## Testing

1. **Portal upload flow:** Upload a document from the portal → verify the checklist row shows amber checkbox with AlertCircle icon, filename/date/verdict are visible, label is NOT struck through
2. **Manual upload flow:** Upload from the accountant dashboard → verify green check, struck-through label (existing behaviour preserved)
3. **Confirm pending:** Click the amber checkbox or the row → it should toggle `manuallyReceived` to true, turning the checkbox green
4. **Records received:** With portal uploads only (no manual confirmation), verify `records_received_for` does NOT include the filing type. After manually confirming all mandatory items, verify it DOES update
5. **Select all / deselect all:** Verify these work correctly with pending portal uploads (select all should mark them as manually received)
6. **Extra documents:** Unmatched portal uploads in the extras section should also show amber
