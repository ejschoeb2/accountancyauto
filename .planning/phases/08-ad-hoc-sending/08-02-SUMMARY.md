---
phase: 08-ad-hoc-sending
plan: 02
subsystem: ui
tags: [modal, bulk-actions, email-sending, progress-bar]

# Dependency graph
requires:
  - phase: 08-ad-hoc-sending
    plan: 01
    provides: sendAdhocEmail() server action and send_type column
  - phase: 05-rich-text-editor
    provides: email_templates API and TipTap rendering
provides:
  - Complete ad-hoc email sending UI flow from clients page
  - previewAdhocEmail() server action for template preview
  - Progress bar component (shadcn)
affects: []

# Tech tracking
tech-stack:
  added: [shadcn/progress]
  patterns: [multi-step modal with state machine, iframe srcDoc for email preview]

key-files:
  created:
    - components/ui/progress.tsx
    - app/(dashboard)/clients/components/send-email-modal.tsx
  modified:
    - app/(dashboard)/clients/components/bulk-actions-toolbar.tsx
    - app/(dashboard)/clients/components/client-table.tsx
    - app/actions/send-adhoc-email.ts
    - lib/email/client.ts

key-decisions:
  - "Multi-step modal with state-driven view switching (select-template, preview, confirm, sending, results)"
  - "Preview uses iframe srcDoc for style isolation from modal"
  - "Sequential send loop with real-time progress bar (not batch)"
  - "Modal close disabled during sending step to prevent partial send state"
  - "Clients without email silently skipped with count shown in results"
  - "Lazy Postmark client initialization to avoid module-load crash when token missing"

patterns-established:
  - "Multi-step modal pattern with checkpoint-style UX (back/next/confirm)"
  - "Server action for preview rendering (previewAdhocEmail) keeps rendering server-side"

# Metrics
duration: 4min
completed: 2026-02-08
---

# Phase 08 Plan 02: Send Email Modal Summary

**Multi-step Send Email modal with template selection, preview, progress bar, and results**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-08
- **Completed:** 2026-02-08
- **Tasks:** 2 (1 implementation + 1 human verification)
- **Files modified:** 6

## Accomplishments
- Installed shadcn Progress bar component
- Created Send Email modal with 5-step flow (select template, preview, confirm, sending, results)
- Added previewAdhocEmail server action for rendering template previews
- Wired Send Email button into bulk actions toolbar
- Connected modal to client-table with selected clients
- Fixed Postmark client eager initialization crash (lazy proxy pattern)

## Task Commits

1. **Task 1: Install Progress, create modal, wire into clients page** - `369be19` (feat)
2. **Orchestrator fix: Lazy Postmark client** - `8f9b9f9` (fix)

## Files Created/Modified
- `components/ui/progress.tsx` - shadcn Progress bar component
- `app/(dashboard)/clients/components/send-email-modal.tsx` - Multi-step Send Email modal
- `app/(dashboard)/clients/components/bulk-actions-toolbar.tsx` - Added Send Email button + onSendEmail prop
- `app/(dashboard)/clients/components/client-table.tsx` - Modal state + SendEmailModal rendering
- `app/actions/send-adhoc-email.ts` - Added previewAdhocEmail server action
- `lib/email/client.ts` - Lazy-initialized Postmark client via Proxy

## Decisions Made

**1. Lazy Postmark client**
The Postmark ServerClient was eagerly initialized at module load, crashing when POSTMARK_SERVER_TOKEN was missing. Changed to lazy Proxy pattern so it only initializes when a method is actually called. Fixes preview flow which doesn't need Postmark.

**2. Multi-step modal pattern**
Used state-driven view switching instead of separate dialog components. Single Dialog with conditional rendering based on `SendStep` type.

**3. Sequential send with progress**
Sends emails one at a time in a loop with real-time progress updates. Simpler than batch and provides better UX feedback.

## Deviations from Plan

- Added lazy Postmark client fix (lib/email/client.ts) - discovered during human verification that eager client initialization crashed preview flow

## Issues Encountered

- Postmark client crash on module load when token missing - fixed with lazy proxy pattern

## User Setup Required

None - Postmark token only needed for actual sends, not previews.

## Self-Check: PASSED

All files created and commits verified:
- components/ui/progress.tsx
- app/(dashboard)/clients/components/send-email-modal.tsx
- 369be19 (Task 1 commit)
- 8f9b9f9 (Orchestrator fix commit)
- Human verification: APPROVED

---
*Phase: 08-ad-hoc-sending*
*Completed: 2026-02-08*
