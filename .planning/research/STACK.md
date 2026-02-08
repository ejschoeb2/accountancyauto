# Technology Stack: v1.1 Template & Scheduling Redesign

**Project:** Peninsula Accounting Reminder System
**Researched:** 2026-02-08
**Scope:** Stack additions for rich text templates, scheduling decoupling, ad-hoc sending

## Current Stack (Validated, No Changes Needed)

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.1.6 | App Router, Server Actions, RSC |
| React | 19.2.3 | UI framework |
| Supabase | 2.95.3 | Postgres, Auth, RLS |
| Postmark | 4.0.5 | Email delivery |
| @react-email/components | 1.0.7 | Email template components |
| @react-email/render | 2.0.4 | React Email to HTML conversion |
| react-hook-form | 7.71.1 | Form state management |
| zod | 4.3.6 | Schema validation |
| date-fns | 4.1.0 | Date manipulation |
| react-big-calendar | 1.19.4 | Calendar visualization |
| @tanstack/react-table | 8.21.3 | Table UI |
| Tailwind CSS | 4.x | Styling |
| Radix UI | 1.4.3 | Headless UI primitives |

---

## Recommended Stack Additions

### 1. Rich Text Editor: TipTap 3.x

**Recommendation:** TipTap (headless, ProseMirror-based)

| Package | Version | Purpose |
|---------|---------|---------|
| `@tiptap/react` | ^3.19.0 | React bindings + core |
| `@tiptap/pm` | ^3.19.0 | ProseMirror peer dependencies |
| `@tiptap/starter-kit` | ^3.19.0 | Bold, italic, headings, lists, etc. |
| `@tiptap/extension-mention` | ^3.15.3 | Placeholder variable nodes (custom trigger) |
| `@tiptap/suggestion` | ^3.15.1 | Autocomplete popup engine (peer dep of mention) |
| `@tiptap/extension-link` | ^3.15.3 | Clickable links in emails |
| `@tiptap/extension-underline` | ^3.10.4 | Underline formatting (email-relevant) |
| `@tiptap/html` | ^3.15.3 | Server-side JSON-to-HTML (no DOM needed) |

**Total new dependencies:** 8 packages (all from same @tiptap org, same release cadence)

**Why TipTap over alternatives:**

| Criterion | TipTap | Lexical | Slate | Quill |
|-----------|--------|---------|-------|-------|
| Headless (no UI lock-in) | YES | YES | YES | NO |
| JSON output (DB-storable) | YES | YES | YES | Delta format |
| Server-side HTML render | YES (@tiptap/html) | Manual | Manual | NO |
| Suggestion/autocomplete | Built-in (@tiptap/suggestion) | Manual plugin | Manual plugin | NO |
| Mention-like nodes | First-party extension | Manual | Manual | NO |
| Extension ecosystem | 50+ official extensions | Growing | Minimal | Plugins |
| Documentation quality | Excellent | Overwhelming | Sparse | Good |
| React 19 compatibility | YES (core, since 2.10+/3.x) | YES | YES | Wrapper |
| Maturity | Stable (ProseMirror foundation) | No 1.0 yet | Stable but low-level | Mature but rigid |
| Bundle size | ~45KB core | Smaller | ~30KB | ~43KB |

**Key decision rationale:**
- TipTap's `@tiptap/extension-mention` + `@tiptap/suggestion` provides 80% of the slash-command/placeholder autocomplete we need out of the box. With Lexical or Slate, we'd build this from scratch.
- `@tiptap/html` provides server-side JSON-to-HTML without a DOM, which is critical for the email rendering pipeline. Lexical and Slate have no equivalent.
- The project already uses headless UI (Radix) + Tailwind -- TipTap's headless approach fits perfectly. We style the editor ourselves with existing design system tokens.

