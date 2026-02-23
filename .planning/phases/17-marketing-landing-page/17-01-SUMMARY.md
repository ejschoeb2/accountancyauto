---
phase: 17-marketing-landing-page
plan: "01"
subsystem: marketing
tags: [particles, framer-motion, animation, physics, lucide]
dependency_graph:
  requires: []
  provides: [HeroParticles, FooterParticles, useIsMobile]
  affects: [components/marketing/hero-particles.tsx, components/marketing/footer-particles.tsx, hooks/use-mobile.ts]
tech_stack:
  added: [framer-motion@12.34.3]
  patterns: [useMotionValue, useSpring, requestAnimationFrame physics loop, IntersectionObserver trigger]
key_files:
  created:
    - hooks/use-mobile.ts
    - components/marketing/hero-particles.tsx
    - components/marketing/footer-particles.tsx
  modified:
    - package.json
    - package-lock.json
decisions:
  - "Bottom boundary bounce added to HeroParticles (not in reference) — prevents particles escaping the tall 150vh container"
  - "framer-motion v12.34.3 installed (v11+ required) — compatible with React 19.2.3"
  - "useRef<number>(undefined) used for animationFrameRef instead of useRef<number | undefined>(null) — avoids strict TypeScript type mismatch with cancelAnimationFrame"
metrics:
  duration: "~15 minutes"
  completed: "2026-02-23"
  tasks_completed: 2
  files_created: 3
  files_modified: 2
---

# Phase 17 Plan 01: Particle Systems and useIsMobile Hook Summary

Installed framer-motion v12, created useIsMobile hook, and ported both particle physics engines (hero + footer) from the phasetwo.uk reference with Prompt-specific Lucide icons and DESIGN.md status colours.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install framer-motion and create useIsMobile hook | 79557b1 | hooks/use-mobile.ts, package.json, package-lock.json |
| 2 | Build hero-particles.tsx and footer-particles.tsx | 0fe70b5 | components/marketing/hero-particles.tsx, components/marketing/footer-particles.tsx |

## Verification Results

1. `npm ls framer-motion` → `framer-motion@12.34.3` installed
2. `npx tsc --noEmit` → no errors in new files (pre-existing `.next/dev/types` route errors unchanged)
3. `hooks/use-mobile.ts` exports `useIsMobile`
4. `components/marketing/hero-particles.tsx` exports `HeroParticles`
5. `components/marketing/footer-particles.tsx` exports `FooterParticles`
6. No imports from reference project (no PhaseZeroLogo, no estudios-launchpad)
7. Both particle files begin with `"use client"`
8. Both use status colour classes: `text-status-danger`, `text-status-critical`, `text-status-warning`, `text-status-info`, `text-green-500`, `text-status-neutral`

## What Was Built

### hooks/use-mobile.ts
Mobile detection hook using `window.matchMedia` at 768px breakpoint. Returns `false` during SSR (initial state `undefined` cast to boolean). Listens for `change` events and cleans up on unmount.

### components/marketing/hero-particles.tsx
20 Lucide-icon particles spawning from the right edge in a semicircular pattern:
- **Layer 1:** 1 particle at origin (straight left trajectory)
- **Layer 2:** 6 particles on an 80px radius arc
- **Layer 3:** 13 particles on a 160px radius arc
- 144-degree arc spread centred on the "straight left" direction
- FRICTION=0.985, elastic particle-to-particle collision, boundary bouncing on all 4 sides, left-edge removal
- 12 Lucide icons: Mail, Calendar, Clock, FileText, Users, Bell, CheckCircle, AlertCircle, Send, BarChart2, Layers, Receipt
- 6 status colours randomly assigned per particle

### components/marketing/footer-particles.tsx
Dual-corner particle explosion triggered when `isTriggered` prop becomes true:
- Left corner: particles aimed up-right at ~-45 degrees (60-degree spread)
- Right corner: particles aimed up-left at ~-135 degrees (60-degree spread)
- 3 layers per corner (1+2+4 = 7 particles × 2 corners = 14 total)
- `hasSpawnedRef` prevents double-spawn on re-renders
- `isStopped` field locks particles in place when velocity drops below threshold (confetti-scatter effect)
- Particles that fall off bottom or sides are removed (null filter)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Auto-add] Bottom boundary bounce added to HeroParticles**
- **Found during:** Task 2 implementation
- **Issue:** Reference HeroParticles only bounces off top and right, ignoring the bottom. Since the container is `h-[150vh]`, particles can escape the visible area by falling off the bottom without removal.
- **Fix:** Added bottom boundary bounce (`newVy *= -0.8`) matching the right-boundary bounce pattern already present in the reference.
- **Files modified:** `components/marketing/hero-particles.tsx`
- **Commit:** 0fe70b5

## Self-Check: PASSED

| Item | Status |
|------|--------|
| hooks/use-mobile.ts | FOUND |
| components/marketing/hero-particles.tsx | FOUND |
| components/marketing/footer-particles.tsx | FOUND |
| Commit 79557b1 | FOUND |
| Commit 0fe70b5 | FOUND |
