# Phase 6: Email Rendering Pipeline - Context

**Gathered:** 2026-02-08
**Status:** Ready for planning

<domain>
## Phase Boundary

**SCOPE CHANGE:** Preview UI is no longer needed (modern editor is sufficient). This phase now focuses solely on the **rendering pipeline** that converts TipTap JSON to email-safe HTML.

Core requirement: Sent emails must render correctly in Gmail, Outlook, and Apple Mail with inline styles and no broken formatting.

Preview functionality has been removed from scope.

</domain>

<decisions>
## Implementation Decisions

### Rendering Pipeline
- **Placeholder replacement timing**: At render time — convert TipTap JSON to HTML with placeholders already filled with client data
- **Missing data fallback**: Show fallback text (e.g., "[Name]", "your records") if placeholder data is missing
- **Link behavior**: All links open in new tab (target="_blank")
- **Style inlining**: Inline everything — convert all styles to inline style attributes for maximum email client compatibility

### Claude's Discretion
- Specific fallback text wording for each placeholder type
- HTML structure and email template wrapper
- Testing strategy for Gmail/Outlook/Apple Mail compatibility
- Error handling for malformed TipTap JSON
- Character encoding and special character handling

</decisions>

<specifics>
## Specific Ideas

No specific product references — focus on email client compatibility and preventing broken formatting.

</specifics>

<deferred>
## Deferred Ideas

- **Preview UI functionality** — Originally part of Phase 6, now removed from scope (editor is sufficient)
- **A/B testing** — Not in current milestone scope
- **Send-time optimization** — Not in current milestone scope

</deferred>

---

*Phase: 06-email-rendering---preview*
*Context gathered: 2026-02-08*
*Note: Scope reduced to rendering pipeline only, preview UI removed*
