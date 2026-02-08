# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-08)

**Core value:** Automate the hours accountants spend manually chasing clients for records and documents, while keeping the accountant in full control of messaging and timing.
**Current focus:** Phase 7 - Schedule Management (v1.1 Template & Scheduling Redesign)

## Current Position

Phase: 7 of 9 (Schedule Management)
Plan: 1 of 2 in current phase
Status: In progress
Last activity: 2026-02-08 -- Completed 07-01-PLAN.md

Progress: [###.......] ~37% (7/~19 v1.1 plans estimated)

## Performance Metrics

**v1.0 Velocity:**
- Total plans completed: 17
- Total execution time: ~78 min
- Timeline: 1 day (2026-02-06 -> 2026-02-07)

**v1.1:**
- Total plans completed: 7
- Phases: 6 (Phase 4-9)
- Plan 04-01: 2 min
- Plan 04-02: 3 min
- Plan 05-01: 3.5 min
- Plan 05-02: 4 min
- Plan 05-03: 3 min
- Plan 05-04: 15 min
- Plan 07-01: 4 min

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
- [07-01]: Three urgency levels only: normal, high, urgent (no 'low' level)
- [07-01]: No validation rules on step array length - trust user to configure sensibly
- [07-01]: Duplicate creates copy with "(Copy)" suffix and is_active: false
- [07-01]: Delete-and-recreate pattern for schedule_steps to honor immutability
- [07-01]: Fetch filing_types and step counts separately to avoid PostgREST FK join cache issues
- [07-01]: Combined Templates & Schedules in single nav tab with sub-tab navigation via searchParams

### Known Risks

- ~~Placeholder corruption: TipTap atomic nodes must prevent editor from splitting {{variable}} syntax~~ ✅ Resolved in 05-01 (atom: true configuration)
- Email rendering: Rich text HTML must convert to email-safe inline-style HTML for Outlook/Gmail
- Queue disruption: Existing cron must continue functioning during entire v1.1 development

### Tech Debt (from v1.0)

1. PostgREST FK join workaround in audit-log.ts
2. Phase 1 plans 02-04 missing formal SUMMARY.md files
3. Phase 1 & 3 missing formal VERIFICATION.md

## Session Continuity

Last session: 2026-02-08T13:17:05Z
Stopped at: Completed 07-01-PLAN.md
Resume file: None
Next step: Continue Phase 7 with 07-02 (Schedule Editor UI)

---
*Phase 7 in progress -- Schedule CRUD API complete, sub-tab navigation integrated*
