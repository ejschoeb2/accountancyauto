---
phase: 15-per-accountant-config
plan: 01
subsystem: database
tags: [postgres, rls, supabase, migrations, owner-scoping]

# Dependency graph
requires:
  - phase: quick-5-accountant-scoped-client-isolation
    provides: "owner_id on clients table, auth_org_role() helper function, admin/member RLS split pattern"
  - phase: 10-org-data-model-rls-foundation
    provides: "auth_org_id() helper, org_id on all tables, org-scoped RLS foundation"
provides:
  - "owner_id NOT NULL on email_templates, schedules, schedule_steps, schedule_client_exclusions"
  - "nullable user_id on app_settings with NULLS NOT DISTINCT unique constraint (org_id, user_id, key)"
  - "Owner-scoped RLS policies on all four resource tables (admin sees all, member sees own)"
  - "Org-scoped RLS on app_settings (user_id filtering done in application code)"
affects:
  - 15-02 (cron pipeline refactor — queries now need per-user scoping)
  - 15-03 (settings actions — need to resolve user setting vs org default fallback)
  - 15-04 (nav/page access changes — members can now access their own templates/schedules)
  - 15-05 (new user seeding — owner_id required on all new resource rows)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "NULLS NOT DISTINCT unique constraint for nullable user_id in multi-tenant settings table"
    - "Same admin/member RLS split pattern from clients now applied to all resource tables"
    - "Backfill to earliest admin per org using COALESCE (admin > member > any user)"

key-files:
  created:
    - supabase/migrations/20260222100001_add_owner_id_to_resource_tables.sql
    - supabase/migrations/20260222100002_add_user_id_to_app_settings.sql
    - supabase/migrations/20260222100003_rewrite_resource_tables_rls.sql
  modified: []

key-decisions:
  - "[D-15-01-01] NULLS NOT DISTINCT for app_settings unique constraint — PostgreSQL 15+ feature ensures (org_id, NULL, key) is truly unique; without it, multiple org-level default rows per key would be allowed"
  - "[D-15-01-02] app_settings RLS stays org-scoped (not owner-scoped) — org-level defaults (user_id IS NULL) must be readable by all org members; user-specific overrides readable by all for fallback resolution in application code"
  - "[D-15-01-03] Do NOT backfill user_id on app_settings — existing rows are org-level defaults (NULL = org-level is correct semantic)"
  - "[D-15-01-04] Migration history repair pattern — use --include-all flag to push migrations when remote history has out-of-order entries from dashboard-applied migrations"

patterns-established:
  - "Owner-scoped RLS: four resource tables now follow same admin/member pattern as clients table"
  - "Settings fallback pattern: read user row (user_id = auth.uid()), fall back to org default (user_id IS NULL)"

requirements-completed: []

# Metrics
duration: 7min
completed: 2026-02-22
---

# Phase 15 Plan 01: Per-Accountant Config DB Foundation Summary

**Three Supabase migrations adding owner_id to four resource tables and NULLS NOT DISTINCT user_id to app_settings, with owner-scoped RLS policies enforcing admin/member access split**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-22T01:34:27Z
- **Completed:** 2026-02-22T01:41:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added owner_id NOT NULL to email_templates, schedules, schedule_steps, schedule_client_exclusions with backfill to earliest admin per org
- Added nullable user_id to app_settings with NULLS NOT DISTINCT unique constraint enabling per-user settings overrides alongside org-level defaults
- Rewrote RLS policies on all four resource tables to enforce admin (sees all in org) vs member (sees only own) access split

## Task Commits

Each task was committed atomically:

1. **Task 1: Add owner_id to resource tables and user_id to app_settings** - `1f79638` (feat)
2. **Task 2: Rewrite RLS policies for resource tables with owner_id scoping** - `1e6b42a` (feat)

## Files Created/Modified
- `supabase/migrations/20260222100001_add_owner_id_to_resource_tables.sql` - Adds owner_id UUID NOT NULL (with backfill and index) to four resource tables
- `supabase/migrations/20260222100002_add_user_id_to_app_settings.sql` - Adds nullable user_id to app_settings with NULLS NOT DISTINCT constraint on (org_id, user_id, key)
- `supabase/migrations/20260222100003_rewrite_resource_tables_rls.sql` - Rewrites RLS on resource tables to owner-scoped admin/member split; keeps app_settings org-scoped

## Decisions Made
- NULLS NOT DISTINCT ensures `(org_id, NULL, key)` uniqueness — without this PostgreSQL would allow multiple org-level defaults for the same key
- app_settings stays org-scoped in RLS (not owner-scoped) because both org defaults (user_id NULL) and user overrides must be readable by all org members to support the fallback resolution pattern
- Existing app_settings rows intentionally left with user_id NULL — they are org-level defaults, which is semantically correct

## Deviations from Plan

None - plan executed exactly as written.

Note: Supabase CLI migration history required `--include-all` flag due to out-of-order entries from migrations previously applied via the Supabase dashboard. This is a known project pattern (see MEMORY.md) and required migration repair commands to resolve, but did not affect the migrations themselves.

## Issues Encountered
- Supabase CLI migration history conflicts: remote DB had migration versions (20260222005958, 20260222010014, 20260210) not present locally as files. Resolved by using `supabase migration repair --status reverted` for remote-only entries and `--include-all` flag for the push command. All three target migrations applied successfully.

## User Setup Required

None - no external service configuration required.

## Self-Check: PASSED

All created files exist and commits verified:
- `supabase/migrations/20260222100001_add_owner_id_to_resource_tables.sql` - FOUND
- `supabase/migrations/20260222100002_add_user_id_to_app_settings.sql` - FOUND
- `supabase/migrations/20260222100003_rewrite_resource_tables_rls.sql` - FOUND
- `.planning/phases/15-per-accountant-config/15-01-SUMMARY.md` - FOUND
- Commit `1f79638` - FOUND
- Commit `1e6b42a` - FOUND

## Next Phase Readiness
- Database foundation complete for per-accountant resource ownership
- All four resource tables have owner_id NOT NULL with backfilled data and owner-scoped RLS
- app_settings has user_id column ready for per-user settings in Phase 15-03
- Ready for Phase 15-02: cron pipeline refactor (per-user inner loop)
- Ready for Phase 15-03: settings actions update (user-level resolution with org default fallback)
- Ready for Phase 15-04: nav/page access changes (members can access their templates/schedules)
- Ready for Phase 15-05: new user seeding (owner_id required on all resource rows)

---
*Phase: 15-per-accountant-config*
*Completed: 2026-02-22*
