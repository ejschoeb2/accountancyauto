---
phase: 14-super-admin-dashboard
plan: 01
subsystem: ui
tags: [react, tanstack-table, supabase, admin, auth, middleware]

# Dependency graph
requires:
  - phase: 12-subdomain-routing-access-gating
    provides: middleware infrastructure with subdomain routing and org membership validation
  - phase: 10-org-data-model-rls-foundation
    provides: organisations table, user_organisations table, app_metadata JWT claims
  - phase: 11-stripe-billing
    provides: subscription_status, plan_tier, trial_ends_at fields on organisations
provides:
  - /admin route accessible only to users with is_super_admin=true in app_metadata
  - isAdminRoute() middleware bypass skipping org membership and subscription enforcement
  - isSuperAdmin prop on NavLinks for conditional Admin link display
  - OrgTable client component with TanStack Table showing all orgs with sortable plan/status columns
affects:
  - 14-02 (org detail page will use same admin client pattern)
  - future super-admin features

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Admin route middleware bypass: check isAdminRoute before org resolution steps; page-level guard enforces is_super_admin
    - Cross-org admin data fetch: createAdminClient() (service role) + Promise.all() for per-org counts
    - Conditional nav item: isSuperAdmin prop passed from layout to NavLinks; appends ADMIN_ITEM when true

key-files:
  created:
    - app/(dashboard)/admin/page.tsx
    - app/(dashboard)/admin/loading.tsx
    - app/(dashboard)/admin/components/org-table.tsx
  modified:
    - lib/supabase/middleware.ts
    - components/nav-links.tsx
    - app/(dashboard)/layout.tsx

key-decisions:
  - "[D-14-01-01] Admin route middleware bypass: isAdminRoute() check inserted after public/API route checks (Step 3.5); unauthenticated users redirected to /login; authenticated users pass through — page guard handles is_super_admin enforcement"
  - "[D-14-01-02] isSuperAdmin extracted from user.app_metadata in dashboard layout and passed as prop to NavLinks — no extra DB query needed since app_metadata is in the JWT"
  - "[D-14-01-03] Client/user counts fetched via parallel Promise.all() with head:true count queries per org — avoids a single complex aggregation query"
  - "[D-14-01-04] STATUS_CONFIG in OrgTable matches billing-status-card.tsx exactly for visual consistency"

patterns-established:
  - "Admin route bypass: isAdminRoute() in middleware, is_super_admin check in page.tsx RSC — two-layer auth"
  - "Cross-org admin fetch: createAdminClient() + Promise.all() per-org count queries pattern"

requirements-completed: [ADMN-01, ADMN-02, ADMN-03]

# Metrics
duration: 10min
completed: 2026-02-21
---

# Phase 14 Plan 01: Super-Admin Route Infrastructure and Org List Dashboard Summary

**Super-admin /admin route with middleware bypass, conditional nav link, and sortable cross-org dashboard showing all organisations with plan, status badges, trial expiry, and client/user counts**

## Performance

- **Duration:** 10 min
- **Started:** 2026-02-21T10:24:47Z
- **Completed:** 2026-02-21T10:35:12Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Middleware admin route bypass: `isAdminRoute()` helper lets authenticated users through to `/admin` without org membership or subscription enforcement; unauthenticated users redirected to `/login`
- NavLinks now accepts `isSuperAdmin` prop and conditionally appends an Admin link (Shield icon) after Billing; layout extracts the flag from `user.app_metadata`
- Server page at `/admin` guards with `is_super_admin` check (redirects to `/dashboard` if false), then fetches all orgs via service role admin client plus client/user counts per org in parallel
- OrgTable client component uses TanStack Table with sortable Plan and Status columns; status cells use color-coded badges matching the existing DESIGN.md traffic light pattern; trial expiry shows relative days ("12 days left", "Expired 3 days ago")
- Loading skeleton provides pulsing placeholder while server-side data fetch completes

## Task Commits

Each task was committed atomically:

1. **Task 1: Middleware admin route bypass and NavLinks super-admin prop** - `05551f4` (feat)
2. **Task 2: Admin org list page with sortable table, status badges, and trial expiry** - `e4fcfb7` (feat)

**Plan metadata:** (this commit — docs: complete plan)

## Files Created/Modified
- `lib/supabase/middleware.ts` - Added `isAdminRoute()` helper and Step 3.5 bypass block
- `components/nav-links.tsx` - Added `isSuperAdmin` prop, `ADMIN_ITEM` constant, Shield icon import
- `app/(dashboard)/layout.tsx` - Extract `isSuperAdmin` from app_metadata; pass to NavLinks
- `app/(dashboard)/admin/page.tsx` - Server component: super-admin guard + cross-org data fetch
- `app/(dashboard)/admin/loading.tsx` - Pulsing skeleton matching page header + table rows
- `app/(dashboard)/admin/components/org-table.tsx` - TanStack Table client component with STATUS_CONFIG, formatTrialExpiry, sort indicators

## Decisions Made
- [D-14-01-01] Admin route middleware bypass: `isAdminRoute()` inserted at Step 3.5 (after public/API checks, before org slug extraction); unauthenticated users get redirect to `/login`; authenticated users pass through with no org validation — page-level guard enforces `is_super_admin`
- [D-14-01-02] `isSuperAdmin` extracted from `user.app_metadata` in dashboard layout — no extra DB query; app_metadata is part of the JWT and already available from `getUser()`
- [D-14-01-03] Client/user counts fetched via `Promise.all()` with `head:true` count queries per org — lightweight, correct, no complex aggregation
- [D-14-01-04] `STATUS_CONFIG` in OrgTable matches `billing-status-card.tsx` exactly — consistent visual language across the platform

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Turbopack `pages-manifest.json ENOENT` error on first build attempt — intermittent pre-existing Turbopack issue (not caused by this plan's changes). TypeScript check via `npx tsc --noEmit` confirmed zero type errors. Second build run succeeded cleanly with `/admin` route included.

## User Setup Required
None - no external service configuration required. The `is_super_admin` flag is set directly in Supabase Auth `app_metadata` via the Dashboard or service role API (only platform operator needs to do this once per super-admin user).

## Next Phase Readiness
- `/admin` route and org list operational; super-admin guard and middleware bypass fully functional
- Plan 02 will add the org detail page at `/admin/[slug]` — the row click navigation to `/admin/${org.slug}` is already wired in OrgTable

---
*Phase: 14-super-admin-dashboard*
*Completed: 2026-02-21*

## Self-Check: PASSED

All 7 files confirmed present. Both task commits (05551f4, e4fcfb7) confirmed in git log. Key content (isAdminRoute, isSuperAdmin, createAdminClient, useReactTable) confirmed in respective files.
