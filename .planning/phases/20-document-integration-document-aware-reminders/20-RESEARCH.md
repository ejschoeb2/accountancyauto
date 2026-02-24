# Phase 20: Document Integration & Document-Aware Reminders - Research

**Researched:** 2026-02-24
**Domain:** UI restructuring, template variable engine extension, scheduler integration, document state evaluation
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Filing card document section**
- Collapsed header: Show progress fraction — e.g. "3 of 8 documents received". Requires an effective checklist to be meaningful; if no checklist configured, show "0 of 0" or fall back to raw count.
- Expanded layout: Interleaved checklist — a single unified list where each required item appears as ✓ received (showing filename, document type, download button) or □ outstanding. No separate tables or tabs.
- Generate Upload Link placement: Button at the bottom of the expanded section. Not inline per item and not in the collapsed header.
- Empty state (no checklist, no documents): Show a prompt — "No documents yet — set up a checklist or generate an upload link" — with a link or button to checklist customisation inline. Do not silently collapse.

**Inline portal link and checklist customisation**
- Checklist customisation: Accessible via a settings/gear icon on the filing card (modal or inline editor). The standalone Checklist Customisation card is removed entirely.
- Generate Upload Link card: Removed entirely. Portal link generation lives within the expanded filing card section (button at bottom).

**`{{documents_required}}` variable**
- Render format: HTML bullet list (`<ul><li>...</li></ul>`). Injected into TipTap-rendered email body via the existing `dangerouslySetInnerHTML` path.
- Item label: `document_types.label` — the canonical HMRC name (e.g. "P60 (End of Year Certificate)"). Not checklist custom labels.
- When all documents received: Resolves to empty string.
- When no checklist configured: Fall back to global defaults from `filing_document_requirements` for that filing type.
- Resolution timing: Computed at scheduler send time by querying `filing_document_requirements` + `client_document_checklist_customisations` (per-client overrides), then diffing against `client_documents`.

**`{{portal_link}}` variable**
- Token generation: Always generate a fresh token per reminder send. Old tokens remain valid until their own expiry.
- Token expiry: Match the gap to the next reminder step in the schedule. Requires the scheduler to know the step interval at token generation time.
- When no checklist configured: Generate the token anyway — portal renders with global defaults.
- When Records Received is already set: Naturally handled — queue builder already skips reminders for those filing types.

**Auto Records Received trigger**
- Trigger condition: All items marked `mandatory = true` in the effective checklist are satisfied. Conditional/optional items do not block auto-set.
- Classification guard: Only `high` or `medium` confidence documents count. `low` or `unclassified` do not satisfy requirements.
- Manual override behaviour: If accountant manually unchecks Records Received after auto-set, manual uncheck is respected. Auto-set does not re-fire until a new document upload arrives after the uncheck.
- Notification on auto-set: Toast message on the client detail page at the moment the upload triggers auto-set. Text: "Records Received auto-set — all mandatory documents received for [Filing Type]." No email, no persistent notification.

**Consolidated API fetch**
- Current problem: Four `DocumentCard` instances each call `GET /api/clients/{id}/documents` — four identical round trips.
- Fix: Filing management API response includes document count + last received date per filing type. Full document list (with checklist interleave) fetches only when a card is expanded.
- Claude's Discretion: Exact shape of the combined filing+document response; whether to use a dedicated endpoint or augment the existing `/api/clients/{id}/filings` route.

### Claude's Discretion

- Exact progress fraction display when no checklist is configured (e.g. show count only, or "X documents · no checklist")
- Checklist customisation modal vs inline — whichever fits the existing modal/dialog pattern from DESIGN.md
- Exact toast wording and duration for auto Records Received notification
- Whether `{{documents_required}}` renders conditional items differently (e.g. greyed out vs omitted entirely) — default to omitting conditional items not applicable to the client

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

## Summary

Phase 20 is a pure integration and wiring phase. All the underlying infrastructure — document tables, Storage bucket, portal tokens, checklist customisations, document classification — was built in Phases 18 and 19. This phase connects that infrastructure to two surfaces: (1) the client detail page UI, where standalone document and portal cards are dissolved into the filing type cards; and (2) the reminder email pipeline, where two new template variables (`{{documents_required}}` and `{{portal_link}}`) are resolved at scheduler send time using live document state.

