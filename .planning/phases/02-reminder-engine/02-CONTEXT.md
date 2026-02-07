# Phase 2: Reminder Engine - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

System calculates UK filing deadlines (Corporation Tax, Companies House, VAT, Self Assessment) from client metadata and the accountant can configure multi-step reminder templates with escalating messaging. Includes per-client deadline overrides and template customization. Does NOT include email sending, delivery tracking, or the monitoring dashboard — those are Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Template Design
- Configurable 1-5 steps per template (not fixed 3)
- Each template covers one filing type (Corporation Tax, Companies House, VAT Return, Self Assessment, etc.)
- Inline accordion editor — all steps visible on one page, expandable sections for editing
- Each step's timing is configured as "days before deadline" (deadline-anchored, not step-relative)
- Placeholder variables ({{client_name}}, {{deadline}}, {{days_until_deadline}}, etc.) are simple enough that no live preview is needed
- No preview feature — placeholders are self-explanatory

### Deadline Display & Overrides
- Global monthly calendar grid view showing deadlines across ALL clients
- Deadlines are calculated from client metadata (year-end, VAT quarter, client type)
- Per-client deadline overrides supported (e.g., HMRC extensions) — custom date overrides the formula for that client and filing type
- Automatic year-on-year rollover — system calculates next cycle's deadline automatically when current deadline passes, no manual confirmation needed

### Reminder Scheduling Logic
- Daily cron job runs at fixed 9am UK time
- If a reminder's calculated send date falls on a weekend or UK bank holiday, shift to next working day
- When records are marked as received, auto-cancel all remaining reminder steps for that filing type — no confirmation prompt
- When a paused client is unpaused, skip any missed reminders and resume from the next due step — don't spam with old reminders
- UK bank holidays sourced from gov.uk API

### Per-Client Customization
- Field-level overrides on templates — accountant changes specific fields (subject, body, delay) while the base template remains the source of truth
- Inheritance model: overridden fields persist, non-overridden fields update when the base template changes
- Badge/indicator on clients in the list view showing which have custom overrides
- Filing type assignment: automatic based on client type (sole trader, limited company, etc.) PLUS manual toggle to opt in/out of any filing type per client

### Claude's Discretion
- Calendar grid component library/implementation
- Exact placeholder variable names and format
- Database schema for template steps, overrides, and deadline storage
- How to efficiently compute "next working day" with bank holiday data
- Override UI placement within client detail view

</decisions>

<specifics>
## Specific Ideas

- Filing types should be auto-assigned based on client type (limited company gets Corp Tax + Companies House, sole trader gets Self Assessment, etc.) but always manually toggleable
- The calendar should give a bird's-eye view of when deadlines cluster — helps the accountant see busy periods coming
- Template steps should feel like building a sequence: step 1 gentle at 60 days, step 2 firm at 30 days, step 3 urgent at 14 days, etc.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-reminder-engine*
*Context gathered: 2026-02-06*
