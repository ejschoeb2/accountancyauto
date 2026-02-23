# Phase 17: Marketing Landing Page - Context

**Gathered:** 2026-02-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Public-facing marketing landing page for Prompt — converts visiting UK accountants into free trial signups. Single scrollable page with hero, features, pricing, and footer CTA. This phase builds the page itself; analytics, A/B testing, and SEO optimisation are separate concerns.

</domain>

<decisions>
## Implementation Decisions

### Page Structure & Sections
- **Sticky nav bar** at top: Prompt logo (Lucide `Brain` icon in violet), section anchor links (Features, Pricing), Login button, Sign Up CTA button
- **Hero section**: "The Chase Is Over" in bold text on the left side. Right side has an explosion of particle icons (adapted from phasetwo.uk's `HeroParticles.tsx` pattern) using Lucide icons from the Prompt dashboard, coloured with the status system colours from DESIGN.md (red, orange, amber, blue, green, grey)
- **"What We Do" features section**: 3 cards summarising the software into its three main functions
- **Pricing section**: 3 pricing cards (Sole Trader, Practice, Firm — Lite tier dropped)
- **Footer**: Dark background section with bold central text "Ready to stop chasing?" + CTA button, navigation links at the bottom, particle effects adapted from phasetwo.uk's `FooterParticles.tsx` pattern

### Hero Particle System
- Adapt the `HeroParticles.tsx` physics engine from the phasetwo.uk reference project (`C:\Users\ejsch\University\Coding Projects\estudios-launchpad-new - Copy\src\components\HeroParticles.tsx`)
- **Icons:** Replace phasetwo shapes (Circle, Square, Triangle, custom logo) with Lucide icons used across the Prompt dashboard (e.g., Mail, Calendar, Clock, FileText, Users, Bell, CheckCircle, AlertCircle, etc.)
- **Colours:** Use the DESIGN.md status system colours instead of primary/secondary — particles should appear in red (`--status-danger`), orange (`--status-critical`), amber (`--status-warning`), blue (`--status-info`), green (`green-500`), grey (`--status-neutral`)
- Same semicircular spawn pattern from right side, friction-based deceleration, particle collision physics
- Hidden on mobile (same as reference)

### Footer Design
- Dark (#1a1a1a) background section — appears normally on scroll (no growing box animation)
- Particle effects from both bottom corners (adapted from `FooterParticles.tsx`) triggered on scroll into view
- Bold central headline: "Ready to stop chasing?"
- "Start Free Trial" CTA button below headline
- Navigation links at bottom: section anchors + Login + legal links
- Prompt logo (Brain icon in violet) in footer nav

### Pricing Cards
- 3 tiers shown: Sole Trader (£39/mo), Practice (£89/mo), Firm (£159/mo)
- No highlighted/recommended tier — all cards equal visual weight
- Card content: tier name, price, client limit, user limit — no feature checklists
- Each card has a "Start Free Trial" CTA button leading directly to /onboarding

### Conversion & CTA Flow
- Three CTA locations: hero section, each pricing card, footer bold text section
- All CTAs lead directly to the /onboarding signup flow
- CTA text: "Start Free Trial" (emphasising the 14-day trial)

### Brand & Visual Identity
- **Logo:** Lucide `Brain` icon in violet colour scheme (temporary branding)
- **Product name:** "Prompt" displayed alongside Brain icon
- **Tone:** Bolder and more expressive than the professional dashboard — personality-driven landing page
- **Background:** Light/white main sections, dark (#1a1a1a) footer section
- **Status colours carry throughout:** The red/orange/amber/blue/green/grey palette from DESIGN.md appears not just in particles but as accent colours across the page — section highlights, card borders, hover states

### Claude's Discretion
- Hero subtext/tagline below "The Chase Is Over"
- The 3 feature card titles and descriptions (summarising the software's core value)
- Exact icon selection for particles (which Lucide icons best represent the dashboard)
- Spacing, typography scale, responsive breakpoints
- Footer navigation link set
- Any subtle scroll animations beyond the particle systems

</decisions>

<specifics>
## Specific Ideas

- "Take heavy inspiration from DESIGN.md and phasetwo.uk" — the reference project at `C:\Users\ejsch\University\Coding Projects\estudios-launchpad-new - Copy` provides the particle physics engine, footer grow animation pattern (simplified for Prompt), and overall bold visual approach
- The hero should feel like an explosion of the dashboard's own iconography — recognisable Lucide icons that accountants will see again inside the product, coloured with the status traffic light system
- "The Chase Is Over" is a direct reference to the product's core value: accountants spend hours chasing clients for records, and Prompt automates that entirely
- "Ready to stop chasing?" in the footer bookends the messaging

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 17-marketing-landing-page*
*Context gathered: 2026-02-23*
