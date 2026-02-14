# Roadmap: Peninsula Accounting Client Reminder System

## Milestones

- **v1.0 MVP** - Phases 1-3 (shipped 2026-02-07)
- **v1.1 Template & Scheduling Redesign** - Phases 4-9 (shipped 2026-02-08)
- **v2.0 QOL & Platform Hardening** - (shipped 2026-02-14)
- **v3.0 Inbound Email Intelligence** - Phases 10-13 (in progress)

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

<details>
<summary>v1.1 Template & Scheduling Redesign (Phases 4-9) - SHIPPED 2026-02-08</summary>

### Phase 4: Data Migration
**Goal**: Restructure database from JSONB-embedded templates to normalized tables
**Plans**: 2 plans (complete)

### Phase 5: Rich Text Editor & Templates
**Goal**: TipTap editor with placeholder autocomplete and template CRUD
**Plans**: 4 plans (complete)

### Phase 6: Email Rendering Pipeline
**Goal**: Convert TipTap JSON to email-safe HTML with inline styles
**Plans**: 1 plan (complete)

### Phase 7: Schedule Management
**Goal**: Schedule creation/editing UI with step management
**Plans**: 2 plans (complete)

### Phase 8: Ad-Hoc Sending
**Goal**: Select clients, pick template, preview, and send outside scheduled flow
**Plans**: 2 plans (complete)

### Phase 9: Queue Integration
**Goal**: Rewire cron queue builder to read from new normalized tables
**Plans**: 2 plans (complete)

</details>

<details>
<summary>v2.0 QOL & Platform Hardening (Phases n/a) - SHIPPED 2026-02-14</summary>

### v2.0 Overview
**Goal**: Quality-of-life improvements, auth modernization, filing management, and operational tooling

**Key Features:**
- **Auth Refactor**: Replaced QuickBooks OAuth with magic link authentication
- **Onboarding Wizard**: Streamlined 3-step onboarding flow
- **Email Logs**: Redesigned full-width table with advanced filtering, sorting, and dropdowns
- **Filing Management**: Filing status badges, status dropdown, filing status API
- **Bulk Operations**: Bulk edit status modal with multi-client status updates
- **CSV Import**: Improved validation and template generation
- **Rollover System**: Year-end rollover detector, executor, and dashboard page
- **Help Widget**: In-app help widget on dashboard
- **Reminder Queue API**: API endpoint for reminder queue processing
- **Email Queue**: Email queue action handlers
- **UI Components**: Separator, toggle group components
- **Database Migrations**: Records received status, rescheduled status, filing status overrides
- **Migration Scripts**: Tooling for applying constraint fixes and status migrations
- **Quick Tasks**: Custom schedules (#001), demo client creation (#002), auth & multi-practice (#003), onboarding wizard (#004)

</details>

## v3.0 Inbound Email Intelligence (In Progress)

**Milestone Goal:** Close the feedback loop — when clients reply to reminders, the system reads, classifies, and acts on their responses automatically.

### Phase 10: Inbound Email Infrastructure
**Goal**: Receive and store client reply emails securely via Postmark webhook
**Depends on**: Phase 9 (outbound email system)
**Requirements**: INBD-01, INBD-02, INBD-03, INBD-04, INBD-05
**Success Criteria** (what must be TRUE):
  1. System receives client reply emails via Postmark inbound webhook with Basic HTTP Auth validation
  2. Reply-To addresses encode client ID and filing type using cryptographic tokens (VERP-style)
  3. Auto-generated emails (out-of-office, auto-replies) are detected and excluded from processing
  4. All inbound emails are stored in database with sender, subject, body, and decoded client context
**Plans**: TBD

Plans:
- [ ] 10-01: TBD

### Phase 11: AI Classification Engine
**Goal**: Classify reply intent using Claude AI with confidence scoring
**Depends on**: Phase 10 (inbound emails stored)
**Requirements**: AICL-01, AICL-02, AICL-03, AICL-04
**Success Criteria** (what must be TRUE):
  1. AI classifies reply intent into 7 accounting-specific categories (Paperwork Sent, Question, Extension Request, Can't Find Records, Accountant Not Needed, Out of Office, Unclear)
  2. Each classification includes confidence score (HIGH 90%+, MEDIUM 60-89%, LOW <60%)
  3. Classification uses Claude Haiku 4.5 with structured outputs for guaranteed schema compliance
  4. Out-of-office replies are flagged and excluded from review queue
  5. AI reasoning is stored alongside classification for audit trail
**Plans**: TBD

Plans:
- [ ] 11-01: TBD

### Phase 12: Accountant Review Interface
**Goal**: Human-in-the-loop review for ambiguous replies with full context
**Depends on**: Phase 11 (classifications available)
**Requirements**: REVW-01, REVW-02, REVW-03, REVW-04, REVW-05
**Success Criteria** (what must be TRUE):
  1. Review queue shows all replies below 90% confidence for accountant classification
  2. Accountant can manually override AI classification with correct intent
  3. Full email content (body, subject, sender, date) visible in dashboard
  4. Reply log shows chronological list of all inbound emails per client with context
  5. Review queue badge count visible in navigation
**Plans**: TBD

Plans:
- [ ] 12-01: TBD

### Phase 13: Auto-Action System
**Goal**: Configurable auto-actions that update filing status for high-confidence replies, with settings controls and onboarding integration
**Depends on**: Phase 12 (manual review establishes accuracy baseline)
**Requirements**: AUTO-01, AUTO-02, AUTO-03, AUTO-04
**Success Criteria** (what must be TRUE):
  1. High-confidence "Paperwork Sent" replies (90%+) automatically mark filing as records received
  2. Auto-actions are logged in audit trail with AI classification details (intent, confidence, reasoning)
  3. Auto-action system can be enabled/disabled via toggle in settings page
  4. Auto-action settings configurable during onboarding setup wizard
  5. Database locking prevents concurrent updates when multiple emails arrive for same client
  6. Accountant can see which status changes were AI-triggered vs. manual
**Plans**: TBD

Plans:
- [ ] 13-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 10 → 11 → 12 → 13

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 7/7 | Complete | 2026-02-06 |
| 2. Reminder Engine | v1.0 | 5/5 | Complete | 2026-02-07 |
| 3. Delivery & Dashboard | v1.0 | 5/5 | Complete | 2026-02-07 |
| 4. Data Migration | v1.1 | 2/2 | Complete | 2026-02-08 |
| 5. Rich Text Editor & Templates | v1.1 | 4/4 | Complete | 2026-02-08 |
| 6. Email Rendering Pipeline | v1.1 | 1/1 | Complete | 2026-02-08 |
| 7. Schedule Management | v1.1 | 2/2 | Complete | 2026-02-08 |
| 8. Ad-Hoc Sending | v1.1 | 2/2 | Complete | 2026-02-08 |
| 9. Queue Integration | v1.1 | 2/2 | Complete | 2026-02-08 |
| — v2.0 QOL & Platform Hardening | v2.0 | n/a | Complete | 2026-02-14 |
| 10. Inbound Email Infrastructure | v3.0 | 0/? | Not started | - |
| 11. AI Classification Engine | v3.0 | 0/? | Not started | - |
| 12. Accountant Review Interface | v3.0 | 0/? | Not started | - |
| 13. Auto-Action System | v3.0 | 0/? | Not started | - |
