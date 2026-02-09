---
phase: quick
plan: 001
subsystem: schedules
tags: [custom-schedules, recurrence, queue-builder, ui]

dependency-graph:
  requires: [v1.1-normalized-tables]
  provides: [custom-schedule-support]
  affects: [reminder-queue, scheduler, schedules-ui]

tech-stack:
  added: []
  patterns: [discriminated-union-validation, schedule-type-dispatch]

key-files:
  created:
    - supabase/migrations/20260209200000_add_custom_schedules.sql
    - app/(dashboard)/schedules/components/custom-schedule-list.tsx
  modified:
    - lib/types/database.ts
    - lib/validations/schedule.ts
    - app/api/schedules/route.ts
    - app/api/schedules/[id]/route.ts
    - lib/reminders/queue-builder.ts
    - lib/reminders/scheduler.ts
    - app/(dashboard)/schedules/page.tsx
    - app/(dashboard)/schedules/[id]/edit/page.tsx

decisions:
  - id: QK001-D1
    decision: "Custom schedules apply to ALL non-paused clients (global scope)"
    rationale: "Simplest model - custom reminders like payroll or year-end packs apply firm-wide"
  - id: QK001-D2
    decision: "Discriminated union for Zod validation (filing vs custom)"
    rationale: "Type-safe at compile time, prevents invalid field combinations"
  - id: QK001-D3
    decision: "Use separate schema instances for form resolver based on schedule_type"
    rationale: "React Hook Form resolver needs a concrete schema, not a union - resolving with the correct variant avoids type gymnastics"

metrics:
  duration: ~8 min
  completed: 2026-02-09
---

# Quick Task 001: Custom Schedules Summary

Custom schedule support extending reminders beyond the 5 HMRC filing types to arbitrary user-defined dates.

## One-liner

Custom schedules with one-off or recurring dates (monthly/quarterly/annually), global client targeting, and discriminated union validation.

## Task Commits

| # | Task | Commit | Key Changes |
|---|------|--------|-------------|
| 1 | Schema migration, types, validation | `6c4afdd` | Migration adds schedule_type + custom date columns, partial unique index, type CHECK constraint. Schedule interface updated with nullable fields. Zod schema becomes discriminated union. |
| 2 | API routes and queue builder | `58adecf` | POST/PUT handle both schedule types. buildCustomScheduleQueue() with recurrence calculation. Scheduler calls both builders, uses left join for filing_types, branches schedule lookup. Rollover skips custom. |
| 3 | UI section and edit form | `272d79b` | CustomScheduleList component. Schedules page separates filing/custom. Edit form adapts: filing shows dropdown, custom shows date mode toggle (one-off vs recurring). |

## Decisions Made

1. **QK001-D1: Global scope for custom schedules** -- Custom schedule reminders target ALL non-paused clients. No per-client assignment mechanism (unlike filing types which use client_filing_assignments). This matches the use case for firm-wide reminders like payroll deadlines.

2. **QK001-D2: Discriminated union validation** -- The Zod schema uses `z.discriminatedUnion('schedule_type', ...)` to enforce that filing schedules have filing_type_id and custom schedules have either custom_date or recurrence_rule+recurrence_anchor. This is validated at API boundaries.

3. **QK001-D3: Per-type schema resolver** -- Rather than passing the union schema to React Hook Form's zodResolver (which causes issues with partial type matching), we select the correct branch schema based on the current schedule_type state.

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

1. `npx tsc --noEmit` passes with zero errors
2. `npx next build` succeeds with no errors
3. All existing filing schedule CRUD paths preserved (regression-safe)
4. Schema migration correctly handles:
   - schedule_type column with CHECK constraint
   - Partial unique index on filing_type_id (WHERE NOT NULL)
   - Type consistency constraint (filing needs filing_type_id, custom needs date OR recurrence)
5. Queue builder:
   - buildReminderQueue filters to filing schedules only
   - buildCustomScheduleQueue handles recurrence date calculation
   - Idempotency check uses template_id for custom (vs filing_type_id for filing)
6. Scheduler:
   - Left join for filing_types (custom have NULL)
   - Schedule name used as filing_type placeholder for custom reminders
   - Rollover logic skips custom schedules

## Architecture Notes

- Custom schedules reuse the same `schedules` table, `schedule_steps`, and `reminder_queue` tables
- The `template_id` column in `reminder_queue` stores the schedule UUID (for both types)
- For filing schedules: `filing_type_id` is the idempotency key
- For custom schedules: `template_id` (schedule id) + `filing_type_id IS NULL` is the idempotency key
- Recurrence calculation: anchor date + interval until past today, using date-fns `addMonths`/`addYears`

## Self-Check: PASSED
