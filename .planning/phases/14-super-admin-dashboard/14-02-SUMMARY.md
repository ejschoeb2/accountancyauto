---
phase: 14-super-admin-dashboard
plan: 02
subsystem: ui
tags: [react, supabase, admin, auth, server-component, clipboard]

# Dependency graph
requires:
  - phase: 14-01
    provides: /admin route with super-admin guard and middleware bypass; OrgTable row clicks navigate to /admin/[slug]
  - phase: 10-org-data-model-rls-foundation
    provides: organisations table, user_organisations table, createAdminClient
  - phase: 11-stripe-billing
    provides: stripe_customer_id, stripe_subscription_id, subscription_status, plan_tier, trial_ends_at fields on organisations
  - phase: 12-subdomain-routing-access-gating
    provides: per-org postmark_server_token, postmark_sender_domain fields on organisations
provides:
  - /admin/[slug] org detail page — read-only, super-admin guarded
  - CopyableText client component for clipboard copy with visual feedback
  - Three-section layout: Organisation Settings, Team Members, Stripe
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Org detail by slug: createAdminClient().from("organisations").eq("slug", slug).single() + not-found fallback
    - Member email resolution: admin.auth.admin.getUserById per membership row (same pattern as D-11-02-03)
    - Postmark token redacted: show "Configured"/"Not configured" badge, never reveal token value
    - CopyableText: navigator.clipboard.writeText with 2s copied state toggle (Check icon replaces Copy icon)

key-files:
  created:
    - app/(dashboard)/admin/[slug]/page.tsx
    - app/(dashboard)/admin/[slug]/loading.tsx
    - app/(dashboard)/admin/components/copyable-text.tsx
  modified: []

key-decisions:
  - "[D-14-02-01] STATUS_CONFIG duplicated inline in detail page (not extracted to shared file) — it's 5 lines, extraction adds more complexity than it saves; decision matches D-14-01-04 approach"
  - "[D-14-02-02] Postmark token displayed as Configured/Not configured badge — never reveal the actual token value even to super-admins via the UI (token is a secret)"
  - "[D-14-02-03] generateMetadata uses async params (Next.js 16 pattern) — params is a Promise in current Next.js version"

patterns-established:
  - "CopyableText component: navigator.clipboard.writeText + 2s copied state; reusable for any copyable ID in admin UI"
  - "Admin detail page: super-admin guard at RSC level + createAdminClient for cross-org queries + auth.admin.getUserById for member resolution"

requirements-completed: [ADMN-04]

# Metrics
duration: 3min
completed: 2026-02-21
---

# Phase 14 Plan 02: Org Detail Page Summary

**Read-only /admin/[slug] detail page showing full org settings, team member list with names/emails/roles via Auth Admin API, and Stripe customer/subscription IDs as copyable text with clipboard button**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-21T10:39:00Z
- **Completed:** 2026-02-21T10:42:00Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments
- CopyableText client component with `navigator.clipboard.writeText`, Check/Copy icon toggle, and 2-second reset — reusable for any copyable ID
- `/admin/[slug]` server page: super-admin guard (redirect to /dashboard if not), org fetch by slug with not-found fallback, member email/name resolution via `admin.auth.admin.getUserById`, client/user counts via parallel count queries
- Three Card sections: Organisation Settings (dl grid with plan, status badge, trial expiry, limits, Postmark configured badge, created date), Team Members (shadcn Table with name/email/role), Stripe (CopyableText for customer and subscription IDs)
- Loading skeleton with three pulsing card placeholders matching page structure

## Task Commits

Each task was committed atomically:

1. **Task 1: Org detail page with settings, member list, and Stripe info** - `4f9887d` (feat)

**Plan metadata:** (this commit — docs: complete plan)

## Files Created/Modified
- `app/(dashboard)/admin/[slug]/page.tsx` - Server component: super-admin guard, org fetch, member resolution, three-section layout
- `app/(dashboard)/admin/[slug]/loading.tsx` - Pulsing skeleton for three card sections
- `app/(dashboard)/admin/components/copyable-text.tsx` - Client component: copy-to-clipboard with Check/Copy icon feedback

## Decisions Made
- [D-14-02-01] STATUS_CONFIG duplicated inline in detail page rather than extracted to a shared file — 5 lines, not worth adding shared module complexity
- [D-14-02-02] Postmark token shown as "Configured"/"Not configured" badge, not the actual token value — token is a secret and must not be displayed even to super-admins via the UI
- [D-14-02-03] `generateMetadata` uses `async params` (Promise) — required in Next.js 16; page params are now Promises

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. The `/admin/[slug]` page uses the same service role admin client as Plan 01, no additional setup needed.

## Next Phase Readiness
- Phase 14 is now complete: `/admin` org list and `/admin/[slug]` org detail are both operational
- Super-admin dashboard fully functional: middleware bypass, conditional nav link, sortable org list, full org detail with team members and Stripe IDs
- No further super-admin phases planned — all ADMN requirements (ADMN-01 through ADMN-04) complete

---
*Phase: 14-super-admin-dashboard*
*Completed: 2026-02-21*

## Self-Check: PASSED

All 4 files confirmed present (page.tsx, loading.tsx, copyable-text.tsx, 14-02-SUMMARY.md). Task commit 4f9887d confirmed in git log. Key content (navigator.clipboard, createAdminClient, getUserById) confirmed in respective files.
