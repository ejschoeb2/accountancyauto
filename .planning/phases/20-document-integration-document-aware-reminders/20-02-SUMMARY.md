---
phase: 20-document-integration-document-aware-reminders
plan: 02
subsystem: ui, documents
tags: [nextjs, supabase, documents, filing-cards, checklist, portal-link, auto-records-received]

# Dependency graph
requires:
  - phase: 20-01
    provides: doc_count and last_received_at in GET /api/clients/[id]/filings response
  - phase: 19
    provides: client_documents, filing_document_requirements, client_document_checklist_customisations tables
provides:
  - Rebuilt DocumentCard with interleaved checklist, progress fraction, gear icon, portal link generation
  - checkAndAutoSetRecordsReceived() utility in lib/documents/auto-records-received.ts
  - DocumentCard integrated into FilingManagement filing type cards
  - Standalone Documents, GeneratePortalLink, ChecklistCustomisation cards removed from page.tsx
affects: [client-detail-page, filing-management, upload-handler]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lazy expand fetch: documents + checklist loaded on first card expand (not on mount)"
    - "Checklist customisation modal scoped to specific filing type (no dropdown needed)"
    - "Interleaved checklist: matched docs (green check) + outstanding (square placeholder) in a single list"
    - "Read-then-write idempotency: check records_received_for before update, return false if already present"

key-files:
  created:
    - lib/documents/auto-records-received.ts
  modified:
    - app/(dashboard)/clients/[id]/components/document-card.tsx
    - app/(dashboard)/clients/[id]/components/filing-management.tsx
    - app/(dashboard)/clients/[id]/page.tsx

key-decisions:
  - "DocumentCard fetches documents and effective checklist lazily on first expand — not on mount — to avoid network on load"
  - "ChecklistModal embeds customisation logic inline (not importing ChecklistCustomisation) — modal scoped to known filing type, no dropdown needed"
  - "DocumentCard placed inside filing card outer div (not standalone section) — documents visible in context of filing workflow"
  - "auto-records-received uses read-then-write pattern — idempotent, worst case is no-op, safer than revoke-then-insert"
  - "notifyAutoRecordsReceived() exported function — called by upload handler response path, not wired into DocumentCard mount"

requirements-completed: [INT-UI-01, INT-AUTO-01]

# Metrics
duration: 30min
completed: 2026-02-24
---

# Phase 20 Plan 02: Document UI Integration and Auto Records Received Summary

**Rebuilt DocumentCard with interleaved checklist (received = green check + filename, outstanding = square placeholder), progress fraction in collapsed header, gear icon for checklist customisation modal, Generate Upload Link button inside expanded card; standalone Documents/GeneratePortalLink/ChecklistCustomisation cards removed from page; lib/documents/auto-records-received.ts utility created**

## Performance

- **Duration:** 30 min
- **Started:** 2026-02-24T13:01:50Z
- **Completed:** 2026-02-24T13:32:05Z
- **Tasks:** 3 of 4 (paused at checkpoint:human-verify)
- **Files modified:** 4

## Accomplishments

- **Task 1:** `lib/documents/auto-records-received.ts` created — exports `checkAndAutoSetRecordsReceived()` that checks all mandatory effective-checklist items against high/medium confidence documents, idempotently appends `filing_type_id` to `clients.records_received_for`, returns `true` when auto-set fires
- **Task 2:** DocumentCard completely rebuilt with new `docCount` + `lastReceivedAt` props from filings API; collapsed header shows progress fraction ("X of Y documents received" or "X documents · no checklist"); gear icon opens `ChecklistModal` (logic inlined from `checklist-customisation.tsx`, scoped to current filing type); expanded view renders interleaved checklist; Generate Upload Link button at bottom of expanded section; `notifyAutoRecordsReceived()` exported for upload handler path
- **Task 3:** `page.tsx` imports for DocumentCard, GeneratePortalLink, ChecklistCustomisation removed; all three standalone card usages removed; FILING_TYPE_LABELS constant removed; `filing-management.tsx` updated with `doc_count`/`last_received_at` on `FilingAssignment` interface and renders `<DocumentCard>` beneath each active filing card

