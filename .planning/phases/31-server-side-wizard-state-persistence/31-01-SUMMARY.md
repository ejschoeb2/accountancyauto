---
phase: 31-server-side-wizard-state-persistence
plan: 01
subsystem: database, api
tags: [supabase, jsonb, server-actions, wizard, sessionStorage]

# Dependency graph
requires:
  - phase: 13-onboarding-wizard
    provides: wizard page with sessionStorage-based persistence
provides:
  - setup_draft JSONB column on organisations table
  - getSetupDraft/saveSetupDraft server actions
  - DB-backed wizard state hydration and fire-and-forget saves
affects: [31-02, wizard, setup]

# Tech tracking
tech-stack:
  added: []
  patterns: [fire-and-forget server action saves, DB draft hydration on mount]

key-files:
  created:
    - supabase/migrations/20260309000001_add_setup_draft_column.sql
  modified:
    - app/(auth)/setup/wizard/actions.ts
    - app/(auth)/setup/wizard/page.tsx

key-decisions:
  - "importRows stored as unknown[] in JSONB draft (not separate table) for Plan 01 simplicity"
  - "advanceToStep wrapper for user-initiated transitions; setAdminStep kept for mount hydration"
  - "beforeunload guard now checks orgCreated instead of sessionStorage key"
  - "No draft save when advancing to complete step (avoids race with markOrgSetupComplete)"

patterns-established:
  - "hydrateFromDraft/collectCurrentState/advanceToStep pattern for DB-backed wizard state"
  - "Fire-and-forget saveSetupDraft calls with .catch() for non-blocking persistence"

requirements-completed: []

# Metrics
duration: 8min
completed: 2026-03-09
---

# Phase 31 Plan 01: Server-Side Wizard State Persistence Summary

**setup_draft JSONB column on organisations with getSetupDraft/saveSetupDraft server actions replacing all sessionStorage-based wizard persistence**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-09T22:43:09Z
- **Completed:** 2026-03-09T22:51:03Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Migration adds setup_draft JSONB column to organisations table
- getSetupDraft and saveSetupDraft server actions follow existing user_organisations auth pattern
- Wizard page hydrates from DB draft on mount with priority-based step selection (URL params > draft > org membership check)
- Fire-and-forget draft saves on every user-initiated step transition via advanceToStep wrapper
- All sessionStorage wizard keys removed except wizard_pending_email (pre-account)
- markOrgSetupComplete clears setup_draft to null (prevents stale drafts)
- Member wizard path completely unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Migration + server actions** - `0c16505` (feat)
2. **Task 2: Refactor wizard page** - `038868f` (feat)
3. **Fix: Restore importRows field** - `0231368` (fix) - linter removed required field
4. **Fix: Remove premature staging code** - `dd566d2` (fix) - linter added Plan 31-02 code

## Files Created/Modified
- `supabase/migrations/20260309000001_add_setup_draft_column.sql` - Adds setup_draft JSONB column to organisations
- `app/(auth)/setup/wizard/actions.ts` - SetupDraft interface, getSetupDraft, saveSetupDraft; markOrgSetupComplete clears draft
- `app/(auth)/setup/wizard/page.tsx` - DB-backed hydration, advanceToStep wrapper, removed sessionStorage persistence

## Decisions Made
- Used `unknown[]` for importRows in SetupDraft to avoid coupling server action types to client component types
- advanceToStep wrapper only saves draft when orgCreated is true and nextStep is not "complete"
- In handleSelectPlan, draft is saved directly (not via advanceToStep) because setOrgCreated state update is async
- beforeunload guard now uses orgCreated flag instead of sessionStorage presence check

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Linter repeatedly removed importRows from SetupDraft**
- **Found during:** Task 2 (post-commit verification)
- **Issue:** External linter/formatter removed the importRows field and added unrelated Plan 31-02 staging table functions
- **Fix:** Restored importRows field, removed premature staging code, removed unused EditableRow import
- **Files modified:** app/(auth)/setup/wizard/actions.ts
- **Verification:** npx tsc --noEmit passes clean
- **Committed in:** 0231368, dd566d2

---

**Total deviations:** 1 auto-fixed (1 blocking - linter interference)
**Impact on plan:** Linter added out-of-scope code that had to be cleaned up. No scope creep.

## Issues Encountered
- Linter/formatter modified actions.ts between edits, adding Plan 31-02 staging table functions and removing importRows. Required two additional fix commits to clean up.

## User Setup Required
None - no external service configuration required. Migration must be applied to Supabase (standard deployment flow).

## Next Phase Readiness
- Plan 31-02 (if it exists) can build on top of setup_draft column for large CSV import optimization
- Wizard state now survives page refresh, tab close, and OAuth/Stripe redirects once org is created
- Pre-org steps (account, firm, plan) still rely on in-memory state only (by design)

---
*Phase: 31-server-side-wizard-state-persistence*
*Completed: 2026-03-09*
