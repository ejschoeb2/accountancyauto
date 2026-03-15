---
phase: 32-expandable-deadline-system-mtd-quarterly-updates
plan: 01
subsystem: deadline-engine
tags: [schema, migration, calculators, mtd, filing-types, typescript]
dependency_graph:
  requires: []
  provides:
    - filing_types extended with is_seeded_default/calculator_type/sort_order
    - org_filing_type_selections junction table with RLS
    - FilingTypeId union (14 IDs)
    - OrgFilingTypeSelection interface
    - getNextMTDQuarterDeadline
    - calculateConfirmationStatementDeadline
    - calculateP11DDeadline
    - calculatePAYEMonthlyDeadline
    - calculateCISMonthlyDeadline
    - calculatePayrollYearEndDeadline
    - calculateSAPaymentOnAccount
    - rolloverDeadline handles all 14 types
    - DEADLINE_DESCRIPTIONS covers all 14 types
  affects:
    - lib/validations/schedule.ts (Zod enum widened)
    - app/(dashboard)/deadlines/[id]/edit/page.tsx (VALID_FILING_TYPE_IDS widened)
tech_stack:
  added: []
  patterns:
    - UTCDate-based fixed-calendar-date calculators for MTD quarters
    - addDays/addYears/addMonths for rollover per type frequency
    - org_filing_type_selections junction table with RLS auth_org_id() policy
key_files:
  created:
    - supabase/migrations/20260315200000_phase32_expandable_deadlines.sql
  modified:
    - lib/types/database.ts
    - lib/deadlines/calculators.ts
    - lib/deadlines/rollover.ts
    - lib/deadlines/descriptions.ts
    - lib/validations/schedule.ts
    - app/(dashboard)/deadlines/[id]/edit/page.tsx
decisions:
  - "[D-32-01-01] MTD rollover uses getNextMTDQuarterDeadline(currentDeadline) — never addDays/addMonths — to preserve fixed HMRC tax-year calendar anchors"
  - "[D-32-01-02] confirmation_statement rollover uses addYears(currentDeadline, 1) — annual cycle off the deadline date itself, not recalculated from incorporation_date"
  - "[D-32-01-03] partnership_tax_return and trust_tax_return reuse calculateSelfAssessmentDeadline — same Jan 31 formula, different applicable_client_types"
metrics:
  duration_seconds: 194
  completed_date: "2026-03-15"
  tasks_completed: 2
  files_changed: 6
---

# Phase 32 Plan 01: Expandable Deadline System — Schema + Calculators Summary

**One-liner:** DB schema expanded from 5 to 14 filing types with per-org activation table, plus 7 new UK deadline calculator functions covering MTD quarterly, Confirmation Statement, P11D, PAYE, CIS, Payroll Year-End, and SA Payment on Account.

## What Was Built

### Task 1 — Schema migration
Migration `20260315200000_phase32_expandable_deadlines.sql`:
- Added `is_seeded_default`, `calculator_type`, `sort_order` columns to `filing_types`
- Updated existing 5 rows with correct calculator types and sort orders (1-5)
- Inserted 9 new filing types (sort_order 6-14), all `is_seeded_default = false`
- Created `org_filing_type_selections` junction table with composite PK `(org_id, filing_type_id)`
- RLS: SELECT for authenticated using `auth_org_id()`, no authenticated INSERT/UPDATE/DELETE
- Backfill: existing orgs receive all 5 seeded-default types via `INSERT ... SELECT ... CROSS JOIN ... ON CONFLICT DO NOTHING`

### Task 2 — TypeScript types + calculators
**lib/types/database.ts:**
- `FilingTypeId` union widened from 5 to 14 string literal members
- `FilingType` interface extended with `is_seeded_default?`, `calculator_type?`, `sort_order?`
- New `OrgFilingTypeSelection` interface added

**lib/deadlines/calculators.ts:**
- `getNextMTDQuarterDeadline(fromDate)` — finds next HMRC MTD quarter deadline (7 Aug/7 Nov/7 Feb/7 May) using fixed UTCDate anchors + addDays
- `calculateConfirmationStatementDeadline(incorporationDate, fromDate?)` — incorporation + N years + 14 days, advancing until after fromDate
- `calculateP11DDeadline(fromDate?)` — 6 July each year
- `calculatePayrollYearEndDeadline(fromDate?)` — 19 April each year
- `calculateSAPaymentOnAccount(fromDate?)` — 31 July each year
- `calculatePAYEMonthlyDeadline(fromDate?)` — 22nd of each month
- `calculateCISMonthlyDeadline(fromDate?)` — 19th of each month
- `calculateDeadline` dispatcher extended with 9 new cases and `incorporation_date?` param

**lib/deadlines/rollover.ts:**
- Imports `addMonths` and `getNextMTDQuarterDeadline`
- Added 9 new switch cases: MTD uses `getNextMTDQuarterDeadline`; PAYE/CIS use `addMonths`; all others use `addYears`

**lib/deadlines/descriptions.ts:**
- `DEADLINE_DESCRIPTIONS` Record extended from 5 to 14 entries

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Zod schema in lib/validations/schedule.ts had hardcoded enum of old 5 IDs**
- **Found during:** Task 2 — TypeScript type check after widening FilingTypeId
- **Issue:** `filingScheduleSchema` in `lib/validations/schedule.ts` used `z.enum([...5 old IDs...])`. After widening FilingTypeId, TypeScript reported type incompatibility in the deadlines edit page because the Zod-inferred type was narrower than FilingTypeId.
- **Fix:** Added all 9 new IDs to the `z.enum()` tuple in `filingScheduleSchema`
- **Files modified:** `lib/validations/schedule.ts`
- **Commit:** 0b7827a

**2. [Rule 1 - Bug] VALID_FILING_TYPE_IDS array in deadlines edit page had only 5 IDs**
- **Found during:** Task 2 — TypeScript type check
- **Issue:** `app/(dashboard)/deadlines/[id]/edit/page.tsx` had a hardcoded `VALID_FILING_TYPE_IDS` array that would incorrectly reject new filing type IDs passed via `prefillFilingType` query parameter
- **Fix:** Added all 9 new IDs to the array
- **Files modified:** `app/(dashboard)/deadlines/[id]/edit/page.tsx`
- **Commit:** 0b7827a

## Verification

- TypeScript: 0 errors (`npx tsc --noEmit` clean)
- Migration file: 14 filing types total (5 updated + 9 inserted), `org_filing_type_selections` CREATE TABLE present
- `DEADLINE_DESCRIPTIONS` Record: 14 keys, satisfies `Record<FilingTypeId, string>` (would fail compile if missing)
- `rolloverDeadline` switch: 14 `case` statements + default throw
- `calculateDeadline` dispatcher: 14 cases + default `return null`

## Self-Check: PASSED

Files verified:
- supabase/migrations/20260315200000_phase32_expandable_deadlines.sql — EXISTS
- lib/types/database.ts — FilingTypeId has 14 members, OrgFilingTypeSelection defined
- lib/deadlines/calculators.ts — 7 new exported functions + extended dispatcher
- lib/deadlines/rollover.ts — 14 cases
- lib/deadlines/descriptions.ts — 14 entries
- lib/validations/schedule.ts — z.enum has 14 IDs

Commits verified:
- b9580c6 — migration file
- 0b7827a — TypeScript types + calculators
