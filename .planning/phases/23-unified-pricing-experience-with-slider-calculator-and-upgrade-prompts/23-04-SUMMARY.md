---
phase: 23-unified-pricing-experience-with-slider-calculator-and-upgrade-prompts
plan: 04
subsystem: ui
tags: [stripe, react, billing, upgrade-prompt, csv-import]

# Dependency graph
requires:
  - phase: 23-01
    provides: PLAN_TIERS, PlanTier type, lib/stripe/plans.ts
  - phase: 23-03
    provides: checkClientLimit, getUsageStats, lib/billing/usage-limits.ts

provides:
  - components/upgrade-modal.tsx — reusable upgrade prompt dialog with usage bar and next tier card
  - CLIENT_LIMIT_REACHED structured error from POST /api/clients
  - onLimitReached callback pattern in CreateClientDialog
  - UpgradeModal integrated into ClientTable via onLimitReached
  - CsvImportResult.limitInfo for partial import reporting
  - Partial import logic in importClientMetadata (truncates to remaining capacity)
  - Amber limitInfo warning in wizard CsvImportStep and dashboard CsvImportDialog

affects: [billing, csv-import, client-creation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Structured API error response with code field (CLIENT_LIMIT_REACHED) enables typed client-side branching
    - Parent-delegated limit handling — dialog fires onLimitReached callback, parent owns upgrade modal state
    - IIFE pattern in JSX for conditional modal rendering with computed props
    - Partial array truncation (splice) for capacity-bounded batch insert

key-files:
  created:
    - components/upgrade-modal.tsx
  modified:
    - lib/billing/usage-limits.ts
    - app/api/clients/route.ts
    - app/(dashboard)/clients/components/create-client-dialog.tsx
    - app/(dashboard)/clients/components/client-table.tsx
    - app/actions/csv.ts
    - app/(auth)/setup/wizard/components/csv-import-step.tsx
    - app/(dashboard)/clients/components/csv-import-dialog.tsx

key-decisions:
  - "onLimitReached callback pattern: CreateClientDialog closes itself and delegates modal ownership to ClientTable — keeps dialog stateless regarding upgrade flow"
  - "IIFE in JSX for UpgradeModal — conditional rendering with computed tier props without extracting a separate component"
  - "Partial import via splice on unmatchedRows — simple, in-place truncation avoids index tracking"
  - "limitInfo returned in CsvImportResult (not thrown as error) — partial import is a success state, not a failure"
  - "CSV limit check omitted for matched clients — only new client creation is capacity-bounded"

patterns-established:
  - "Structured error code pattern: API returns { error, code, ...data } allowing typed client-side branching on code === 'CLIENT_LIMIT_REACHED'"
  - "Upgrade modal receives all tier display data as props — no internal Stripe lookups, just render"

requirements-completed: []

# Metrics
duration: 20min
completed: 2026-02-27
---

# Phase 23 Plan 04: Upgrade Prompts and Client-Limit Enforcement Summary

**UpgradeModal component with usage bar and next-tier card; CLIENT_LIMIT_REACHED structured API error; CSV partial import with capacity tracking and amber limitInfo warning**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-02-27T02:00:00Z
- **Completed:** 2026-02-27T02:20:00Z
- **Tasks:** 3 of 3 complete
- **Files modified:** 7

## Accomplishments
- Created `components/upgrade-modal.tsx` — reusable dialog showing current usage bar, next tier card, and upgrade CTA that redirects to Stripe Checkout
- Updated POST /api/clients to return `code: "CLIENT_LIMIT_REACHED"` with `currentCount` and `limit` for structured client-side handling
- Added `onLimitReached` callback to `CreateClientDialog`; on limit error it closes itself and fires the callback with usage data
- Wired `UpgradeModal` into `ClientTable` — opens when `onLimitReached` fires, determines next tier from `currentLimit`, calls `/api/stripe/create-checkout-session`
- Added `checkClientLimit` call in `importClientMetadata` — truncates new clients to remaining capacity, populates optional `limitInfo` in result
- Amber warning shown in wizard `CsvImportStep` and dashboard `CsvImportDialog` when `limitInfo` is present, with upgrade link in dashboard version
- Dashboard CSV import now creates new clients for unmatched rows (`createIfMissing=true`) with red-row limit highlighting, limit warning banner, and "Clients created" summary card

## Task Commits

Each task was committed atomically:

1. **Task 1: UpgradeModal and client creation flow integration** - `9679cbd` (feat)
2. **Task 2: CSV import limit-awareness and partial import** - `bac071d` (feat)
3. **Task 3: Dashboard CSV client creation + verification** - `7c5b5c9` (feat)

## Files Created/Modified
- `components/upgrade-modal.tsx` — Reusable upgrade dialog with usage progress bar and next tier card
- `lib/billing/usage-limits.ts` — Added `OrgBillingInfo` interface and `getOrgBillingInfo` helper
- `app/api/clients/route.ts` — Structured CLIENT_LIMIT_REACHED error with currentCount and limit
- `app/(dashboard)/clients/components/create-client-dialog.tsx` — Added `onLimitReached` callback prop; delegates limit errors to parent
- `app/(dashboard)/clients/components/client-table.tsx` — Added UpgradeModal state, `handleLimitReached`, `getNextTierInfo`, `handleUpgradeClick`; wired into CreateClientDialog
- `app/actions/csv.ts` — Added `limitInfo` to `CsvImportResult`; partial import truncation via `checkClientLimit`
- `app/(auth)/setup/wizard/components/csv-import-step.tsx` — Amber `limitInfo` warning in results view
- `app/(dashboard)/clients/components/csv-import-dialog.tsx` — Amber `limitInfo` warning with `/billing` upgrade link

## Decisions Made
- `onLimitReached` callback pattern keeps `CreateClientDialog` stateless with respect to the upgrade flow — dialog only needs to know it was blocked, not what happens next
- `limitInfo` returned in `CsvImportResult` (not thrown) — partial import is a success state with informational metadata, not a failure
- CSV limit check uses `splice()` on `unmatchedRows` for in-place truncation; simple and avoids index tracking
- `getNextTierInfo` helper uses `currentLimit` thresholds (25 and 100) to determine next tier — no DB call needed at render time

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 3 tasks complete — Phase 23 fully shipped
- All code changes committed and TypeScript compiles cleanly

---
*Phase: 23-unified-pricing-experience-with-slider-calculator-and-upgrade-prompts*
*Completed: 2026-02-27*
