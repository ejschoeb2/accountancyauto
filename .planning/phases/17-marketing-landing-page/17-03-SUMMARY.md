---
phase: 17-marketing-landing-page
plan: "03"
subsystem: marketing
tags: [landing-page, routing, middleware, assembly]
dependency_graph:
  requires: [MarketingNav, HeroSection, FeaturesSection, PricingSection, FooterSection]
  provides: [marketing-landing-page-at-root]
  affects:
    - app/(marketing)/layout.tsx
    - app/(marketing)/page.tsx
    - app/page.tsx
    - lib/supabase/middleware.ts
tech_stack:
  added: []
  patterns: [route-group-layout, middleware-pathname-bypass, server-component-composition]
key_files:
  created:
    - app/(marketing)/layout.tsx
    - app/(marketing)/page.tsx
  modified:
    - lib/supabase/middleware.ts
  deleted:
    - app/page.tsx
decisions:
  - "app/page.tsx deleted entirely — app/(marketing)/page.tsx is sole handler for '/'; no re-export needed"
  - "Middleware root bypass is universal (auth-state-agnostic) — authenticated users at '/' see marketing page; dashboard is at '/dashboard?org=slug'"
  - "scroll-smooth added to main element className — CSS-level smooth scroll for anchor nav links"
metrics:
  duration: "~5 minutes"
  completed: "2026-02-23"
  tasks_completed: 1
  tasks_total: 2
  files_created: 2
  files_modified: 1
  files_deleted: 1
status: awaiting-human-verify
---

# Phase 17 Plan 03: Marketing Page Assembly Summary

Assembled the marketing landing page from section components into the (marketing) route group, replaced the old auth-redirect app/page.tsx, and updated middleware to serve the root URL as a public marketing page without authentication.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create marketing route group layout and page, replace app/page.tsx, update middleware | ad257d1 | app/(marketing)/layout.tsx (created), app/(marketing)/page.tsx (created), app/page.tsx (deleted), lib/supabase/middleware.ts (modified) |

## Tasks Pending

| Task | Name | Status |
|------|------|--------|
| 2 | Visual verification of marketing landing page | Awaiting human-verify checkpoint |

## What Was Built

### app/(marketing)/layout.tsx
Minimal route group layout — no auth providers, no sidebar, no Toaster. Wraps children in a React fragment. Exports custom metadata with SEO title and description targeting UK accountants.

### app/(marketing)/page.tsx
Server component composing all 5 marketing sections in order:
1. `<MarketingNav />` — sticky glassmorphism nav with logo, anchor links, Login, Sign Up CTA
2. `<HeroSection />` — "The Chase Is Over" hero with particle physics
3. `<FeaturesSection />` — 3 feature cards with `id="features"` anchor
4. `<PricingSection />` — 3 pricing tier cards with `id="pricing"` anchor
5. `<FooterSection />` — dark footer with IntersectionObserver-triggered particle explosion

### lib/supabase/middleware.ts (Step 5 modification)
Added root path bypass at the top of the `if (!slug)` block:
```typescript
if (pathname === "/") {
  return supabaseResponse;
}
```
This allows `localhost:3000/` to render the marketing page in development without redirecting to `/login`. In production, the same check allows the root of any marketing deployment through. All other no-slug paths continue to existing logic (authenticated → org redirect, unauthenticated → /login in dev, phasetwo.uk in prod).

### app/page.tsx (deleted)
The old server component that checked auth and redirected to /dashboard, /login, or /onboarding. Deleted because `app/(marketing)/page.tsx` now claims the `/` route. The (marketing) route group handles auth-agnostic rendering for the public landing page.

## Verification Results

1. `app/page.tsx` deleted — confirmed `DELETED` via bash check
2. `app/(marketing)/layout.tsx` exists with metadata
3. `app/(marketing)/page.tsx` imports all 5 section components (verified against export names)
4. `npx tsc --noEmit` — no errors in source files; only pre-existing `.next/dev/types` errors (same as plans 01 and 02)
5. Middleware Step 5 now has `if (pathname === "/") { return supabaseResponse; }` as first check

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| app/(marketing)/layout.tsx | FOUND |
| app/(marketing)/page.tsx | FOUND |
| app/page.tsx | DELETED (correct) |
| lib/supabase/middleware.ts root bypass | VERIFIED |
| Commit ad257d1 | FOUND |
