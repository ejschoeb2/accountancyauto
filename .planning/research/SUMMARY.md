# Project Research Summary

**Project:** Peninsula Accounting v1.1 - Template & Scheduling Redesign
**Domain:** Email reminder system for UK accounting practice
**Researched:** 2026-02-08
**Confidence:** HIGH

## Executive Summary

This research covers three interconnected v1.1 improvements to an existing email reminder system: (1) adding a rich text editor with placeholder autocomplete to replace plain text templates, (2) decoupling email content from scheduling logic by restructuring the database schema, and (3) enabling ad-hoc email sending outside the automated reminder flow.

The recommended approach uses TipTap 3.x as the rich text editor with custom mention nodes for placeholder insertion, maintains React Email for the rendering pipeline, and normalizes the database by splitting the current `reminder_templates.steps` JSONB array into separate `email_templates`, `schedules`, and `schedule_steps` tables. This architecture enables template reuse, independent editing of content vs. timing, and ad-hoc sends while preserving the existing queue-building and email delivery infrastructure.

The highest risks are email rendering inconsistency (rich text HTML breaking in Outlook/Gmail), placeholder corruption (editor splitting `{{variable}}` syntax across HTML tags), and data loss during the JSONB-to-table migration. These are mitigated through: atomic placeholder nodes in TipTap, explicit email-safe HTML conversion via React Email components, and a three-phase migration strategy (add tables, verify data, cleanup old structure).

## Key Findings

### Recommended Stack

**No changes to existing stack.** The project already has Next.js 16, React 19, Supabase, Postmark, React Email, react-hook-form, zod, date-fns, react-big-calendar, and Radix UI — all are adequate for v1.1 features.

**Stack additions (8 packages, all TipTap ecosystem):**

- **@tiptap/react (3.19.0)**: Headless rich text editor — chosen over Lexical/Slate for first-party mention/suggestion system, server-side HTML export, and React 19 compatibility
- **@tiptap/pm (3.19.0)**: ProseMirror peer dependencies
- **@tiptap/starter-kit (3.19.0)**: Bold, italic, headings, lists
- **@tiptap/extension-mention (3.15.3)**: Atomic placeholder nodes with custom trigger
- **@tiptap/suggestion (3.15.1)**: Autocomplete popup engine
- **@tiptap/extension-link (3.15.3)**: Hyperlinks in email body
- **@tiptap/extension-underline (3.10.4)**: Underline formatting
- **@tiptap/html (3.15.3)**: Server-side JSON-to-HTML converter (no DOM needed)

**Why TipTap:** Headless architecture fits existing shadcn/Radix/Tailwind design system. Built-in mention/suggestion utilities handle 80% of slash-command autocomplete out of the box. Server-side HTML export via `@tiptap/html` works without a browser DOM, critical for email rendering pipeline. Lexical and Slate lack these first-party utilities.

**Bundle impact:** ~50-60KB gzipped, client-side only.

**Critical stack decisions verified:**
- React 19 compatibility: Confirmed via GitHub discussion #5816, fix in TipTap core (not UI Components, which are unused)
- Email rendering: Use `@tiptap/html.generateHTML()` server-side, wrap output in React Email layout, NOT `@tiptap/static-renderer` (wrong tool)
- No ORM: Continue using Supabase client directly, no Prisma/Drizzle for one migration

### Expected Features

**Must have (table stakes):**

1. **Rich text editor with toolbar** — Replaces `<Textarea>` for email body. Toolbar with bold, italic, underline, lists, links. Keyboard shortcuts. Copy-paste from Word/Outlook strips complex styles.
2. **Placeholder insertion via slash command** — Type `/` to trigger autocomplete dropdown of available variables (client_name, deadline, filing_type, etc.). Inserts styled pill badges (atomic nodes). Prevents manual typing of `{{placeholders}}`.
3. **Subject line input with placeholder button** — Single-line input (no rich text). Small dropdown button to insert `{{variable}}` syntax.
4. **Live preview pane** — Side-by-side editor/preview (desktop), toggle (mobile). Updates debounced ~500ms. Shows rendered email with sample data. Uses iframe to prevent style bleed.
5. **Template save and load (JSON storage)** — Store TipTap JSON in database, reload via `editor.commands.setContent()`. Migrate existing plain text to TipTap JSON (wrap in paragraph nodes).
6. **Ad-hoc sending: client selection** — 4-step wizard: (1) Select clients (searchable checkboxes), (2) Pick template/step, (3) Preview & edit, (4) Confirm & send. Logs to delivery log.
7. **Ad-hoc sending: confirmation and feedback** — Modal confirmation before bulk send. Progress indicator. Results summary (sent/failed counts). Error reasons visible.
8. **Scheduling view (upcoming reminders)** — List/table of scheduled sends (send date, client, template, status). Sort/filter. Cancel/reschedule actions.

