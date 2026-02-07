---
phase: 02-reminder-engine
plan: 01
subsystem: database-foundation
tags: [database, schema, migration, typescript, dependencies]

requires:
  - phase-1-complete

provides:
  - phase-2-database-schema
  - phase-2-typescript-types
  - react-hook-form-dependency
  - react-big-calendar-dependency

affects:
  - all-phase-2-plans

tech-stack:
  added:
    - react-hook-form@7.71.1
    - react-big-calendar@1.19.4
    - "@types/react-big-calendar"
  patterns:
    - multi-step-reminder-templates
    - client-level-overrides
    - scheduled-reminder-queue
    - bank-holiday-caching

key-files:
  created:
    - supabase/migrations/create_phase2_schema.sql
    - lib/types/database.ts
  modified:
    - package.json
    - package-lock.json

decisions:
  - id: filing-types-as-text-enum
    choice: Use TEXT primary keys for filing_types instead of UUID
    rationale: Filing types are reference data with meaningful IDs (e.g., 'corporation_tax_payment') that improve code readability and make queries clearer
  - id: steps-as-jsonb-array
    choice: Store template steps as JSONB array instead of separate table
    rationale: Steps are always queried together with template, JSONB simplifies queries and updates while maintaining flexibility
  - id: has-overrides-trigger
    choice: Auto-update has_overrides flag via trigger instead of application logic
    rationale: Database-level trigger ensures flag is always accurate regardless of which code path modifies overrides
  - id: placeholder-variables-constant
    choice: Export PLACEHOLDER_VARIABLES as TypeScript constant
    rationale: Provides autocomplete/reference for template editor UI without hardcoding in components

metrics:
  duration: 3.6 minutes
  completed: 2026-02-06
---

# Phase 02 Plan 01: Database Schema & Dependencies Summary

**One-liner:** Created 7 Phase 2 database tables with seed data, extended clients table with reminder metadata, installed react-hook-form and react-big-calendar, and exported TypeScript types for all new schema entities.

## What Was Built

### Database Schema (create_phase2_schema.sql)

**Reference Tables:**
- `filing_types`: Reference table with 5 UK filing types (Corporation Tax Payment, CT600 Filing, Companies House Accounts, VAT Return, Self Assessment) - each specifies which client types it applies to by default
- Seed data inserted for all 5 filing types with applicable_client_types arrays

**Core Reminder System:**
- `reminder_templates`: One template per filing type, stores multi-step reminder sequences as JSONB array (step_number, delay_days, subject, body)
- `client_filing_assignments`: Tracks which filing types apply to each client (with is_active toggle for manual enable/disable)
- `reminder_queue`: Scheduled/pending reminders ready for cron job processing (statuses: scheduled, pending, sent, cancelled, failed)

**Client-Level Overrides:**
- `client_deadline_overrides`: Per-client custom deadline dates (e.g., HMRC extension granted)
- `client_template_overrides`: Field-level customizations per client per template step (subject, body, delay_days)

**Supporting Tables:**
- `bank_holidays_cache`: Cached gov.uk bank holiday data for business day calculations
- Extended `clients` table with:
  - `has_overrides` BOOLEAN (auto-updated by trigger when template overrides exist)
  - `reminders_paused` BOOLEAN (for pause/unpause functionality)
  - `records_received_for` JSONB (array of filing_type_ids where records received, used to auto-cancel reminders)

**Indexes:**
- `idx_reminder_queue_send_date_status`: Optimizes cron job queries for today's pending reminders
- `idx_reminder_queue_client_filing`: Fast lookup of reminders per client/filing type
- `idx_client_filing_assignments_client`, `idx_client_template_overrides_client`, `idx_client_deadline_overrides_client`: Speed up client detail page queries

**Triggers:**
- Auto-update `updated_at` on reminder_templates, client_deadline_overrides, client_template_overrides, reminder_queue
- Auto-update `has_overrides` flag on clients when template overrides are inserted/updated/deleted

**RLS Policies:**
- Authenticated users: Full CRUD on all Phase 2 tables
- Service role: Full access for cron jobs and background tasks

### TypeScript Types (lib/types/database.ts)

