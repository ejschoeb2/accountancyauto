---
phase: 02-reminder-engine
plan: 06
subsystem: ui
tags: [react-big-calendar, date-fns, calendar, deadlines, api]

# Dependency graph
requires:
  - phase: 02-01
    provides: Filing types, client assignments, override schemas
  - phase: 02-02
    provides: Deadline calculator functions

provides:
  - Global monthly calendar view showing all client deadlines
  - Calendar deadlines API endpoint with month/year filtering
  - Color-coded deadline events by filing type
  - Visual legend for filing type identification

affects: [02-07, 02-08, dashboard-integration]

# Tech tracking
tech-stack:
  added: [react-big-calendar with date-fns localizer]
  patterns:
    - Calendar API with month/year query params
    - Override merge pattern (override date preferred over calculated)
    - Color-coded event styling by filing type

key-files:
  created:
    - app/api/calendar/deadlines/route.ts
    - app/(dashboard)/calendar/page.tsx
    - app/(dashboard)/calendar/components/deadline-calendar.tsx
  modified:
    - app/(dashboard)/layout.tsx

key-decisions:
  - "react-big-calendar uses date-fns localizer with enGB locale (week starts Monday)"
  - "Calendar API includes date padding (last week of prior month, first week of next) for better calendar display"
  - "Override dates take precedence over calculated dates in calendar display"
  - "Month view only - no week/day/agenda views"

patterns-established:
  - "Calendar API filtering pattern: calculate all deadlines, then filter to month range with padding"
  - "Override lookup pattern: build Map from overrides array for O(1) lookup"
  - "Event color coding: filing type ID → predefined color map"

# Metrics
duration: 3min
completed: 2026-02-06
---

# Phase 02 Plan 06: Calendar View Summary

**Global monthly calendar with react-big-calendar showing color-coded filing deadlines across all clients, with override support and month navigation**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-06T21:00:01Z
- **Completed:** 2026-02-06T21:03:27Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Calendar deadlines API endpoint with month/year filtering and override support
- Monthly calendar grid view using react-big-calendar with date-fns localizer
- Color-coded deadline events by filing type (5 distinct colors)
- Calendar navigation link added to dashboard layout
- Visual legend showing filing type color mapping

## Task Commits

Each task was committed atomically:

1. **Task 1: Calendar deadlines API** - `4dddc76` (feat)
2. **Task 2: Calendar page with react-big-calendar** - `fed7043` (feat)

**Plan metadata:** [Will be committed after SUMMARY creation]

## Files Created/Modified
- `app/api/calendar/deadlines/route.ts` - GET endpoint fetching all client deadlines for a given month/year, merging overrides
- `app/(dashboard)/calendar/page.tsx` - Calendar page with server-side initial data fetch, legend, and event count
- `app/(dashboard)/calendar/components/deadline-calendar.tsx` - Client component wrapping react-big-calendar with date-fns localizer, color styling, and month navigation
- `app/(dashboard)/layout.tsx` - Added "Calendar" link to navigation bar

## Decisions Made

**1. react-big-calendar with date-fns localizer**
- Used date-fns localizer (not moment.js) since date-fns already installed
- Configured with enGB locale for UK week convention (starts Monday)

**2. Calendar API date padding**
- Calendar fetches deadlines with padding (~last week of prior month, first week of next)
- Ensures edge dates visible in calendar grid display
- Filter range: month-2, day 25 through month+1, day 7

**3. Override precedence in display**
- Override dates take absolute precedence over calculated dates
- `is_overridden` flag added to event payload for visual indication
- Override map built using `Map<clientId_filingTypeId, overrideDate>` for O(1) lookup

**4. Month view only**
- Calendar restricted to month view (no week/day/agenda)
- Matches user vision: "bird's-eye view of when deadlines cluster"

**5. Color coding by filing type**
- Corporation Tax Payment: blue (#3b82f6)
- CT600 Filing: indigo (#6366f1)
- Companies House: amber (#f59e0b)
- VAT Return: green (#10b981)
- Self Assessment: red (#ef4444)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation proceeded smoothly. Note that build shows errors from other wave 2 plans (02-05 missing filing-assignments component, templates edit page missing @hookform/resolvers/zod), but calendar implementation has zero TypeScript errors.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for:**
- Reminder queue scheduling (02-07) - calendar provides visual context for when reminders fire
- Template editor enhancements - calendar helps verify template step timing
- Dashboard overview - calendar events available via API

**Considerations:**
- Calendar currently shows calculated deadlines for current year only for VAT and Self Assessment
- Future enhancement: multi-year VAT deadline display (showing all 4 quarterly deadlines across current + next year)
- Calendar navigation is client-side after initial load - performs well with current dataset size

---
*Phase: 02-reminder-engine*
*Completed: 2026-02-06*

## Self-Check: PASSED

All created files verified:
- app/api/calendar/deadlines/route.ts ✓
- app/(dashboard)/calendar/page.tsx ✓
- app/(dashboard)/calendar/components/deadline-calendar.tsx ✓

All commits verified:
- 4dddc76 ✓
- fed7043 ✓