There are no new database tables required. The schema is complete. The three core work areas are: UI restructuring (filing card gains document section + checklist customisation + portal link generation), template variable engine extension (add two new variables to `lib/templates/variables.ts` and resolve them in `lib/reminders/scheduler.ts`), and auto-Records-Received trigger (evaluate checklist completion on upload and programmatically set `records_received_for` with a toast notification).

The key planning consideration is sequencing: the consolidated API fetch must come before the UI restructure (UI depends on the new API shape), and the template variable resolution logic must be built before the scheduler integration. The auto-Records-Received trigger can be built in parallel with the UI work since it operates at the upload API layer.

**Primary recommendation:** Break into 3 plans: (1) API consolidation + new filing/document endpoint, (2) UI restructuring of client detail page (filing cards + remove standalone cards), (3) template variable engine extension + scheduler wiring + auto-Records-Received trigger.

---

## Standard Stack

### Core (all already installed — no new packages needed)

| Library | Purpose | Where Used |
|---------|---------|-----------|
| Next.js App Router | Route handlers, server components | All API routes |
| Supabase JS SDK | DB queries for checklist, documents, tokens | Scheduler, upload API |
| TipTap (`@tiptap/html`) | HTML generation from TipTap JSON | `lib/email/render-tiptap.ts` |
| `@react-email/render` | Inline-styles email rendering | `lib/email/render-tiptap.ts` |
| `date-fns` | Schedule step interval calculations | `lib/reminders/scheduler.ts` |
| `sonner` | Toast notifications | Client detail page |

### No New NPM Packages Required

All dependencies already present. Phase 20 is a wiring and integration phase, not a new-library phase.

---

## Architecture Patterns

### Recommended Plan Structure

```
Plan 20-01: API consolidation
  - Augment GET /api/clients/[id]/filings to include doc_count + last_received_at per filing type
  - New GET /api/clients/[id]/documents?filing_type_id=X (lazy-load on card expand)

Plan 20-02: UI restructuring
  - Rewrite DocumentCard: interleaved checklist + progress fraction + gear icon + portal link button
  - Remove standalone GeneratePortalLink card, ChecklistCustomisation card, Documents card from page.tsx
  - Auto-Records-Received trigger on document upload (portal + inbound webhook paths)

Plan 20-03: Template variable engine + scheduler wiring
  - Extend TemplateContext + AVAILABLE_PLACEHOLDERS with documents_required, portal_link
  - Extend substituteVariables() to handle HTML injection for documents_required
  - Add resolveDocumentVariables() helper in lib/documents/
  - Wire into processRemindersForUser() in scheduler.ts
  - Add portal token generation logic within scheduler (step interval lookup)
```

### Pattern 1: Augmenting the Filings API Response

**What:** Extend `GET /api/clients/[id]/filings` to include document summary data per filing type — document count and most recent received date. This prevents 4 DocumentCard instances each making separate fetch calls.

**Implementation approach:** After the existing filings response is built, run a single aggregation query against `client_documents` grouped by `filing_type_id` for this client, then merge into the response.

```typescript
// Source: existing /api/clients/[id]/filings route pattern
// Add after building filings array:
const { data: docSummary } = await supabase
  .from('client_documents')
  .select('filing_type_id, received_at')
  .eq('client_id', clientId)
  .order('received_at', { ascending: false });

// Group by filing_type_id in app code (PostgREST aggregate workaround)
const docSummaryMap = new Map<string, { count: number; lastReceived: string | null }>();
for (const doc of docSummary ?? []) {
  const entry = docSummaryMap.get(doc.filing_type_id) ?? { count: 0, lastReceived: null };
  entry.count++;
  if (!entry.lastReceived) entry.lastReceived = doc.received_at;
  docSummaryMap.set(doc.filing_type_id, entry);
}
// Merge into each filing in the response
```

**Confidence:** HIGH — consistent with project's "fetch separately and map in application code" pattern documented in MEMORY.md (PostgREST FK join workaround).

### Pattern 2: Interleaved Checklist Computation

**What:** When a DocumentCard is expanded, fetch the effective checklist (global requirements + per-client customisations) and the actual documents, then compute the interleaved view in the component.