## Task Commits

Each task was committed atomically:

1. **Task 1: Create lib/documents/auto-records-received.ts utility** - `2ec3ded` (feat)
2. **Task 2: Rebuild DocumentCard with interleaved checklist, progress fraction, gear icon, and portal link generation** - `44e57d3` (feat)
3. **Task 3: Remove standalone cards from page.tsx and integrate FilingManagement document display** - `27c541e` (feat)

## Files Created/Modified

- `lib/documents/auto-records-received.ts` (created) — Exports `checkAndAutoSetRecordsReceived(supabase, clientId, filingTypeId, orgId): Promise<boolean>`. Fetches mandatory requirements, applies customisations, checks document satisfaction, performs idempotent records_received_for update.
- `app/(dashboard)/clients/[id]/components/document-card.tsx` (rewritten) — Rebuilt from 214 lines to full component with checklist modal, interleaved list, portal link generation. New props: `docCount`, `lastReceivedAt`. Exports `notifyAutoRecordsReceived()`.
- `app/(dashboard)/clients/[id]/components/filing-management.tsx` (modified) — Added `doc_count`/`last_received_at` to FilingAssignment interface; imported DocumentCard; renders DocumentCard beneath each active filing card inside the card's outer div.
- `app/(dashboard)/clients/[id]/page.tsx` (modified) — Removed DocumentCard, GeneratePortalLink, ChecklistCustomisation imports and all three card sections. FILING_TYPE_LABELS constant removed.

## Decisions Made

- DocumentCard lazily fetches expanded data (documents + effective checklist) only on first expand, not on mount — avoids N×2 network calls on page load
- ChecklistModal embeds customisation logic inline rather than importing the standalone `ChecklistCustomisation` component — modal is scoped to a known `filingTypeId`, removing the filing type dropdown
- DocumentCard is placed inside the filing card outer div (not as a sibling div below it) — documents appear in context of the filing workflow
- auto-records-received uses read-then-write (not atomic) — idempotent worst case, safe for this use pattern per RESEARCH.md guidance
- `notifyAutoRecordsReceived()` is an exported function called by the upload handler, not wired to DocumentCard mount — keeps the component stateless regarding upload events

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- Pre-existing TypeScript errors in `settings-tabs.tsx` (2 errors) and `checklist-item.tsx` (2 errors). Not caused by these changes. Logged as out-of-scope per deviation rules — noted in Plan 20-01 summary as well.

## User Setup Required

None — no external service configuration required.

## Checkpoint Status

Paused at Task 4 (checkpoint:human-verify). Human browser verification required before this plan is marked complete.

## Next Phase Readiness

After human verification of Task 4:
- Plan 20-02 UI integration complete
- Plan 20-04 can wire `checkAndAutoSetRecordsReceived()` into the upload handler response path
- `notifyAutoRecordsReceived()` exported and ready to call from the upload handler

---
*Phase: 20-document-integration-document-aware-reminders*
*Completed: 2026-02-24*

## Self-Check

### Files Exist
- FOUND: lib/documents/auto-records-received.ts
- FOUND: app/(dashboard)/clients/[id]/components/document-card.tsx (rebuilt)
- FOUND: app/(dashboard)/clients/[id]/components/filing-management.tsx (modified)
- FOUND: app/(dashboard)/clients/[id]/page.tsx (modified)

### Commits Exist
- FOUND: 2ec3ded — feat(20-02): create checkAndAutoSetRecordsReceived utility
- FOUND: 44e57d3 — feat(20-02): rebuild DocumentCard with interleaved checklist and portal link
- FOUND: 27c541e — feat(20-02): integrate DocumentCard into FilingManagement; remove standalone cards

## Self-Check: PASSED
