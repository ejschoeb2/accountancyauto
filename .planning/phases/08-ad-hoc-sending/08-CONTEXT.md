# Phase 8: Ad-Hoc Sending - Context

**Gathered:** 2026-02-08
**Status:** Ready for planning

<domain>
## Phase Boundary

User can send one-off emails to selected clients outside the automated reminder schedule. The flow starts from the existing clients page: select clients, pick a template, preview the rendered email, and send. No new navigation pages — the entire flow happens via a modal triggered from the bulk actions toolbar.

</domain>

<decisions>
## Implementation Decisions

### Client selection
- Flow starts from the existing clients page — user selects clients via the existing bulk selection checkboxes
- A new "Send Email" button appears in the bulk actions toolbar (alongside existing bulk actions)
- Selection on the clients page is final — no ability to modify recipients inside the modal
- Clients without email addresses are silently skipped during send, with the count reflected in the results summary

### Template & preview
- Template selection via a simple dropdown listing all templates by name
- After selecting a template, show a preview rendered with the first selected client's data
- Preview shows the rendered email as the client would see it, plus a note indicating which placeholders were substituted
- No inline editing of subject or body — template is used as-is (user edits the template itself if changes are needed)

### Send flow & feedback
- Explicit confirmation step before sending: "Send to X clients?" with confirm button
- Visual progress bar showing X/Y sent as emails go out
- Results summary shows sent count and failed count, plus a list of failed clients with error reasons
- On individual send failure, continue sending remaining clients — collect all failures and report at the end

### Entry points & navigation
- Clients page is the only entry point — no standalone "Send Email" nav item
- Ad-hoc sends appear in the existing delivery log with an "ad-hoc" badge/tag to distinguish from scheduled reminders
- After successful send, modal closes and user returns to clients page with a success toast notification

### Claude's Discretion
- Modal layout and step progression (single panel vs wizard steps)
- Progress bar styling and animation
- Toast notification design and duration
- How to handle the case when all selected clients lack email addresses

</decisions>

<specifics>
## Specific Ideas

- Flow mirrors the existing bulk actions pattern — select, act, confirm — keeping the UX consistent
- Preview with placeholder substitution note helps the user verify the template works correctly before sending to many clients

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-ad-hoc-sending*
*Context gathered: 2026-02-08*