**Data fetch on expand:**
1. `GET /api/clients/{id}/documents?filing_type_id={X}` — returns documents for this filing type
2. Fetch checklist state: either inline in the same endpoint OR a separate call to the existing Supabase direct queries already used in `ChecklistCustomisation`

**Interleave logic (app layer):**
```typescript
// For each requirement in effective checklist:
// - Find a matching client_document (document_type_id match, confidence high/medium)
// - If found: render as received row with filename + download button
// - If not found: render as outstanding row with checkbox placeholder
```

**Confidence:** HIGH — matches the decision in CONTEXT.md verbatim.

### Pattern 3: Template Variable Resolution for `{{documents_required}}`

**What:** At scheduler send time (`lib/reminders/scheduler.ts`, Step 6-7), after context is built, resolve `documents_required` by:
1. Fetching `filing_document_requirements` for this filing type — mandatory items only
2. Fetching `client_document_checklist_customisations` for this client+filing — apply toggles
3. Fetching `client_documents` for this client+filing — filter for high/medium confidence
4. Diff: items in effective checklist NOT satisfied by any existing document
5. Render as `<ul><li>...</li></ul>` HTML string using `document_types.label`

**Current `substituteVariables()` handles only plain strings.** The `{{documents_required}}` variable produces an HTML fragment that must survive into the rendered email. The TipTap HTML pipeline currently calls `substituteVariables()` on raw HTML before passing to `renderTipTapEmail()`. The HTML fragment injection must happen at the same point — the regex substitution already places the result directly into the HTML string, which is then passed to React Email's `dangerouslySetInnerHTML` path.

**Key: No changes to the email template format are needed.** The `{{documents_required}}` placeholder is just a text token in the template. When the regex replaces it with `<ul><li>...</li></ul>`, it becomes an HTML fragment that is already inside a `<p>` or other block element. The React Email wrapper renders it inline. Confirm the HTML is well-formed — a `<ul>` inside a `<p>` is invalid HTML; the template should put `{{documents_required}}` as a block-level element, not inside a paragraph.

**Confidence:** HIGH for the substitution approach. MEDIUM for the HTML validity concern — needs to be tested in the template editor.

### Pattern 4: Token Generation for `{{portal_link}}` at Send Time

**What:** During scheduler's Step 7 (template rendering loop), when a reminder has a template containing `{{portal_link}}`, generate a fresh portal token scoped to client + filing type + tax year, with expiry matching the gap to the next schedule step.

**Step interval lookup:** The scheduler already has the schedule and step in scope during Step 7:
```typescript
// Already in scope at this point in scheduler.ts:
const step = steps.find((s) => s.step_number === reminder.step_index);
const nextStep = steps.find((s) => s.step_number === reminder.step_index + 1);
const daysToNextStep = nextStep ? nextStep.delay_days : 30; // fallback
const expiresAt = addDays(new Date(), daysToNextStep);
```

**Token generation:** Reuse the same crypto pattern as `POST /api/clients/[id]/portal-token`:
```typescript
const rawToken = crypto.randomBytes(32).toString('hex');
const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
// Insert into upload_portal_tokens with org_id, client_id, filing_type_id, tax_year, token_hash, expires_at
// tax_year derived from reminder.deadline_date (year of the deadline)
```

