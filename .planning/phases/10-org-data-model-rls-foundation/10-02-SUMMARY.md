---
phase: 10-org-data-model-rls-foundation
plan: 02
subsystem: database
tags: [multi-tenancy, rls, jwt, security, policies, supabase-hooks]

dependency-graph:
  requires:
    - phase: 10-01
      provides: org_id FK on all 15 data tables, user_organisations junction table
  provides:
    - Custom Access Token Hook injecting org_id and org_role into JWT app_metadata
    - auth_org_id() helper function for RLS policy definitions
    - Org-scoped RLS policies on all 18 tables (15 data + 3 multi-tenant)
    - Global read-only policies on filing_types and bank_holidays_cache
    - Zero anon policies (complete anon lockout)
  affects:
    - 10-03 (cron scoping must use org_id filters now that RLS is active)
    - 10-04 (application code must include org_id in queries)
    - 10-05 (verification plan must test cross-tenant isolation)
    - Phase 13 (org switching will need to update JWT claims)

tech-stack:
  added: []
  patterns:
    - Custom Access Token Hook pattern (PL/pgSQL function called by Supabase Auth)
    - auth_org_id() helper for DRY RLS policy definitions
    - org_id = auth_org_id() as universal RLS USING clause
    - COALESCE to zero UUID for missing claims (prevents NULL comparison bugs)
    - Separate SELECT/INSERT/UPDATE/DELETE policies per table (not FOR ALL)

key-files:
  created:
    - supabase/migrations/20260219000004_create_jwt_hook.sql
    - supabase/migrations/20260219000005_rewrite_rls_policies.sql
    - supabase/migrations/20260219000006_temp_policy_checker.sql
    - supabase/migrations/20260219000007_drop_remaining_anon_policies.sql
  modified: []

key-decisions:
  - "D-10-02-01: app_metadata used for JWT claims (not user_metadata) - user_metadata is client-writable"
  - "D-10-02-02: auth_org_id() returns zero UUID on missing claims rather than NULL"
  - "D-10-02-03: Separate per-operation policies (SELECT/INSERT/UPDATE/DELETE) instead of FOR ALL"
  - "D-10-02-04: organisations table - authenticated can only SELECT own org, no write access"
  - "D-10-02-05: user_organisations - authenticated can SELECT org members only, no write access"
  - "D-10-02-06: filing_types and bank_holidays_cache - read-only for authenticated, write restricted to service_role"

patterns-established:
  - "JWT Hook: Supabase Auth calls custom_access_token_hook on every token issue/refresh"
  - "RLS Helper: auth_org_id() extracts org_id from JWT app_metadata for policy use"
  - "Policy Naming: {table}_{operation}_org convention for org-scoped policies"
  - "Zero UUID Fallback: COALESCE missing claims to 00000000-... rather than NULL"

duration: ~17 min
completed: 2026-02-19
---

# Phase 10 Plan 02: JWT Hook & RLS Policy Rewrite Summary

**Custom Access Token Hook injecting org_id/org_role into JWT app_metadata, with org-scoped RLS policies replacing USING(true) on all 18 tables and complete anon lockout**

## Performance

- **Duration:** 17 min
- **Started:** 2026-02-19T22:31:35Z
- **Completed:** 2026-02-19T22:48:50Z
- **Tasks:** 2
- **Files created:** 4 migration files

## Accomplishments
- JWT Custom Access Token Hook that injects org_id and org_role from user_organisations into every authenticated JWT
- auth_org_id() helper function providing clean, DRY access to org_id from JWT claims in RLS policies
- Org-scoped RLS policies on all 15 data tables (4 policies each: SELECT/INSERT/UPDATE/DELETE)
- Org-scoped policies on 3 multi-tenant tables (organisations, user_organisations, invitations)
- Complete anon lockout: zero anon policies remain on any table (security fix for re-created anon policies)
- Filing_types and bank_holidays_cache restricted to read-only for authenticated users
- All 45 verification checks passed (JWT hook, service role access, anon lockout)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Custom Access Token Hook** - `8122de1` (feat)
2. **Task 2: Rewrite all RLS policies to use org_id scoping** - `05b10be` (feat)

## Files Created/Modified

