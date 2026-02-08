# Requirements: Peninsula Accounting v1.1

**Defined:** 2026-02-08
**Core Value:** Automate the hours accountants spend manually chasing clients for records and documents, while keeping the accountant in full control of messaging and timing.

## v1.1 Requirements

Requirements for Template & Scheduling Redesign milestone.

### Rich Text Editor

- [ ] **EDIT-01**: User can compose email body with rich text toolbar (bold, italic, underline, lists, links)
- [ ] **EDIT-02**: User can insert placeholder variables via slash command (type `/` triggers autocomplete dropdown)
- [ ] **EDIT-03**: Placeholders render as styled pills in editor (atomic nodes, cannot be split)
- [ ] **EDIT-04**: User can paste content from Word/Outlook without complex styles breaking layout
- [ ] **EDIT-05**: Editor sanitizes HTML on save to prevent XSS (blocks script, style, iframe tags)

### Template Management

- [ ] **TMPL-01**: User can create standalone email template with name, subject, and rich text body
- [ ] **TMPL-02**: User can insert placeholders in subject line via button dropdown
- [ ] **TMPL-03**: Template body is stored as TipTap JSON in database
- [ ] **TMPL-04**: User can edit existing template and changes load correctly in editor
- [ ] **TMPL-05**: User can view list of all email templates

### Email Rendering

- [ ] **RNDR-01**: User sees live preview pane updating as they type in editor
- [ ] **RNDR-02**: Preview displays email with sample client data filling placeholders
- [ ] **RNDR-03**: User can select real client from dropdown to preview with actual data
- [ ] **RNDR-04**: TipTap JSON is converted to email-safe HTML via React Email pipeline
- [ ] **RNDR-05**: Sent emails render correctly in Gmail, Outlook, and Apple Mail

### Scheduling System

- [ ] **SCHD-01**: User can create schedule for a filing type
- [ ] **SCHD-02**: User can add multiple steps to schedule (each step = template + timing + urgency)
- [ ] **SCHD-03**: User can specify delay in days before deadline for each step
- [ ] **SCHD-04**: User can assign email template to each schedule step from template list
- [ ] **SCHD-05**: User can reorder schedule steps
- [ ] **SCHD-06**: User can view list of all schedules with their filing types
- [ ] **SCHD-07**: User can edit schedule (add/remove/reorder steps)
- [ ] **SCHD-08**: One template can be used in multiple schedule steps
- [ ] **SCHD-09**: User can cancel individual scheduled reminder from schedule view
- [ ] **SCHD-10**: User can reschedule individual reminder to different date

### Per-Client Overrides

- [ ] **OVRD-01**: User can override email template content for specific client
- [ ] **OVRD-02**: User can override schedule timing for specific client
- [ ] **OVRD-03**: Content overrides apply to template globally (all uses of that template)
- [ ] **OVRD-04**: Timing overrides apply to specific schedule step for that client
- [ ] **OVRD-05**: Override precedence is clear: base template -> client content override -> client timing override

### Ad-Hoc Sending

- [ ] **ADHC-01**: User can start ad-hoc send wizard from main navigation
- [ ] **ADHC-02**: Step 1: User can select multiple clients via searchable checkbox list
- [ ] **ADHC-03**: Step 2: User can pick email template from list
- [ ] **ADHC-04**: Step 3: User can preview email with selected clients' data
- [ ] **ADHC-05**: Step 3: User can edit subject and body before sending
- [ ] **ADHC-06**: Step 4: User sees confirmation modal with send count before final send
- [ ] **ADHC-07**: User sees progress indicator during bulk send
- [ ] **ADHC-08**: User sees results summary (sent/failed counts) after send completes
- [ ] **ADHC-09**: Ad-hoc sends appear in delivery log with "ad-hoc" type indicator

### Data Migration

- [ ] **MIGR-01**: Existing reminder_templates automatically convert to email_templates + schedules
- [ ] **MIGR-02**: Each step in reminder_templates.steps becomes a schedule_step entry
- [ ] **MIGR-03**: Plain text template bodies convert to TipTap JSON (wrapped in paragraph nodes)
- [ ] **MIGR-04**: Existing client_template_overrides split into content overrides and timing overrides
- [ ] **MIGR-05**: Migration preserves template UUIDs to avoid orphaning overrides
- [ ] **MIGR-06**: Data verification query confirms row counts match after migration
- [ ] **MIGR-07**: Old tables retained for one release cycle to allow rollback

### Queue Integration

