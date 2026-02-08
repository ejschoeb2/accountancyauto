# Domain Pitfalls

**Domain:** Email automation system -- rich text editor addition, schema migration, template/scheduling redesign
**Researched:** 2026-02-08
**Confidence:** HIGH (based on codebase analysis + verified research)

---

## Critical Pitfalls

Mistakes that cause data loss, security vulnerabilities, or broken production email delivery.

---

### Pitfall 1: Rich Text HTML Stored Unsanitized Reaches Email via `resolved_body`

**What goes wrong:** The current system stores `body` as plain text in the `steps` JSONB column of `reminder_templates`. The scheduler resolves variables with `substituteVariables()` and stores the result in `resolved_body` on `reminder_queue`. The email sender passes `resolved_body` directly to the React Email template as `{body}` with `whiteSpace: 'pre-wrap'`. When you switch to a rich text editor, the body will contain HTML instead of plain text. If that HTML is stored without sanitization, any content -- including script tags, event handlers, or malicious markup pasted from external sources -- flows straight through to the email.

**Why it happens:** The existing pipeline assumes plain text at every stage. There is no sanitization layer anywhere in the chain: `template editor -> steps JSONB -> queue builder -> variable substitution -> email sender -> React Email template -> Postmark`. Adding a rich text editor changes the contract of `body` from "plain text string" to "HTML string" but none of the downstream consumers know this.

**Consequences:**
- XSS risk if email clients render script content (some webmail clients do)
- Broken email rendering from unsupported HTML tags or attributes
- Stored XSS if the admin previews templates in the dashboard without sanitization
- HTML injection via paste from external sources (Word, websites) carrying invisible scripts or event handlers

**Prevention:**
1. Sanitize on save, not on render. When the template is saved via the API, run the HTML body through DOMPurify (or isomorphic-dompurify for server-side) with an email-safe allowlist before writing to the database. Never trust that the editor alone prevents dangerous content.
2. Define an explicit email-safe HTML subset: `<p>`, `<br>`, `<strong>`, `<em>`, `<u>`, `<ul>`, `<ol>`, `<li>`, `<a href>`, `<h1>`-`<h3>`, `<blockquote>`. Block everything else -- `<script>`, `<style>`, `<iframe>`, `<img>` (unless you specifically want images), all `on*` event attributes, `style` attributes (email clients handle these inconsistently anyway).
3. Configure the rich text editor (e.g., Tiptap) to only offer the allowed formatting options. Do not allow arbitrary HTML input mode.
4. Sanitize again on the server before inserting into `reminder_queue.resolved_body` as a defense-in-depth measure.

**Detection:** Test by pasting `<script>alert(1)</script>` and `<img src=x onerror=alert(1)>` into the editor, saving, and checking what ends up in the database and in sent emails.

**Which phase should address it:** The very first phase that introduces the rich text editor. This must be solved before any rich text content is saved to the database.

**Rollback/recovery:** If unsanitized HTML makes it to the database, you need a migration script that runs DOMPurify over all `body` fields in both `reminder_templates.steps` and the new template table. Audit `reminder_queue` entries with status `scheduled` or `pending` and re-resolve their bodies.

---

### Pitfall 2: JSONB `steps` Migration Loses Data or Leaves Orphaned References

**What goes wrong:** The current `reminder_templates` table stores steps as a JSONB array column (`steps JSONB NOT NULL DEFAULT '[]'`). The v1.1 redesign will split this into a normalized `template_steps` table (or similar). The migration must extract each step from every template's JSONB array, insert it as a row in the new table, and then update all references -- `client_template_overrides` references steps by `step_index` (an integer position in the JSONB array), and `reminder_queue` also stores `step_index` and `template_id`. If the migration fails partway through, you get templates with no steps, overrides pointing at non-existent steps, or queued reminders that reference the wrong template structure.

**Why it happens:** The migration touches four interconnected tables simultaneously:
- `reminder_templates` (source of JSONB steps)
- New `template_steps` or equivalent (destination)
- `client_template_overrides` (references `template_id` + `step_index`)
- `reminder_queue` (references `template_id` + `step_index`)