**Portal URL construction:** Use the same pattern as the existing route — `${NEXT_PUBLIC_APP_URL}/portal/${rawToken}`. No subdomain awareness needed for portal URLs (they're public-facing, token-authenticated).

**Note:** The existing `POST /api/clients/[id]/portal-token` revokes all previous tokens. The scheduler must NOT revoke — old tokens from previous reminders remain valid (per CONTEXT.md decision: "Old tokens from previous reminders remain valid until their own expiry. No reuse lookup."). The scheduler inserts a new token row without touching existing ones.

**Confidence:** HIGH — clear decision from CONTEXT.md, clear pattern from existing portal-token route.

### Pattern 5: Auto Records Received Trigger

**What:** After a document is uploaded (portal upload path in `app/portal/[token]/` upload handler, and Postmark inbound webhook in `app/api/postmark/inbound`), check if all mandatory checklist items are now satisfied. If yes, set `records_received_for` to include the filing type.

**Where to add:** The upload handler already creates the `client_documents` row. After INSERT, call a new utility function `checkAndAutoSetRecordsReceived(supabase, clientId, filingTypeId, orgId)`.

**Evaluation logic:**
```typescript
async function checkAndAutoSetRecordsReceived(
  supabase, clientId: string, filingTypeId: string, orgId: string
): Promise<boolean> {
  // 1. Fetch effective mandatory checklist (global requirements - disabled customisations)
  // 2. Fetch client_documents for client+filing with classification_confidence IN ('high', 'medium')
  // 3. For each mandatory item: check if any document has matching document_type_id
  // 4. If ALL mandatory items satisfied: PATCH clients.records_received_for to add filingTypeId
  // 5. Return true if auto-set fired
}
```

**Manual uncheck re-fire guard:** The decision requires that if an accountant manually unchecks Records Received, auto-set doesn't re-fire until a NEW upload arrives. This is naturally handled: the trigger fires at upload time. A manual uncheck after an auto-set does not schedule any re-evaluation. The next upload simply runs the check again — which will pass if all mandatory items are still present.

**Toast notification:** The function returns a boolean. The upload handler (which is a server component or API route) cannot directly fire a client-side toast. The approach: the upload response includes an `auto_records_received: true` field; the portal page or client component reads this and shows the toast. For the Postmark inbound webhook (background processing), the toast cannot be shown immediately — it will only appear on next page load or via Supabase Realtime.

**Confidence for portal path:** HIGH — response field approach is clean.
**Confidence for inbound email path:** MEDIUM — Realtime notification is the only viable path; a server-side event must be emitted.

### Anti-Patterns to Avoid

- **Running per-card document fetches on mount:** The current DocumentCard fetches all documents for the client on every mount and filters client-side. This results in 4 identical API calls. Replace with the consolidated filings API pattern.
- **Generating portal tokens from a client component:** Token generation requires `crypto.randomBytes()` and a DB insert — must stay server-side. Do not expose this to client components.
- **Storing the raw portal token:** The raw token is shown once and discarded. Only the SHA-256 hash goes in the DB. This is already enforced in Phase 19, but the scheduler's token generation must follow the same pattern.
- **Using `dangerouslySetInnerHTML` on user-controlled content:** The `{{documents_required}}` value is system-generated from `document_types.label` values (seeded HMRC names). Not user-controlled. Safe to inject as HTML. Do not flag this as an XSS concern.
- **Putting `{{documents_required}}` inside a `<p>` tag in the template:** A `<ul>` inside a `<p>` is invalid HTML and browsers will auto-correct it in unexpected ways. The template editor or documentation should guide accountants to insert this variable as a standalone block. Alternatively, the variable could be wrapped in a `<div>` to ensure block-level rendering.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Token generation | Custom entropy scheme | `crypto.randomBytes(32).toString('hex')` + SHA-256 hash — already established in Phase 19 |
| HTML email rendering | Manual inline-style injection | Existing `renderTipTapEmail()` pipeline in `lib/email/render-tiptap.ts` |
| Distributed lock for scheduler | Custom mutex | Existing `locks` table pattern already used in `processRemindersForUser()` |
| Modal/dialog UI | Custom overlay | Existing `Dialog`/`DialogContent` from `@/components/ui/dialog` — already used in FilingManagement |
| Toast notifications | Custom notification system | `sonner` via `toast()` — already used everywhere |
| Records received state update | Direct Supabase client call from component | `PATCH /api/clients/[id]` with `{ records_received_for: [...] }` — existing pattern used in `handleRecordsReceivedToggle()` in `filing-management.tsx` |

---

## Common Pitfalls

### Pitfall 1: Four simultaneous document fetches on page load

**What goes wrong:** The current `DocumentCard` calls `GET /api/clients/${clientId}/documents` on mount (via `useEffect`). With four cards for four filing types, this fires four parallel fetches. The response is the same every time — all documents for the client. The filtering happens client-side. This wastes bandwidth and slows the page.

**Why it happens:** The card was built as a standalone component that fetches its own data, which was the right call for Phase 19 isolation.

**How to avoid:** Augment the filings API to include `doc_count` and `last_received_at` per filing type. DocumentCard receives these as props. Only fetch full documents when the card is expanded, filtered by `filing_type_id`.

**Warning signs:** Network tab showing 4 identical requests to `/api/clients/{id}/documents` on every page load.

### Pitfall 2: `{{documents_required}}` producing `<ul>` inside `<p>`

**What goes wrong:** TipTap wraps all paragraph content in `<p>` tags. If an accountant writes `Please provide: {{documents_required}}` in a paragraph node, the substitution produces `<p>Please provide: <ul><li>...</li></ul></p>` which is invalid HTML. Browsers typically move the `<ul>` outside the `<p>`, breaking the layout.

**Why it happens:** TipTap's paragraph node wraps all inline content in `<p>`. The variable is treated as inline text.

**How to avoid:** Either (a) in the template editor, treat `{{documents_required}}` as a block-level element hint and render a non-collapsible callout in the editor preview, or (b) document clearly that this variable should be placed on its own line/paragraph in the template. The simplest technical fix: wrap the resolved value in `<div>` instead of bare `<ul>` since `<div>` inside `<p>` is also invalid but email clients are more forgiving. Best approach: produce `<br>• Item 1<br>• Item 2<br>` (plain bullet-like format) if the variable will be used inline, OR use `<ul><li>...</li></ul>` only when the accountant places it in a dedicated paragraph.

**Recommendation:** Use the `<ul><li></li></ul>` format as decided, and document that the variable should be placed in its own paragraph block (not inline within text). The TipTap editor's placeholder pill pattern already renders variables as block-level nodes in the editor, so the UX naturally guides accountants to use it standalone.

### Pitfall 3: Token expiry calculation when next step is missing

**What goes wrong:** For the last step in a schedule, there is no "next step". The `daysToNextStep` calculation returns undefined/null, causing the expiry to be undefined or `addDays(new Date(), NaN)`.

**Why it happens:** The scheduler looks up `steps.find(s => s.step_number === reminder.step_index + 1)`. For the final step, this returns `undefined`.

**How to avoid:** Add a fallback: if no next step exists, use 30 days as the default expiry (or the number of days until the deadline). `const daysToNextStep = nextStep?.delay_days ?? 30;`

### Pitfall 4: Auto Records Received fires on low/unclassified documents

**What goes wrong:** A client uploads a document that gets classified as `low` or `unclassified`. The auto-set check runs and incorrectly counts it toward the mandatory checklist completion.

**Why it happens:** Missing the confidence filter in the evaluation query.

**How to avoid:** The `checkAndAutoSetRecordsReceived()` function must filter `client_documents` with `classification_confidence IN ('high', 'medium')` before matching against checklist items. This is explicitly stated in CONTEXT.md.

### Pitfall 5: Portal token row insert in scheduler uses same revocation logic as manual generation

**What goes wrong:** If the scheduler's token generation accidentally calls the same code path as `POST /api/clients/[id]/portal-token` (which revokes all existing tokens for that client+filing+year), it will invalidate tokens from previous manual portal link generations.

**Why it happens:** Code reuse without awareness of the revocation side-effect.

**How to avoid:** The scheduler must INSERT a new `upload_portal_tokens` row directly without calling any existing revoke-then-insert pattern. The scheduler's token generation is additive only — it never revokes existing tokens.

### Pitfall 6: `records_received_for` field is JSONB array — requires careful merge

**What goes wrong:** Setting `records_received_for` requires reading the current array, adding the new filing type ID, and writing it back. If two uploads arrive simultaneously (portal + email), both may read the same current state and both write the same new state, resulting in a correct but redundant final state. The real risk is a race condition causing one write to overwrite another filing type that was just added.

**Why it happens:** JSONB arrays require application-level merging; there's no native Postgres "add element if not present" for JSONB in a single update without custom SQL.

**How to avoid:** Use Postgres array operations via raw SQL: `UPDATE clients SET records_received_for = records_received_for || '["filing_type_id"]'::jsonb WHERE NOT records_received_for @> '["filing_type_id"]'::jsonb AND id = $1`. This makes the add-if-not-present operation atomic. Alternatively, accept the read-merge-write pattern since the worst case is an idempotent write (same value already present), which is safe.

---

## Code Examples

### Extending `TemplateContext` and `AVAILABLE_PLACEHOLDERS`

```typescript
// Source: lib/templates/variables.ts — extend existing interface and array

export interface TemplateContext {
  client_name: string;
  deadline: Date;
  filing_type: string;
  accountant_name?: string;
  documents_required?: string;  // HTML fragment — resolved at send time
  portal_link?: string;         // URL string — resolved at send time
}

export const AVAILABLE_PLACEHOLDERS = [
  { name: 'client_name', description: "Client's company or trading name" },
  { name: 'deadline', description: 'Deadline date in long format (e.g., 31 January 2026)' },
  { name: 'deadline_short', description: 'Deadline date in short format (e.g., 31/01/2026)' },
  { name: 'filing_type', description: 'Type of filing (e.g., Corporation Tax Payment)' },
  { name: 'days_until_deadline', description: 'Number of days remaining until deadline' },
  { name: 'accountant_name', description: 'Practice name' },
  { name: 'documents_required', description: 'List of outstanding required documents (HTML bullet list)' },
  { name: 'portal_link', description: 'Secure upload link for client to submit documents' },
] as const;
```

### Effective Checklist Computation

```typescript
// Source: new lib/documents/checklist.ts utility

export async function resolveEffectiveChecklist(
  supabase: SupabaseClient,
  clientId: string,
  filingTypeId: string
): Promise<Array<{ documentTypeId: string; label: string; is_mandatory: boolean }>> {
  // 1. Fetch global requirements
  const { data: requirements } = await supabase
    .from('filing_document_requirements')
    .select('document_type_id, is_mandatory, document_types(label)')
    .eq('filing_type_id', filingTypeId);

  // 2. Fetch per-client customisations
  const { data: customisations } = await supabase
    .from('client_document_checklist_customisations')
    .select('document_type_id, is_enabled')
    .eq('client_id', clientId)
    .eq('filing_type_id', filingTypeId);

  const customisationMap = new Map(
    (customisations ?? []).map(c => [c.document_type_id, c.is_enabled])
  );

  // 3. Apply overrides — default enabled when no customisation row
  return (requirements ?? [])
    .filter(req => customisationMap.get(req.document_type_id) !== false)
    .map(req => ({
      documentTypeId: req.document_type_id,
      label: (req.document_types as { label: string }).label,
      is_mandatory: req.is_mandatory,
    }));
}
```

### `{{documents_required}}` Resolution

```typescript
// Source: new lib/documents/checklist.ts

export async function resolveDocumentsRequired(
  supabase: SupabaseClient,
  clientId: string,
  filingTypeId: string
): Promise<string> {
  const effectiveChecklist = await resolveEffectiveChecklist(supabase, clientId, filingTypeId);
  const mandatoryItems = effectiveChecklist.filter(item => item.is_mandatory);

  if (mandatoryItems.length === 0) return '';

  // Fetch received documents (high/medium confidence only)
  const { data: received } = await supabase
    .from('client_documents')
    .select('document_type_id')
    .eq('client_id', clientId)
    .eq('filing_type_id', filingTypeId)
    .in('classification_confidence', ['high', 'medium']);

  const receivedTypeIds = new Set((received ?? []).map(d => d.document_type_id));

  const outstanding = mandatoryItems.filter(
    item => !receivedTypeIds.has(item.documentTypeId)
  );

  if (outstanding.length === 0) return ''; // All received

  const listItems = outstanding.map(item => `<li>${item.label}</li>`).join('');
  return `<ul>${listItems}</ul>`;
}
```

### `{{portal_link}}` Generation in Scheduler

```typescript
// Source: insert into processRemindersForUser() in lib/reminders/scheduler.ts
// After step lookup, before renderTipTapEmail() call:

import crypto from 'crypto';
import { addDays } from 'date-fns';

// Determine token expiry from next step interval
const nextStep = steps.find(s => s.step_number === reminder.step_index + 1);
const daysToNextStep = nextStep?.delay_days ?? 30;
const tokenExpiry = addDays(new Date(), daysToNextStep);

// Generate fresh token (additive — does NOT revoke existing tokens)
const rawToken = crypto.randomBytes(32).toString('hex');
const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
const taxYear = new Date(reminder.deadline_date).getFullYear().toString();

await supabase.from('upload_portal_tokens').insert({
  org_id: org.id,
  client_id: client.id,
  filing_type_id: reminder.filing_type_id,
  tax_year: taxYear,
  token_hash: tokenHash,
  expires_at: tokenExpiry.toISOString(),
  // created_by_user_id: null (system-generated, not user-initiated)
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const portalLink = `${appUrl}/portal/${rawToken}`;
```

### Auto Records Received Trigger

```typescript
// Source: new lib/documents/auto-records-received.ts

export async function checkAndAutoSetRecordsReceived(
  supabase: SupabaseClient,
  clientId: string,
  filingTypeId: string,
  orgId: string
): Promise<boolean> {
  const effectiveChecklist = await resolveEffectiveChecklist(supabase, clientId, filingTypeId);
  const mandatoryItems = effectiveChecklist.filter(item => item.is_mandatory);

  if (mandatoryItems.length === 0) return false;

  const { data: received } = await supabase
    .from('client_documents')
    .select('document_type_id')
    .eq('client_id', clientId)
    .eq('filing_type_id', filingTypeId)
    .in('classification_confidence', ['high', 'medium']);

  const receivedTypeIds = new Set((received ?? []).map(d => d.document_type_id));
  const allSatisfied = mandatoryItems.every(item => receivedTypeIds.has(item.documentTypeId));

  if (!allSatisfied) return false;

  // Fetch current records_received_for to merge
  const { data: clientData } = await supabase
    .from('clients')
    .select('records_received_for')
    .eq('id', clientId)
    .single();

  const current: string[] = clientData?.records_received_for ?? [];
  if (current.includes(filingTypeId)) return false; // Already set — do not overwrite

  const updated = [...current, filingTypeId];
  await supabase
    .from('clients')
    .update({ records_received_for: updated })
    .eq('id', clientId);

  return true; // Caller shows toast
}
```

### Filing Card Header with Progress Fraction

```typescript
// Source: updated DocumentCard collapsed header
// Progress fraction when checklist exists:
// "{received} of {total} documents received"
// When no checklist: "{count} documents · no checklist"

// Checklist item count from filing_document_requirements for this filing type
// Received count = matching client_documents with confidence high/medium
```

---

## State of the Art

| Old Approach (Phase 19) | New Approach (Phase 20) | Impact |
|-------------------------|-------------------------|--------|
| Standalone `GeneratePortalLink` card | Portal link button inside expanded DocumentCard | One fewer card on page; in-context access |
| Standalone `ChecklistCustomisation` card | Gear icon on DocumentCard header → modal/inline | Contextual access per filing type |
| Standalone `Documents` card wrapping 4 DocumentCards | Documents section dissolved into FilingManagement cards | Unified filing + document view |
| 4 parallel `GET /api/clients/{id}/documents` on load | 1 doc summary in `/api/clients/{id}/filings`; lazy full fetch on expand | Eliminates 3 redundant network requests |
| `TemplateContext` with 4 variables | `TemplateContext` with 6 variables (+ `documents_required`, `portal_link`) | Document-aware reminder emails |
| `records_received_for` only set manually | Auto-set on document upload when checklist complete | Reduced manual accountant work |

---

## Open Questions

1. **`tax_year` derivation for scheduler-generated portal tokens**
   - What we know: The scheduler has `reminder.deadline_date` (a date string). The portal token schema has `tax_year TEXT`.
   - What's unclear: Is `tax_year` always the 4-digit year of the deadline? Or should it match the `tax_year` stored in any existing portal token for that client+filing? The current manual generation takes `taxYear` as a user input.
   - Recommendation: Derive from `reminder.deadline_date` as the 4-digit year (e.g., `'2026'` from `'2026-01-31'`). This is consistent with how the portal token route works and matches the `tax_year` field on the portal's document upload.

2. **Where to call `resolveDocumentsRequired()` and `resolvePortalLink()` in the scheduler**
   - What we know: Currently the scheduler resolves template variables at Step 7 (rendering loop) using a single `renderTipTapEmail()` call with a `TemplateContext`.
   - What's unclear: Should the document/portal resolution happen before or inside `renderTipTapEmail()`? The context object is already built before the call, so the cleanest approach is to resolve the two new variables before calling `renderTipTapEmail()` and include them in the context.
   - Recommendation: Resolve before the `renderTipTapEmail()` call. Add `await resolveDocumentsRequired(supabase, clientId, filingTypeId)` and the portal token generation to the pre-render context assembly. Pass as `context.documents_required` and `context.portal_link`.

3. **Whether `substituteVariables()` needs modification for HTML injection**
   - What we know: The current regex `template.replace(/\{\{(\w+)\}\}/g, (match, key) => variables[key] ?? match)` replaces any matched key with its string value. If `documents_required` is `<ul><li>P60</li></ul>`, the regex replaces `{{documents_required}}` with that HTML string in the raw HTML.
   - What's unclear: Are there any escape issues? The HTML is already in a raw HTML string at this point (post-TipTap generation), so the HTML fragment should inject cleanly.
   - Recommendation: No modification needed to `substituteVariables()`. The existing regex handles any string value, HTML or plain text. Verify with a unit test.

4. **How the `DocumentCard` receives checklist data on expand**
   - What's unclear: Should the card fetch checklist data from the Supabase client directly (as `ChecklistCustomisation` does today), or should there be a dedicated API endpoint?
   - Recommendation: On expand, make two fetch calls in parallel: (1) `GET /api/clients/{id}/documents?filing_type_id={X}` for documents, (2) direct Supabase client queries for `filing_document_requirements` and `client_document_checklist_customisations` (consistent with how `ChecklistCustomisation` already works). Avoids creating a new API route.

---

## What Phase 20 Does NOT Require

- No new database migrations (all tables exist: `document_types`, `filing_document_requirements`, `client_documents`, `client_document_checklist_customisations`, `upload_portal_tokens`)
- No new npm packages
- No changes to the Storage bucket or RLS policies
- No changes to the portal page (`/portal/[token]`) — it already renders the checklist correctly
- No changes to Postmark webhook handling beyond adding the auto-records-received trigger call
- No new cron jobs or Vercel scheduled tasks

---

## Sources

### Primary (HIGH confidence)

- Codebase analysis: `lib/templates/variables.ts` — TemplateContext interface, AVAILABLE_PLACEHOLDERS, substituteVariables()
- Codebase analysis: `lib/reminders/scheduler.ts` — processRemindersForUser() steps 1-8
- Codebase analysis: `app/(dashboard)/clients/[id]/components/document-card.tsx` — current fetch pattern
- Codebase analysis: `app/(dashboard)/clients/[id]/components/filing-management.tsx` — existing filing card UI pattern
- Codebase analysis: `app/(dashboard)/clients/[id]/components/checklist-customisation.tsx` — existing checklist UI + Supabase query pattern
- Codebase analysis: `app/api/clients/[id]/portal-token/route.ts` — token generation pattern
- Codebase analysis: `app/api/clients/[id]/documents/route.ts` — documents API
- Codebase analysis: `app/api/clients/[id]/filings/route.ts` — filings API shape
- Codebase analysis: `lib/email/render-tiptap.ts` — rendering pipeline
- Supabase schema (live): `client_documents`, `upload_portal_tokens`, `client_document_checklist_customisations`, `filing_document_requirements`, `clients` — column names and types verified
- CONTEXT.md: All locked decisions and Claude's discretion areas

### Secondary (MEDIUM confidence)

- MEMORY.md pitfall: PostgREST FK join workaround — "fetch reference tables separately and map in application code" — influences API consolidation approach
- STATE.md decision D-19-03-03: "DocumentCard fetches all client documents once per page mount and filters client-side by filing_type_id" — confirms current approach and motivation for change

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries, all dependencies confirmed present
- Architecture patterns: HIGH — all based on existing code patterns in the codebase
- Pitfalls: HIGH for fetch consolidation and token handling; MEDIUM for HTML injection edge cases
- Variable resolution in scheduler: HIGH — clear insertion point in existing Step 7 code

**Research date:** 2026-02-24
**Valid until:** 2026-03-24 (30 days — stable domain)
