# Phase 4: Data Migration - Context

**Gathered:** 2026-02-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Restructure the database from JSONB-embedded reminder templates (reminder_templates.steps array) to normalized tables (email_templates, schedules, schedule_steps). Preserve all existing data and keep the current reminder system running without disruption. Migration creates new tables alongside old ones, copies data with verification, and retains old structure for rollback safety.

</domain>

<decisions>
## Implementation Decisions

### Plain Text to TipTap JSON Conversion
- Simple paragraph wrap: Wrap entire plain text body in a single TipTap paragraph node
- Keep {{placeholders}} as plain text in the JSON (not converted to mention nodes yet)
- Create empty paragraph node for templates with empty/missing bodies (don't skip or fail)
- Validation only checks TipTap JSON structure is valid (don't verify placeholder preservation)

### Claude's Discretion
- Migration timing and trigger mechanism (manual vs automatic)
- Data verification depth and test approach
- Transition period length (how long to keep old tables)
- Rollback strategy if issues arise
- Dual-write implementation during transition
- When to clean up old tables

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for database migration safety and verification.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-data-migration*
*Context gathered: 2026-02-08*
