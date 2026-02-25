---
phase: 22-document-verification-portal-feedback-dashboard-summary
plan: "03"
subsystem: ui
tags: [react, supabase, next.js, document-verification, ocr, inline-editing]

# Dependency graph
requires:
  - phase: 22-01
    provides: Phase 21 OCR columns on client_documents (extracted_tax_year, extracted_employer, extracted_paye_ref, extraction_source, page_count)
provides:
  - GET /api/clients/[id]/documents returns all Phase 21 OCR columns
  - POST /api/clients/[id]/documents accepts update-extraction action with field allowlist
  - DocumentRow sub-component renders extraction fields with inline editing
  - EditableField click-to-edit pattern for tax year, employer, PAYE ref
  - ScannedPdfBadge (amber) and ReviewNeededBadge (red) status indicators
  - Historical documents (pre-Phase-21 keyword source, all null) suppressed from extraction display
affects:
  - Phase 23 (if any further document UI plans)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - DocumentRow co-located sub-component pattern — per-row useState for edit fields avoids Map state in parent
    - EditableField click-to-edit pattern — blur/Enter saves, Escape cancels, optimistic state update on success
    - Action dispatch pattern in POST handler — shared auth + named action branches (download / update-extraction)
    - Field allowlist for extraction edits — ALLOWED_FIELDS const array + includes() guard, session-scoped client for RLS

key-files:
  created: []
  modified:
    - app/api/clients/[id]/documents/route.ts
    - app/(dashboard)/clients/[id]/components/document-card.tsx

key-decisions:
  - "DocumentRow co-located in document-card.tsx (not extracted to shared file) — scoped sub-component avoids lifting edit state into DocumentCard parent"
  - "isHistorical flag: all three extraction fields null AND extraction_source='keyword' — suppresses extraction row for pre-Phase-21 docs; zero visual regression for existing documents"
  - "saving state is shared across all three EditableField instances in DocumentRow — simplifies implementation; only one field editable at a time in practice"
  - "session-scoped client (not service client) for update-extraction — RLS enforces org ownership; belt-and-braces .eq('client_id') check added"

patterns-established:
  - "Action dispatch pattern: parse body, shared auth, named if-branches per action — used in POST handler; replace future per-action handlers with this pattern"
  - "Field allowlist guard: ALLOWED_FIELDS const + .includes() — for any API route accepting a field name for dynamic DB update"

requirements-completed: []

# Metrics
duration: 4min
completed: 2026-02-25
---

# Phase 22 Plan 03: Dashboard Extraction Display Summary

**OCR-extracted tax year, employer, and PAYE ref surfaced in filing card with click-to-edit inline fields and Scanned PDF / Review needed status badges**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-25T22:39:04Z
- **Completed:** 2026-02-25T22:43:15Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- GET /api/clients/[id]/documents SELECT extended to include all 5 Phase 21 columns (extracted_tax_year, extracted_employer, extracted_paye_ref, extraction_source, page_count)
- POST /api/clients/[id]/documents refactored to shared-auth action dispatch; new update-extraction action with 3-field allowlist, session-scoped client, and extraction_source='manual' stamp
- DocumentCard extended with DocumentRow sub-component, EditableField helper, ScannedPdfBadge, and ReviewNeededBadge — all co-located in document-card.tsx
- Historical documents (all extraction fields null + extraction_source='keyword') show no extraction section — zero visual regression for pre-Phase-21 docs

## Task Commits

Each task was committed atomically:

1. **Task 1: Update documents API route** - `8c2776a` (feat)
2. **Task 2: Extend DocumentCard with extraction display and inline editing** - `2423a01` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `app/api/clients/[id]/documents/route.ts` — GET SELECT adds 5 Phase 21 columns; POST refactored with shared auth + update-extraction action branch
- `app/(dashboard)/clients/[id]/components/document-card.tsx` — ClientDocument interface extended; ScanLine + AlertTriangle icons added; ScannedPdfBadge, ReviewNeededBadge, EditableField, DocumentRow sub-components added; effectiveChecklist received row and extraDocuments both replaced with DocumentRow

## Decisions Made

- DocumentRow co-located in document-card.tsx rather than extracted — per-row useState keeps edit state contained without lifting to parent
- `isHistorical` flag uses `extraction_source === 'keyword'` (not null) because all pre-Phase-21 rows have DEFAULT 'keyword' per D-21-01-01 — correct detection of legacy docs
- saving state shared across all three EditableField instances in one DocumentRow — only one field is editable at a time in practice, simplifies implementation
- Session-scoped client for update-extraction (not service client) — RLS enforces org ownership; belt-and-braces `.eq('client_id')` check added as secondary guard

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 22 complete (all 3 plans done): schema migration (22-01), portal feedback UI (22-02 if planned), dashboard extraction display (22-03)
- Accountants can now see and correct OCR-extracted metadata per document without leaving the filing card
- Historical documents show no extraction section — safe for orgs with pre-Phase-21 documents

---
*Phase: 22-document-verification-portal-feedback-dashboard-summary*
*Completed: 2026-02-25*
