# Feature Landscape

**Domain:** Email template authoring, scheduling, and ad-hoc sending for accounting practice reminders
**Researched:** 2026-02-08
**Overall confidence:** MEDIUM-HIGH (Tiptap patterns well-documented; UX patterns verified across multiple sources)

---

## Table Stakes

Features users expect. Missing any of these and the system feels broken or incomplete.

### 1. Rich Text Editor with Toolbar

| Aspect | Detail |
|--------|--------|
| **Feature** | WYSIWYG editor replacing the current `<Textarea>` for email body |
| **Why expected** | User wants "Gmail/Outlook feel" -- plain textarea is the #1 frustration |
| **Complexity** | Medium |
| **Recommendation** | Tiptap 3.x with `@tiptap/starter-kit` |
| **Toolbar controls** | Bold, italic, underline, bullet list, numbered list, link insertion |
| **Dependencies** | New packages: `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit` |

**Expected behaviors:**
- Formatting toolbar sits above editor (fixed, not floating -- simpler for non-technical user)
- Keyboard shortcuts work (Ctrl+B, Ctrl+I, Ctrl+U)
- Undo/redo works
- Copy-paste from Word/Outlook preserves basic formatting (bold, lists) but strips complex styles
- Editor area feels like a real text box, not a code editor

**Why Tiptap over alternatives:**
- Headless (no forced styling -- fits existing shadcn/Tailwind design system)
- Extension-based architecture (add only what's needed, avoid bloat)
- ProseMirror foundation is battle-tested for email editors
- Mention/Suggestion system is exactly what placeholder insertion needs
- Already has Next.js/React 19 support
- JSON storage enables both editor reload and HTML export
- TinyMCE has merge-tag support but brings its own UI framework (conflict with shadcn)
- Lexical is powerful but has steeper learning curve for this scope

**Confidence:** HIGH (Tiptap docs verified via WebFetch, multiple production email editors use it)

---

### 2. Placeholder Insertion via Slash Command or Trigger

| Aspect | Detail |
|--------|--------|
| **Feature** | Type `/` to open autocomplete menu of placeholder variables |
| **Why expected** | Core value proposition -- user explicitly requested this over manual `{{typing}}` |
| **Complexity** | Medium |
| **Recommendation** | Tiptap Mention extension with `/` trigger character, custom node rendering |
| **Dependencies** | `@tiptap/extension-mention`, `@tiptap/suggestion` |

**Expected behaviors:**
- User types `/` anywhere in the editor body
- Dropdown appears with filterable list of available placeholders (client_name, deadline, filing_type, etc.)
- Typing further filters the list (e.g., `/cli` shows only "client_name")
- Selecting an item inserts a styled pill/badge (e.g., `[Client Name]` with colored background)
- Pill is atomic -- cannot be partially edited, only deleted as a whole
- Pill stores the placeholder key (`client_name`) while displaying the human label (`Client Name`)
- Backspace on a pill deletes the entire pill
- Existing PLACEHOLDER_VARIABLES constant (in `lib/types/database.ts`) drives the suggestion list

**Implementation pattern (Tiptap Suggestion utility):**
- `char: '/'` triggers the autocomplete popup
- `items` function returns filtered AVAILABLE_PLACEHOLDERS based on query
- `command` inserts a Mention node with `id: 'client_name'` and `label: 'Client Name'`
- Custom `renderHTML` renders pills as `<span data-placeholder="client_name" class="...">Client Name</span>`
- On save, `getJSON()` stores structured content; on send, `getHTML()` exports and a post-processor replaces placeholder spans with actual `{{variable}}` syntax for the existing `substituteVariables()` function

**Alternative considered:** Button/dropdown in toolbar for inserting placeholders. This works but is slower -- the user has to leave the keyboard, click the dropdown, find the variable, click it. Slash command keeps hands on keyboard. Recommend BOTH: slash command as primary, plus a toolbar button as discovery aid for first-time use.

**Confidence:** HIGH (Tiptap Suggestion utility documented, Mention extension customization verified)

---

### 3. Subject Line Input (Separate from Body)

| Aspect | Detail |
|--------|--------|
| **Feature** | Dedicated subject line input field with placeholder support |
| **Why expected** | Emails have subjects -- this already exists but needs placeholder insertion too |
| **Complexity** | Low |
| **Recommendation** | Keep as `<Input>` but add a small "Insert Variable" dropdown button next to it |
| **Dependencies** | None new (existing Input component) |

**Expected behaviors:**
- Subject line remains a single-line text input (not rich text -- email subjects are plain text)
- Small button beside the input opens a popover/dropdown to insert `{{variable}}` syntax
- Inserted variables appear as raw `{{client_name}}` text (no pills in single-line input)
- Slash command NOT needed here -- too complex for a single-line field

**Confidence:** HIGH (standard pattern, already partially exists)

---

### 4. Live Preview Pane

| Aspect | Detail |
|--------|--------|
| **Feature** | Side-by-side or toggle preview showing rendered email with sample data |
| **Why expected** | User cannot verify what client receives without seeing rendered output |
| **Complexity** | Medium |
| **Recommendation** | Side-by-side layout: editor left, preview right (desktop), toggle on mobile |
| **Dependencies** | Existing `substituteVariables()` function, existing react-email template |

**Expected behaviors:**
- Preview updates in near-real-time as user types (debounced ~500ms)
- Uses sample/dummy client data to fill placeholders (e.g., "ABC Ltd", "31 January 2026")
- Shows the email as it will be rendered, wrapped in the branded Peninsula Accounting email layout (header, footer)
- Preview should be inside an iframe or scoped container to prevent email styles from leaking into the app
- Optionally: dropdown to pick a real client for preview data (differentiator, not table stakes)

**Pipeline for preview:**
1. Editor content: Tiptap `getHTML()` produces raw HTML with placeholder spans
2. Post-process: Replace `<span data-placeholder="...">` with actual values from sample context
3. Wrap: Pass through the existing react-email `ReminderEmail` component layout
4. Render: Use `@react-email/render` to produce final HTML
5. Display: Render in an iframe with `srcdoc`

**Confidence:** HIGH (react-email render already works in codebase at `lib/email/sender.ts`)

---

### 5. Template Save and Load (JSON Storage)

| Aspect | Detail |
|--------|--------|
| **Feature** | Saving rich text template content and reloading it in the editor |
| **Why expected** | Templates must persist -- this already exists for plain text |
| **Complexity** | Low |
| **Recommendation** | Store Tiptap JSON in the `body` field of `TemplateStep` (change from plain string to JSON) |
| **Dependencies** | Schema migration for `steps` JSONB column format |

**Expected behaviors:**
- Save: `editor.getJSON()` stored in the template step's body field
- Load: `editor.commands.setContent(savedJSON)` restores editor state
- Migration: Existing plain-text bodies must be converted to Tiptap JSON format (wrap in paragraph nodes)
- Backward compatibility: Old plain-text bodies should still render if loaded

**Why JSON over HTML storage:**
- JSON preserves the exact editor state (placeholder nodes with metadata)
- JSON is easier to programmatically search/modify (e.g., "find all templates that use client_name")
- HTML export is done at send-time, not storage-time
- Tiptap docs explicitly recommend JSON for storage

**Confidence:** HIGH (Tiptap output docs verified)

---

### 6. Ad-Hoc Sending: Client Selection

| Aspect | Detail |
|--------|--------|
| **Feature** | Select one or more clients, pick a template, send immediately |
| **Why expected** | Core v1.1 feature -- the accountant needs to send one-off emails outside the automated schedule |
| **Complexity** | Medium-High |
| **Recommendation** | Wizard/stepper flow: Select Clients -> Pick Template -> Preview -> Confirm & Send |
| **Dependencies** | Existing client list, existing template list, existing email sender |

**Expected behaviors (step-by-step wizard):**

**Step 1: Select Clients**
- Searchable client list with checkboxes (reuse existing client table component patterns)
- Show client name, email, client type
- "Select All" / "Deselect All" for bulk operations
- Display count of selected clients
- Filter by client type (Limited Company, Sole Trader, etc.)

**Step 2: Pick Template**
- List of active templates with name, filing type, description
- Select a template, then select which step from that template to use
- Or: "Blank" option for a one-off custom email

**Step 3: Preview & Edit**
- Show the rendered email with one sample client's data
- Allow inline edits to subject and body (for this send only, not saved to template)
- Show recipient count: "This will be sent to N clients"
- If multiple clients selected, show a "Preview as:" dropdown to switch between different clients

**Step 4: Confirm & Send**
- Final confirmation: "Send [subject] to N clients?"
- Send button with loading state
- Results: show success/failure per client after sending
- Log all sends to the existing delivery log

**UX pattern source:** This wizard pattern is consistent across Adobe Campaign, ServiceMinder, Cochrane Editorial Manager, and eTrigue -- all verified via WebSearch. The 4-step wizard is the dominant pattern for ad-hoc email workflows.

**Confidence:** MEDIUM-HIGH (pattern well-established; implementation details are project-specific)

---

### 7. Ad-Hoc Sending: Confirmation and Delivery Feedback

| Aspect | Detail |
|--------|--------|
| **Feature** | Clear confirmation before send, and visible results after send |
| **Why expected** | Sending emails is a destructive action -- user MUST confirm before bulk send |
| **Complexity** | Low-Medium |
| **Recommendation** | Modal confirmation dialog, then toast notifications + results summary |
| **Dependencies** | Existing sonner toast, existing Postmark sender |

**Expected behaviors:**
- Confirmation dialog shows: recipient count, subject line, "Are you sure?"
- Send shows progress (sending 1/N, 2/N...)
- After completion: summary shows sent count, failed count
- Failed sends show error reason
- All sends logged to delivery log (existing audit_log table)
- User can navigate to delivery log to see full details

**Confidence:** HIGH (straightforward UX pattern)

---

### 8. Scheduling View (Upcoming Reminders)

| Aspect | Detail |
|--------|--------|
| **Feature** | Dedicated page showing all upcoming scheduled reminders |
| **Why expected** | User needs visibility into what will be sent and when |
| **Complexity** | Medium |
| **Recommendation** | List view (not calendar) as default, with sort/filter capabilities |
| **Dependencies** | Existing `reminder_queue` table with `scheduled` status entries |

**Expected behaviors:**
- Table/list showing: send date, client name, filing type, template name, step number, status
- Sort by date (default: nearest first)
- Filter by: date range, client, filing type, status
- Ability to cancel a specific scheduled reminder (set status to 'cancelled')
- Ability to reschedule (change send_date)
- Group by date for visual clarity ("Today", "This Week", "Next Week", etc.)

**Why list view over calendar:**
- The calendar already exists at `/calendar` showing filing deadlines
- A scheduling view is about operational management, not date visualization
- List view supports better filtering, searching, and bulk actions
- Calendar view is a differentiator (see below), not table stakes

**Confidence:** MEDIUM-HIGH (existing reminder_queue data model supports this directly)

---

## Differentiators

Features that set the product apart. Not expected, but add significant value.

### 1. Preview with Real Client Data

| Aspect | Detail |
|--------|--------|
| **Feature** | Dropdown to select a real client and preview the email with their actual data |
| **Value** | Catches errors in templates (e.g., missing data for a specific client) |
| **Complexity** | Low (once base preview exists) |
| **Notes** | Fetch client + filing data, build TemplateContext, render preview |

**Why differentiate over sample data only:**
- Sample data always works. Real data might expose edge cases (long names, missing fields)
- Builds confidence: "I can see exactly what John Smith will receive"

---

### 2. Calendar View for Scheduled Reminders

| Aspect | Detail |
|--------|--------|
| **Feature** | Calendar visualization of upcoming reminder sends |
| **Value** | Visual pattern recognition -- see if reminders cluster on certain dates |
| **Complexity** | Low (react-big-calendar already in project) |
| **Notes** | Reuse existing calendar component from `/calendar` page |

---

### 3. Duplicate Template Action

| Aspect | Detail |
|--------|--------|
| **Feature** | One-click duplicate of an existing template |
| **Value** | Faster template creation when making variations (e.g., same content, different filing type) |
| **Complexity** | Low |
| **Notes** | Copy all template data, rename to "[Original Name] (Copy)", redirect to edit |

---

### 4. Template Usage Statistics

| Aspect | Detail |
|--------|--------|
| **Feature** | Show how many times a template has been sent, last sent date |
| **Value** | Helps identify unused templates for cleanup |
| **Complexity** | Low |
| **Notes** | Query delivery log grouped by template_id |

---

### 5. Undo/Resend for Failed Emails

| Aspect | Detail |
|--------|--------|
| **Feature** | Retry sending for emails that failed delivery |
| **Value** | Recovers from transient Postmark errors without re-creating the send |
| **Complexity** | Medium |
| **Notes** | Only for `failed` status entries in delivery log |

---

### 6. Inline Link Insertion with Preview

| Aspect | Detail |
|--------|--------|
| **Feature** | Insert hyperlinks in the email body with a clean UI (not raw HTML) |
| **Value** | Link to HMRC payment pages, Companies House filings, etc. |
| **Complexity** | Low (Tiptap Link extension) |
| **Notes** | `@tiptap/extension-link` -- adds link mark to editor, provides URL input popup |

---

### 7. Dark/Light Mode Email Preview

| Aspect | Detail |
|--------|--------|
| **Feature** | Toggle to preview email in dark mode (as some email clients render it) |
| **Value** | Catches accessibility issues in dark mode email clients |
| **Complexity** | Medium |
| **Notes** | Apply dark mode CSS to preview iframe |

---

### 8. Template Search and Filtering

| Aspect | Detail |
|--------|--------|
| **Feature** | Search templates by name, description, or filing type |
| **Value** | Useful once template count grows beyond ~10 |
| **Complexity** | Low |
| **Notes** | Client-side search on the existing template list; add search input + filing type filter |

---

## Anti-Features

Features to explicitly NOT build. Common mistakes in this domain that waste time or create problems.

### 1. Full Drag-and-Drop Email Builder

| Anti-Feature | Building a visual email designer with drag-and-drop blocks, columns, images |
|--------------|-----------|
| **Why avoid** | Massive complexity (Unlayer, BeeFree-level effort). The user is a solo accountant sending text-based reminders with some bold text, not designing marketing newsletters. The existing react-email layout wrapper handles branding (header, footer, colors). The body content needs rich text, not visual design tools. |
| **What to do instead** | Rich text editor for body content within the fixed branded email layout wrapper |

### 2. Server-Side Postmark Templates

| Anti-Feature | Using Postmark's own template system instead of react-email |
|--------------|-----------|
| **Why avoid** | The project already has a working react-email pipeline (`lib/email/sender.ts`, `lib/email/templates/reminder.tsx`). Postmark templates use Mustachio syntax which is different from the existing `{{variable}}` system. Switching would require rewriting the entire email rendering pipeline for no user-facing benefit. |
| **What to do instead** | Keep using react-email for rendering, Postmark for delivery only |

### 3. Multiple Email Layout Templates

| Anti-Feature | Letting users choose between different email layouts/designs |
|--------------|-----------|
| **Why avoid** | Single-user system for one accounting practice. One branded layout is sufficient. Multiple layouts adds complexity with no value. |
| **What to do instead** | One hardcoded layout. If layout changes are needed, modify the react-email component directly. |

### 4. HTML Source Code Editing

| Anti-Feature | "View source" button to directly edit HTML in the email editor |
|--------------|-----------|
| **Why avoid** | User is non-technical. Raw HTML editing is confusing, error-prone, and can break email rendering. Tiptap's structured schema prevents invalid HTML by design. |
| **What to do instead** | WYSIWYG only. What you see is what the email contains. |

### 5. Complex Scheduling Rules Engine

| Anti-Feature | Cron-like scheduling, conditional send rules, time-of-day selection |
|--------------|-----------|
| **Why avoid** | The existing scheduler (`lib/reminders/scheduler.ts`) already handles automated reminders based on filing deadlines. It sends at 9am UK time daily. Adding complex scheduling rules creates edge cases, timezone bugs, and confusion. The ad-hoc sending feature covers "send now" needs. |
| **What to do instead** | Keep automated scheduling as-is (deadline-based). Ad-hoc sending covers everything else. |

### 6. Real-Time Collaborative Editing

| Anti-Feature | Multiple users editing the same template simultaneously |
|--------------|-----------|
| **Why avoid** | Single user system. Tiptap supports collaboration via Y.js but it's unnecessary complexity. |
| **What to do instead** | Single-user editor with normal save behavior |

### 7. Email Analytics Dashboard

| Anti-Feature | Open rates, click rates, engagement metrics |
|--------------|-----------|
| **Why avoid** | Postmark TrackOpens is already set to `false` in the codebase. These are filing reminders, not marketing emails. GDPR considerations for UK practice. Tracking adds no value -- the accountant cares whether the email was delivered, not whether it was opened. |
| **What to do instead** | Delivery status tracking (already exists via Postmark webhooks) |

### 8. Email Template Version History

| Anti-Feature | Full version control for templates with diff view and rollback |
|--------------|-----------|
| **Why avoid** | Overengineered for a solo practice with ~5-10 templates. The user edits templates infrequently. |
| **What to do instead** | Simple "last edited" timestamp (already exists via `updated_at`). If rollback is truly needed later, it's a v2.0 concern. |

---

## Feature Dependencies

```
Rich Text Editor (Tiptap)
  |
  +---> Placeholder Insertion (Tiptap Mention extension)
  |       |
  |       +---> Live Preview (needs HTML export + placeholder resolution)
  |       |       |
  |       |       +---> Preview with Real Client Data (extends base preview)
  |       |
  |       +---> Template Save/Load (JSON storage)
  |               |
  |               +---> Data migration (plain text -> Tiptap JSON)
  |
  +---> Subject Line Placeholder Button (independent of Tiptap body editor)

Ad-Hoc Sending (independent of editor, but uses templates)
  |
  +---> Client Selection UI
  |
  +---> Template/Step Selection
  |
  +---> Preview & Edit (depends on Live Preview above)
  |
  +---> Confirmation Dialog
  |
  +---> Send Execution (uses existing sendReminderEmail)
  |
  +---> Delivery Log Integration (existing delivery log)

Scheduling View (independent, reads existing reminder_queue)
  |
  +---> List View with Filters
  |
  +---> Cancel/Reschedule Actions
  |
  +---> Calendar View (differentiator, uses react-big-calendar)
```

---

## MVP Recommendation

For the v1.1 milestone, prioritize in this order:

### Must Ship (Phase 1 - Editor Foundation)
1. **Rich text editor with Tiptap** replacing textarea -- the core upgrade
2. **Placeholder slash command** with pill rendering -- the headline feature
3. **Template JSON storage** with migration from plain text -- enables everything else
4. **Subject line placeholder button** -- small but necessary

### Must Ship (Phase 2 - Preview & Sending)
5. **Live preview pane** with sample data -- validates the editor output
6. **Ad-hoc sending wizard** (all 4 steps) -- the second headline feature
7. **Scheduling list view** -- operational visibility

### Defer to Post-v1.1
- Preview with real client data (low complexity but not critical for launch)
- Calendar view for schedule (already have calendar page; this is nice-to-have)
- Template duplication (trivial to add later)
- Template usage stats (trivial to add later)
- Template search/filter (not needed until template count grows)
- Link insertion (add when users ask for it)

### Critical Technical Decision: HTML Email Pipeline

The Tiptap-to-email pipeline is the most architecturally significant piece:

1. **Editor** produces Tiptap JSON (stored in DB)
2. **Preview** calls `editor.getHTML()`, post-processes placeholder spans to values
3. **Send** calls `editor.getHTML()`, post-processes placeholder spans to `{{variable}}` syntax
4. Existing `substituteVariables()` resolves `{{variable}}` to actual values
5. Resulting HTML is injected into the react-email `ReminderEmail` component (replacing the current `body` prop)
6. `@react-email/render` produces final email-safe HTML with inline styles
7. Postmark sends it

**Key change:** The react-email template needs to accept `htmlBody` (rich HTML) instead of plain `body` text. The `whiteSpace: 'pre-wrap'` text rendering must be replaced with `dangerouslySetInnerHTML` or a dedicated HTML container component.

**Email safety consideration:** Tiptap produces clean, semantic HTML (p, strong, em, ul, ol, li, a). These tags all render well across email clients when wrapped in the react-email layout. No need for a separate HTML-to-email sanitizer for this limited tag set. However, limit the Tiptap extensions to email-safe formatting only (no images, tables, colors, or custom fonts in v1.1).

---

## Sources

### Verified (HIGH confidence)
- [Tiptap React Installation](https://tiptap.dev/docs/editor/getting-started/install/react) - Verified via WebFetch
- [Tiptap Suggestion Utility](https://tiptap.dev/docs/editor/api/utilities/suggestion) - Verified via WebFetch
- [Tiptap Mention Extension](https://tiptap.dev/docs/editor/extensions/nodes/mention) - Verified via WebFetch
- [Tiptap Content Export](https://tiptap.dev/docs/editor/guide/output) - Verified via WebFetch
- [Postmark Email API](https://postmarkapp.com/developer/user-guide/send-email-with-api) - From WebSearch
- Existing codebase: `lib/email/sender.ts`, `lib/email/templates/reminder.tsx`, `lib/templates/variables.ts`

### Referenced (MEDIUM confidence)
- [Tiptap GitHub Discussion #3185](https://github.com/ueberdosis/tiptap/discussions/3185) - Custom variable rendering patterns
- [React Email Render Utility](https://react.email/docs/utilities/render) - From WebSearch
- [10 Best React WYSIWYG Rich Text Editors 2026](https://reactscript.com/best-rich-text-editor/) - Ecosystem survey

### Pattern Sources (MEDIUM confidence)
- [Adobe Campaign Ad-Hoc Templates](https://experienceleague.adobe.com/docs/campaign-classic-learn/tutorials/sending-messages/using-delivery-templates/deploying-ad-hoc-email-delivery-template.html) - Ad-hoc workflow pattern
- [Cochrane Editorial Manager Ad-Hoc Emails](https://documentation.cochrane.org/emkb/emails/ad-hoc-emails) - Wizard pattern reference
- [ServiceMinder Ad-Hoc Email Templates](https://serviceminder.knowledgeowl.com/help/ad-hoc-email-templates) - Template selection pattern
