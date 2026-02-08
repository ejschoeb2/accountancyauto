# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-08)

**Core value:** Automate the hours accountants spend manually chasing clients for records and documents, while keeping the accountant in full control of messaging and timing.
**Current focus:** Phase 4 - Data Migration (v1.1 Template & Scheduling Redesign)

## Current Position

Phase: 4 of 9 (Data Migration)
Plan: 1 of 2 in current phase
Status: In progress
Last activity: 2026-02-08 -- Completed 04-01-PLAN.md

Progress: [#.........] ~5% (1/~19 v1.1 plans estimated)

## Performance Metrics

**v1.0 Velocity:**
- Total plans completed: 17
- Total execution time: ~78 min
- Timeline: 1 day (2026-02-06 -> 2026-02-07)

**v1.1:**
- Total plans completed: 1
- Phases: 6 (Phase 4-9)
- Plan 04-01: 2 min

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

### Known Risks

- MIGR data loss: JSONB-to-table migration must preserve all template UUIDs to avoid orphaning overrides
- Placeholder corruption: TipTap atomic nodes must prevent editor from splitting {{variable}} syntax
- Email rendering: Rich text HTML must convert to email-safe inline-style HTML for Outlook/Gmail
- Queue disruption: Existing cron must continue functioning during entire v1.1 development

### Tech Debt (from v1.0)

1. PostgREST FK join workaround in audit-log.ts
2. Phase 1 plans 02-04 missing formal SUMMARY.md files
3. Phase 1 & 3 missing formal VERIFICATION.md

## Session Continuity

Last session: 2026-02-08
Stopped at: Completed 04-01-PLAN.md
Resume file: None
Next step: Execute 04-02-PLAN.md (migrate v1.0 data to normalized structure)

---
*Phase 4 plan 1/2 complete -- v1.1 normalized tables created*
