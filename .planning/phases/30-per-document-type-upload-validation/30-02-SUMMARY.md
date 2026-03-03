---
phase: 30-per-document-type-upload-validation
plan: 02
subsystem: portal
tags: [validation, portal, upload, amber-card, warnings, documents, react]

# Dependency graph
requires:
  - phase: 30-01
    provides: "runValidation() in lib/documents/validate.ts; ValidationWarning and ValidationResult types; needs_review + validation_warnings columns on client_documents"
provides:
  - "Upload route calls runValidation() after classification, before storage"
  - "needs_review and validation_warnings written to client_documents INSERT"
  - "JSON response includes validationWarnings array"
  - "ValidationWarningCard amber component for portal client feedback"
  - "portal-checklist.tsx and checklist-item.tsx updated with validation warning state"
affects:
  - 30-03-accountant-facing-ui

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Amber warning card priority: validationWarnings.length > 0 shows amber; else OCR data shows green; else nothing (Pitfall 6)"
    - "ValidationWarning interface defined locally in each consumer component — avoids importing from server-only lib/documents/validate.ts into client components"
    - "Large-file path sets validationWarnings:[] — no buffer available for finalize route"

key-files:
  created:
    - app/portal/[token]/components/validation-warning-card.tsx
  modified:
    - app/api/portal/[token]/upload/route.ts
    - app/portal/[token]/components/portal-checklist.tsx
    - app/portal/[token]/components/checklist-item.tsx

key-decisions:
  - "ValidationWarning interface redefined locally in portal client components — lib/documents/validate.ts is a server module; importing it into 'use client' components would pull server-only dependencies into the client bundle"
  - "showConfirmationCard condition extended to require validationWarnings.length === 0 — ensures amber card takes absolute priority over green card (Pitfall 6 from research)"
  - "Large-file path (upload-finalize route) unchanged — no buffer = no runValidation call; validationWarnings set to [] explicitly in the finalize state update"

patterns-established:
  - "Card priority pattern: amber warning card always shown over green confirmation card when validation warnings exist — never both simultaneously"

requirements-completed: []

# Metrics
duration: 4min
completed: 2026-03-03
---

# Phase 30 Plan 02: Upload Route Integration and Portal Amber Warning Card Summary

**Upload route wired to runValidation() with needs_review DB flag; new ValidationWarningCard amber component; portal shows amber instead of green when validation warnings exist**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-03T01:43:48Z
- **Completed:** 2026-03-03T01:47:36Z
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- Integrated `runValidation()` into the upload route after classification and before `provider.upload()`, passing `documentTypeCode`, `mimeType`, `fileBuffer`, `taxYear`, `classification.extractedTaxYear`, and `portalToken.filing_type_id`
- Extended `client_documents` INSERT with `needs_review: validation.warnings.length > 0` and `validation_warnings: validation.warnings.length > 0 ? validation.warnings : null`
- Extended JSON response with `validationWarnings: validation.warnings` for client-side rendering
- Created `app/portal/[token]/components/validation-warning-card.tsx` — amber card with `bg-amber-500/10`, `AlertTriangle` icon, stacked warning messages
- Updated `portal-checklist.tsx`: added `ValidationWarning` interface, `validationWarnings` field to `UploadedFile`, updated small-file response handler to extract `validationWarnings` from API and fix `showConfirmationCard` priority logic
- Updated `checklist-item.tsx`: imported `ValidationWarningCard`, added `validationWarnings` to `UploadedFile` interface, updated rendering to show amber card when `validationWarnings.length > 0`, green card otherwise

## Task Commits

Each task was committed atomically:

1. **Task 1: Integrate runValidation into upload route and extend JSON response** - `b5fe790` (feat)
2. **Task 2: Create ValidationWarningCard and update portal components for conditional card display** - `772a402` (feat)

## Files Created/Modified

- `app/api/portal/[token]/upload/route.ts` — `runValidation()` import + call after classification; `needs_review` + `validation_warnings` in INSERT; `validationWarnings` in JSON response
- `app/portal/[token]/components/validation-warning-card.tsx` — New amber warning card component matching duplicate warning pattern
- `app/portal/[token]/components/portal-checklist.tsx` — `ValidationWarning` interface; `validationWarnings` in `UploadedFile`; updated small-file and large-file response handlers; amber-takes-priority `showConfirmationCard` logic
- `app/portal/[token]/components/checklist-item.tsx` — `ValidationWarning` interface; `validationWarnings` in `UploadedFile`; `ValidationWarningCard` import; conditional card rendering

## Decisions Made

- `ValidationWarning` interface is redefined locally inside each portal client component (`portal-checklist.tsx` and `checklist-item.tsx`) rather than imported from `lib/documents/validate.ts`. The validate module is a server-only module that imports `pdf-parse` and `xlsx` — importing it into `'use client'` components would attempt to bundle server-only dependencies into the browser bundle. The local redefinition is structurally identical and safe.
- `showConfirmationCard` condition in `portal-checklist.tsx` extended to include `validationWarnings.length === 0` — implements research Pitfall 6 recommendation that amber card takes absolute priority over green confirmation card. Both cards are never shown simultaneously.
- Large-file path (`upload-session` + `upload-finalize` flow) is unchanged. When the browser sends chunks directly to the provider, the server never sees the file buffer, so `runValidation()` cannot run. The finalize state update now explicitly sets `validationWarnings: []` to satisfy the updated `UploadedFile` interface.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- None. All TypeScript checks pass cleanly for the modified files.

## Next Phase Readiness

- Validation warnings are now stored in `client_documents.validation_warnings` (JSONB) and `needs_review` (boolean) for Plan 03
- Plan 03 (accountant-facing UI) can query `needs_review = true` rows for the client page badge and the activity page upload detail popup
- No blockers

---
*Phase: 30-per-document-type-upload-validation*
*Completed: 2026-03-03*