A partial failure in any of these leaves the system in an inconsistent state. Supabase migrations are single SQL files that run as transactions by default, but if you break the migration into multiple files or use application-level scripts, you lose atomicity.

**Consequences:**
- Data loss: steps exist in old JSONB but not in new table (or vice versa)
- Broken overrides: `client_template_overrides` references step indices that no longer correspond to the right step after normalization
- Broken queue: scheduled reminders reference old step indices in a new structure, causing wrong email content to be sent
- Impossible rollback: if you drop the JSONB column before verifying the new table is populated, the data is gone

**Prevention:**
1. Use a single SQL migration file wrapped in a transaction (Supabase migrations run as transactions by default -- verify this).
2. Follow a three-phase migration pattern:
   - **Phase A (additive):** Create new tables, copy data FROM JSONB using `jsonb_array_elements_text` or similar. Do NOT modify or drop old columns. Add new FK columns alongside old ones.
   - **Phase B (verify):** Run a verification query that checks row counts match (e.g., `SELECT COUNT(*) FROM template_steps` equals the total steps across all templates). This can be a CHECK constraint or an application-level assertion.
   - **Phase C (cleanup):** Only after verification passes, drop or deprecate old JSONB column. This should be a separate migration file run only after Phase B is confirmed.
3. Keep the old `steps` JSONB column for at least one release cycle. Mark it as deprecated. The new code reads from the new table; the old column is a backup.
4. Back up the database before running the migration. For Supabase, use `supabase db dump` or the dashboard backup feature.

**Detection:** After migration, run a reconciliation query:
```sql
-- Should return 0 rows if migration was complete
SELECT rt.id, jsonb_array_length(rt.steps) as jsonb_count,
       (SELECT COUNT(*) FROM template_steps ts WHERE ts.template_id = rt.id) as table_count
FROM reminder_templates rt
WHERE jsonb_array_length(rt.steps) !=
      (SELECT COUNT(*) FROM template_steps ts WHERE ts.template_id = rt.id);
```

**Which phase should address it:** The schema migration phase, which should be a dedicated phase before the UI changes. Never combine schema migration with feature development in the same phase.

**Rollback/recovery:** If Phase A fails, the transaction rolls back and nothing changes. If Phase B reveals mismatches, the old JSONB column still has all data -- drop the new table and retry. If Phase C was run prematurely, you need the database backup.

---

### Pitfall 3: Rich Text Body Breaks Email Rendering in Outlook and Older Clients

**What goes wrong:** The current React Email template renders the body with `whiteSpace: 'pre-wrap'` as plain text inside a `<Text>` component. When the body becomes HTML from the rich text editor, you cannot simply inject raw HTML into a React Email `<Text>` component -- React will escape it. But if you use `dangerouslySetInnerHTML` or render raw HTML, the CSS from the rich text editor (which uses classes, not inline styles) will be stripped by email clients. Outlook uses the Word rendering engine and ignores most CSS. Gmail strips `<style>` blocks. The result: rich text looks great in the editor but arrives as unstyled plain text (or worse, broken markup) in the client's inbox.

**Why it happens:** There are two rendering contexts with completely different rules:
1. **Browser (editor/preview):** Full CSS support, classes, external styles
2. **Email client:** Inline styles only, limited tag support, no `<style>` blocks in Gmail, Word engine in Outlook

The rich text editor produces HTML optimized for context 1. Email delivery requires context 2. Most developers forget this gap exists until testing with real email clients.

**Consequences:**
- Emails arrive with no formatting (just raw text with HTML tags visible in some clients)
- Layout breaks in Outlook (tables collapse, padding disappears, fonts revert)
- Links lose styling, lists render incorrectly
- The accountant sees a beautiful preview but clients receive garbage

