# Phase 5: Rich Text Editor & Templates - Context

**Gathered:** 2026-02-08
**Status:** Ready for planning

<domain>
## Phase Boundary

User can create and manage standalone email templates using a rich text editor (TipTap) with placeholder autocomplete. Templates include a name, subject line (plain text + placeholders), and rich text body (formatted text + placeholders). Templates are reusable entities stored in the email_templates table.

</domain>

<decisions>
## Implementation Decisions

### Editor Toolbar & Formatting
- **Formatting options**: Minimal set only — bold, italic, lists (bullets/numbered), and links
- **Toolbar position**: Fixed top, always visible above the editor (like Gmail compose)
- **Subject line formatting**: Plain text only, no rich text formatting in subject
- **Link insertion**: Auto-detect pasted URLs and convert to links; toolbar button for manual link insertion
- **Default styling**: No template-level or global defaults — always starts plain
- **Keyboard shortcuts**: Yes, standard shortcuts work (Ctrl+B for bold, Ctrl+I for italic, etc.)
- **Metrics display**: No character count or word count shown
- **List nesting**: Flat lists only, no nested/indented sub-items

### Placeholder Insertion UX
- **Body insertion method**: Button + dropdown only (no slash command) — click "Insert Placeholder" button, select from dropdown
- **Placeholder appearance in editor**: Styled pill/badge with colored background (clear visual distinction, protected from accidental editing)
- **Subject line insertion method**: Button dropdown (consistent with body)
- **Placeholder styling in subject**: Yes, same styled pill treatment as body

### Template Management UI
- **Navigation location**: Main tab called "Templates" (top-level navigation, same level as Clients/Dashboard)
- **List page layout**: Cards in grid layout showing template preview and metadata
- **Search/filter**: No search or filter functionality — simple list/grid of all templates
- **New template creation**: Button opens full editor page (navigate away from list to dedicated editor page)

### Content Pasting Behavior
- **Style stripping**: Strip all formatting — paste as plain text only, user re-applies formatting with toolbar
- **Paste notification**: No notification, silent paste
- **Paste shortcuts**: Ctrl+V always strips formatting, no Ctrl+Shift+V alternative
- **Image handling**: Ignore images completely — they don't appear, paste text only if present

### Claude's Discretion
- Exact color/styling of placeholder pills (as long as they're visually distinct and protected)
- Error state messaging for editor failures
- Loading states for template list and editor
- Exact card design in grid layout
- Button placement and styling for toolbar

</decisions>

<specifics>
## Specific Ideas

No specific product references or design inspiration provided — open to standard best practices for email template editors.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 05-rich-text-editor---templates*
*Context gathered: 2026-02-08*
