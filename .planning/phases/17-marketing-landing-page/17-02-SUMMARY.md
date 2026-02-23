---
phase: 17-marketing-landing-page
plan: "02"
subsystem: marketing
tags: [landing-page, nav, hero, features, pricing, footer, particles, tailwind]
dependency_graph:
  requires: [HeroParticles, FooterParticles, useIsMobile]
  provides: [MarketingNav, HeroSection, FeaturesSection, PricingSection, FooterSection]
  affects:
    - components/marketing/nav.tsx
    - components/marketing/hero-section.tsx
    - components/marketing/features-section.tsx
    - components/marketing/pricing-section.tsx
    - components/marketing/footer-section.tsx
tech_stack:
  added: []
  patterns: [sticky-glassmorphism-nav, two-column-hero, feature-cards, pricing-cards, IntersectionObserver-trigger]
key_files:
  created:
    - components/marketing/nav.tsx
    - components/marketing/hero-section.tsx
    - components/marketing/features-section.tsx
    - components/marketing/pricing-section.tsx
    - components/marketing/footer-section.tsx
  modified: []
decisions:
  - "PricingSection hardcodes tier values — no import from lib/stripe/plans.ts to avoid coupling to Stripe env vars"
  - "No highlighted/recommended pricing tier — all three cards have equal visual weight per CONTEXT.md decision"
  - "Footer CTA uses inverted colour scheme (white bg + violet text) for contrast on dark #1a1a1a background"
  - "HeroSection right column hidden on desktop only (lg:hidden) because HeroParticles already handles mobile via useIsMobile"
metrics:
  duration: "~2 minutes"
  completed: "2026-02-23"
  tasks_completed: 2
  files_created: 5
  files_modified: 0
---

# Phase 17 Plan 02: Marketing Section Components Summary

Created all five marketing page section components: sticky nav bar, hero with particles, feature cards, pricing cards, and dark footer with particle explosion — all using plain HTML/Tailwind with no shadcn imports.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create nav.tsx, hero-section.tsx, and features-section.tsx | 7398d2b | components/marketing/nav.tsx, components/marketing/hero-section.tsx, components/marketing/features-section.tsx |
| 2 | Create pricing-section.tsx and footer-section.tsx | 5f481da | components/marketing/pricing-section.tsx, components/marketing/footer-section.tsx |

## Verification Results

1. `npx tsc --noEmit` — only pre-existing `.next/dev/types` route errors; no new errors in any of the 5 files
2. All 5 section components have `"use client"` directive
3. All CTA buttons/links point to `/onboarding` (verified in nav, hero, each pricing card, footer)
4. Nav has Brain icon in violet-600, anchor links to `#features` and `#pricing`, Login link, Start Free Trial CTA
5. Hero has "The Chase Is Over" headline and imports `HeroParticles` from `@/components/marketing/hero-particles`
6. Features has 3 cards: Automated Reminders (status-info blue), Deadline Tracking (status-warning amber), Email Management (green-500)
7. Pricing has 3 hardcoded tier cards — no import from `lib/stripe/plans.ts`; values: Sole Trader £39, Practice £89, Firm £159
8. Footer has `bg-[#1a1a1a]` dark background, "Ready to stop chasing?" headline, `FooterParticles` with IntersectionObserver trigger at 40% threshold, and navigation links
9. Zero imports from `@/components/ui` (shadcn) across all 5 files

## What Was Built

### components/marketing/nav.tsx
Sticky glassmorphism navigation bar at `z-50`:
- `sticky top-0 z-50 backdrop-blur-md bg-white/80 border-b border-border`
- Left: Lucide `Brain` icon in `text-violet-600` + "Prompt" text bold
- Center: `#features` and `#pricing` anchor links (hidden on mobile with `hidden md:flex`)
- Right: "Login" text link + "Start Free Trial" violet-600 CTA (`rounded-lg bg-violet-600 px-5 py-2.5`)
- `max-w-6xl mx-auto px-6` container

### components/marketing/hero-section.tsx
Two-column hero section with `py-20 lg:py-32`:
- Left: "The Chase Is Over" (`text-5xl lg:text-6xl font-bold tracking-tight text-foreground`), subtext ("Automated client reminders for UK accounting practices..."), large CTA button, "14-day free trial. No card required." micro-copy
- Right: `hidden lg:block relative overflow-visible min-h-[500px]` container with `<HeroParticles />`
- HeroParticles handles its own mobile suppression via `useIsMobile`

### components/marketing/features-section.tsx
Three feature cards on `bg-muted/30` background with `id="features"`:
- Section heading "What We Do" + subtext
- Cards: `bg-white rounded-xl border border-border p-8 shadow-sm`
- Automated Reminders — Bell icon in `text-status-info`
- Deadline Tracking — CalendarDays icon in `text-status-warning`
- Email Management — MailOpen icon in `text-green-500`

### components/marketing/pricing-section.tsx
Three equal-weight pricing tier cards with `id="pricing"`:
- Section heading "Simple, Honest Pricing"
- Sole Trader: £39/mo, up to 40 clients, 1 user
- Practice: £89/mo, up to 150 clients, up to 5 users
- Firm: £159/mo, unlimited clients, unlimited users
- All values hardcoded — zero Stripe coupling
- Each card: `bg-white rounded-xl border border-border p-8`, tier name, large price (text-4xl font-bold), limits, Start Free Trial CTA
- VAT note: "All prices exclude VAT." below cards

### components/marketing/footer-section.tsx
Dark footer section with IntersectionObserver-triggered particle explosion:
- `bg-[#1a1a1a] text-white min-h-[500px]` background
- `IntersectionObserver` at `threshold: 0.4` fires `setShouldExplode(true)` → passed as `isTriggered` to `<FooterParticles />`
- "Ready to stop chasing?" headline (`text-3xl lg:text-5xl font-bold text-white text-center`)
- Inverted CTA: `bg-white px-8 py-3 text-violet-600 font-semibold` (contrasts dark background)
- Brain logo in `text-violet-400` (lightened for dark bg)
- Nav links: Features, Pricing, Login, Sign Up, Privacy Policy, Terms of Service
- Copyright: "© 2026 Prompt. All rights reserved."

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| components/marketing/nav.tsx | FOUND |
| components/marketing/hero-section.tsx | FOUND |
| components/marketing/features-section.tsx | FOUND |
| components/marketing/pricing-section.tsx | FOUND |
| components/marketing/footer-section.tsx | FOUND |
| Commit 7398d2b | FOUND |
| Commit 5f481da | FOUND |