**Prevention:**
1. Build an explicit "editor HTML to email HTML" conversion layer. This is NOT the same as sanitization. This converts rich text output into email-safe inline-styled HTML.
2. Use a library like `juice` to inline CSS styles. Or, better: since you already use React Email, build a mapping from each rich text node type to a React Email component with inline styles:
   - `<p>` -> `<Text style={{...}}>`
   - `<strong>` -> `<strong>` (universally supported)
   - `<a href>` -> `<Link>` from React Email
   - `<ul>/<ol>` -> Be careful -- list rendering is inconsistent in Outlook. Use table-based fallbacks or accept minor visual differences.
3. Stick to the "email-safe subset" of HTML tags: `<p>`, `<br>`, `<strong>`, `<em>`, `<u>`, `<a>`, `<ul>`, `<ol>`, `<li>`, `<h1>`-`<h3>`, `<blockquote>`. Avoid `<div>` (Outlook interprets it inconsistently), `<span>` with classes (classes get stripped), and any CSS that is not inline.
4. Generate a plain text version automatically from the HTML for the `TextBody` field in Postmark. The current system already sends `params.body` as `TextBody` -- this needs updating to strip HTML tags.
5. Test with Litmus or Email on Acid, or at minimum: Gmail (web), Outlook (desktop), Apple Mail, and one mobile client.

**Detection:** Send test emails from the preview to a real Gmail and Outlook account before shipping. If the formatting looks wrong, the conversion layer is broken or missing.

**Which phase should address it:** Same phase as the rich text editor introduction. The editor is useless without correct email rendering.

**Rollback/recovery:** If emails are being sent with broken formatting, the fix is in the conversion layer, not the data. Existing queued reminders with `resolved_body` containing raw editor HTML can be re-resolved by the scheduler.

---

### Pitfall 4: Template Variable Placeholders in Rich Text Get Corrupted by the Editor

**What goes wrong:** The current system uses `{{variable_name}}` placeholders (e.g., `{{client_name}}`, `{{deadline}}`). These are substituted by `substituteVariables()` using a regex: `/\{\{(\w+)\}\}/g`. When a rich text editor processes content, it may insert invisible HTML tags inside the placeholder text. For example, typing `{{client_name}}` might be stored as `{{client_<strong>name</strong>}}` or `{{client_name<br>}}` depending on editor behavior. The regex will no longer match, and the placeholder will be sent to the client as literal text: "Dear {{client_name}}".

**Why it happens:** Rich text editors (Tiptap, Quill, TinyMCE) operate on a document model where formatting can be applied at any character boundary. If the user selects part of a placeholder and bolds it, or if the editor auto-formats, or if a paste operation carries formatting, the placeholder string is broken across multiple DOM nodes and the serialized HTML contains tags within the placeholder.

**Consequences:**
- Clients receive emails with raw placeholder text ("Dear {{client_name}}, your {{filing_type}} is due...")
- The accountant does not notice because the editor preview may show the placeholder correctly (the DOM merges adjacent text nodes visually)
- This is a silent failure -- no error is thrown, the email still sends, but it looks unprofessional and confusing

**Prevention:**
1. Implement placeholders as atomic inline nodes in the editor (Tiptap calls these "node views"). A placeholder like `{{client_name}}` should be a single, indivisible node that cannot be partially formatted. Tiptap's node system supports this -- create a custom `Placeholder` node that renders as a styled pill/chip in the editor and serializes to `{{client_name}}` in the HTML output.
2. Use the planned slash-command insertion to create these nodes. Never let users type placeholders manually -- always insert them as atomic nodes via the slash-command UI.
3. Add a validation step on save that checks whether the serialized HTML contains any `{{...}}` patterns that are split across HTML tags. Reject the save if found.
4. As a fallback, add a pre-substitution step that strips HTML tags from within placeholder patterns before running the regex. For example: `html.replace(/<[^>]*>/g, '')` applied only to the region matching `\{\{[^}]*\}\}`. But this is fragile -- the atomic node approach is far better.
5. Add a warning in the variable substitution function when a placeholder is not matched, and surface this in the dashboard (e.g., "Template X contains unresolved placeholder").

**Detection:** After saving any template, preview the resolved output with test data. If any `{{...}}` text appears in the preview, placeholders are broken. Add this as an automated check.

**Which phase should address it:** The rich text editor phase. Placeholder handling must be designed alongside the editor, not retrofitted.

