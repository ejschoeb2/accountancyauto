# Phase 17: Marketing Landing Page - Research

**Researched:** 2026-02-23
**Domain:** Next.js static marketing page with particle physics animation (framer-motion)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Page Structure & Sections**
- Sticky nav bar at top: Prompt logo (Lucide `Brain` icon in violet), section anchor links (Features, Pricing), Login button, Sign Up CTA button
- Hero section: "The Chase Is Over" bold text on the left. Right side has an explosion of particle icons adapted from phasetwo.uk's `HeroParticles.tsx` pattern, using Lucide icons from the Prompt dashboard, coloured with the status system colours from DESIGN.md (red, orange, amber, blue, green, grey)
- "What We Do" features section: 3 cards summarising the software into its three main functions
- Pricing section: 3 pricing cards (Sole Trader, Practice, Firm — Lite tier dropped)
- Footer: Dark background (#1a1a1a) section with bold central text "Ready to stop chasing?" + CTA button, navigation links at the bottom, particle effects adapted from phasetwo.uk's `FooterParticles.tsx` pattern

**Hero Particle System**
- Adapt the `HeroParticles.tsx` physics engine from phasetwo.uk reference project (`C:\Users\ejsch\University\Coding Projects\estudios-launchpad-new - Copy\src\components\HeroParticles.tsx`)
- Icons: Replace phasetwo shapes (Circle, Square, Triangle, custom logo) with Lucide icons used across the Prompt dashboard (e.g., Mail, Calendar, Clock, FileText, Users, Bell, CheckCircle, AlertCircle, etc.)
- Colours: Use DESIGN.md status system colours instead of primary/secondary — particles appear in red (`--status-danger`), orange (`--status-critical`), amber (`--status-warning`), blue (`--status-info`), green (`green-500`), grey (`--status-neutral`)
- Same semicircular spawn pattern from right side, friction-based deceleration, particle collision physics
- Hidden on mobile (same as reference)

**Footer Design**
- Dark (#1a1a1a) background section — appears normally on scroll (no growing box animation)
- Particle effects from both bottom corners (adapted from `FooterParticles.tsx`) triggered on scroll into view
- Bold central headline: "Ready to stop chasing?"
- "Start Free Trial" CTA button below headline
- Navigation links at bottom: section anchors + Login + legal links
- Prompt logo (Brain icon in violet) in footer nav

**Pricing Cards**
- 3 tiers shown: Sole Trader (£39/mo), Practice (£89/mo), Firm (£159/mo)
- No highlighted/recommended tier — all cards equal visual weight
- Card content: tier name, price, client limit, user limit — no feature checklists
- Each card has a "Start Free Trial" CTA button leading directly to /onboarding

**Conversion & CTA Flow**
- Three CTA locations: hero section, each pricing card, footer bold text section
- All CTAs lead directly to the /onboarding signup flow
- CTA text: "Start Free Trial" (emphasising the 14-day trial)

**Brand & Visual Identity**
- Logo: Lucide `Brain` icon in violet colour scheme (temporary branding)
- Product name: "Prompt" displayed alongside Brain icon
- Tone: Bolder and more expressive than the professional dashboard
- Background: Light/white main sections, dark (#1a1a1a) footer section
- Status colours carry throughout: red/orange/amber/blue/green/grey palette from DESIGN.md appears as accent colours — section highlights, card borders, hover states

### Claude's Discretion

- Hero subtext/tagline below "The Chase Is Over"
- The 3 feature card titles and descriptions (summarising the software's core value)
- Exact icon selection for particles (which Lucide icons best represent the dashboard)
- Spacing, typography scale, responsive breakpoints
- Footer navigation link set
- Any subtle scroll animations beyond the particle systems

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

## Summary

Phase 17 builds a public-facing marketing landing page for the Prompt product. The page lives at `phasetwo.uk` (the marketing domain) but must be built inside the existing Next.js app as the root path `app/(marketing)/page.tsx` — the middleware already redirects unauthenticated users on bare `app.phasetwo.uk` to `phasetwo.uk`, so the marketing page needs a distinct route group that bypasses the subdomain/auth middleware entirely.

The central technical challenge is the particle physics engine. The reference implementation (`HeroParticles.tsx` and `FooterParticles.tsx` in the phasetwo.uk reference project) uses `framer-motion` for position/rotation spring animations combined with a `requestAnimationFrame` physics loop using friction-based deceleration and elastic collision resolution. **Framer-motion is not currently installed** in the Prompt project — it must be added. The reference code has been fully read and understood; the adaptation is primarily: (1) replace shape type system with Lucide icon selection, (2) replace colour classes (`text-primary`/`text-secondary`) with the 6 status colour classes from DESIGN.md.

The footer particle system differs from the hero: it uses an `isTriggered` prop driven by an `IntersectionObserver` scroll event rather than spawning on mount. The reference footer uses a growing-box scroll animation that is explicitly **not wanted** for Prompt — the footer appears as a static dark section, so the footer particle trigger mechanism needs adaptation (IntersectionObserver on the footer element itself, replacing the `useScroll`/`useMotionValueEvent` chain).

**Primary recommendation:** Install framer-motion, create `app/(marketing)/` route group with its own layout that bypasses the auth middleware, build the page as a single-file client component split into focused sub-components per section.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| framer-motion | ^11.x (latest) | Position/rotation spring animations for particles | Used in reference implementation; de facto React animation standard; `useMotionValue`, `useSpring`, `useScroll`, `useMotionValueEvent` needed |
| lucide-react | ^0.563.0 (already installed) | Particle icons and UI icons | Already in project; same icons as dashboard |
| next (App Router) | 16.1.6 (already installed) | Page routing, layout system | Already in project |
| tailwindcss | ^4 (already installed) | All styling | Already in project |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react (19.x) | already installed | useRef, useState, useEffect for particle engine | Already in project |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| framer-motion | CSS animations only | Cannot replicate the physics engine — requestAnimationFrame + spring position requires framer-motion's `useMotionValue`/`useSpring` pattern from the reference |
| framer-motion | GSAP | Would work but adds ~70kb; framer-motion matches reference exactly |
| framer-motion | react-spring | Less feature-complete for scroll-driven animation; reference uses framer-motion |

**Installation:**
```bash
npm install framer-motion
```

---

## Architecture Patterns

### Recommended Project Structure

```
app/
├── (marketing)/                  # New route group — no auth middleware needed
│   ├── layout.tsx                # Minimal layout (no sidebar, no auth check)
│   └── page.tsx                  # Main landing page (imports sections)
│
components/
└── marketing/                    # Marketing-specific components
    ├── nav.tsx                   # Sticky navigation bar
    ├── hero-section.tsx          # Hero with HeroParticles
    ├── features-section.tsx      # 3 feature cards
    ├── pricing-section.tsx       # 3 pricing cards (Sole Trader, Practice, Firm)
    ├── footer-section.tsx        # Dark footer with FooterParticles
    ├── hero-particles.tsx        # Adapted particle physics engine (hero)
    └── footer-particles.tsx      # Adapted particle physics engine (footer)
```

### Pattern 1: Route Group for Marketing Page

**What:** Next.js App Router route groups (`(marketing)`) create a layout boundary without affecting the URL. The page at `app/(marketing)/page.tsx` resolves to `/` and can have its own layout that does not include auth context.

**Problem being solved:** The existing `app/page.tsx` does an auth check and redirects to `/login` or `/dashboard`. The marketing page must be the public root. The solution is to **replace** `app/page.tsx` with `app/(marketing)/page.tsx` (same URL, new layout group) and move the auth-checking redirect logic elsewhere.

**Current `app/page.tsx` behaviour:** Checks auth, redirects to `/login` if unauthenticated. For the marketing site, unauthenticated visitors at the root should see the landing page — the middleware already handles the separation by serving `app.phasetwo.uk` (app subdomain) vs `phasetwo.uk` (marketing domain). However, in development, the root `/` with no `?org=` param currently redirects to `/login`. The marketing page needs to replace this.

**Approach:** Replace `app/page.tsx` with a marketing page. The middleware already handles routing correctly: unauthenticated users on `app.phasetwo.uk/` → no slug → redirect to marketing (phasetwo.uk). So the root page in the app can simply become the marketing page. Authenticated app users will not land here (they're on the subdomain). For development, the root `/` without `?org=` currently redirects to `/login` — this is acceptable since development uses `?org=` for tenant routing.

**Implementation:** Replace `app/page.tsx` directly (it is currently just a redirect page). Create `app/(marketing)/layout.tsx` with a minimal wrapper (no Toaster, no auth providers).

Actually, more precisely: since the marketing page lives at `phasetwo.uk` (separate domain) in production, the root `app/page.tsx` in the _app_ deploy is never reached by normal users — it only exists as the fallback for unauthenticated access at `app.phasetwo.uk`. The marketing page should be created as a **standalone Next.js page at the app root** but make it public — OR, given that the marketing page is meant for `phasetwo.uk`, it could be a separate deployment entirely. The CONTEXT.md says "public-facing marketing landing page" and the middleware redirects bare visitors to `phasetwo.uk` — this implies it is a separate site.

**Resolution:** The cleanest approach in this codebase is to build the marketing page in this repo at `app/(marketing)/page.tsx` and deploy it as the root of `phasetwo.uk`. The middleware on the app subdomain (`app.phasetwo.uk`) will never serve this page to app users. In development, the root `/` can show the marketing page for review purposes, with the auth check removed. The existing redirect logic in `app/page.tsx` can be deleted and replaced entirely.

### Pattern 2: Particle Engine Adaptation

**What:** The reference `HeroParticles.tsx` uses a `requestAnimationFrame` physics loop that updates React state on every frame. `framer-motion`'s `useMotionValue` + `useSpring` provide smooth interpolation between physics updates, avoiding jerky animation from direct state updates.

**Key mechanics from the reference (verbatim):**
- `FRICTION = 0.985` — velocity decays each frame
- `VELOCITY_THRESHOLD = 0.01` — stop updating when velocity is negligible
- Particles spawn in 3 semicircular layers (1 center + 6 inner + 13 outer = 20 total) from origin at right edge
- 144-degree arc span centered on "straight left" (180°)
- Elastic particle-to-particle collision with velocity swap and separation
- Left-boundary removal: particles that pass off the left edge (`x + radius < -100`) are removed
- Bounce off right/top with coefficient 0.8 (energy loss)
- `useSpring` with `{ stiffness: 300, damping: 30 }` for smooth position update
- `rotate` motion value accumulates based on velocity magnitude

**Adaptation changes for Prompt:**
1. Replace `ParticleType` (`circle | square | triangle | custom`) with colour-indexed Lucide icons
2. Replace `color: 'primary' | 'secondary'` with `color: 'danger' | 'critical' | 'warning' | 'info' | 'green' | 'neutral'` (6 status colours)
3. Replace `iconColorClass` lookup with a colour-to-class map matching DESIGN.md CSS variables
4. Replace the `shapeElement()` switch with a Lucide icon lookup by particle type index
5. Remove `pageType` prop / `PAGE_ICONS` map — icons are hardcoded for Prompt

**Colour class mapping for particles:**
```typescript
const STATUS_COLOURS = {
  danger:   { icon: 'text-status-danger',   fill: 'stroke-status-danger' },
  critical: { icon: 'text-status-critical', fill: 'stroke-status-critical' },
  warning:  { icon: 'text-status-warning',  fill: 'stroke-status-warning' },
  info:     { icon: 'text-status-info',     fill: 'stroke-status-info' },
  green:    { icon: 'text-green-500',       fill: 'stroke-green-500' },
  neutral:  { icon: 'text-status-neutral',  fill: 'stroke-status-neutral' },
} as const;

type ParticleColour = keyof typeof STATUS_COLOURS;
```

**Icon selection for particles (dashboard icons = recognisable to accountants):**
```typescript
import { Mail, Calendar, Clock, FileText, Users, Bell, CheckCircle, AlertCircle, Send, BarChart2, Layers, Receipt } from 'lucide-react';

const PARTICLE_ICONS = [Mail, Calendar, Clock, FileText, Users, Bell, CheckCircle, AlertCircle, Send, BarChart2, Layers, Receipt];
```
Particle `type` field becomes an index into this array (random at spawn, integer 0-11).

### Pattern 3: FooterParticles Trigger via IntersectionObserver

**What:** The reference `FooterParticles.tsx` uses an `isTriggered` prop (boolean) that the parent Footer passes in, set when `scrollYProgress >= 0.99`. The reference Footer uses `useScroll` + `useMotionValueEvent` to track scroll progress of the footer element.

**Prompt adaptation:** The footer is a static dark section (no growing box). The trigger needs to come from `IntersectionObserver` detecting when the footer enters the viewport. The Footer component should:
1. Create a `containerRef` on the footer section
2. Use a `useEffect` + `IntersectionObserver` to set `shouldExplode = true` once when the footer reaches 50% viewport visibility
3. Pass `shouldExplode` to `FooterParticles` as `isTriggered`

The `FooterParticles` component already has `hasSpawnedRef` preventing double-spawns — this is correct to keep.

**Pattern:**
```typescript
useEffect(() => {
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.intersectionRatio >= 0.5 && !shouldExplode) {
        setShouldExplode(true);
      }
    },
    { threshold: 0.5 }
  );
  if (footerRef.current) observer.observe(footerRef.current);
  return () => observer.disconnect();
}, [shouldExplode]);
```

### Pattern 4: Sticky Nav with Anchor Links

**What:** The nav uses standard `href="#section-id"` anchor links for in-page navigation. The sticky behaviour uses `position: sticky` (CSS) or a framer-motion header with scroll detection.

**Simple implementation:** CSS `sticky top-0 z-50` + `backdrop-blur-md bg-white/80` (glassmorphism, same as reference). No framer-motion required for the nav hide/show — the reference uses framer-motion to hide when footer is visible, but this is Claude's discretion to skip or simplify.

**Sections need IDs:** `id="features"`, `id="pricing"`.

### Anti-Patterns to Avoid

- **Using `requestAnimationFrame` without cleanup:** The `animationFrameRef.current` must be cancelled in the `useEffect` cleanup to prevent memory leaks and double animation loops in React Strict Mode.
- **Creating the particle component as a server component:** The physics engine requires `useState`, `useEffect`, `useRef` — must be `"use client"`.
- **Using the dashboard's `Card` component directly:** The pricing cards on the landing page should be built with plain HTML/Tailwind, not the shadcn Card component with its dashboard styling.
- **Importing `PLAN_TIERS` from `lib/stripe/plans.ts` on the marketing page:** This file reads `process.env.STRIPE_PRICE_*` at module level. Safe to import (lazy Stripe client is separate), but the marketing page should hardcode the display values (£39, £89, £159 and client limits) rather than coupling to the billing config. This avoids accidental exposure of Stripe env context.
- **Placing marketing components in `components/ui/`:** Keep them in `components/marketing/` to separate from the dashboard component library.
- **Using `useIsMobile` from a hook that doesn't exist yet:** The project has NO `hooks/` directory and no `useIsMobile` hook. Need to create `hooks/use-mobile.ts` or inline the logic. The reference implementation is 19 lines and trivially inlineable.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Spring-based position animation | Custom CSS transition or `setInterval` position update | `framer-motion` `useMotionValue` + `useSpring` | Framer handles RAF scheduling, spring physics, and React state synchronisation. Custom implementations always have stutter artifacts. |
| Elastic particle collision | Ad-hoc collision response | Port directly from reference `HeroParticles.tsx` | The reference has correct elastic collision math (velocity rotation, swap, counter-rotation). Re-deriving introduces bugs. |
| Scroll-into-view detection | Scroll event listener with `getBoundingClientRect` | `IntersectionObserver` | Standard, performant, no scroll event overhead. |
| Mobile detection | User agent sniffing | `window.matchMedia` (same as reference `useIsMobile`) | Responsive, avoids SSR issues. |

**Key insight:** The particle engine is the only technically complex part. Everything else (layout, nav, cards) is standard Tailwind. Copy the physics code from the reference rather than re-deriving.

---

## Common Pitfalls

### Pitfall 1: framer-motion and React 19 Compatibility

**What goes wrong:** framer-motion v11+ supports React 19 but required peer dependency changes. Using an older framer-motion version with React 19 may cause warnings or subtle animation issues.

**Why it happens:** The project uses React 19.2.3 (very new). framer-motion 11+ explicitly supports React 19.

**How to avoid:** Install `framer-motion@^11` (latest v11). Verify with `npm install framer-motion` — npm will warn on peer dependency conflicts.

**Warning signs:** TypeScript errors on motion component `ref` types, or console warnings about concurrent features.

### Pitfall 2: `requestAnimationFrame` Running in React Strict Mode (Development)

**What goes wrong:** In React Strict Mode (Next.js dev), `useEffect` runs twice. This can cause two `requestAnimationFrame` loops to run simultaneously, doubling particle speed and causing visual glitches.

**Why it happens:** The `animationFrameRef.current` check only prevents spawning a new loop if one exists, but the cleanup and re-run in strict mode can leave a stale frame running.

**How to avoid:** Ensure the `useEffect` cleanup always cancels the animation frame:
```typescript
return () => {
  clearTimeout(initTimer);
  window.removeEventListener('resize', updateDimensions);
  if (animationFrameRef.current) {
    cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = undefined;
  }
};
```
The reference already does this correctly — preserve the cleanup pattern.

### Pitfall 3: `useSpring` State Update on Every Frame

**What goes wrong:** The physics loop calls `setParticles()` on every animation frame (60fps). Each call triggers a React re-render for all particles. With 20 particles each having their own `motion.div`, this is 20 × 60 = 1200 renders/sec.

**Why it happens:** This is how the reference implementation works — it's intentional but needs to be implemented exactly as in the reference (using `useMotionValue` to avoid propagating updates through the component tree unnecessarily).

**How to avoid:** The `useSpring` on each particle's `x` and `y` values means framer-motion handles the actual DOM updates via its own optimised pipeline, not React's reconciler. The `setParticles()` call updates the state array, but since `useSpring` subscribes to `useMotionValue` directly, the DOM updates are bypassed for position. This is correct as-is in the reference. Do NOT refactor to remove `useMotionValue` per particle — it will cause severe jank.

### Pitfall 4: Particle Container Height Overflow

**What goes wrong:** The `HeroParticles` container is `h-[150vh]` in the reference (taller than the viewport). If the container is inside a section with `overflow-hidden`, particles that travel above or below the hero viewport will be clipped.

**Why it happens:** The hero section needs `overflow: visible` or a specific height to let particles move freely.

**How to avoid:** Apply `overflow-visible` to the hero section, and use `pointer-events-none` on the particle container so it doesn't block scroll/click events. The container must use `position: absolute` with `inset-0` (same as reference).

### Pitfall 5: Middleware Treating the Marketing Root as a Protected Route

**What goes wrong:** The existing `app/page.tsx` does an auth check. Replacing it with a marketing page that requires no auth could break if the middleware still routes unauthenticated visitors at `app.phasetwo.uk/` away before the page renders.

**Why it happens:** The middleware handles `app.phasetwo.uk/` (no slug, unauthenticated) → redirect to `phasetwo.uk`. The marketing page is at `phasetwo.uk/` — a completely different host/deploy. The middleware on the app subdomain never serves it.

**How to avoid:** Build the marketing page in this repo as `app/(marketing)/page.tsx` (replaces the old redirect-only `app/page.tsx`). In production, this page will be served from the root deployment (`phasetwo.uk`). In development, visiting `localhost:3000/` (no `?org=`) will hit the middleware's "no slug, unauthenticated" path → redirect to `/login`. The marketing page will be visible in dev only by routing the middleware to allow it (add `/` to PUBLIC_ROUTES when no slug is present) — OR accept that it's previewed via `localhost:3000` with auth disabled.

**Recommendation:** Add `"/"` as a special case in the middleware: if `pathname === "/"` and no slug is present, serve it (don't redirect). This makes the marketing page visible in development. Only add exact `/` as a public route — not `startsWith("/")`.

### Pitfall 6: Status Colour CSS Variables Not Available as Tailwind Arbitrary Values

**What goes wrong:** Writing `className="text-[var(--status-danger)]"` in Tailwind works, but the `text-status-danger` utility shorthand works ONLY if the CSS variable is registered in `@theme` — which it is in `globals.css` (lines 41-45: `--color-status-danger: var(--status-danger)` etc.).

**How to avoid:** Use the Tailwind v4 utility classes `text-status-danger`, `text-status-critical` etc. directly — they ARE registered. Verify in `globals.css` `@theme inline` block. This is confirmed working in the dashboard components (DESIGN.md status badge examples).

---

## Code Examples

Verified patterns from the reference project and project codebase:

### Adapted Particle Colour System

```typescript
// Source: DESIGN.md status system + reference HeroParticles.tsx adaptation
type ParticleColour = 'danger' | 'critical' | 'warning' | 'info' | 'green' | 'neutral';

const PARTICLE_COLOUR_CLASSES: Record<ParticleColour, string> = {
  danger:   'text-status-danger',
  critical: 'text-status-critical',
  warning:  'text-status-warning',
  info:     'text-status-info',
  green:    'text-green-500',
  neutral:  'text-status-neutral',
};

const PARTICLE_COLOURS: ParticleColour[] = ['danger', 'critical', 'warning', 'info', 'green', 'neutral'];
```

### Adapted Particle Type (Icon Index)

```typescript
// Source: Adapted from HeroParticles.tsx reference
import { Mail, Calendar, Clock, FileText, Users, Bell, CheckCircle, AlertCircle, Send, BarChart2, Layers, Receipt } from 'lucide-react';

const PROMPT_ICONS = [Mail, Calendar, Clock, FileText, Users, Bell, CheckCircle, AlertCircle, Send, BarChart2, Layers, Receipt] as const;

export type Particle = {
  id: number;
  iconIndex: number;          // 0-11, index into PROMPT_ICONS
  colour: ParticleColour;
  size: number;
  x: number; y: number;
  vx: number; vy: number;
};
```

### Shape Component (Adapted)

```typescript
// Source: HeroParticles.tsx reference (Shape component) — adapted
const Shape = ({ particle }: { particle: Particle }) => {
  const Icon = PROMPT_ICONS[particle.iconIndex % PROMPT_ICONS.length];
  const colourClass = PARTICLE_COLOUR_CLASSES[particle.colour];
  const x = useMotionValue(particle.x);
  const y = useMotionValue(particle.y);
  const rotate = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 300, damping: 30 });
  const springY = useSpring(y, { stiffness: 300, damping: 30 });

  useEffect(() => {
    x.set(particle.x);
    y.set(particle.y);
    const rotationSpeed = Math.sqrt(particle.vx ** 2 + particle.vy ** 2) * 2;
    rotate.set(rotate.get() + rotationSpeed);
  }, [particle.x, particle.y, particle.vx, particle.vy]);

  return (
    <motion.div
      style={{
        x: springX, y: springY, rotate,
        position: 'absolute', left: 0, top: 0,
        marginLeft: -particle.size / 2, marginTop: -particle.size / 2,
      }}
    >
      <Icon size={particle.size} strokeWidth={2.5} className={colourClass} />
    </motion.div>
  );
};
```

### Footer IntersectionObserver Trigger

```typescript
// Source: Adapted from Footer.tsx reference (replacing scroll-progress approach)
const [shouldExplode, setShouldExplode] = useState(false);
const footerRef = useRef<HTMLElement>(null);

useEffect(() => {
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.intersectionRatio >= 0.4) setShouldExplode(true);
    },
    { threshold: 0.4 }
  );
  const el = footerRef.current;
  if (el) observer.observe(el);
  return () => observer.disconnect();
}, []);

// Then: <FooterParticles isTriggered={shouldExplode} />
```

### useIsMobile Hook (needs to be created)

```typescript
// Source: reference project hooks/use-mobile.tsx — to be created at hooks/use-mobile.ts
import { useEffect, useState } from 'react';

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    mql.addEventListener('change', onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return !!isMobile;
}
```

### Middleware Update (PUBLIC_ROUTES)

```typescript
// Source: lib/supabase/middleware.ts — current line 7
// Current:
const PUBLIC_ROUTES = ["/login", "/auth/callback", "/auth/signout", "/pricing", "/onboarding", "/invite/accept"];
// Updated:
const PUBLIC_ROUTES = ["/login", "/auth/callback", "/auth/signout", "/pricing", "/onboarding", "/invite/accept"];
// The "/" route is handled specially in Step 5 (no-slug, unauthenticated) — in production it
// redirects to phasetwo.uk. In development, add exact "/" to skip the redirect so the
// marketing page renders locally. Only needed if dev previewing is desired.
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `react-spring` for animation | `framer-motion` v11 | ~2022 | framer-motion has better scroll API and React 19 support |
| Particle canvas (`<canvas>`) | DOM-based particles with motion.div | N/A (design choice) | DOM allows Lucide icons as particles; canvas would require custom icon rendering |
| `document.addEventListener('scroll')` for scroll detection | `IntersectionObserver` | ~2018 | No scroll event overhead; better performance |

**Deprecated/outdated:**
- `framer-motion` v10 and below: Use v11+ for React 19 compatibility and the current `useMotionValueEvent` API

---

## Open Questions

1. **Where does the marketing page deploy?**
   - What we know: The middleware redirects `phasetwo.uk` (unauthenticated, no-slug in prod) to `phasetwo.uk`. This suggests the marketing site is a separate deployment.
   - What's unclear: Is `phasetwo.uk` served from this same Next.js repo (different Vercel deployment, same code) or is it truly a separate project?
   - Recommendation: Build the marketing page in this repo at `app/(marketing)/page.tsx`. This works for either deployment strategy — same repo deployed to `phasetwo.uk`, or the marketing page co-existing with the app at the root for dev preview. The planner should decide whether to also update the middleware to allow dev preview of `/`.

2. **User limits on pricing cards**
   - What we know: CONTEXT.md says cards show "tier name, price, client limit, user limit"
   - What's unclear: `PLAN_TIERS` in `lib/stripe/plans.ts` does NOT have a `userLimit` field — only `clientLimit`. The plans have seat limits (Sole Trader: 1 user, Practice: 5 users, Firm: unlimited) but these are not currently stored in the plans config.
   - Recommendation: Hardcode user limits on the landing page pricing cards (do not couple to `PLAN_TIERS`). Hardcoded values: Sole Trader (40 clients, 1 user), Practice (150 clients, 5 users), Firm (unlimited clients, unlimited users).

3. **`app/page.tsx` replacement strategy**
   - What we know: The current `app/page.tsx` is a pure redirect (auth check → `/login` or `/dashboard`). The marketing page needs to replace it.
   - What's unclear: Whether replacing `app/page.tsx` breaks the auth redirect path for the app subdomain.
   - Recommendation: It does NOT break anything. In production, the app subdomain (`acmefirm.app.phasetwo.uk`) serves all app routes; the marketing page at `/` is on a different domain. In development, the `/` route currently shows the auth redirect — replacing it with a marketing page is a dev experience improvement. The middleware will redirect authenticated users appropriately regardless.

---

## Sources

### Primary (HIGH confidence)

- Reference project `HeroParticles.tsx` — full source read, physics engine fully understood
- Reference project `FooterParticles.tsx` — full source read, trigger mechanism understood
- Reference project `Footer.tsx` — scroll trigger mechanism read (to be simplified)
- Reference project `Header.tsx` — sticky nav pattern read
- `app/globals.css` — status colour CSS variables confirmed registered in `@theme inline`
- `lib/supabase/middleware.ts` — PUBLIC_ROUTES and routing logic fully read
- `lib/stripe/plans.ts` — plan tier data structure confirmed; user limits not present
- `app/pricing/page.tsx` — existing pricing page confirmed (separate from landing page)
- `package.json` — framer-motion confirmed NOT installed

### Secondary (MEDIUM confidence)

- framer-motion React 19 support: Known from training data; npm install will confirm version compatibility at install time.

### Tertiary (LOW confidence)

- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — reference code fully read; framer-motion absence confirmed
- Architecture: HIGH — middleware fully read; route group pattern is documented Next.js behaviour
- Pitfalls: HIGH — React Strict Mode RAF issue, CSS variable registration, and container overflow all verified from direct code inspection
- Particle physics adaptation: HIGH — reference code fully read and adaptation plan is concrete

**Research date:** 2026-02-23
**Valid until:** 2026-03-23 (stable domain — framer-motion API unlikely to change materially)
