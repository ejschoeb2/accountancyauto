# Phase 19: Collection Mechanisms - Context

**Gathered:** 2026-02-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Documents arrive through two channels: passively from Postmark email attachments and actively via the token-based client upload portal. Documents are classified, surfaced inline on the client detail page, and trigger accountant notifications. Retention enforcement runs automatically via cron and DSAR export is available on demand. Creating new document types, modifying classification models, and client communication flows are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Portal experience
- Primary upload interaction: drag-drop dropzone with click-to-browse fallback
- Checklist layout: list of items, each a row with status indicator and per-item upload slot
- Post-upload feedback: inline confirmation per item — row updates to green check with filename shown; no page navigation
- Re-upload allowed: yes — re-uploading on an already-submitted item replaces the previous file

### Document display on client page
- Default state: collapsed card showing document count and most recent submission date
- Expanded row columns: filename, document type label, confidence badge, received date, source (portal / email), download button
- Confidence badge: traffic light colours (green ≥80%, amber 50–79%, red <50%) with percentage shown — matches existing design system
- Download behaviour: opens signed URL in new tab (no forced download, no in-app preview modal)

### Notification behaviour
- Trigger timing: per upload — fires immediately each time a document is received
- Applies to both channels: yes — both portal uploads and email attachment ingestion trigger notifications
- Display: toast only (auto-dismissing); no persistent notification bell for this phase
- Toast content: client name + document type label + outstanding items count (e.g. "Sarah Jones uploaded P60 — 2 items still outstanding")

### Email ingestion edge cases
- No client match: store document as unmatched (not discarded); surface to accountant for triage
- Triage location: dedicated "Unmatched documents" section on the Documents page
- Multiple attachments: each attachment becomes a separate `client_documents` row — classified and stored independently
- Low classification confidence: store document regardless (never discard); show amber/red confidence badge; accountant corrects the type manually

### Claude's Discretion
- Exact toast positioning and dismiss timing
- Unmatched document section layout within Documents page
- Accountant correction flow for misclassified documents (inline edit vs modal)
- DSAR export format and delivery mechanism
- Retention flagging email template content and formatting

</decisions>

<specifics>
## Specific Ideas

- Confidence badge uses the existing traffic light design system — researcher should look at how traffic light badges are implemented elsewhere in the codebase for consistency
- Portal re-upload should replace silently — no confirmation prompt needed (keeps it simple for clients)
- "Never lose a document" principle: even unmatched emails and low-confidence attachments are stored, never discarded

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 19-collection-mechanisms*
*Context gathered: 2026-02-23*
