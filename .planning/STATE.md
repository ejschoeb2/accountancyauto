# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-08)

**Core value:** Automate the hours accountants spend manually chasing clients for records and documents, while keeping the accountant in full control of messaging and timing.
**Current focus:** Phase 7 - Schedule Management (v1.1 Template & Scheduling Redesign) [Phase 6 just completed]

## Current Position

Phase: 9 of 9 (Queue Integration)
Plan: 1 of 2 in current phase
Status: In progress
Last activity: 2026-02-08 -- Completed 09-01-PLAN.md

Progress: [#####.....] ~55% (11/~20 v1.1 plans estimated)

## Performance Metrics

**v1.0 Velocity:**
- Total plans completed: 17
- Total execution time: ~78 min
- Timeline: 1 day (2026-02-06 -> 2026-02-07)

**v1.1:**
- Total plans completed: 11
- Phases: 9 (Phase 4-9)
- Plan 04-01: 2 min
- Plan 04-02: 3 min
- Plan 05-01: 3.5 min
- Plan 05-02: 4 min
- Plan 05-03: 3 min
- Plan 05-04: 15 min
- Plan 06-01: 6 min
- Plan 07-01: 4 min
- Plan 07-02: 3 min
- Plan 08-01: 2 min
- Plan 09-01: 5 min

## Accumulated Context

### Decisions

See PROJECT.md Key Decisions table for full list.

Recent decisions affecting current work:
- [v1.1 Roadmap]: TipTap 3.x chosen for rich text editor (React 19 compatible, first-party mention/suggestion)
- [v1.1 Roadmap]: Three-phase migration strategy (add tables, verify data, cleanup old structure)
- [v1.1 Roadmap]: Composition over embedding -- email templates as standalone entities referenced by ID
- [04-01]: ON DELETE RESTRICT for schedule_steps -> email_templates FK (prevents breaking schedules by deleting in-use templates)
- [04-01]: schedule_steps has no updated_at (immutable, modify via delete-and-recreate)
- [04-01]: All v1.1 tables get full anon CRUD policies (app uses anon role, no Supabase Auth)
- [04-02]: New UUIDs for all migrated rows (each step becomes its own email_template, can't reuse single template UUID)
- [04-02]: Urgency level derived from step_number position (1-2 = normal, 3 = high, 4+ = urgent)
- [04-02]: ON CONFLICT DO UPDATE for override deduplication during migration
- [05-01]: PlaceholderNode configured as atomic inline (atom: true) prevents corruption
- [05-01]: Paste always strips formatting to plain text, no Ctrl+Shift+V alternative
- [05-01]: Pills display as {{variable}} with primary color styling for visual distinction
- [05-02]: Zod v4 requires z.record(keyType, valueType) - used z.record(z.string(), z.unknown()) for TipTap attrs
- [05-02]: /api/email-templates/ routes coexist with v1.0 /api/templates/ (separate tables, no conflict)
- [05-02]: DELETE returns 409 when template in use by schedule (FK constraint 23503 handled gracefully)
- [05-03]: Link extension configured with autolink: true for auto-detecting pasted URLs
- [05-03]: PlaceholderDropdown uses onCloseAutoFocus prevention to avoid stealing focus from editor
- [05-03]: Subject line editor stores plain text with {{variable}} syntax, renders preview with pills
- [05-04]: Template list page uses server component querying email_templates (not reminder_templates)
- [05-04]: Create and edit pages use same component structure with conditional behavior
- [05-04]: Card grid layout for template list (1 col mobile, 2 md, 3 lg)
- [05-04]: Delete button includes confirmation and gracefully handles FK constraint 409 errors
- [06-01]: PlaceholderNode renderHTML outputs {{id}} syntax for substituteVariables() to replace
- [06-01]: getSharedExtensions() used by both editor and renderer to prevent mismatched extensions
- [06-01]: Link extension configured with target='_blank' and rel='noopener noreferrer' for security
- [06-01]: ReminderEmail template supports both v1.0 plain text and v1.1 htmlBody for backwards compatibility
- [06-01]: sendReminderEmail() preserved unchanged - v1.0 cron queue continues working during v1.1 development
- [06-01]: React Email render(pretty: false) keeps output compact to avoid Gmail 102KB clipping
- [07-01]: Three urgency levels only: normal, high, urgent (no 'low' level)
- [07-01]: No validation rules on step array length - trust user to configure sensibly
- [07-01]: Duplicate creates copy with "(Copy)" suffix and is_active: false
- [07-01]: Delete-and-recreate pattern for schedule_steps to honor immutability
- [07-01]: Fetch filing_types and step counts separately to avoid PostgREST FK join cache issues
- [07-01]: Combined Templates & Schedules in single nav tab with sub-tab navigation via searchParams
- [07-02]: Card layout for steps (not Accordion) for better visibility of all fields at once
- [07-02]: Preset delay buttons (7/14/30) + custom input for common + flexible configuration
- [07-02]: Non-blocking duplicate template warning allows same template in multiple steps
- [07-02]: useFieldArray move() for step reordering with field.id as React key
- [08-01]: send_type discriminator column on email_log (DEFAULT 'scheduled', CHECK constraint for values)
- [08-01]: Ad-hoc sends use placeholder context (filing_type='Ad-hoc', deadline=now) for template variables
- [08-01]: Ad-hoc sends logged with reminder_queue_id=null and filing_type_id=null
- [08-01]: Delivery log shows ad-hoc badge with accent styling, scheduled as plain text
- [09-01]: Remove ALL per-client override processing from queue builder (per user decision from Phase 7)
- [09-01]: Use step.step_number for step_index in reminder_queue (not array index)
- [09-01]: Set template_id to schedule.id in reminder_queue (points to schedule, not old reminder_templates)
- [09-01]: Postmark failures marked as 'pending' for retry (not 'failed') - ensures no missed emails
- [09-01]: Missing templates/schedules logged to email_log with 'failed' status for visibility

### Known Risks

- ~~Placeholder corruption: TipTap atomic nodes must prevent editor from splitting {{variable}} syntax~~ ✅ Resolved in 05-01 (atom: true configuration)
- ~~Email rendering: Rich text HTML must convert to email-safe inline-style HTML for Outlook/Gmail~~ ✅ Resolved in 06-01 (TipTap -> generateHTML -> React Email -> inline styles)
- ~~Queue disruption: Existing cron must continue functioning during entire v1.1 development~~ ✅ Resolved in 09-01 (v1.1 queue builder operational)

### Tech Debt (from v1.0)

1. PostgREST FK join workaround in audit-log.ts
2. Phase 1 plans 02-04 missing formal SUMMARY.md files
3. Phase 1 & 3 missing formal VERIFICATION.md

## Session Continuity

Last session: 2026-02-08T14:21:28Z
Stopped at: Completed 09-01-PLAN.md (Phase 9 Plan 1 of 2)
Resume file: None
Next step: Execute 09-02-PLAN.md (v1.0 cleanup - drop old tables and code)

---
*Phase 9 in progress -- Automated reminder cron system rewired to v1.1 normalized tables with TipTap rendering pipeline.*
