# Phase 14: Super-Admin Dashboard - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Read-only internal dashboard for the platform operator to monitor all tenants — their plan, subscription status, usage, and health — without accessing the production database directly. No data modification actions are exposed. The `is_super_admin` flag is set only via direct service-role access.

</domain>

<decisions>
## Implementation Decisions

### Org list presentation
- Data table layout (not cards or grid) — consistent with existing client list patterns
- All columns treated with equal weight — name, slug, plan tier, subscription status, trial expiry, client count, user count
- Sort only — no filtering or search controls. Column headers are clickable to sort
- All orgs loaded at once — no pagination. Org count will be manageable (tens, not thousands)

### Org detail view
- Full page at `/admin/[slug]` — not a modal or slide-over. Back button returns to list
- Single scroll page — settings at top, members below, Stripe info at bottom. No tabs
- Member list shows: name, email, role (no last sign-in or other metadata)
- Stripe subscription ID displayed as copyable text with copy button — not a clickable link

### Health & status signals
- Color-coded badges for subscription status — use the existing traffic light system from DESIGN.md for consistency
- Trial expiry shown as relative days remaining ("12 days left", "Expired 3 days ago") — not absolute dates
- Badge alone signals problems — no row highlighting or summary stats needed

### Navigation & access
- "Admin" link visible in sidebar/nav only when user has `is_super_admin = true` in app_metadata
- Reuse existing dashboard layout — same sidebar and top bar, admin content renders inside
- Non-super-admin users silently redirected to their org dashboard (no 403 page)
- From /admin, normal nav/logo navigation returns to org dashboard — no special "back to org" link needed

### Claude's Discretion
- Exact badge color mapping within the existing traffic light system
- Loading states and skeleton design
- Error handling for failed data fetches
- Exact spacing and typography within DESIGN.md patterns

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Follow existing dashboard patterns from the app.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 14-super-admin-dashboard*
*Context gathered: 2026-02-21*
