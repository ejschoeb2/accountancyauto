---
phase: 30-per-document-type-upload-validation
plan: 03
subsystem: ui
tags: [validation, documents, amber-badge, needs-review, modal, uploads-table, document-card]

# Dependency graph
requires:
  - phase: 30-01
    provides: "needs_review + validation_warnings columns on client_documents; ValidationWarning type"
  - phase: 30-02
    provides: "needs_review/validation_warnings written on upload; PortalUpload fields populated"
provides:
  - "Amber needs_review badge on document-card.tsx with clear-review action"
  - "Validation warning messages shown inline on document card"
  - "Issues column in uploads table with amber Review badge"
  - "UploadValidationModal component for full warning detail"
  - "Needs Review filter chip in uploads table filter panel"
affects:
  - app/(dashboard)/clients/[id]/components/document-card.tsx
  - app/actions/document-uploads.ts
  - app/(dashboard)/email-logs/components/uploads-table.tsx
  - app/(dashboard)/email-logs/components/upload-validation-modal.tsx

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Amber badge using bg-amber-500/10 + AlertTriangle icon — traffic light system (DESIGN.md)"
    - "useTransition for clear-review server action (per D-13-04-01)"
    - "Modal opened via setSelectedUpload state — null closes; stopPropagation prevents row navigation"
    - "Client-side filter using boolean flag (filterNeedsReview) added to useMemo filteredData"

key-files:
  created:
    - app/(dashboard)/email-logs/components/upload-validation-modal.tsx
  modified:
    - app/(dashboard)/clients/[id]/components/document-card.tsx
    - app/actions/document-uploads.ts
    - app/api/clients/[id]/documents/route.ts
    - app/(dashboard)/email-logs/components/uploads-table.tsx

key-decisions:
  - "ValidationWarning type duplicated locally in document-card.tsx and document-uploads.ts (not imported from server module lib/documents/validate.ts) — avoids importing server-only module into client bundle"
  - "Clear review uses direct Supabase client call (not server action) — already in a client component; useTransition provides pending state"
  - "Issues column placed after Received column at the far right — least-intrusive position for an advisory column"
  - "Modal only renders when selectedUpload has validation_warnings — guards against opening with empty warnings"

requirements-completed: []

# Metrics
duration: 7min
completed: 2026-03-03
---

# Phase 30 Plan 03: Accountant-Facing Validation Warning UI Summary

**Amber needs_review badge on client page document cards, Issues column in activity uploads table, and UploadValidationModal for full warning drill-down**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-03T01:44:05Z
- **Completed:** 2026-03-03T01:51:00Z
- **Tasks:** 2
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments

- Added `ValidationWarning` interface + `needs_review`/`validation_warnings` fields to `ClientDocument` in document-card.tsx
- Amber "Needs review" badge (AlertTriangle icon, `bg-amber-500/10`) rendered on `DocumentRow` when `needs_review=true`
- "Clear" button (amber variant, `useTransition` pending state) calls Supabase directly to set `needs_review=false, validation_warnings=null` and removes badge optimistically
- Warning messages shown inline below the badge on the document card
- `PortalUpload` interface and `getPortalUploads` SELECT + mapping extended with `needs_review`/`validation_warnings`
- API route `/api/clients/[id]/documents` SELECT extended with the two Phase 30 columns
- Created `UploadValidationModal` with upload summary (file, client, filing type, doc type, received) and amber warning blocks (message + expected/found dl entries)
- Uploads table: new "Issues" column with amber "Review" badge; clicking opens validation modal without navigating away
- "Needs Review" filter chip added to filter panel for one-click filtering to flagged uploads
- Table colSpan updated from 7 to 8

## Task Commits

Each task was committed atomically:

1. **Task 1: Add amber badge and clear-review action to document card, extend data query** - `ba3ad4e` (feat)
2. **Task 2: Add Issues column to uploads table and create validation detail modal** - `8ab6b25` (feat)

## Files Created/Modified

- `app/(dashboard)/clients/[id]/components/document-card.tsx` — ValidationWarning interface, needs_review badge, clear action, inline warning messages, API route SELECT extended
- `app/actions/document-uploads.ts` — ValidationWarning interface, PortalUpload extended, SELECT + mapping updated
- `app/api/clients/[id]/documents/route.ts` — SELECT now includes needs_review, validation_warnings
- `app/(dashboard)/email-logs/components/uploads-table.tsx` — Issues column, Needs Review filter, modal state, colSpan 8
- `app/(dashboard)/email-logs/components/upload-validation-modal.tsx` — new: Dialog with upload summary + warning detail blocks

## Decisions Made

- `ValidationWarning` interface duplicated in client-facing files rather than imported from `lib/documents/validate.ts` — avoids importing a server-only module (which imports `lib/documents/ocr.ts`) into the client bundle
- Clear review uses direct Supabase client call rather than a new server action — the component is already `'use client'`; `useTransition` provides responsive UI per D-13-04-01
- Issues column placed after Received at the far right of the uploads table — advisory column, lowest priority position
- Modal only renders when `selectedUpload.validation_warnings` is non-empty — guards against opening empty state

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

All created files exist on disk. Both task commits (ba3ad4e, 8ab6b25) verified in git log.

---
*Phase: 30-per-document-type-upload-validation*
*Completed: 2026-03-03*