**Should have (differentiators):**

- Preview with real client data (dropdown to select actual client, not just sample data)
- Calendar view for scheduled reminders (reuse existing react-big-calendar)
- Duplicate template action (one-click copy with rename)
- Template usage statistics (send count, last sent date)
- Retry for failed emails (resend `failed` status entries)
- Inline link insertion with preview (TipTap Link extension)
- Dark/light mode email preview toggle
- Template search and filtering (by name, filing type)

**Defer (v2+):**

- Full drag-and-drop email builder (Unlayer/BeeFree-level)
- Server-side Postmark templates (current React Email pipeline works)
- Multiple email layout templates (single-user, one brand)
- HTML source code editing (non-technical user)
- Complex scheduling rules engine (existing deadline-based logic sufficient)
- Real-time collaborative editing (single user)
- Email analytics (open/click tracking — privacy concern, no value)
- Template version history (infrequent edits, overkill)

### Architecture Approach

The current `reminder_templates` table conflates two concerns: email content (subject/body) and scheduling logic (delay_days). These change independently — wording changes at a different pace than timing. The v1.1 redesign separates them through normalized tables.

**Major components:**

1. **email_templates** — Standalone reusable email content (subject, body_json, category). Referenced by schedules and ad-hoc sends. Content overrides apply here.
2. **schedules** — Container for a filing-type-specific reminder sequence. One active schedule per filing type (matches current constraint).
3. **schedule_steps** — Join between schedules and email templates with timing (step_number, delay_days). One-to-many from email_templates.
4. **ad_hoc_sends** — One-off email sends outside scheduled flow. Stores resolved subject/body snapshot at send time. Recipient_client_ids as UUID array.
5. **client_email_overrides** (replaces client_template_overrides) — Per-client content overrides, keyed to email_template_id.
6. **client_schedule_overrides** (new) — Per-client timing overrides, keyed to schedule_step_id.
7. **reminder_queue** (modified) — Replace template_id + step_index with schedule_step_id reference.

**Key pattern: Composition over embedding.** Email templates are standalone entities referenced by ID, not JSON blobs embedded in parents. Enables reuse, independent editing, cleaner override boundaries.

**Migration strategy:**

- **Phase A (additive):** Create new tables, copy data from JSONB using SQL. Add `schedule_step_id` column to reminder_queue. Do NOT modify or drop old columns.
- **Phase B (verify):** Reconciliation query checks row counts match. Dual-write period (1-2 weeks): write to both old and new tables.
- **Phase C (cleanup):** Drop old tables/columns only after verification passes and one release cycle completes.

**Impact on codebase:**

- HIGH complexity: `lib/reminders/queue-builder.ts` (read from schedules + schedule_steps instead of reminder_templates.steps)
- MEDIUM complexity: `lib/reminders/scheduler.ts` (resolve content from email_templates via schedule_step_id), template CRUD API, override API split
- LOW complexity: Type definitions, validation schemas, template list UI

### Critical Pitfalls

1. **Rich text HTML stored unsanitized reaches email via resolved_body** — Prevention: Sanitize on save (DOMPurify with email-safe allowlist: p, br, strong, em, u, ul, ol, li, a, h1-h3, blockquote). Block script, style, iframe, img, on* event attributes. Configure TipTap to only offer allowed formatting. Sanitize again before inserting into reminder_queue. Test with `<script>alert(1)</script>` paste.

2. **JSONB steps migration loses data or leaves orphaned references** — Prevention: Three-phase migration in single SQL transaction. Keep old JSONB column for one release cycle. Verify row counts match before dropping. Back up database before migration. Reconciliation query: `SELECT COUNT(*) FROM template_steps` equals total steps across all templates. Preserve template UUIDs to avoid orphaning client_template_overrides.

3. **Rich text body breaks email rendering in Outlook and older clients** — Prevention: Build explicit "editor HTML to email HTML" conversion layer. Use React Email components with inline styles, NOT raw TipTap HTML. Email-safe subset only (no div, span with classes, external styles). Generate plain text version with `html-to-text` for TextBody field. Test with Gmail, Outlook desktop, Apple Mail. Use iframe for preview isolation.

