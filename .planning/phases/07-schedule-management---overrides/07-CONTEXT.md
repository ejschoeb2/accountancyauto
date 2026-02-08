# Phase 7: Schedule Management - Context

**Gathered:** 2026-02-08
**Status:** Ready for planning

<domain>
## Phase Boundary

**SCOPE CHANGE:** Per-client overrides removed from scope. If a client needs custom content/timing, accountant will send ad-hoc emails (Phase 8) instead of managing overrides.

This phase now delivers: schedule creation and editing UI where users create reminder schedules for filing types, add/remove/reorder steps, assign email templates to steps, and set delay + urgency per step. Schedules define WHEN templates are sent, decoupled from WHAT templates say.

</domain>

<decisions>
## Implementation Decisions

### Schedule Creation & Editing UI
- **Navigation location**: Combined with Templates tab (e.g., "Templates & Schedules" tab, or sub-tabs within Templates)
- **Adding steps**: Add button creates new row, then user configures template/delay/urgency inline
- **Reordering steps**: Up/down arrow buttons to move step up or down in sequence
- **Template reuse**: Same template CAN appear in multiple steps of a schedule, but show warning message
- **Editing**: Full page editor (consistent with template editing pattern)

### Step Configuration Details
- **Delay input**: Preset options (7 days, 14 days, 30 days) plus custom number input
- **Urgency levels**: Manual dropdown/radio selection with 3 levels: Normal / High / Urgent
- **Validation**: No validation rules — trust user to configure sensible delays and urgency

### Schedule Viewing & Navigation
- **Schedule list layout**: Simple list showing schedule name and filing type
- **Upcoming reminders**: Do NOT show upcoming reminders from schedule view — schedules show configuration only
- **Individual send management**: No cancel/reschedule individual sends from schedule view
- **Duplicate action**: Yes, "Duplicate" button creates copy with "(Copy)" suffix for easy cloning

### Claude's Discretion
- Exact layout of step editor (table, cards, or list)
- Button styling and placement
- Warning message wording for duplicate templates
- Error handling for step operations
- Loading states for schedule list and editor

</decisions>

<specifics>
## Specific Ideas

No specific product references — focus on clear workflow for accountants managing reminder sequences.

</specifics>

<deferred>
## Deferred Ideas

- **Per-client overrides** — Originally part of Phase 7, now removed from scope. Accountant uses ad-hoc sending (Phase 8) for client-specific needs instead.
- **Schedule analytics** — Track effectiveness, open rates, etc. (not in current milestone)
- **Automatic optimization** — Suggest best send times based on historical data (not in current milestone)
- **Upcoming reminder visibility from schedule view** — Discussed but removed from scope during discussion

</deferred>

---

*Phase: 07-schedule-management---overrides*
*Context gathered: 2026-02-08*
*Note: Overrides removed from scope, upstream reminders removed from schedule view*