- `supabase/migrations/20260219000004_create_jwt_hook.sql` - JWT hook function + auth_org_id() helper + permission grants
- `supabase/migrations/20260219000005_rewrite_rls_policies.sql` - Drop USING(true) policies, create org-scoped policies on all 18 tables, drop anon policies, validation
- `supabase/migrations/20260219000006_temp_policy_checker.sql` - Temporary debug function for pg_policies inspection (function dropped by 000007)
- `supabase/migrations/20260219000007_drop_remaining_anon_policies.sql` - Patch migration to drop anon policies that survived auth switchover

## Decisions Made

| ID | Decision | Reason |
|----|----------|--------|
| D-10-02-01 | app_metadata for JWT claims, not user_metadata | user_metadata is client-writable; app_metadata requires service role to modify |
| D-10-02-02 | auth_org_id() returns zero UUID on missing claims | NULL would cause unexpected behavior in equality checks (NULL = X is NULL, not false) |
| D-10-02-03 | Separate per-operation policies instead of FOR ALL | Granular control; clearer intent; easier to audit and modify individual operations |
| D-10-02-04 | organisations: authenticated SELECT only, no writes | Org management should go through service_role API routes for safety |
| D-10-02-05 | user_organisations: authenticated SELECT only, no writes | Member management should go through service_role API routes |
| D-10-02-06 | filing_types/bank_holidays_cache: read-only for authenticated | Reference data; writes restricted to service_role (cron jobs) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Anon policies still active on data tables (security vulnerability)**
- **Found during:** Task 2 verification
- **Issue:** 25 anon policies were still active on clients, email_templates, schedules, and 9 other tables. These should have been removed by the auth switchover migration (20260212000001), but were re-created when older migrations (20260207131000, 20260207193244, etc.) were re-applied due to `--include-all` migration push ordering during 10-01 execution.
- **Fix:** Added anon policy drops to the 20260219000005 file (for future fresh deployments) AND created patch migration 20260219000007 to drop them from the live database. Added validation block confirming zero anon policies remain.
- **Files created:** `supabase/migrations/20260219000007_drop_remaining_anon_policies.sql`
- **Verification:** Validation block in migration passes; anon REST API returns 0 rows for all 20 tables tested
- **Committed in:** `05b10be` (Task 2 commit)

**2. [Rule 3 - Blocking] Temporary debug function needed for policy inspection**
- **Found during:** Task 2 verification
- **Issue:** Could not query pg_policies through Supabase REST API (system tables not exposed). Needed to inspect actual policy state to diagnose anon access.
- **Fix:** Created temporary _debug_list_policies() function via migration, called via RPC to inspect policies, then dropped it in the anon cleanup migration.
- **Files created:** `supabase/migrations/20260219000006_temp_policy_checker.sql`
- **Verification:** Function created, used, and dropped cleanly
- **Committed in:** `05b10be` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** The anon policy fix was critical for security. Without it, unauthenticated users had full read/write access to all data tables. No scope creep.

## User Setup Required

**The JWT hook must be enabled in the Supabase Dashboard:**
1. Go to Authentication > Hooks (under Configuration)
2. Enable "Custom Access Token Hook"
3. Select schema: `public`, function: `custom_access_token_hook`
4. Save

This step cannot be automated via SQL migration. Until enabled, JWTs will not contain org_id/org_role claims, and authenticated users will see zero rows (auth_org_id() returns the zero UUID fallback which matches nothing).

## Verification Results

All 45 automated checks passed:
- JWT hook function callable and injects org_id/org_role correctly
- auth_org_id() returns zero UUID without JWT claims
- Service role reads all 20 tables successfully
- Anon role returns 0 rows on all 20 tables
- DB validation: zero USING(true) authenticated policies on data tables
- DB validation: zero anon policies on any table

## Next Phase Readiness

**Blockers:** The JWT hook must be enabled in the Supabase Dashboard (see User Setup above). Without it, the RLS policies will block all authenticated users since their JWT won't contain org_id.

**Ready for Plan 03:** Cron job scoping can now use org_id to iterate over organisations.

**Ready for Plan 04:** Application code can be updated to include org_id in queries. The auth_org_id() function handles the JWT extraction automatically in RLS policies, but INSERT operations must explicitly set org_id.

**Note:** The `20260210` migration history entry keeps being marked as `reverted` and re-applied each time `--include-all` is used. This is harmless (the migration uses `IF NOT EXISTS`) but causes noise. A permanent fix would be to delete the file or rename it with a proper timestamp.

## Self-Check: PASSED

All 4 created files verified to exist on filesystem.
Both commit hashes (8122de1, 05b10be) verified to exist in git history.

---
*Phase: 10-org-data-model-rls-foundation*
*Completed: 2026-02-19*