4. **Template variable placeholders in rich text get corrupted by editor** — Prevention: Implement placeholders as atomic inline nodes (TipTap node views). Custom `Placeholder` node renders as pill in editor, serializes to `{{client_name}}` in HTML. Never let users type placeholders manually — always insert via slash-command. Add validation on save rejecting split placeholders. Add warning when substituteVariables() finds unmatched patterns.

5. **Per-client template override precedence becomes ambiguous after restructuring** — Prevention: Decide early: overrides apply to email_template globally, not per-schedule. Precedence chain: base template → client_email_override → client_schedule_override (timing only). Preserve template UUIDs across migration to avoid orphaning overrides.

## Implications for Roadmap

Based on research, the safest phase structure addresses migration risks before UI work and builds rendering pipeline before editor features.

### Phase 1: Schema Migration & Data Integrity

**Rationale:** Database restructuring is the highest-risk change and must be validated before any UI work. Separating this phase allows verification before building features that depend on the new schema.

**Delivers:**
- New tables: email_templates, schedules, schedule_steps, ad_hoc_sends, client_email_overrides, client_schedule_overrides
- Migration script: JSONB steps → normalized tables
- schedule_step_id column on reminder_queue
- Data verification query (row count reconciliation)
- Old tables retained for rollback

**Addresses:**
- Pitfall #2 (migration data loss)
- Pitfall #5 (override precedence ambiguity)