**Rollback/recovery:** If broken placeholders are already in the database, they need manual editing to fix. The atomic node approach prevents this from happening in the first place.

---

## Moderate Pitfalls

Mistakes that cause delays, user confusion, or technical debt requiring rework.

---

### Pitfall 5: Per-Client Template Override Precedence Becomes Ambiguous After Restructuring

**What goes wrong:** The current system has a clear override hierarchy: base template steps -> client_template_overrides (field-level merge via `resolveTemplateForClient()`). With the v1.1 redesign splitting templates from schedules, the override system becomes more complex. If a client has an override on a template's body, and the template is reassigned to a different schedule, or the template itself is updated, which version wins? The current `client_template_overrides` table references `template_id` + `step_index` + specific `overridden_fields`. If templates are now standalone and schedules reference them, the override might apply to the template globally or only when used in a specific schedule.

**Why it happens:** The v1.0 model is simple: one template per filing type, overrides per client per step. The v1.1 model introduces indirection: templates are standalone, schedules assign templates to timings, and the same template might be used in multiple schedules. The override system was not designed for this indirection.

**Prevention:**
1. Make a clear design decision early: overrides apply to the template, not the schedule. This means if a client has a custom body for "CT600 Reminder", that custom body applies everywhere the template is used, regardless of which schedule references it.
2. Document the precedence chain explicitly: `base template -> client template override -> (optional) per-schedule timing override`. If per-schedule overrides are not needed for v1.1, do not build the infrastructure for them.
3. Migrate `client_template_overrides` carefully -- the `template_id` FK still works if you keep the same template UUIDs. But if templates are recreated (new UUIDs) during the restructuring, all overrides become orphaned.
4. Preserve template UUIDs across the migration. The `reminder_templates.id` must not change.

**Detection:** After migration, query for orphaned overrides: `SELECT * FROM client_template_overrides WHERE template_id NOT IN (SELECT id FROM reminder_templates)`. This should return 0 rows.

**Which phase should address it:** The schema design phase, before any UI work begins.

**Rollback/recovery:** If overrides are orphaned, you need a mapping of old template UUIDs to new ones to reassign them.

---

### Pitfall 6: Plain Text Fallback Breaks When Body Becomes HTML

**What goes wrong:** The current email sender passes `params.body` as both `HtmlBody` (via React Email rendering) and `TextBody` (as-is, for plain text fallback). When `body` becomes HTML from the rich text editor, the `TextBody` will contain raw HTML tags instead of readable text. Email clients that display the plain text version (or accessibility tools / screen readers) will show `<p>Dear {{client_name}},</p><p>Your <strong>Corporation Tax</strong> return is due...</p>` instead of clean text.

**Why it happens:** The plain text path in `sender.ts` line 53 (`TextBody: params.body`) was written when body was always plain text. This implicit assumption is broken by the switch to rich text.

**Prevention:**
1. Add an HTML-to-plain-text conversion step. Strip all HTML tags, convert `<br>` and `</p>` to newlines, convert `<a href="url">text</a>` to `text (url)`, convert `<li>` to `- item`. Libraries like `html-to-text` (npm) handle this well.
2. Apply this conversion in `sendReminderEmail()` when constructing the Postmark payload.
3. Store the plain text version alongside the HTML in `reminder_queue.resolved_body` (add a `resolved_body_text` column) so you can inspect what was actually sent.

**Detection:** Send a test email and view "Show original" in Gmail to see the plain text MIME part. If it contains HTML tags, the conversion is missing.

**Which phase should address it:** Same phase as the email sender refactoring.

**Rollback/recovery:** No data loss -- just fix the conversion function and resend any affected emails.

---

### Pitfall 7: Migration Runs While Cron Is Active, Causing Queue Corruption

**What goes wrong:** The daily cron job (`/api/cron/reminders`) reads from `reminder_templates`, `client_template_overrides`, and writes to `reminder_queue`. If a schema migration runs while the cron is executing (or between the queue-building step and the email-sending step), the cron may read from the old schema structure, attempt to write to a modified table, or resolve template variables against steps that have been moved to a new table.

