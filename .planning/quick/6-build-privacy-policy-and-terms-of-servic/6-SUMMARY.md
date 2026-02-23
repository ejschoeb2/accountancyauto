---
phase: quick-06
plan: 01
subsystem: marketing
tags: [legal, privacy, gdpr, marketing-pages]
dependency_graph:
  requires: [Phase 17 marketing landing page]
  provides: [/privacy page, /terms page, working footer legal links]
  affects: [components/marketing/footer-section.tsx]
tech_stack:
  added: []
  patterns: [static server component with SEO metadata, MarketingNav + FooterSection layout]
key_files:
  created:
    - app/(marketing)/privacy/page.tsx
    - app/(marketing)/terms/page.tsx
  modified:
    - components/marketing/footer-section.tsx
decisions:
  - Static server components (no "use client") — content is fully static; no dynamic data needed
  - Tailwind utility classes for prose styling — @tailwindcss/typography not installed; used utility classes per plan spec
  - Sub-processors presented as a table — more scannable than a list for compliance readers
  - Privacy and Terms pages both include MarketingNav and FooterSection for visual consistency with homepage
metrics:
  duration: "~5 minutes"
  completed: "2026-02-23"
  tasks_completed: 2
  files_created: 2
  files_modified: 1
---

# Quick Task 6: Privacy Policy and Terms of Service Summary

**One-liner:** UK GDPR-compliant privacy policy (16 sections) and terms of service (14 sections) as static marketing pages with working footer links.

## What Was Built

Two new static server component pages were created under the `app/(marketing)/` route group, both following the same layout pattern as the marketing homepage: `MarketingNav` at top, content area in the middle, `FooterSection` at bottom.

The footer was also updated to replace two placeholder `href="#"` links with real routes.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create privacy policy and terms of service pages | 353e9d4 | app/(marketing)/privacy/page.tsx, app/(marketing)/terms/page.tsx |
| 2 | Update footer links to /privacy and /terms | 05169c7 | components/marketing/footer-section.tsx |

## Verification Results

- Build: `npx next build` completed successfully; `/privacy` and `/terms` appear as static (prerendered) routes
- File line counts: privacy/page.tsx = 275 lines (min 150), terms/page.tsx = 206 lines (min 120)
- Footer: zero `href="#"` placeholders remaining; `href="/privacy"` and `href="/terms"` confirmed present
- Both pages include `MarketingNav` and `FooterSection` components

## Privacy Policy Sections (all 16 required)

1. Introduction
2. Identity and Contact Details
3. Data We Collect (Account / Client / Billing / Auth / Usage)
4. Our Role as Data Processor (Article 28 UK GDPR)
5. Lawful Basis for Processing (6(1)(b), 6(1)(f), 6(1)(c))
6. How We Use Your Data
7. Sub-processors (table: Supabase, Postmark, Stripe, Vercel)
8. International Data Transfers (SCCs, IDTAs)
9. Data Retention
10. Data Security
11. Multi-tenancy and Data Isolation
12. Your Rights Under UK GDPR (Articles 15-21)
13. Cookies (strictly necessary only, PECR exempt)
14. Children
15. Complaints (ICO, ico.org.uk, 0303 123 1113)
16. Changes to This Policy

## Terms of Service Sections (all 14 required)

1. Introduction
2. Service Description
3. Account Registration and Responsibilities
4. Acceptable Use
5. Subscription and Billing
6. Data Processing (data processor role, Privacy Policy link)
7. Intellectual Property
8. Availability and Support
9. Limitation of Liability
10. Indemnification
11. Termination
12. Changes to These Terms
13. Governing Law (England and Wales)
14. Contact (legal@phasetwo.uk)

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- `app/(marketing)/privacy/page.tsx`: FOUND
- `app/(marketing)/terms/page.tsx`: FOUND
- Commit 353e9d4: FOUND
- Commit 05169c7: FOUND
- Build succeeded with /privacy and /terms as static routes
- No `href="#"` in footer-section.tsx
- `href="/privacy"` in footer-section.tsx: FOUND
- `href="/terms"` in footer-section.tsx: FOUND