**Avoids:**
- Combining schema changes with feature development
- Cron corruption (Pitfall #7: disable cron before deployment)

**Dependencies:** None (foundational)

**Research flag:** Standard Supabase migration pattern, well-documented. No phase-specific research needed.

---

### Phase 2: Rich Text Editor Foundation

**Rationale:** The editor is the most user-visible change and requires atomic placeholder implementation before any content can be created. Must come before ad-hoc sending (which needs templates to send).

**Delivers:**
- TipTap editor replacing `<Textarea>` in template step editor
- Toolbar (bold, italic, underline, lists, links)
- Atomic placeholder nodes (custom Mention extension)
- Slash-command autocomplete (TipTap Suggestion utility)
- JSON storage in email_templates.body_json
- Paste handler (strips Word junk with DOMPurify)

**Addresses:**
- Table stakes: rich text editor, placeholder insertion, template save/load
- Pitfall #1 (unsanitized HTML): DOMPurify on save
- Pitfall #4 (placeholder corruption): atomic nodes
- Pitfall #11 (Word paste junk): transformPastedHTML configuration

**Uses:**
- @tiptap/react, @tiptap/starter-kit, @tiptap/extension-mention, @tiptap/suggestion

**Dependencies:** Phase 1 (email_templates table must exist)

**Research flag:** Needs research on TipTap node configuration and mention extension customization. Placeholder node rendering logic is project-specific.

---

### Phase 3: Email Rendering Pipeline

**Rationale:** The editor is useless without correct email rendering. This phase converts TipTap JSON to email-safe HTML and ensures consistency between preview and actual sent emails.

**Delivers:**
- Server-side TipTap JSON → HTML conversion (@tiptap/html.generateHTML)
- HTML-to-plain-text for TextBody field (html-to-text library)
- React Email wrapper refactor (dangerouslySetInnerHTML or HTML container)
- Live preview pane (side-by-side, iframe-based)
- Preview uses same React Email pipeline as send
- Email-safe HTML subset enforcement

**Addresses:**
- Table stakes: live preview pane
- Pitfall #3 (email rendering breaks): React Email conversion layer
- Pitfall #6 (plain text fallback contains HTML): html-to-text
- Pitfall #8 (preview differs from email): preview through React Email render
- Pitfall #10 (variable HTML encoding): HTML-encode substituted values

**Uses:**
- @tiptap/html, existing React Email components, html-to-text

**Dependencies:** Phase 2 (TipTap editor must produce JSON)

**Research flag:** Standard pattern, no research needed. React Email integration is straightforward.

---

### Phase 4: Schedule Management UI

**Rationale:** Decoupling templates from schedules enables reuse but requires new UI for managing schedule → template assignments and timing.

**Delivers:**
- Schedule list page (/schedules)
- Schedule editor (assign email templates to steps, set delay_days)
- Subject line placeholder button (separate from TipTap body editor)
- Template list page refactor (list email_templates, not reminder_templates)
- Override UI split (content overrides vs. timing overrides)

**Addresses:**
- Table stakes: subject line placeholder input
- Pitfall #12 (stale queue): rebuildQueueForClient() on schedule changes

**Uses:**
- Existing react-hook-form, zod, Radix UI primitives

**Dependencies:** Phase 1 (schedules table), Phase 2 (email templates exist)

**Research flag:** Standard CRUD UI. No research needed.

---

### Phase 5: Ad-Hoc Sending

**Rationale:** Depends on email templates and rendering pipeline being stable. 4-step wizard is self-contained and can be built after core infrastructure is complete.

**Delivers:**
- 4-step wizard UI (select clients, pick template, preview, send)
- ad_hoc_sends table integration
- Send confirmation dialog
- Progress indicator and results summary
- Delivery log integration (existing email_log)

**Addresses:**
- Table stakes: ad-hoc sending wizard, confirmation/feedback

**Uses:**
- Existing sendReminderEmail(), client table component patterns, sonner toast

**Dependencies:** Phase 2 (templates), Phase 3 (rendering pipeline)

**Research flag:** Wizard pattern is well-documented (Adobe Campaign, ServiceMinder, Cochrane Editorial Manager). No research needed.

---

### Phase 6: Queue Builder Migration

**Rationale:** Highest-risk code change, saved for last. Rewrites queue-builder.ts and scheduler.ts to read from new tables. Requires all UI to be stable before cutover.

**Delivers:**
- queue-builder.ts refactor (read from schedules + schedule_steps + email_templates)
- scheduler.ts refactor (resolve content via schedule_step_id)
- Override resolution split (content vs. timing)
- Feature flag approach (USE_NEW_SCHEDULES env var)
- Data validation function (compare old vs. new queue output)

**Addresses:**
- Pitfall #7 (cron during migration): disable cron, deploy sequentially
- Pitfall #5 (override precedence): simplified resolution with split tables

**Dependencies:** All previous phases (new schema stable, UI complete)

**Research flag:** High complexity but codebase-specific. No external research needed.

---

### Phase 7: Differentiators & Polish

**Rationale:** Nice-to-have features that add value without blocking core functionality.

**Delivers:**
- Preview with real client data (dropdown selector)
- Calendar view for scheduled reminders (reuse react-big-calendar)
- Duplicate template action
- Template usage statistics
- Retry for failed emails
- Template search/filter

**Addresses:**
- Differentiators from FEATURES.md

**Dependencies:** All core phases complete

**Research flag:** No research needed. Standard patterns.

---

### Phase Ordering Rationale

**Why schema migration first:**
- Pitfall #2 demands isolated testing before UI builds on new tables
- Allows rollback without losing feature work
- Avoids Pitfall #7 (cron corruption) through controlled deployment

**Why editor before rendering:**
- Pitfall #4 (placeholder corruption) must be solved in editor design, not retrofitted
- But editor cannot ship without rendering (Pitfall #3, #8)
- Phases 2-3 are tightly coupled, could be combined if timeline allows

**Why queue builder last:**
- Highest-risk code change
- Benefits from stable schema and UI before rewriting core business logic
- Feature flag allows gradual rollout

**Why ad-hoc sending before queue builder:**
- Ad-hoc sending is user-facing, queue builder is backend
- Allows user to test template system end-to-end before queue cutover
- De-risks queue builder by validating rendering pipeline first

### Research Flags

**Phases needing deeper research during planning:**

- **Phase 2 (Editor Foundation):** TipTap mention node customization, slash-command popup positioning, renderHTML configuration for placeholder serialization
- **Phase 6 (Queue Builder Migration):** Override resolution logic with split tables, dual-write implementation details

**Phases with standard patterns (skip research-phase):**

- **Phase 1:** Supabase SQL migrations, JSONB extraction
- **Phase 3:** React Email integration, html-to-text
- **Phase 4:** CRUD UI with react-hook-form + zod
- **Phase 5:** Wizard UI pattern, well-documented
- **Phase 7:** All differentiators use existing patterns

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | TipTap React 19 compatibility confirmed via GitHub. All packages verified on npm. React Email pipeline already working in codebase. |
| Features | MEDIUM-HIGH | Table stakes and differentiators verified across multiple email automation products. Wizard pattern consistent across Adobe Campaign, ServiceMinder, Cochrane Editorial Manager. |
| Architecture | HIGH | Based on direct codebase analysis, not external sources. Schema design follows normalization principles. Migration strategy matches Supabase best practices. |
| Pitfalls | HIGH | HTML sanitization, email rendering, placeholder corruption, migration data loss all verified via official docs (DOMPurify, Campaign Monitor CSS guide, TipTap docs, Supabase migration docs). |

**Overall confidence:** HIGH

### Gaps to Address

**Rich text editor configuration:**
- TipTap mention node `renderHTML` configuration needs testing to confirm `{{variable}}` serialization works correctly
- Paste handler DOMPurify allowlist needs validation with actual Word/Outlook paste content
- Handle during Phase 2 planning: build minimal POC of placeholder node before full implementation

**Email client rendering:**
- React Email inline style conversion for TipTap HTML output needs testing in Outlook desktop (Word engine)
- Gmail `<style>` tag stripping may affect list rendering
- Handle during Phase 3: test with Litmus or Email on Acid before shipping

**Migration data integrity:**
- `client_template_overrides` migration when splitting overridden_fields JSONB into two tables (content vs. timing)
- Some overrides may have both fields — needs careful splitting logic
- Handle during Phase 1: write reconciliation query that validates all override fields preserved

**Queue builder dual-write:**
- Complexity of maintaining both old and new data paths during cutover
- Risk of divergence between old and new queue outputs
- Handle during Phase 6: automated comparison tool that asserts queue equality before cutover

## Sources

### Primary (HIGH confidence)

- Codebase analysis: `lib/reminders/queue-builder.ts`, `lib/reminders/scheduler.ts`, `lib/templates/inheritance.ts`, `lib/email/sender.ts`, `lib/email/templates/reminder.tsx`, `supabase/migrations/20260207000002_create_phase2_schema.sql`
- [TipTap React Installation](https://tiptap.dev/docs/editor/getting-started/install/react)
- [TipTap Next.js Setup](https://tiptap.dev/docs/editor/getting-started/install/nextjs)
- [TipTap Mention Extension](https://tiptap.dev/docs/editor/extensions/nodes/mention)
- [TipTap Suggestion Utility API](https://tiptap.dev/docs/editor/api/utilities/suggestion)
- [TipTap JSON/HTML Export](https://tiptap.dev/docs/guides/output-json-html)
- [TipTap HTML Utility](https://tiptap.dev/docs/editor/api/utilities/html)
- [React Email Render Utility](https://react.email/docs/utilities/render)
- [TipTap React 19 Support Discussion](https://github.com/ueberdosis/tiptap/discussions/5816)
- [Supabase Database Migrations](https://supabase.com/docs/guides/deployment/database-migrations)
- [DOMPurify Default Allowlist](https://github.com/cure53/DOMPurify/wiki/Default-TAGs-ATTRIBUTEs-allow-list-&-blocklist)

### Secondary (MEDIUM confidence)

- [Campaign Monitor CSS Support Guide](https://www.campaignmonitor.com/css/)
- [Email on Acid: Gmail HTML Development](https://www.emailonacid.com/blog/article/email-development/12-things-you-must-know-when-developing-for-gmail-and-gmail-mobile-apps-2/)
- [Adobe Campaign Ad-Hoc Templates](https://experienceleague.adobe.com/docs/campaign-classic-learn/tutorials/sending-messages/using-delivery-templates/deploying-ad-hoc-email-delivery-template.html)
- [Cochrane Editorial Manager Ad-Hoc Emails](https://documentation.cochrane.org/emkb/emails/ad-hoc-emails)
- [Rich Text Editor Comparison (Liveblocks)](https://liveblocks.io/blog/which-rich-text-editor-framework-should-you-choose-in-2025)
- [Syncfusion: XSS Prevention in React Rich Text Editor](https://www.syncfusion.com/blogs/post/react-rich-text-editor-xss-prevention)
- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [Dev.to: Zero-Downtime Database Migration Guide](https://dev.to/ari-ghosh/zero-downtime-database-migration-the-definitive-guide-5672)

### Tertiary (LOW confidence)

- [TinyMCE: Copy and Paste from Word](https://www.tiny.cloud/blog/under-pressure-powerpaste/) - Word paste behavior patterns
- [Froala: Copy and Paste to WYSIWYG Editors](https://froala.com/blog/general/is-copy-and-paste-to-rich-text-wysiwyg-editors-problematic/) - Paste sanitization patterns

---
*Research completed: 2026-02-08*
*Ready for roadmap: yes*