**Why it happens:** Supabase migrations run as ALTER TABLE statements that acquire ACCESS EXCLUSIVE locks. If the cron is mid-transaction querying `reminder_templates`, the migration will block. If the cron starts after the migration but the code expects the old schema, it will fail. There is no coordination mechanism between deployments and cron executions.

**Prevention:**
1. Disable the cron job before deploying schema migrations. On Vercel, you can do this by temporarily removing the cron configuration from `vercel.json` or setting a feature flag.
2. Deploy in this exact order: (a) disable cron, (b) run migration, (c) deploy new code that works with new schema, (d) re-enable cron.
3. Since this is a single-user app with cron running at specific times (8am and 9am UTC), schedule the migration deployment outside those windows.
4. The existing distributed lock (`locks` table) provides some protection -- if the cron acquires the lock before the migration, the migration will wait (or vice versa). But this is not reliable because the lock is application-level, not database-level.

**Detection:** If the cron fails after a migration, the error will appear in Vercel logs. Monitor the first cron execution after any deployment.

**Which phase should address it:** Every phase that includes a database migration. Include cron-disable/enable steps in the deployment checklist.

**Rollback/recovery:** If the cron corrupted queue data, identify affected `reminder_queue` rows by checking for `status = 'pending'` with NULL `resolved_body` or invalid `template_id` references. Cancel those entries and rebuild the queue with `rebuildQueueForClient()`.

---

### Pitfall 8: Editor Content Looks Different in Preview vs. Actual Email

**What goes wrong:** A "live preview" panel that renders the rich text HTML in a browser `<div>` will look very different from what arrives in an email inbox. The preview uses browser CSS rendering; the email uses the target client's renderer. Developers build the preview first, assume it is accurate, and skip email client testing. The accountant customizes a beautiful template in the preview, then clients receive a completely different-looking email.

**Why it happens:** There is no way to perfectly simulate email client rendering in a browser. Outlook uses Word's rendering engine. Gmail strips `<style>` tags and rewrites class names. Yahoo adds its own styles. The preview is inherently a lie unless it goes through the actual email rendering pipeline.

**Prevention:**
1. The preview should render through the same React Email template that produces the actual email HTML. Do NOT preview the raw editor HTML. Instead: editor HTML -> conversion to React Email components -> `render()` -> display the rendered HTML in an iframe. This way the preview shows what will actually be sent.
2. Add a "Send Test Email" button that sends the rendered email to the accountant's own address. This is the most reliable preview.
3. Clearly label the in-app preview as "approximate" and encourage test sends for important template changes.
4. Use an iframe for the preview (not a div) to prevent the dashboard's CSS from affecting the preview rendering.

**Detection:** Compare in-app preview with an actual received email. If they differ significantly, the preview pipeline is wrong.

**Which phase should address it:** The preview/editor phase. The preview pipeline should be built before or alongside the editor.

**Rollback/recovery:** No data impact -- this is a UI/UX issue. Fix the preview rendering pipeline.

---

### Pitfall 9: Slash-Command Insertion Creates Invalid HTML Structure

**What goes wrong:** Tiptap (or similar editors) slash-command menus insert nodes at the cursor position. If the cursor is inside a `<strong>` tag, a `<li>`, or a `<blockquote>`, the inserted placeholder node might end up nested inside an inappropriate parent. The serialized HTML could be `<strong>Some text {{<placeholder>client_name</placeholder>}}</strong>` or worse, block-level nodes inside inline elements. This produces invalid HTML that email clients render unpredictably.

**Why it happens:** Slash-command insertion does not always validate the document structure at the insertion point. The editor may allow inserting a block-level node inside an inline context, producing HTML that looks fine in ProseMirror's document model but serializes to invalid HTML.

**Prevention:**
1. Define the placeholder as an inline node in the Tiptap schema, not a block node. Inline nodes can be placed anywhere text can go.
2. Set the `group` property to `'inline'` and `inline: true` in the node spec.
3. Add a schema validation rule that prevents placeholders from being nested inside other inline formatting nodes (or explicitly allow it, since `<strong>{{client_name}}</strong>` is fine as long as the placeholder is atomic).
4. Test insertion at every possible cursor position: start of paragraph, middle of bold text, inside a list item, inside a blockquote.

