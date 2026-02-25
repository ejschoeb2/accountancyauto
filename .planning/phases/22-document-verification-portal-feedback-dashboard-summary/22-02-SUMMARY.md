---
phase: 22-document-verification-portal-feedback-dashboard-summary
plan: 02
subsystem: ui
tags: [react, next.js, portal, ocr, dropzone, tailwind]

# Dependency graph
requires:
  - phase: 22-01
    provides: OCR extraction fields (extractedTaxYear, extractedEmployer, extractedPayeRef, isImageOnly) in portal upload API response; skipDuplicate bypass; HTTP 409 on duplicate file hash
  - phase: 21-03
    provides: Portal upload route wired with OCR and integrity checks; file_hash stored on client_documents
provides:
  - ExtractionConfirmationCard component — warm green "We've read this document" card shown after OCR-successful upload
  - pendingDuplicate state in PortalChecklist — intercepts HTTP 409 as inline warning, not error
  - Inline amber duplicate warning banner in ChecklistItem with "Yes, upload anyway" / "Cancel" actions
  - confirmDuplicate bypass — confirmed duplicate retry sends confirmDuplicate=true in FormData
  - Disabled dropzone state on non-duplicate items while warning is active
affects: [22-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "HTTP 409 as UX gate: treat 409 as pending state (pendingDuplicate), not error — re-submits with confirmDuplicate=true flag"
    - "pre-computed boolean (showConfirmationCard) stored in UploadedFile shape — avoids prop drilling of all OCR fields into display logic"
    - "disabled dropzone styling: separate CSS branch for disabled state (cursor-not-allowed, gray palette) alongside isDragActive and isUploaded branches"

key-files:
  created:
    - app/portal/[token]/components/upload-confirmation-card.tsx
  modified:
    - app/portal/[token]/components/portal-checklist.tsx
    - app/portal/[token]/components/checklist-item.tsx

key-decisions:
  - "showConfirmationCard pre-computed in handleUpload and stored on UploadedFile — avoids re-evaluating hasOcrData on every render"
  - "pendingDuplicate: one-at-a-time state (not per-item map) — plan explicitly notes this prevents race conditions"
  - "Disabled state visually communicated on dropzone with explicit CSS branch (gray, cursor-not-allowed) — useDropzone disabled prop alone does not change visual"

patterns-established:
  - "ExtractionConfirmationCard: parent-controlled visibility — component never renders empty rows; null filtering happens via .filter() on rows array"
  - "Duplicate warning: inline amber banner within checklist item, not modal — contextual to the item that triggered the duplicate"

requirements-completed: []

# Metrics
duration: 9min
completed: 2026-02-25
---

# Phase 22 Plan 02: Portal Feedback UI Summary

**Client-facing duplicate warning (amber inline banner with confirm/cancel) and OCR extraction confirmation card (green "We've read this document") added to portal upload flow**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-02-25T22:38:44Z
- **Completed:** 2026-02-25T22:47:44Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 updated)

## Accomplishments
- New `ExtractionConfirmationCard` component renders labelled rows (document type, tax year, employer, PAYE ref) in a warm green card after OCR-successful uploads
- `PortalChecklist` now intercepts HTTP 409 responses as `pendingDuplicate` state instead of throwing, disabling all other upload zones until resolved
- `ChecklistItem` renders inline amber duplicate warning with "Yes, upload anyway" / "Cancel" actions, and conditionally renders `ExtractionConfirmationCard` per uploaded file

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ExtractionConfirmationCard component** - `0f83bf8` (feat)
2. **Task 2: Update PortalChecklist and ChecklistItem with duplicate warning and confirmation card** - `68fa356` (feat)

**Plan metadata:** (docs commit — see final_commit step)

## Files Created/Modified
- `app/portal/[token]/components/upload-confirmation-card.tsx` - New ExtractionConfirmationCard component; warm green confirmation card with labelled OCR data rows
- `app/portal/[token]/components/portal-checklist.tsx` - Extended UploadedFile interface with OCR extraction fields; handleUpload intercepts 409 as pendingDuplicate; confirmDuplicate bypass via FormData; disabled prop propagated to ChecklistItem
- `app/portal/[token]/components/checklist-item.tsx` - Updated UploadedFile type; added disabled/duplicateWarning/onConfirmDuplicate/onDismissDuplicate props; inline amber duplicate banner; ExtractionConfirmationCard per uploaded file when showConfirmationCard=true; disabled dropzone visual state

## Decisions Made
- `showConfirmationCard` pre-computed in `handleUpload` and stored on `UploadedFile` — avoids re-evaluating `hasOcrData` logic on every render; single source of truth
- `pendingDuplicate` is a single state slot (not a per-item map) — plan explicitly targets one-at-a-time to prevent race conditions (PITFALL 2 from RESEARCH.md)
- Added explicit disabled CSS branch on dropzone (gray palette, `cursor-not-allowed`) — `useDropzone`'s `disabled` prop prevents drag/click but does not visually indicate disabled state

## Deviations from Plan

None - plan executed exactly as written. The stale `.next/lock` file from a prior build was removed (Rule 3 — build tooling issue), not a code deviation.

## Issues Encountered
- Stale `.next/lock` file from a prior build session blocked the first verification run. Removed the lock file and re-ran — clean build on second attempt.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Portal upload flow now provides meaningful client feedback for both successful OCR extractions and duplicate file attempts
- Ready for Phase 22-03: accountant-facing dashboard summary view of extracted document data
- No blockers

---
*Phase: 22-document-verification-portal-feedback-dashboard-summary*
*Completed: 2026-02-25*