**React 19 compatibility status (HIGH confidence):**
- Core `@tiptap/react` supports React 19 -- confirmed via [GitHub discussion #5816](https://github.com/ueberdosis/tiptap/discussions/5816), fix merged in PR #5807 and released.
- TipTap's pre-built "UI Components" (paid tier) have lagging React 19 support, but we are NOT using those -- we build custom UI with Radix + Tailwind.
- The `immediatelyRender: false` option is required for Next.js App Router SSR compatibility.

**Confidence:** HIGH -- TipTap is the dominant headless rich text editor for React. Multiple authoritative sources confirm compatibility.

---

### 2. Email Rendering Pipeline

**Recommendation:** Keep React Email. Build a custom TipTap JSON-to-React-Email transformer.

**Architecture:**

```
Editor (client)          Server (send time)
     |                        |
TipTap JSON  --store-->  Supabase (jsonb column)
                              |
                         @tiptap/html (generateHTML)
                              |
                         Raw HTML string (with placeholder {{vars}} still present)
                              |
                         String replacement (resolve placeholders)
                              |
                         Wrap in React Email layout template
                              |
                         @react-email/render (final email HTML with inline styles)
                              |
                         Postmark send
```

**Why this approach:**
1. **Store TipTap JSON in Supabase** -- JSON is the canonical format. It's re-editable, version-safe, and decoupled from rendering.
2. **Use `@tiptap/html` server-side** -- The `generateHTML` export from `@tiptap/html` works without a DOM (unlike `@tiptap/core`'s version). Pass the same extensions list used by the editor.
3. **Keep React Email for the layout wrapper** -- The existing `ReminderEmail` component handles header, footer, branding, inline styles. The TipTap-generated HTML becomes the `body` content injected into this wrapper.
4. **Placeholder resolution stays as string replacement** -- The current `{{client_name}}` pattern works. Mention nodes render as `{{variable_name}}` in HTML output (configured via `renderHTML` on the custom mention extension). Server-side replacement happens after `generateHTML`.

**What NOT to do:**
- Do NOT use `@tiptap/static-renderer` -- it's designed for SSR/RSC rendering of content in pages, not email HTML generation. `@tiptap/html` is simpler and purpose-built.
- Do NOT use `juice` for CSS inlining -- React Email's `render()` already handles inline styles. Adding juice would be redundant.
- Do NOT convert TipTap JSON directly to React Email components at render time -- this is over-engineered. The HTML wrapper approach is simpler and the current `ReminderEmail` template already works.

**New packages needed:** None. `@tiptap/html` (already listed above) handles the server-side conversion. React Email is already in the project.

**Confidence:** HIGH -- The rendering pipeline uses only official TipTap and React Email capabilities documented on their respective sites.

---

### 3. Slash-Command Autocomplete for Placeholders

**Recommendation:** Custom implementation using `@tiptap/extension-mention` + `@tiptap/suggestion`. No additional packages needed.

**Approach:**

The `@tiptap/extension-mention` extension is designed exactly for this use case -- inline tokens that represent variables. We customize it:

1. **Custom trigger character:** Set `suggestion.char` to `/` for slash-command style, or use `{{` for direct placeholder insertion. Recommendation: use `/` as the trigger (Notion-style), which opens a dropdown of available placeholders.

2. **Items list:** Feed from the existing `PLACEHOLDER_VARIABLES` constant in `lib/types/database.ts` (already defined: `client_name`, `deadline`, `deadline_short`, `filing_type`, `days_until_deadline`, `accountant_name`).

3. **Rendering:** Configure `renderHTML()` on the Mention node to output `{{variable_name}}` so the server-side pipeline resolves them via string replacement (same as current system).

4. **Popup UI:** Build a custom Radix `Popover` or simple `div` positioned via the `render()` callback from `@tiptap/suggestion`. No need for `cmdk` or other command palette libraries -- the list is small (6 items) and static.

**What NOT to add:**
- `cmdk` -- overkill for 6 static items. A simple filtered list with keyboard navigation (which `@tiptap/suggestion` provides) is sufficient.
- `@harshtalks/slash-tiptap` or `tiptap-slash-react` -- community packages with low maintenance. The official `@tiptap/suggestion` utility is more reliable and already a dependency of `@tiptap/extension-mention`.

**Known issue:** Using `/` as the trigger character has a [reported edge case](https://github.com/ueberdosis/tiptap/issues/3335) where typing a URL with slashes can inadvertently trigger the suggestion popup. Mitigation: configure `allowedPrefixes` to require a space or line start before the `/`.

**Confidence:** HIGH -- `@tiptap/suggestion` is TipTap's official utility for this exact pattern, well-documented with full API for `char`, `items`, `command`, and `render`.

---

### 4. Live Preview

**Recommendation:** Client-side only, using TipTap's `editor.getHTML()` + React Email's static layout.

**Approach:**

```
TipTap editor (left pane)  -->  editor.getHTML()  -->  Preview pane (right pane)
                                                        |
                                                   Inject into static
                                                   email layout HTML
                                                        |
                                                   Render in <iframe> or
                                                   dangerouslySetInnerHTML
```

1. **On every editor change** (`onUpdate` callback), call `editor.getHTML()` to get HTML.
2. **Replace placeholder tokens** with sample data client-side (e.g., `{{client_name}}` becomes "Acme Ltd").
3. **Inject into a static HTML email template** that mirrors the React Email layout (header, footer, branding).
4. **Render in an iframe** for true email preview isolation (prevents CSS bleed from the app).

**Why iframe:** Email HTML uses inline styles and table-based layout. Rendering it inside the app's Tailwind context would cause style conflicts. An iframe isolates the email preview completely.

**New packages needed:** None. This uses `editor.getHTML()` (built into TipTap) and static HTML string construction.

**Debouncing:** Use a 300ms debounce on the `onUpdate` callback to avoid re-rendering preview on every keystroke. No need for a debounce library -- `setTimeout`/`clearTimeout` in a `useRef` is sufficient, or use `react-hook-form`'s `watch` with existing patterns.

**Confidence:** HIGH -- `editor.getHTML()` is a core TipTap API. The iframe approach is standard for email previews.

---

### 5. Scheduling UI Components

**Recommendation:** No new packages. Use existing `react-big-calendar` + Radix UI primitives.

**Rationale:**
- The project already has `react-big-calendar@1.19.4` for the deadline calendar page.
- The scheduling page needs: a list/table of schedule rules (template + timing pairs), a form to create/edit rules, and a timeline/calendar preview.
- `@tanstack/react-table` (already installed) handles the schedule rules table.
- `react-hook-form` + `zod` (already installed) handles the schedule form.
- Date/time inputs use native HTML inputs + `date-fns` for formatting.

**What NOT to add:**
- `react-day-picker` -- would be needed only for a fancy date picker widget. The scheduling UI deals with relative timing ("30 days before deadline"), not absolute date picking. Native `<input type="number">` for delay_days is sufficient (same pattern as current `template-step-editor.tsx`).
- `@fullcalendar/react` -- more powerful than `react-big-calendar` but much larger bundle. The existing calendar library is adequate.
- `cron` or `node-cron` -- the scheduling is deadline-relative, not cron-based. No cron expressions needed.

**Confidence:** HIGH -- this is a UI restructuring, not a technology addition. Existing components cover all needs.

---

### 6. Database Migration Utilities

**Recommendation:** Supabase SQL migrations only. No ORM, no migration framework.

**Approach:**
- Write a new Supabase migration file: `supabase/migrations/<timestamp>_v1.1_template_scheduling_schema.sql`
- The migration creates new tables (`email_templates`, `schedules`) and migrates data from the existing `reminder_templates.steps[]` JSONB array into the new normalized structure.
- Data migration is a one-time SQL script within the same migration file (INSERT...SELECT from old structure).

**Naming convention:** Must use `<timestamp>_name.sql` format (Supabase requirement -- files without timestamps are silently skipped, per project memory).

**What NOT to add:**
- `prisma` or `drizzle` -- the project uses Supabase client directly with TypeScript types. Adding an ORM for one migration is unjustified complexity.
- `supabase-migration-tools` or similar -- does not exist as a meaningful package. Raw SQL migrations are the Supabase way.
- `pg-migrate` or `node-pg-migrate` -- unnecessary when Supabase CLI handles migrations natively.

**Rollback strategy:** Include `-- rollback` comments in the migration with reverse SQL, but Supabase migrations are forward-only in practice. Test on a branch database first.

**Confidence:** HIGH -- the project already has 10 migration files following this exact pattern.

---

## Installation Command

```bash
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-mention @tiptap/suggestion @tiptap/extension-link @tiptap/extension-underline @tiptap/html
```

**Estimated bundle impact:** ~50-60KB gzipped (TipTap core + extensions). Client-side only -- `@tiptap/html` is used server-side and tree-shaken from client bundles.

---

## What NOT to Add (and Why)

| Library | Why Not |
|---------|---------|
| `lexical` | No built-in mention/suggestion system; no server-side HTML export utility. Would require 3x more custom code for same result. |
| `slate` | Lowest-level option. Maximum flexibility we don't need. No server-side rendering utility. |
| `quill` | Not headless. Opinionated UI conflicts with our Radix + Tailwind design system. Delta format not as portable as JSON. |
| `cmdk` | Overkill for 6-item placeholder list. TipTap suggestion handles keyboard nav natively. |
| `@tiptap/static-renderer` | Designed for SSR page rendering, not email HTML. `@tiptap/html` is the right tool. |
| `juice` | CSS inlining already handled by `@react-email/render`. Redundant. |
| `prisma` / `drizzle` | Project uses Supabase client. Adding ORM for one feature is scope creep. |
| `react-day-picker` | Scheduling uses relative days (delay_days), not absolute date picking. |
| `node-cron` | Scheduling is deadline-relative, not cron-based. |
| `@tiptap/extension-placeholder` | This is for ghost text ("Type something..."), NOT for template variable placeholders. Naming collision -- do not confuse. |

---

## Integration Points with Existing Code

### Template Step Editor Refactor

**Current:** `template-step-editor.tsx` uses `<Textarea>` for plain text body with `{{placeholder}}` hint in the placeholder attribute.

**New:** Replace `<Textarea>` with TipTap `<EditorContent>` component. The editor instance stores JSON. Form integration via `react-hook-form`'s `setValue`/`watch` -- on editor `onUpdate`, call `form.setValue('body_json', editor.getJSON())`.

### Email Sender Refactor

**Current:** `lib/email/sender.ts` passes `params.body` (plain text string) directly into the React Email template.

**New:** Add a `renderTemplateBody(bodyJson: object, variables: Record<string, string>): string` function that:
1. Calls `generateHTML(bodyJson, extensions)` from `@tiptap/html`
2. Runs string replacement for `{{variable}}` tokens
3. Returns HTML string

The existing `ReminderEmail` component receives this HTML string and renders it via `dangerouslySetInnerHTML` or a React Email `<Section>` with raw HTML.

### Database Schema Change

**Current:** `reminder_templates.steps[].body` is a plain text string inside a JSONB array.

**New:** `email_templates.body_json` is a JSONB column storing TipTap/ProseMirror JSON. The `body_html` can be optionally cached as a generated column or computed at send time.

Migration must convert existing plain text bodies to TipTap JSON format:
```json
{
  "type": "doc",
  "content": [
    {
      "type": "paragraph",
      "content": [
        { "type": "text", "text": "existing plain text body content" }
      ]
    }
  ]
}
```

This is a straightforward transformation -- wrap each line in a paragraph node.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| TipTap React 19 edge case | LOW | MEDIUM | Core React 19 support is confirmed. Only "UI Components" (paid, unused) have issues. Pin @tiptap/* versions together. |
| Email HTML rendering inconsistency | MEDIUM | LOW | TipTap generates clean semantic HTML. React Email wrapper handles inline styles. Test in Litmus/Email on Acid for key clients (Outlook, Gmail). |
| Mention node rendering in emails | LOW | MEDIUM | Configure `renderHTML` to output plain `{{var}}` text, not `<span>` wrappers. Verify with `@tiptap/html` output. |
| Migration data loss | LOW | HIGH | Run migration on branch database first. Include rollback SQL. Back up before running on production. |
| Bundle size increase | LOW | LOW | ~50-60KB gzipped. Acceptable for an admin tool with no public traffic. |

---

## Sources

### HIGH Confidence (Official Documentation)
- [TipTap React Installation](https://tiptap.dev/docs/editor/getting-started/install/react)
- [TipTap Next.js Setup](https://tiptap.dev/docs/editor/getting-started/install/nextjs)
- [TipTap Mention Extension](https://tiptap.dev/docs/editor/extensions/nodes/mention)
- [TipTap Suggestion Utility API](https://tiptap.dev/docs/editor/api/utilities/suggestion)
- [TipTap Static Renderer](https://tiptap.dev/docs/editor/api/utilities/static-renderer)
- [TipTap JSON/HTML Export](https://tiptap.dev/docs/guides/output-json-html)
- [TipTap HTML Utility](https://tiptap.dev/docs/editor/api/utilities/html)
- [TipTap Slash Commands (Experimental)](https://tiptap.dev/docs/examples/experiments/slash-commands)
- [React Email Render Utility](https://react.email/docs/utilities/render)
- [TipTap React 19 Support Discussion](https://github.com/ueberdosis/tiptap/discussions/5816)

### MEDIUM Confidence (npm, Verified Versions)
- [@tiptap/react 3.19.0](https://www.npmjs.com/package/@tiptap/react)
- [@tiptap/suggestion 3.15.1](https://www.npmjs.com/package/@tiptap/suggestion)
- [@tiptap/extension-mention 3.15.3](https://www.npmjs.com/package/@tiptap/extension-mention)
- [@tiptap/extension-link 3.15.3](https://www.npmjs.com/package/@tiptap/extension-link)
- [@tiptap/extension-underline 3.10.4](https://www.npmjs.com/package/@tiptap/extension-underline)
- [@tiptap/html 3.15.3](https://www.npmjs.com/package/@tiptap/html)

### MEDIUM Confidence (Community / Comparative)
- [Rich Text Editor Comparison (Liveblocks)](https://liveblocks.io/blog/which-rich-text-editor-framework-should-you-choose-in-2025)
- [Email Builder WYSIWYG (TipTap + React Email)](https://github.com/stefanraath3/email-builder-wysiwyg)
- [TipTap Slash Command Trigger Issue #3335](https://github.com/ueberdosis/tiptap/issues/3335)

### LOW Confidence (Unverified)
- TipTap UI Components React 19 compatibility claims -- conflicting sources. Core is confirmed working; UI Components status unclear. Not relevant since we don't use UI Components.
