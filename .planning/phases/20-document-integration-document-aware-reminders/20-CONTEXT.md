# Phase 20: Document Integration & Document-Aware Reminders - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the document collection system into the filing type workflow. Remove the standalone Documents, Generate Upload Link, and Checklist Customisation cards from the client detail page and integrate them as contextual features within each filing type card. Extend the reminder template engine with two new variables — `{{documents_required}}` and `{{portal_link}}` — that resolve at send time using live document state. Auto-set Records Received when all mandatory documents are uploaded. No new tables, no new external services, no new scheduling infrastructure.

</domain>

<decisions>
## Implementation Decisions

### Filing card document section

- **Collapsed header:** Show progress fraction — e.g. "3 of 8 documents received". Requires an effective checklist to be meaningful; if no checklist configured, show "0 of 0" or fall back to raw count.
- **Expanded layout:** Interleaved checklist — a single unified list where each required item appears as ✓ received (showing filename, document type, download button) or □ outstanding. No separate tables or tabs. Makes gaps immediately visible in context.
- **Generate Upload Link placement:** Button at the bottom of the expanded section. Not inline per item (portal links are filing-type scoped, not per-document) and not in the collapsed header.
- **Empty state (no checklist, no documents):** Show a prompt — "No documents yet — set up a checklist or generate an upload link" — with a link or button to checklist customisation inline. Do not silently collapse.

### Inline portal link and checklist customisation

- **Checklist customisation:** Accessible via a settings/gear icon on the filing card (modal or inline editor). The standalone Checklist Customisation card is removed entirely.
- **Generate Upload Link card:** Removed entirely. Portal link generation lives within the expanded filing card section (button at bottom as above).

### `{{documents_required}}` variable

- **Render format:** HTML bullet list (`<ul><li>...</li></ul>`). Rendered as an HTML fragment, not a plain string, and injected into the TipTap-rendered email body via the existing `dangerouslySetInnerHTML` path.
- **Item label:** Document type label from `document_types.label` — the canonical HMRC name (e.g. "P60 (End of Year Certificate)"). Does not use checklist custom labels or short codes.
- **When all documents received:** Resolves to empty string. Variable disappears. Accountants should not include `{{documents_required}}` in "all received" acknowledgment templates.
- **When no checklist configured:** Fall back to global defaults from `filing_document_requirements` for that filing type. Always produces a meaningful list; never resolves to empty due to missing configuration.
- **Resolution timing:** Computed at scheduler send time by querying `filing_document_requirements` + `client_document_checklist_customisations` (per-client overrides), then diffing against `client_documents` for the client/filing type.

### `{{portal_link}}` variable

- **Token generation:** Always generate a fresh token per reminder send. Old tokens from previous reminders remain valid until their own expiry. No reuse lookup.
- **Token expiry:** Match the gap to the next reminder step in the schedule. If next step fires in 28 days, token expires in 28 days. Requires the scheduler to know the step interval at token generation time.
- **When no checklist configured:** Generate the token anyway — the portal renders with global `filing_document_requirements` defaults. `{{portal_link}}` always resolves to a valid URL.
- **When Records Received is already set:** Do not generate a link. This is naturally handled — the queue builder already skips reminders for filing types where records are received. No extra conditional logic needed.

### Auto Records Received trigger

- **Trigger condition:** All items marked `mandatory = true` in the effective checklist (global `filing_document_requirements` minus any per-client `client_document_checklist_customisations` that disable them). Conditional/optional items do not block auto-set.
- **Classification guard:** Only documents with classification confidence of `high` or `medium` count toward fulfilling a checklist item. `low` or `unclassified` documents are present but do not satisfy requirements.
- **Manual override behaviour:** If an accountant manually unchecks Records Received after it was auto-set, the manual uncheck is respected. Auto-set does not re-fire until a *new* document upload arrives after the uncheck. A new upload re-evaluates the condition and re-fires if all mandatory items are still met.
- **Notification on auto-set:** Toast message shown on the client detail page at the moment the upload triggers auto-set. Text: "Records Received auto-set — all mandatory documents received for [Filing Type]." No email, no persistent notification entry.

### Consolidated API fetch

- **Current problem:** Four `DocumentCard` instances each call `GET /api/clients/{id}/documents` and filter client-side — four identical round trips.
- **Fix:** Filing management API response includes document count + last received date per filing type. Full document list (with checklist interleave) fetches only when a card is expanded.
- **Claude's Discretion:** Exact shape of the combined filing+document response; whether to use a dedicated endpoint or augment the existing `/api/clients/{id}/filings` route.

### Claude's Discretion

- Exact progress fraction display when no checklist is configured (e.g. show count only, or "X documents · no checklist")
- Checklist customisation modal vs inline — whichever fits the existing modal/dialog pattern from DESIGN.md
- Exact toast wording and duration for auto Records Received notification
- Whether `{{documents_required}}` renders conditional items differently (e.g. greyed out vs omitted entirely) — default to omitting conditional items not applicable to the client

</decisions>

<specifics>
## Specific Ideas

- The interleaved checklist is the key UX win — received and outstanding in one view, so the accountant sees the gap at a glance without switching sections.
- `{{documents_required}}` should feel like writing a natural email: the accountant puts it where they'd put a paragraph, and it becomes a formatted list. It should not require any special editor treatment beyond appearing in the variable picker.
- Token expiry matching the next step interval is the right behaviour: a client gets a link in an email, and that link stays valid until the next reminder arrives with a fresh one. They're never left with an expired link mid-sequence.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 20-document-integration-document-aware-reminders*
*Context gathered: 2026-02-24*
