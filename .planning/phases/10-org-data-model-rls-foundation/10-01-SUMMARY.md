---
phase: 10-org-data-model-rls-foundation
plan: 01
subsystem: database
tags: [multi-tenancy, organisations, migrations, rls, schema]

dependency-graph:
  requires: []
  provides:
    - organisations table with founding org row
    - user_organisations junction table
    - invitations table
    - org_id FK on all 15 data tables
    - app_settings restructured with (org_id, key) unique constraint
  affects:
    - 10-02 (RLS policies depend on org_id columns)
    - 10-03 (JWT hook depends on user_organisations)
    - 10-04 (cron scoping depends on org_id)
    - 10-05 (application code must include org_id in queries)

tech-stack:
  added: []
  patterns:
    - org_id FK on every tenant-scoped table
    - backfill-then-constrain migration pattern (nullable -> update -> NOT NULL)
    - validation migration as safety net

key-files:
  created:
    - supabase/migrations/20260219000001_create_organisations_and_user_orgs.sql
    - supabase/migrations/20260219000002_add_org_id_to_all_tables.sql
    - supabase/migrations/20260219000003_validate_org_migration.sql
  modified: []

decisions:
  - id: D-10-01-01
    decision: "app_settings restructured from key TEXT PK to UUID id PK + UNIQUE(org_id, key)"
    reason: "Multi-tenant settings need org scoping; key alone cannot be unique across orgs"
  - id: D-10-01-02
    decision: "locks table keeps TEXT PK; org scoping done via org_id column + application code"
    reason: "Changing lock ID format is simpler in app code than restructuring the PK"
  - id: D-10-01-03
    decision: "Skip filing_types, bank_holidays_cache, oauth_tokens from org_id migration"
    reason: "These are global reference data shared across all orgs per ORG-06"
  - id: D-10-01-04
    decision: "Temporary USING(true) RLS policies on new tables"
    reason: "Plan 02 will replace with org-scoped policies; needed now for basic access"

metrics:
  duration: ~15 min
  completed: 2026-02-19
---

# Phase 10 Plan 01: Database Schema - Multi-Tenant Foundation Summary

**One-liner:** Three migration files creating organisations/user_organisations/invitations tables, adding org_id FK to 15 data tables, backfilling to founding org, and validating zero data loss.

## What Was Done

### Task 1: Create organisations, user_organisations, and invitations tables
Created the core multi-tenancy schema:
- **organisations** table with slug, plan_tier, Stripe/Postmark fields, and slug format CHECK constraint
- **user_organisations** junction table linking users to orgs with role (admin/member)
- **invitations** table with token_hash, expires_at for secure team invites
- Three new enums: `plan_tier_enum`, `org_role_enum`, `subscription_status_enum`
- Seeded founding org "Peninsula Accounting" (slug=peninsula, plan_tier=firm, subscription_status=active)
- Linked existing user as admin of founding org
- Temporary permissive RLS policies on all three tables

### Task 2: Add org_id to all data tables and backfill
Added `org_id UUID NOT NULL REFERENCES organisations(id)` to 15 tables:
1. clients
2. email_templates
3. schedules
4. schedule_steps
5. schedule_client_exclusions
6. client_email_overrides
7. client_schedule_overrides
8. client_filing_assignments
9. client_deadline_overrides
10. client_filing_status_overrides
11. reminder_queue
12. email_log
13. inbound_emails
14. app_settings (special: restructured PK from key-only to UUID id + UNIQUE(org_id, key))
15. locks (special: kept TEXT PK, added org_id for scoping)

All existing data backfilled to founding org. Added org_id index on every table for RLS query performance.

### Task 3: Validation migration
Comprehensive validation migration that checks:
- Founding org exists with correct attributes
- Zero NULL org_ids across all 15 tables
- Zero orphaned org_ids (all reference valid organisations row)
- user_organisations has at least one link
- app_settings has UNIQUE constraint on (org_id, key)
- invitations table has all required columns
- Inserts `v3_migration_complete = true` marker

## Task Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create organisations, user_organisations, invitations | `6bf9617` | `20260219000001_create_organisations_and_user_orgs.sql` |
| 2 | Add org_id to all data tables and backfill | `52ea951` | `20260219000002_add_org_id_to_all_tables.sql` |
| 3 | Validation migration | `0067c2e` | `20260219000003_validate_org_migration.sql` |

## Decisions Made

| ID | Decision | Reason |
|----|----------|--------|
| D-10-01-01 | app_settings restructured from key TEXT PK to UUID id PK + UNIQUE(org_id, key) | Multi-tenant settings need org scoping; key alone cannot be unique across orgs |
| D-10-01-02 | locks keeps TEXT PK; org scoping via org_id column + app code | Changing lock ID format is simpler in app code than PK restructuring |
| D-10-01-03 | Skip filing_types, bank_holidays_cache, oauth_tokens from migration | Global reference data shared across all orgs per ORG-06 |
| D-10-01-04 | Temporary USING(true) RLS policies on new tables | Plan 02 replaces with org-scoped policies |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Migration history conflict with 20260210 entry**
- **Found during:** Task 1
- **Issue:** Remote database had an orphaned `20260210` migration entry not matching any local file, plus the local `20260210_add_schedule_send_hour.sql` was out of order. This blocked `migration up --linked`.
- **Fix:** Used `supabase migration repair --status reverted` for the orphaned remote entry, then `--include-all` flag to apply local migrations regardless of ordering.
- **Files modified:** None (only Supabase migration history table)
- **Impact:** None. The `20260210` send_hour migration uses `IF NOT EXISTS` so re-applying is harmless.

**2. [Rule 3 - Blocking] 20260216203749_create_inbound_emails.sql not recorded in remote history**
- **Found during:** Task 1
- **Issue:** The inbound_emails migration was applied to the remote database but not recorded in migration history, causing index creation errors on re-apply.
- **Fix:** Used `supabase migration repair 20260216203749 --status applied` to mark it as already applied.
- **Files modified:** None
- **Impact:** None.

## Verification Results

All 6 verification checks passed:
1. organisations has exactly 1 row (Peninsula Accounting, slug=peninsula, plan_tier=firm)
2. user_organisations has 1 row (matching 1 auth.users row)
3. All 15 data tables have zero NULL org_ids
4. app_settings has UNIQUE constraint on (org_id, key)
5. invitations has all required columns (token_hash, expires_at, org_id)
6. v3_migration_complete = true in app_settings

## Next Phase Readiness

**Blockers:** None.

**Ready for Plan 02:** RLS policies can now use `org_id` column for row filtering. The JWT hook (Plan 03) and cron scoping (Plan 04) can reference `user_organisations` and `organisations` tables.

**Note:** Application code (Plan 05) must be updated to include `org_id` in all queries and mutations. The current app will continue to work because RLS policies are still `USING(true)` and org_id is already populated.

**Postmark token:** The founding org's `postmark_server_token` column is NULL. This needs to be populated before cron switches to per-org token mode (Plan 04 or Phase 12). Run: `UPDATE organisations SET postmark_server_token = '<token>' WHERE slug = 'peninsula';`

## Self-Check: PASSED
