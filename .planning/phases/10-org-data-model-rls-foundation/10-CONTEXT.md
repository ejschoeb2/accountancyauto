# Phase 10: Org Data Model & RLS Foundation - Context

**Gathered:** 2026-02-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Transforming the database from single-tenant to multi-tenant at the data layer — every table gets `org_id`, RLS enforces isolation, JWT claims identify the org, and cron jobs iterate per-org without cross-tenant data leaks. This phase delivers the data foundation; Stripe integration, subdomain routing, and onboarding UI are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Migration Strategy
- **Downtime acceptable:** 5-10 minute maintenance window for migration (not zero-downtime)
- **Validation:** Both automated SQL checks (no NULL org_id, FK constraints valid, counts match) AND manual verification before proceeding
- **Rollback plan:** Database backup + restore (safest approach)
- **Migration order:** Standard dependency chain — (1) create organisations table, (2) insert founding org, (3) add org_id columns, (4) backfill org_id values

### Cron Org-Scoping
- **Iteration pattern:** Sequential (one org at a time) — simple, predictable, easier to debug
- **Error handling:** Continue with other orgs if one fails — log error, skip failed org, don't block others
- **Logging:** Log both org_id and org name for debugging (e.g., "Processing org: Acme (uuid-123)")
- **Transaction isolation:** One database transaction per org — failed org's changes roll back without affecting others

### Founding Org Setup
- **Data source:** Hardcoded in migration script (not from env vars or app_settings)
- **Slug:** `peninsula` (will become peninsula.app.domain.com in Phase 12)
- **Postmark token:** Copy from existing POSTMARK_SERVER_TOKEN env var into organisations.postmark_server_token
- **Plan tier:** `firm` (highest tier, full access, no limits)

### RLS Activation Safety
- **Activation timing:** After JWT hook verified — write JWT hook first, verify org_id in claims, THEN enable RLS
- **Activation approach:** Phased by table group — enable on core tables (clients, templates) first, then secondary tables
- **Testing:** Both manual testing (with two orgs) and automated SQL tests for isolation verification
- **Policy structure:** Policies use JWT claims directly via `(auth.jwt() -> 'app_metadata' ->> 'org_id')` — standard Supabase pattern

### Claude's Discretion
- Specific table groupings for phased RLS activation
- Exact SQL for automated isolation tests
- Error message formatting for cron failures
- JWT hook implementation details

</decisions>

<specifics>
## Specific Ideas

No specific references or "I want it like X" moments — standard multi-tenancy approach using Supabase best practices.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 10-org-data-model-rls-foundation*
*Context gathered: 2026-02-19*
