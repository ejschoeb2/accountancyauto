# Phase 9: Queue Integration - Context

**Gathered:** 2026-02-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Rewire the automated reminder cron queue builder to read from the new normalized tables (schedules, schedule_steps, email_templates) instead of the old JSONB-embedded reminder_templates structure. Drop old tables and remove all v1.0 code paths. This completes the v1.1 migration.

</domain>

<decisions>
## Implementation Decisions

### Cutover strategy
- Direct code replacement — rewrite queue builder to read new tables, delete old code entirely
- No feature flag or gradual rollover — clean break
- Git history serves as reference for old code, no commented-out blocks
- V1.1 rendering pipeline only — all templates go through TipTap JSON -> HTML rendering
- New tables are the sole source of truth — old reminder_templates.steps JSONB is never consulted

### Override precedence
- No per-client overrides at all — client_email_overrides and client_schedule_overrides are not used
- Simple path: filing type -> schedule -> schedule_steps -> email_templates
- Every client with the same filing type gets identical emails at identical timing
- Override tables left in database (not dropped) but completely ignored by queue builder

### Failure handling
- Missing template: skip that step, log warning, continue with remaining steps for the client
- Rendering failure (missing placeholder data): skip that email, log error to audit log, continue with other clients
- Failures logged to audit log only — no dashboard indicator needed
- Postmark failures: mark as pending for retry on next cron run (transient failures don't permanently lose emails)

### Old table cleanup
- Drop reminder_templates table via migration after queue is rewired
- Remove old /templates page and /api/templates routes (v1.1 templates UI replaces them)
- Claude audits codebase for ALL old table references and removes them
- DROP TABLE migration is a separate SQL file from queue rewiring migration (independent rollback)

### Claude's Discretion
- Queue builder internal architecture (batch size, query ordering)
- Audit log entry format for skipped/failed emails
- How to identify and remove all v1.0 code references (grep strategy)

</decisions>

<specifics>
## Specific Ideas

- User explicitly wants a clean break — no backwards compatibility, no fallbacks to old structure
- Override system is intentionally simplified out: same schedule = same emails for everyone
- Retry semantics for Postmark failures preserve the "no missed emails" guarantee

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-queue-integration*
*Context gathered: 2026-02-08*