**Detection:** After slash-command insertion, inspect the serialized HTML output of the editor. If placeholder markup is nested inside unexpected tags, the node definition is wrong.

**Which phase should address it:** The editor/placeholder implementation phase.

**Rollback/recovery:** No data loss -- fix the node schema definition. Existing templates may need re-editing if they contain invalid nesting.

---

## Minor Pitfalls

Mistakes that cause annoyance or minor rework but are recoverable.

---

### Pitfall 10: `date-fns` Format Tokens in Placeholder Output Conflict with Rich Text

**What goes wrong:** The `substituteVariables()` function uses `format(context.deadline, 'dd MMMM yyyy')` from date-fns. If the rich text body contains HTML entities or the variable substitution runs on HTML (not text), characters in variable values might need HTML encoding. For example, if a client name contains `<` or `&` (e.g., "Smith & Partners" or "A < B Ltd"), the substituted value will be injected as raw text into HTML, potentially breaking the markup or being interpreted as HTML.

**Prevention:**
1. HTML-encode variable values after substitution if the body is HTML. Run `value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')` on each substituted value.
2. Better: perform variable substitution BEFORE the HTML conversion step, while the content is still in the editor's intermediate format. Or substitute into the React Email component as React children (which auto-escapes).

**Which phase should address it:** The variable substitution refactoring, alongside the rich text conversion.

---

### Pitfall 11: Pasted Content from Word/Outlook Carries Invisible Formatting

**What goes wrong:** When the accountant pastes content from Microsoft Word or Outlook into the rich text editor, the clipboard contains complex HTML with Word-specific tags (`<o:p>`, `<w:wrap>`, `mso-` CSS properties, conditional comments like `<!--[if gte mso 9]>`). If the editor does not strip these on paste, the template body will contain hundreds of lines of invisible junk markup that inflates email size and causes unpredictable rendering.

**Prevention:**
1. Configure the editor's paste handler to strip all non-standard HTML on paste. Tiptap has built-in paste rules and you can configure `transformPastedHTML` to run DOMPurify with the email-safe allowlist.
2. Add a "Paste as plain text" keyboard shortcut (Ctrl+Shift+V) and document it for the user.
3. Test explicitly: copy formatted text from Word, paste it into the editor, then inspect the serialized HTML.

**Which phase should address it:** The editor configuration phase.

---

### Pitfall 12: New Scheduling UI Does Not Account for Already-Queued Reminders

**What goes wrong:** The v1.0 system has a queue-builder that creates `reminder_queue` entries based on template steps and deadlines. If the scheduling UI is changed (e.g., different delay_days, different template assignment), the already-queued entries with `status = 'scheduled'` are stale. If the system does not cancel and rebuild the queue when schedule changes are saved, clients will receive emails based on the old schedule.

**Why it happens:** The `rebuildQueueForClient()` function exists and deletes scheduled entries, but it is only called in specific code paths. If the new scheduling UI saves changes through a different API endpoint that does not trigger queue rebuilding, the queue goes stale.

**Prevention:**
1. Any API endpoint that modifies scheduling (template assignment, timing changes, override changes) MUST call `rebuildQueueForClient()` for all affected clients.
2. Add a "Rebuild All Queues" admin action as a safety net.
3. Add a visual indicator on the dashboard showing when the queue was last rebuilt, so the accountant can verify changes took effect.