**Exported Types:**
- `FilingTypeId`: Union type of 5 filing type identifiers
- `FilingType`: Interface for filing_types table
- `TemplateStep`: Structure for individual reminder steps within template
- `ReminderTemplate`: Interface for reminder_templates table
- `ClientFilingAssignment`: Interface for client_filing_assignments table
- `ClientDeadlineOverride`: Interface for client_deadline_overrides table
- `ClientTemplateOverride`: Interface for client_template_overrides table
- `BankHoliday`: Interface for bank_holidays_cache table
- `ReminderStatus`: Union type of 5 reminder statuses
- `ReminderQueueItem`: Interface for reminder_queue table
- `PLACEHOLDER_VARIABLES`: Constant array of available template placeholders (client_name, deadline, deadline_short, filing_type, days_until_deadline, accountant_name)

All types mirror the database schema 1:1 and compile without errors.

### Dependencies Installed

- `react-hook-form@7.71.1`: Form state management for template editor and override forms
- `react-big-calendar@1.19.4`: Calendar view for deadline visualization
- `@types/react-big-calendar`: TypeScript definitions (dev dependency)

## Task Commits

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Create Phase 2 database migration and install dependencies | 016df5f | supabase/migrations/create_phase2_schema.sql, package.json, package-lock.json |
| 2 | Create TypeScript types for Phase 2 database tables | 0527ff7 | lib/types/database.ts |

## Decisions Made

**1. Filing types as TEXT enum vs UUID:**
- **Decision:** Use TEXT primary keys (e.g., 'corporation_tax_payment') instead of UUIDs
- **Rationale:** Filing types are reference data with stable, meaningful identifiers. TEXT keys improve code readability (can reference 'corporation_tax_payment' directly instead of magic UUID) and make SQL queries/logs clearer. No performance penalty since table has only 5 rows.

**2. Template steps as JSONB array vs separate table:**
- **Decision:** Store steps as JSONB array in reminder_templates
- **Rationale:** Steps are always queried together with their template (never independently), JSONB simplifies queries (single SELECT instead of JOIN), and provides flexibility for future step schema changes without migrations. PostgreSQL JSONB indexing handles step lookups efficiently.

**3. has_overrides flag auto-update via trigger:**
- **Decision:** Database trigger automatically maintains has_overrides flag on clients table
- **Rationale:** Ensures flag is always accurate regardless of which code path creates/deletes overrides (API routes, admin tools, bulk operations). Prevents desync bugs and eliminates need for application code to remember to update flag.

**4. PLACEHOLDER_VARIABLES as exported constant:**
- **Decision:** Export placeholder variables as TypeScript constant instead of hardcoding in UI
- **Rationale:** Single source of truth for available placeholders, enables autocomplete in template editor, makes it easy to add new placeholders in future (just update one constant), and provides description metadata for UI tooltips.

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

All verification checks passed:
- ✅ SQL migration file exists at `supabase/migrations/create_phase2_schema.sql`
- ✅ All 7 tables defined: filing_types, reminder_templates, client_filing_assignments, client_deadline_overrides, client_template_overrides, bank_holidays_cache, reminder_queue
- ✅ Seed data for 5 filing types present
- ✅ All foreign keys reference existing Phase 1 tables (clients)
- ✅ RLS policies created for all 7 new tables (authenticated + service_role)
- ✅ Indexes created for query optimization
- ✅ 3 new columns added to clients table (has_overrides, reminders_paused, records_received_for)
- ✅ `npm ls react-hook-form react-big-calendar` shows both installed (v7.71.1 and v1.19.4)
- ✅ TypeScript types compile without errors (`npx tsc --noEmit lib/types/database.ts`)
- ✅ All 10+ interfaces/types exported from database.ts

## Next Phase Readiness

**Ready for Phase 2 continuation:**
- Database schema is complete and ready for migration to Supabase
- TypeScript types available for import in all Phase 2 UI components
- Dependencies installed for form handling and calendar visualization

**Pending action items:**
1. Run migration in Supabase SQL Editor to create tables
2. Seed reminder_templates with initial template data (will be done in later plans)
3. Test RLS policies work with authenticated users

**No blockers.** Phase 2 foundation is complete.

## Self-Check: PASSED

**Files created verification:**
- ✅ supabase/migrations/create_phase2_schema.sql exists
- ✅ lib/types/database.ts exists

**Commits verification:**
- ✅ 016df5f exists in git log
- ✅ 0527ff7 exists in git log
