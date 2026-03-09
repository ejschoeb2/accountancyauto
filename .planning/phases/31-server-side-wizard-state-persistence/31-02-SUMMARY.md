---
phase: 31-server-side-wizard-state-persistence
plan: 02
subsystem: database, api
tags: [supabase, staging-table, rls, server-actions, csv-import, wizard]

requires:
  - phase: 31-server-side-wizard-state-persistence
    plan: 01
    provides: setup_draft JSONB column, getSetupDraft/saveSetupDraft server actions
provides:
  - setup_draft_clients staging table for large CSV imports
  - saveDraftClients, getDraftClients, clearDraftClients server actions
  - Import rows decoupled from JSONB draft to dedicated table
affects: [wizard, csv-import]

tech-stack:
  added: []
  patterns: [staging table for large transient data, DELETE+INSERT idempotent bulk upsert]

key-files:
  created:
    - supabase/migrations/20260309000002_create_setup_draft_clients.sql
  modified:
    - app/(auth)/setup/wizard/actions.ts
    - app/(auth)/setup/wizard/page.tsx

key-decisions:
  - "importRows removed from SetupDraft interface entirely (now in staging table)"
  - "getDraftClients returns null (not empty array) when no rows exist"
  - "saveDraftClients uses DELETE+INSERT pattern for natural idempotency on re-import"
  - "markOrgSetupComplete clears staging rows as belt-and-suspenders alongside ON DELETE CASCADE"

patterns-established:
  - "Staging table pattern: large transient data in dedicated table instead of JSONB column"
  - "getDraftClients on mount in all resume branches (Stripe, OAuth, normal)"

requirements-completed: []

duration: 15min
completed: 2026-03-09
---

# Phase 31 Plan 02: Draft Clients Staging Table Summary

**setup_draft_clients staging table with saveDraftClients/getDraftClients/clearDraftClients server actions, decoupling large CSV imports from JSONB draft**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-09T22:43:30Z
- **Completed:** 2026-03-09T22:58:13Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created setup_draft_clients staging table with ON DELETE CASCADE FK to organisations
- RLS enabled with service_role-only policy (all access via admin client)
- Added saveDraftClients, getDraftClients, clearDraftClients server actions
- Removed importRows from SetupDraft interface (import data now in staging table)
- Wizard hydrates import rows from staging table on all mount branches
- markOrgSetupComplete clears staging rows (belt-and-suspenders with CASCADE)
- Member wizard path completely unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Staging table migration and server actions** - `3cb8bb8` (feat)
2. **Task 2: Wire wizard page to use staging table** - `75f080a` (feat)

## Files Created/Modified
- `supabase/migrations/20260309000002_create_setup_draft_clients.sql` - Creates staging table with RLS
- `app/(auth)/setup/wizard/actions.ts` - saveDraftClients, getDraftClients, clearDraftClients; importRows removed from SetupDraft; EditableRow import added
- `app/(auth)/setup/wizard/page.tsx` - getDraftClients on mount, saveDraftClients on import, clearDraftClients on downgrade

## Decisions Made
- importRows removed entirely from SetupDraft (not optional/deprecated)
- getDraftClients returns null for "no data" vs empty array
- DELETE+INSERT pattern for saveDraftClients (natural idempotency)
- Belt-and-suspenders cleanup in markOrgSetupComplete alongside CASCADE

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Linter/formatter repeatedly reverted changes to actions.ts between Edit calls. Resolved by writing the complete file content in a single Write operation.

## User Setup Required
None - no external service configuration required. Migration must be applied to Supabase (standard deployment flow).

## Next Phase Readiness
- Phase 31 complete: wizard state persists to DB, large CSV imports in staging table
- Wizard survives page refresh, tab close, OAuth/Stripe redirects, and large imports
- Ready for production deployment

## Self-Check: PASSED

- Migration file: FOUND
- Commit 3cb8bb8: FOUND
- Commit 75f080a: FOUND
- TypeScript: compiles clean

---
*Phase: 31-server-side-wizard-state-persistence*
*Completed: 2026-03-09*
