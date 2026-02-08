---
phase: 04-data-migration
plan: 02
subsystem: database
tags: [postgres, supabase, migration, plpgsql, tiptap, jsonb, typescript]

# Dependency graph
requires:
  - phase: 04-data-migration
    plan: 01
    provides: email_templates, schedules, schedule_steps, client_email_overrides, client_schedule_overrides tables
  - phase: 02-reminder-engine
    provides: reminder_templates table with JSONB steps, client_template_overrides table, filing_types table
provides:
  - Data migration SQL that populates all v1.1 normalized tables from v1.0 JSONB structure
  - Verification script that validates migration integrity (row counts, TipTap JSON, delay_days consistency)
  - Temporary mapping table pattern for tracking old->new ID relationships during migration
affects: [05-rich-text-editor, 07-schedule-management, 09-queue-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PL/pgSQL DO block with temp mapping table for cross-table data migration"
    - "Plain text to TipTap JSON conversion: single paragraph wrap with text node"
    - "Idempotent migration: check if target table already has data before running"
    - "ON CONFLICT DO UPDATE for override deduplication during migration"

key-files:
  created:
    - supabase/migrations/20260208000002_migrate_v10_data_to_normalized.sql
    - scripts/verify-migration.ts
  modified: []

key-decisions:
  - "New UUIDs for all migrated rows (email_templates, schedules, schedule_steps) rather than reusing reminder_templates UUIDs"
  - "Temporary _migration_step_map table tracks old_template_id + step_index to new IDs for override migration"
  - "Urgency level derived from step_number: steps 1-2 = normal, step 3 = high, step 4+ = urgent"
  - "Override migration uses ON CONFLICT DO UPDATE to handle potential duplicates safely"
  - "Verification script uses dotenv to load .env.local (same pattern as populate-dummy-data.ts)"

patterns-established:
  - "Migration verification as standalone script: npx tsx scripts/verify-migration.ts"
  - "Row count comparison between source JSONB arrays and target normalized tables"

# Metrics
duration: 3min
completed: 2026-02-08
---

# Phase 4 Plan 02: Migrate v1.0 Data to Normalized Tables Summary

**PL/pgSQL migration copying JSONB-embedded template steps to normalized email_templates/schedules/schedule_steps with TipTap JSON conversion and override splitting, plus TypeScript verification script**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-08T03:49:44Z
- **Completed:** 2026-02-08T03:53:06Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created idempotent PL/pgSQL migration that transforms JSONB steps into normalized rows across 3 tables
- Plain text template bodies wrapped in TipTap JSON paragraph nodes, empty bodies get valid empty documents
- client_template_overrides split into content overrides (client_email_overrides) and timing overrides (client_schedule_overrides)
- Verification script compares row counts, validates TipTap JSON structure, checks filing_type and delay_days consistency
- Old tables (reminder_templates, client_template_overrides) remain completely untouched

## Task Commits

Each task was committed atomically:

1. **Task 1: Create data migration SQL** - `759f409` (feat)
2. **Task 2: Create migration verification script** - `790650b` (feat)

## Files Created/Modified
- `supabase/migrations/20260208000002_migrate_v10_data_to_normalized.sql` - PL/pgSQL DO block migrating reminder_templates to normalized tables with TipTap JSON conversion and override splitting
- `scripts/verify-migration.ts` - TypeScript verification script comparing old and new table row counts, validating TipTap JSON, and checking data consistency

## Decisions Made
- Used new UUIDs for all migrated rows rather than reusing reminder_templates UUIDs (each step becomes its own email_template, so can't reuse the single template UUID for multiple rows)
- Derived urgency_level from step_number position (1-2 = normal, 3 = high, 4+ = urgent) since v1.0 had no urgency concept
- Used ON CONFLICT DO UPDATE for override inserts to safely handle edge cases of duplicate client+template combinations
- Verification script follows existing populate-dummy-data.ts pattern (dotenv loading .env.local, service role key)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - migration needs to be applied via Supabase SQL Editor or `npx supabase db push` as part of normal deployment flow. Verification script can be run after with `npx tsx scripts/verify-migration.ts`.

## Next Phase Readiness
- All v1.0 data can now be migrated to v1.1 normalized structure
- Phase 5 (Rich Text Editor) can build UI on top of email_templates with TipTap JSON bodies
- Phase 7 (Schedule Management) can manage schedules and schedule_steps
- Phase 9 (Queue Integration) can switch from reading reminder_templates to reading schedules
- Old v1.0 tables remain intact for rollback safety and continued queue-builder.ts operation during transition

## Self-Check: PASSED
