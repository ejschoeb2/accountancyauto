---
phase: 04-data-migration
plan: 01
subsystem: database
tags: [postgres, supabase, migration, rls, typescript]

# Dependency graph
requires:
  - phase: 02-reminder-engine
    provides: filing_types table, reminder_templates table, update_updated_at() trigger function
provides:
  - email_templates table (standalone reusable email content with TipTap JSON)
  - schedules table (one per filing type, replaces reminder_templates scheduling role)
  - schedule_steps table (ordered steps within a schedule, FK to email_templates)
  - client_email_overrides table (per-client content customizations)
  - client_schedule_overrides table (per-client timing customizations)
  - TypeScript interfaces for all v1.1 tables
affects: [04-02-data-migration, 05-rich-text-editor, 07-schedule-management, 09-queue-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Normalized template-schedule separation: email content decoupled from scheduling logic via FK references"
    - "ON DELETE RESTRICT for email_templates referenced by schedule_steps (prevents accidental deletion of in-use templates)"
    - "TipTapDocument/TipTapNode TypeScript types for structured rich text JSON"

key-files:
  created:
    - supabase/migrations/20260208000001_create_v11_normalized_tables.sql
  modified:
    - lib/types/database.ts

key-decisions:
  - "ON DELETE RESTRICT for schedule_steps -> email_templates FK (prevents breaking schedules by deleting templates)"
  - "UrgencyLevel CHECK constraint matches TypeScript union type exactly (low, normal, high, urgent)"
  - "UNIQUE(schedule_id, step_number) prevents duplicate step ordering within a schedule"
  - "All tables use IF NOT EXISTS for safe re-run"

patterns-established:
  - "v1.1 tables coexist alongside v1.0 tables with no cross-dependencies"
  - "TipTapDocument type for body_json columns (type: 'doc', content: TipTapNode[])"

# Metrics
duration: 2min
completed: 2026-02-08
---

# Phase 4 Plan 01: Create v1.1 Normalized Tables Summary

**5 normalized database tables (email_templates, schedules, schedule_steps, client_email_overrides, client_schedule_overrides) with RLS policies, indexes, triggers, and matching TypeScript interfaces**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-08T03:44:47Z
- **Completed:** 2026-02-08T03:47:06Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created 5 normalized tables that decouple email content from scheduling logic
- All tables have RLS policies for anon, authenticated, and service_role (25 policies total)
- 6 performance indexes on all FK columns
- 4 update_updated_at triggers (all tables with updated_at column)
- TypeScript interfaces match database schema exactly, including TipTapDocument/TipTapNode types
- Old v1.0 tables (reminder_templates, client_template_overrides) remain completely untouched

## Task Commits

Each task was committed atomically:

1. **Task 1: Create v1.1 normalized tables migration** - `32e528b` (feat)
2. **Task 2: Add TypeScript interfaces for new tables** - `4eccd53` (feat)

## Files Created/Modified
- `supabase/migrations/20260208000001_create_v11_normalized_tables.sql` - DDL for 5 new tables with FKs, indexes, triggers, and RLS policies
- `lib/types/database.ts` - Added EmailTemplate, Schedule, ScheduleStep, ClientEmailOverride, ClientScheduleOverride, TipTapDocument, TipTapNode, UrgencyLevel types

## Decisions Made
- Used ON DELETE RESTRICT for schedule_steps.email_template_id -> email_templates.id (prevents deleting a template that's actively used in a schedule, would break reminder delivery)
- Used ON DELETE CASCADE for all other FKs (client deletion cascades to their overrides, schedule deletion cascades to its steps)
- schedule_steps has no updated_at column (steps are immutable once created, modifications go through delete-and-recreate)
- All 5 tables get full anon CRUD policies (app uses anon role, no Supabase Auth login)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - migration needs to be applied via `npx supabase db push` but this will happen as part of the normal deployment flow.

## Next Phase Readiness
- All 5 v1.1 tables ready for plan 04-02 (data migration from v1.0 JSONB to normalized structure)
- TypeScript types ready for Phase 5 (TipTap editor), Phase 7 (schedule management), Phase 9 (queue integration)
- Old v1.0 tables and types preserved for continued operation during transition

## Self-Check: PASSED

---
*Phase: 04-data-migration*
*Completed: 2026-02-08*
