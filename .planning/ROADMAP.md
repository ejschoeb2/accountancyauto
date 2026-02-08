# Roadmap: Peninsula Accounting Client Reminder System

## Milestones

- **v1.0 MVP** - Phases 1-3 (shipped 2026-02-07)
- **v1.1 Template & Scheduling Redesign** - Phases 4-9 (in progress)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-3) - SHIPPED 2026-02-07</summary>

### Phase 1: Foundation
**Goal**: Project scaffolding, QuickBooks integration, client data model
**Plans**: 7 plans (complete)

### Phase 2: Reminder Engine
**Goal**: Template system, deadline calculators, queue builder, email delivery
**Plans**: 5 plans (complete)

### Phase 3: Delivery & Dashboard
**Goal**: Dashboard, audit logging, calendar, status tracking
**Plans**: 5 plans (complete)

</details>

### v1.1 Template & Scheduling Redesign (In Progress)

**Milestone Goal:** Decouple email templates from scheduling logic, add rich text editing with live preview, and enable ad-hoc client communications.

**Phase Numbering:**
- Integer phases (4, 5, 6...): Planned milestone work
- Decimal phases (4.1, 4.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 4: Data Migration** - Restructure database from JSONB-embedded templates to normalized tables
- [ ] **Phase 5: Rich Text Editor & Templates** - TipTap editor with placeholder autocomplete and template CRUD
- [ ] **Phase 6: Email Rendering Pipeline** - Convert TipTap JSON to email-safe HTML with inline styles
- [ ] **Phase 7: Schedule Management** - Schedule creation/editing UI with step management (overrides removed from scope)
- [ ] **Phase 8: Ad-Hoc Sending** - Select clients, pick template, preview, and send outside scheduled flow
- [ ] **Phase 9: Queue Integration** - Rewire cron queue builder to read from new normalized tables

## Phase Details

### Phase 4: Data Migration
**Goal**: Existing reminder data is safely restructured into normalized tables without data loss or disruption to the running system
**Depends on**: Nothing (foundational for v1.1)
**Requirements**: MIGR-01, MIGR-02, MIGR-03, MIGR-04, MIGR-05, MIGR-06, MIGR-07
**Success Criteria** (what must be TRUE):
  1. New email_templates table contains one row per unique template body, with body stored as TipTap JSON (paragraph-wrapped plain text)
  2. New schedules and schedule_steps tables contain the same step sequences previously embedded in reminder_templates.steps JSONB
  3. Client overrides are split into content overrides (client_email_overrides) and timing overrides (client_schedule_overrides) with no data lost
  4. Data verification query confirms row counts match between old and new structures
  5. Old tables are retained and the existing reminder queue continues to function without disruption
**Plans**: 2 plans
Plans:
- [x] 04-01-PLAN.md — Create v1.1 normalized tables (DDL migration + TypeScript types)
- [x] 04-02-PLAN.md — Migrate v1.0 data to normalized structure + verification script

### Phase 5: Rich Text Editor & Templates
**Goal**: User can create and manage standalone email templates using a rich text editor with placeholder autocomplete
**Depends on**: Phase 4 (email_templates table must exist)
**Requirements**: EDIT-01, EDIT-02, EDIT-03, EDIT-04, EDIT-05, TMPL-01, TMPL-02, TMPL-03, TMPL-04, TMPL-05
**Success Criteria** (what must be TRUE):
  1. User can create a new email template with name, subject line, and rich text body using a toolbar with bold, italic, underline, lists, and links
  2. User can type `/` in the editor body to trigger an autocomplete dropdown and insert a placeholder that renders as a styled pill (cannot be accidentally split or corrupted)
  3. User can insert placeholders in the subject line via a button dropdown
  4. User can paste content from Word or Outlook and the editor strips complex styles without breaking layout
  5. User can view a list of all templates and edit any existing template with content loading correctly in the editor
**Plans**: 4 plans
Plans:
- [ ] 05-01-PLAN.md — Install TipTap + create PlaceholderNode and PasteHandler extensions
- [ ] 05-02-PLAN.md — API routes for email_templates CRUD (validation, list, create, update, delete)
- [ ] 05-03-PLAN.md — TipTap editor component, toolbar, placeholder dropdown, subject line editor
- [ ] 05-04-PLAN.md — Template list page (card grid) and create/edit pages with visual verification

### Phase 6: Email Rendering Pipeline
**Goal**: TipTap JSON content converts to email-safe HTML with inline styles for correct rendering in Gmail, Outlook, and Apple Mail
**Depends on**: Phase 5 (TipTap editor must produce JSON content)
**Requirements**: RNDR-04, RNDR-05 (RNDR-01, RNDR-02, RNDR-03 removed from scope -- preview UI not needed)
**Success Criteria** (what must be TRUE):
  1. Sent emails render correctly in Gmail, Outlook, and Apple Mail (email-safe HTML with inline styles, no broken formatting)
  2. Placeholders are replaced with client data at render time, with fallback text for missing values
  3. All links open in new tab with proper security attributes
**Plans**: 1 plan
Plans:
- [ ] 06-01-PLAN.md — Rendering pipeline: TipTap JSON to inline-styled email HTML + tests

### Phase 7: Schedule Management
**Goal**: User can create and manage reminder schedules independently from templates, with sub-tab navigation alongside templates
**Depends on**: Phase 5 (email templates must exist to assign to schedule steps)
**Requirements**: SCHD-01, SCHD-02, SCHD-03, SCHD-04, SCHD-05, SCHD-06, SCHD-07, SCHD-08
**Success Criteria** (what must be TRUE):
  1. User can create a schedule for a filing type with multiple steps, where each step assigns an email template, a delay-before-deadline in days, and an urgency level
  2. User can reorder, add, and remove steps within a schedule, and the same template can appear in multiple steps
  3. User can view all schedules with their filing types and edit any schedule
  4. User can duplicate a schedule with "(Copy)" suffix
**Plans**: 2 plans
Plans:
- [ ] 07-01-PLAN.md — Validation schema, CRUD API routes, sub-tab navigation, schedule list
- [ ] 07-02-PLAN.md — Schedule editor page with step management (reorder, template/delay/urgency config)

### Phase 8: Ad-Hoc Sending
**Goal**: User can send one-off emails to selected clients outside the automated reminder schedule
**Depends on**: Phase 5 (templates), Phase 6 (rendering pipeline)
**Requirements**: ADHC-01, ADHC-02, ADHC-03, ADHC-04, ADHC-05, ADHC-06, ADHC-07, ADHC-08, ADHC-09
**Success Criteria** (what must be TRUE):
  1. User can start an ad-hoc send from the main navigation and select multiple clients via a searchable checkbox list
  2. User can pick an email template, preview it with selected clients' data, and edit the subject and body before sending
  3. User sees a confirmation modal with the send count, a progress indicator during sending, and a results summary showing sent/failed counts
  4. Ad-hoc sends appear in the delivery log with an "ad-hoc" type indicator distinguishing them from scheduled reminders
**Plans**: TBD

### Phase 9: Queue Integration
**Goal**: The automated reminder system reads from the new normalized tables, completing the migration from the old JSONB structure
**Depends on**: Phase 4 (new tables), Phase 7 (schedules and overrides), Phase 6 (rendering pipeline)
**Requirements**: QUEU-01, QUEU-02, QUEU-03, QUEU-04
**Success Criteria** (what must be TRUE):
  1. Queue builder reads from schedules and schedule_steps tables (not reminder_templates.steps JSONB)
  2. Queue builder resolves email content from email_templates via schedule_step_id and applies content and timing overrides in the correct precedence order
  3. Existing reminder queue continues to function during the transition period with no missed or duplicate sends
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 4 -> 5 -> 6 -> 7 -> 8 -> 9
(Phases 6 and 7 can potentially execute in parallel after Phase 5)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 4. Data Migration | v1.1 | 2/2 | Complete | 2026-02-08 |
| 5. Rich Text Editor & Templates | v1.1 | 4/4 | Complete | 2026-02-08 |
| 6. Email Rendering Pipeline | v1.1 | 0/1 | Planning complete | - |
| 7. Schedule Management | v1.1 | 0/2 | Planning complete | - |
| 8. Ad-Hoc Sending | v1.1 | TBD | Not started | - |
| 9. Queue Integration | v1.1 | TBD | Not started | - |