- [ ] **QUEU-01**: Queue builder reads from new schedules + schedule_steps tables
- [ ] **QUEU-02**: Queue builder resolves email content from email_templates via schedule_step_id
- [ ] **QUEU-03**: Queue builder applies content and timing overrides in correct precedence order
- [ ] **QUEU-04**: Existing reminder queue continues to function during migration (no disruption)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Template Organization

- **DISC-01**: User can duplicate template with one-click copy action
- **DISC-02**: User can search templates by name or content
- **DISC-03**: User can filter templates by category or filing type
- **DISC-04**: User can view template usage statistics (send count, last sent date)

### Email Enhancements

- **EMAL-01**: System generates plain text fallback for all emails automatically
- **EMAL-02**: User can view email preview in multiple email clients (Litmus integration)
- **EMAL-03**: User can retry failed ad-hoc sends from delivery log

### Scheduling Enhancements

- **CALV-01**: User can view scheduled reminders in calendar view (reuse react-big-calendar)
- **CALV-02**: User can drag-and-drop reschedule reminders in calendar
- **QKSN-01**: User can send ad-hoc email from individual client detail page

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Drag-and-drop email builder | Complex, not needed for accountant use case -- rich text editor sufficient |
| HTML source code editing | Non-technical user, would bypass sanitization safeguards |
| Server-side Postmark templates | Current React Email pipeline works well, no need to change |
| Multiple email layout templates | Single-user, one brand, one layout is sufficient |
| Complex scheduling rules engine | Existing deadline-based logic covers UK accounting obligations |
| Real-time collaborative editing | Solo practitioner, no collaboration needed |
| Email analytics (open/click tracking) | Privacy concern, provides no actionable value for this use case |
| Template version history | Templates edited infrequently, git provides version history if needed |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| EDIT-01 | Phase 5 | Pending |
| EDIT-02 | Phase 5 | Pending |
| EDIT-03 | Phase 5 | Pending |
| EDIT-04 | Phase 5 | Pending |
| EDIT-05 | Phase 5 | Pending |
| TMPL-01 | Phase 5 | Pending |
| TMPL-02 | Phase 5 | Pending |
| TMPL-03 | Phase 5 | Pending |
| TMPL-04 | Phase 5 | Pending |
| TMPL-05 | Phase 5 | Pending |
| RNDR-01 | Phase 6 | Pending |
| RNDR-02 | Phase 6 | Pending |
| RNDR-03 | Phase 6 | Pending |
| RNDR-04 | Phase 6 | Pending |
| RNDR-05 | Phase 6 | Pending |
| SCHD-01 | Phase 7 | Pending |
| SCHD-02 | Phase 7 | Pending |
| SCHD-03 | Phase 7 | Pending |
| SCHD-04 | Phase 7 | Pending |
| SCHD-05 | Phase 7 | Pending |
| SCHD-06 | Phase 7 | Pending |
| SCHD-07 | Phase 7 | Pending |
| SCHD-08 | Phase 7 | Pending |
| SCHD-09 | Phase 7 | Pending |
| SCHD-10 | Phase 7 | Pending |
| OVRD-01 | Phase 7 | Pending |
| OVRD-02 | Phase 7 | Pending |
| OVRD-03 | Phase 7 | Pending |
| OVRD-04 | Phase 7 | Pending |
| OVRD-05 | Phase 7 | Pending |
| ADHC-01 | Phase 8 | Pending |
| ADHC-02 | Phase 8 | Pending |
| ADHC-03 | Phase 8 | Pending |
| ADHC-04 | Phase 8 | Pending |
| ADHC-05 | Phase 8 | Pending |
| ADHC-06 | Phase 8 | Pending |
| ADHC-07 | Phase 8 | Pending |
| ADHC-08 | Phase 8 | Pending |
| ADHC-09 | Phase 8 | Pending |
| MIGR-01 | Phase 4 | Pending |
| MIGR-02 | Phase 4 | Pending |
| MIGR-03 | Phase 4 | Pending |
| MIGR-04 | Phase 4 | Pending |
| MIGR-05 | Phase 4 | Pending |
| MIGR-06 | Phase 4 | Pending |
| MIGR-07 | Phase 4 | Pending |
| QUEU-01 | Phase 9 | Pending |
| QUEU-02 | Phase 9 | Pending |
| QUEU-03 | Phase 9 | Pending |
| QUEU-04 | Phase 9 | Pending |

**Coverage:**
- v1.1 requirements: 50 total
- Mapped to phases: 50/50
- Unmapped: 0

---
*Requirements defined: 2026-02-08*
*Last updated: 2026-02-08 after roadmap creation (traceability added)*