**Which phase should address it:** The scheduling UI phase.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Severity | Mitigation |
|-------------|---------------|----------|------------|
| Rich text editor introduction | Unsanitized HTML in database (#1) | CRITICAL | Sanitize on save with DOMPurify email-safe allowlist |
| Rich text editor introduction | Placeholder corruption (#4) | CRITICAL | Implement placeholders as atomic Tiptap nodes, not typed text |
| Rich text editor introduction | Paste from Word junk (#11) | MINOR | Configure paste handler with DOMPurify strip |
| Email rendering pipeline | Editor HTML breaks in email clients (#3) | CRITICAL | Build editor-to-email conversion layer using React Email components |
| Email rendering pipeline | Plain text fallback contains HTML (#6) | MODERATE | Add html-to-text conversion in sender |
| Email rendering pipeline | Preview does not match actual email (#8) | MODERATE | Preview through React Email render pipeline, not raw HTML |
| Schema migration | JSONB to table data loss (#2) | CRITICAL | Three-phase migration: add, verify, cleanup. Keep old column. |
| Schema migration | Cron runs during migration (#7) | MODERATE | Disable cron before deploying migrations |
| Schema migration | Override precedence ambiguity (#5) | MODERATE | Decide and document precedence rules before coding |
| Scheduling UI | Stale queue entries (#12) | MINOR | Always rebuild queue on schedule changes |
| Variable substitution | HTML encoding of values (#10) | MINOR | HTML-encode substituted values or substitute in React context |
| Slash-command placeholders | Invalid HTML nesting (#9) | MODERATE | Define placeholder as inline Tiptap node |

---

## Deployment Order Implications

Based on pitfall analysis, the phases should be ordered to minimize risk:

1. **Schema migration first, in isolation.** Do not combine with UI changes. Verify data integrity before proceeding. This addresses #2, #5, and #7.
2. **Rich text editor + placeholder system together.** The editor cannot be shipped without the atomic placeholder node system (#4) and paste handling (#11). These are tightly coupled.
3. **Email rendering pipeline alongside or immediately after the editor.** The editor is useless without correct email rendering (#3, #6). The preview system (#8) should be built here too.
4. **Scheduling UI last.** It depends on the new schema being stable and the template system being complete. Queue rebuild (#12) is the main risk.

---

## Sources

- Codebase analysis: `lib/templates/variables.ts`, `lib/templates/inheritance.ts`, `lib/email/sender.ts`, `lib/email/templates/reminder.tsx`, `lib/reminders/scheduler.ts`, `lib/reminders/queue-builder.ts`, `supabase/migrations/20260207000002_create_phase2_schema.sql`
- [Syncfusion: XSS Prevention in React Rich Text Editor](https://www.syncfusion.com/blogs/post/react-rich-text-editor-xss-prevention)
- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [DOMPurify: Default Tags/Attributes Allowlist](https://github.com/cure53/DOMPurify/wiki/Default-TAGs-ATTRIBUTEs-allow-list-&-blocklist)
- [Campaign Monitor: CSS Support Guide for Email Clients](https://www.campaignmonitor.com/css/)
- [Designmodo: HTML and CSS in Emails 2026](https://designmodo.com/html-css-emails/)
- [Email on Acid: Gmail HTML Email Development](https://www.emailonacid.com/blog/article/email-development/12-things-you-must-know-when-developing-for-gmail-and-gmail-mobile-apps-2/)
- [Codegenes: CSS Padding Not Working in Outlook](https://www.codegenes.net/blog/css-padding-is-not-working-as-expected-in-outlook/)
- [Medium: HTML Injection in Email Templates](https://medium.com/@mahmoudmagdy45456/html-injection-in-email-template-98f9a77d98bb)
- [TinyMCE: Copy and Paste from Word](https://www.tiny.cloud/blog/under-pressure-powerpaste/)
- [Froala: Copy and Paste to WYSIWYG Editors](https://froala.com/blog/general/is-copy-and-paste-to-rich-text-wysiwyg-editors-problematic/)
- [Lexical: CSP Copy/Paste Bug](https://github.com/facebook/lexical/issues/4051)
- [Tech Buddies: Top 7 PostgreSQL Migration Mistakes](https://www.techbuddies.io/2025/12/14/top-7-postgresql-migration-mistakes-developers-regret-later/)
- [Dev.to: Zero-Downtime Database Migration Guide](https://dev.to/ari-ghosh/zero-downtime-database-migration-the-definitive-guide-5672)
- [Supabase: Database Migrations Docs](https://supabase.com/docs/guides/deployment/database-migrations)
