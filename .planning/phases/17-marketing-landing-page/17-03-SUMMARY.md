---
phase: 17-marketing-landing-page
plan: "03"
subsystem: marketing
tags: [landing-page, routing, middleware, assembly, next-js]

dependency_graph:
  requires:
    - phase: 17-02
      provides: MarketingNav, HeroSection, FeaturesSection, PricingSection, FooterSection components
    - phase: 17-01
      provides: HeroParticles, FooterParticles, useIsMobile hook
  provides:
    - marketing landing page at root URL (/)
    - (marketing) route group with minimal layout
    - middleware root-path bypass for public access
  affects:
    - middleware (all requests through lib/supabase/middleware.ts)
    - onboarding flow (all CTAs point to /onboarding)

tech-stack:
  added: []
  patterns:
    - Route group layout isolation — (marketing) group gets bare layout with no auth/sidebar
    - Server component composition — page.tsx composes client section components without "use client"
    - Middleware pathname bypass — exact path check before no-slug logic for public routes

key-files:
  created:
    - app/(marketing)/layout.tsx
    - app/(marketing)/page.tsx
  modified:
    - lib/supabase/middleware.ts
  deleted:
    - app/page.tsx

key-decisions:
  - "app/page.tsx deleted entirely — app/(marketing)/page.tsx is sole handler for '/'; no re-export needed"
  - "Middleware root bypass is universal (auth-state-agnostic) — authenticated users at '/' see marketing page; dashboard is at '/dashboard?org=slug'"
  - "scroll-smooth added to main element className — CSS-level smooth scroll for anchor nav links"

patterns-established:
  - "Marketing route group: (marketing)/ with bare layout — inherits root html/body/fonts from app/layout.tsx, adds only SEO metadata"
  - "Public path bypass in middleware: insert pathname === '/' check at top of !slug block before any auth logic"

requirements-completed: [MKT-PAGE, MKT-ROUTING]

duration: "~10 minutes total (5 min build + visual checkpoint)"
completed: "2026-02-23"
---

# Phase 17 Plan 03: Marketing Page Assembly Summary

**Full marketing landing page assembled at root URL: (marketing) route group with isolated layout, server component composing 5 sections, middleware updated to allow '/' through without auth redirect, and human-verified visual quality**

## Performance

- **Duration:** ~10 minutes total (5 min build + visual checkpoint)
- **Started:** 2026-02-23
- **Completed:** 2026-02-23
- **Tasks:** 2 of 2
- **Files modified:** 4 (2 created, 1 modified, 1 deleted)

## Accomplishments
- Created `app/(marketing)/layout.tsx` — bare route group layout with SEO metadata, no auth providers, no sidebar, no Toaster
- Created `app/(marketing)/page.tsx` — server component composing all 5 section components in order (Nav, Hero, Features, Pricing, Footer) with `scroll-smooth` for anchor navigation
- Deleted `app/page.tsx` — removed the old auth-redirect page; the (marketing) route group now exclusively owns the `/` route
- Updated `lib/supabase/middleware.ts` Step 5 to allow exact path `/` through without redirect, enabling the marketing page to render in development and production without authentication
- Human visual verification approved — all sections render correctly, particle physics animate, CTAs navigate to /onboarding, mobile layout is responsive

## Task Commits

Each task was committed atomically:

1. **Task 1: Create marketing route group layout and page, replace app/page.tsx, update middleware** - `ad257d1` (feat)
2. **Task 2: Visual verification of marketing landing page** - Human-approved checkpoint (no code commit)

**Plan metadata:** TBD (docs commit)

## Files Created/Modified
- `app/(marketing)/layout.tsx` — Minimal route group layout with Prompt SEO metadata; no auth providers, sidebar, or Toaster; inherits html/body/fonts from root layout
- `app/(marketing)/page.tsx` — Server component composing MarketingNav, HeroSection, FeaturesSection, PricingSection, FooterSection; scroll-smooth on main wrapper
- `lib/supabase/middleware.ts` — Added `if (pathname === "/") { return supabaseResponse; }` at top of Step 5 no-slug block
- `app/page.tsx` — DELETED; old auth-redirect server component replaced by (marketing) route group

## Decisions Made
- `app/page.tsx` deleted entirely rather than emptied/redirected — the (marketing) route group's `page.tsx` is the sole handler for `/` with no conflict
- Middleware root bypass is auth-state-agnostic — authenticated users visiting `/` see the marketing page (not redirected); the dashboard lives at `/dashboard?org=slug`, so this is intentional behaviour for dev preview and production phasetwo.uk root
- `scroll-smooth` added as className on the `<main>` element for CSS-level anchor scroll behaviour without JavaScript

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Phase 17 is complete. All 3 plans executed:
- Plan 01: Particle systems (HeroParticles, FooterParticles, useIsMobile)
- Plan 02: Marketing section components (Nav, Hero, Features, Pricing, Footer)
- Plan 03: Page assembly, routing, middleware (this plan)

The marketing landing page is live at the root URL. The project is feature-complete for v3.0 scope.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| app/(marketing)/layout.tsx | FOUND |
| app/(marketing)/page.tsx | FOUND |
| app/page.tsx | DELETED (correct) |
| lib/supabase/middleware.ts root bypass | VERIFIED |
| Commit ad257d1 | FOUND |
| Human verification | APPROVED |

---
*Phase: 17-marketing-landing-page*
*Completed: 2026-02-23*
