---
phase: 12-subdomain-routing-access-gating
plan: 01
subsystem: auth
tags: [next.js, middleware, subdomain, multi-tenant, supabase, jwt]

# Dependency graph
requires:
  - phase: 10-org-data-model-rls-foundation
    provides: "organisations table with slug, subscription_status, trial_ends_at; JWT hook injecting org_id into app_metadata; getOrgId/getOrgContext in org-context.ts"
  - phase: 11-stripe-billing
    provides: "subscription_status values (active, trialing, cancelled, past_due); read-only mode enforcement pattern"
provides:
  - "getOrgSlug(request): extracts org slug from subdomain (production) or ?org= param (development)"
  - "resolveOrgFromSlug(supabase, slug): looks up OrgInfo from organisations table"
  - "enforceSubscription(request, org): redirects inactive/expired orgs to /billing"
  - "getCurrentOrg(slug): React.cache-wrapped org lookup for server components"
  - "Updated updateSession() middleware with full subdomain routing, org validation, and x-org-slug header"
affects:
  - "12-02-postmark-settings: getCurrentOrg() used to fetch org Postmark credentials"
  - "12-03-per-org-email: x-org-slug header consumed by server components"
  - "13-onboarding: middleware routes new orgs correctly after org creation"
  - "All server components: x-org-slug header now available for org context"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Subdomain extraction via host header splitting (production) or ?org= query param (development)"
    - "JWT org_id fast path with user_organisations fallback for pre-hook sessions"
    - "copyCookies() pattern: copy supabaseResponse cookies to all redirect responses"
    - "enforceSubscription returns null (allow) or redirect response (block)"
    - "React.cache wrapping for org lookup deduplication within server render"
    - "x-org-slug request header propagated to server components via NextResponse.next({ request: { headers } })"

key-files:
  created:
    - lib/middleware/subdomain.ts
    - lib/middleware/access-gating.ts
  modified:
    - lib/supabase/middleware.ts
    - lib/auth/org-context.ts
    - lib/email/sender.ts

key-decisions:
  - "[D-12-01-01] Subdomain routing: {slug}.app.phasetwo.uk in production, ?org= query param in development"
  - "[D-12-01-02] Wrong org redirect uses JWT org_id fast path; falls back to user_organisations query for pre-hook sessions"
  - "[D-12-01-03] copyCookies() helper ensures auth token refresh is preserved on all redirect responses"
  - "[D-12-01-04] /auth/signout and /pricing added to PUBLIC_ROUTES alongside /login and /auth/callback"
  - "[D-12-01-05] Unauthenticated on no-slug in dev → /login; in prod → phasetwo.uk (marketing)"

patterns-established:
  - "copyCookies(from, to): always copy supabaseResponse cookies to redirect/modified responses to preserve session"
  - "isPublicRoute/isApiRoute: checked before org slug extraction so these routes always pass through"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04]

# Metrics
duration: 3min
completed: 2026-02-21
---

# Phase 12 Plan 01: Subdomain Routing & Access Gating Summary

**Next.js middleware with subdomain-based org routing, JWT membership validation, subscription enforcement, and React.cache getCurrentOrg() for multi-tenant request handling.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-21T08:46:35Z
- **Completed:** 2026-02-21T08:49:47Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Implemented `getOrgSlug()` and `resolveOrgFromSlug()` for extracting org context from subdomains (prod) or query params (dev)
- Rewrote `updateSession()` middleware with full multi-tenant routing: org validation, wrong-org redirect, unauthenticated redirect, subscription enforcement, and `x-org-slug` header injection
- `getCurrentOrg()` with React.cache deduplication added to `org-context.ts` for server component use

## Task Commits

Each task was committed atomically:

1. **Task 1: Create subdomain extraction and access gating modules** - `eadc751` (feat)
2. **Task 2: Rewrite middleware for subdomain routing with org validation and access gating** - `173f64b` (feat)

## Files Created/Modified

- `lib/middleware/subdomain.ts` - getOrgSlug (dev/prod extraction) and resolveOrgFromSlug (DB lookup)
- `lib/middleware/access-gating.ts` - enforceSubscription with billing/auth passthrough and trial validity check
- `lib/supabase/middleware.ts` - Full subdomain routing middleware: public route passthrough, slug extraction, org resolution, membership validation, subscription enforcement, x-org-slug header
- `lib/auth/org-context.ts` - getCurrentOrg() with React.cache alongside existing getOrgId/getOrgContext
- `lib/email/sender.ts` - Auto-fixed type incompatibility in SendRichEmailForOrgParams

## Decisions Made

- `[D-12-01-01]` Development mode uses `?org=` query param instead of subdomains; production uses `{slug}.app.phasetwo.uk`
- `[D-12-01-02]` JWT `app_metadata.org_id` provides fast-path org validation; falls back to `user_organisations` query for sessions issued before Custom Access Token Hook was enabled
- `[D-12-01-03]` `copyCookies()` helper copies auth cookies from supabaseResponse to all redirect responses so session refresh is never lost
- `[D-12-01-04]` `/auth/signout` and `/pricing` added to PUBLIC_ROUTES (plan only listed `/login` and `/auth/callback`)
- `[D-12-01-05]` Unauthenticated users on no-slug in dev redirect to `/login`; in production redirect to `https://phasetwo.uk`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript interface extension error in sender.ts**
- **Found during:** Task 2 (TypeScript compilation check)
- **Issue:** `SendRichEmailForOrgParams extends SendRichEmailParams` but overrode `orgPostmarkToken` with `string | null` which is incompatible with parent's `string | undefined` type
- **Fix:** Changed parent interface `orgPostmarkToken` type from `string | undefined` to `string | null | undefined` (`orgPostmarkToken?: string | null`)
- **Files modified:** `lib/email/sender.ts`
- **Verification:** `npx tsc --noEmit` passes with no errors
- **Committed in:** `173f64b` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Type fix essential for TypeScript compilation. No scope creep.

## Issues Encountered

The `lib/middleware/subdomain.ts` and `lib/middleware/access-gating.ts` files already existed in the working directory as untracked files before execution (pre-created as part of research/planning). They matched the plan requirements exactly so were committed as-is in Task 1.

## User Setup Required

None - no external service configuration required. Subdomain routing is code-only; DNS/Vercel subdomain configuration is an infrastructure concern outside this plan's scope.

## Next Phase Readiness

- Middleware is ready; server components can read `x-org-slug` header via `headers().get('x-org-slug')`
- `getCurrentOrg(slug)` available for any server component needing org data
- Phase 12 plan 02 (Postmark Settings) can proceed immediately

---
*Phase: 12-subdomain-routing-access-gating*
*Completed: 2026-02-21*
