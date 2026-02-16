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

**Milestone Goal:** Close the feedback loop — when clients reply to reminders, the system reads, classifies, and acts on their responses. The accountant reviews AI verdicts on an Inbound tab within Email Activity, with configurable auto-action for high-confidence replies.

### Phase 10: Inbound Email Infrastructure
**Goal**: Receive and store client reply emails via Postmark webhook, linked back to the original client and filing type
**Depends on**: Phase 9 (outbound email system)
**Success Criteria** (what must be TRUE):
  1. Outbound reminder emails use VERP-style Reply-To addresses encoding client ID and filing type via cryptographic tokens
  2. Postmark inbound webhook receives client replies with Basic HTTP Auth validation
  3. Auto-generated emails (out-of-office, auto-replies) are detected via headers and excluded
  4. Inbound emails stored in `inbound_emails` table with sender, subject, body, decoded client ID, filing type, and timestamp
  5. Each inbound email is linked to the correct client record and filing type via the decoded VERP token
**Plans**: TBD

Plans:
- [ ] 10-01: TBD

### Phase 11: AI Classification Engine
**Goal**: Classify each inbound reply to produce a verdict — what action should be taken on the client's filing
**Depends on**: Phase 10 (inbound emails stored with client/filing context)
**Success Criteria** (what must be TRUE):
  1. Each inbound email is classified by AI (Claude Haiku 4.5) into a verdict: Records Sent, Question, Extension Request, Can't Find Records, Accountant Not Needed, Out of Office, or Unclear
  2. Each verdict includes a confidence score (HIGH 90%+, MEDIUM 60-89%, LOW <60%)
  3. AI reasoning is stored alongside the verdict for audit trail
  4. Classification runs automatically when an inbound email is stored (triggered from Phase 10 webhook flow)
  5. Verdict and confidence are written to the inbound email record for display in Phase 12
**Plans**: TBD

Plans:
- [ ] 11-01: TBD

### Phase 12: Email Activity — Inbound Interface
**Goal**: Add an Inbound tab to the Email Activity page (renamed from Email Logs) where the accountant reviews AI-classified client replies, inspects details, and takes action on filings
**Depends on**: Phase 11 (verdicts available on inbound emails)
**Success Criteria** (what must be TRUE):
  1. Email Logs page renamed to "Email Activity" across nav and page title
  2. New toggle above the existing date-range toggle: **Outbound** (default, current view) | **Inbound**
  3. Inbound tab shows table with columns: checkbox, client name, client type, checked (yes/no status), filing type, verdict (AI opinion), change applied (yes/no)
  4. Sort-by and filter UI on the right above the table (same pattern as outbound tab)
  5. Filter includes an "Unchecked only" checkbox option
  6. Clicking a row opens a detail popup:
     - **Left side**: full email content from the client (subject, body, date)
     - **Right side**: checked/unchecked status badge, AI verdict with reasoning, recommended action, and buttons to set the linked filing status (e.g. "Mark Records Received")
  7. Saving changes in the popup marks the email as "checked" and applies the filing status update
  8. Detail popup has Previous / Next navigation buttons to move between emails without closing
**Plans**: TBD

Plans:
- [ ] 12-01: TBD

### Phase 13: AI Agent Configuration
**Goal**: Settings page section where the accountant configures whether the AI auto-applies filing changes or only recommends them for manual approval
**Depends on**: Phase 12 (inbound review interface exists)
**Success Criteria** (what must be TRUE):
  1. Settings page has an "AI Agent" section with a mode toggle: **Auto-apply** (AI makes changes automatically for high-confidence verdicts) vs **Recommend only** (AI suggests, accountant approves via inbound tab)
  2. In auto-apply mode: high-confidence verdicts (90%+) automatically update filing status and mark the email as checked, with "change applied: yes" shown in the inbound table
  3. In recommend-only mode: all emails appear as unchecked in the inbound table regardless of confidence, accountant must review and apply manually
  4. All auto-applied changes are logged in the audit trail with AI classification details (verdict, confidence, reasoning)
  5. Accountant can distinguish AI-triggered status changes from manual ones in the audit log
  6. Default mode is "Recommend only" (safe default for new practices)
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
| 12. Email Activity — Inbound Interface | v3.0 | 0/? | Not started | - |
| 13. AI Agent Configuration | v3.0 | 0/? | Not started | - |
