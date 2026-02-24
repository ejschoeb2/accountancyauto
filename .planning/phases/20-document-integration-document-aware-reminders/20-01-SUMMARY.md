---
phase: 20-document-integration-document-aware-reminders
plan: 01
subsystem: api
tags: [nextjs, supabase, documents, filings, api-routes]

# Dependency graph
requires:
  - phase: 19-collection-mechanisms
    provides: client_documents table with filing_type_id and received_at columns
provides:
  - GET /api/clients/[id]/filings includes doc_count and last_received_at per filing
  - GET /api/clients/[id]/documents supports optional ?filing_type_id= server-side filter
affects: [20-02, 20-03, document-card, filing-card]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single aggregation query in app code (not PostgREST aggregate) for doc summary — consistent with MEMORY.md FK join cache workaround"
    - "Non-fatal document query: console.warn + defaults, never 500 for secondary data failure"
    - "Supabase query builder chaining with conditional .eq() filter via let binding"

key-files:
  created: []
  modified:
    - app/api/clients/[id]/filings/route.ts
    - app/api/clients/[id]/documents/route.ts

key-decisions:
  - "docSummaryMap built via single app-code iteration over ordered rows (descending received_at) — first row per filing_type_id is most recent; efficient O(n) pass"
  - "Document query failure is non-fatal — filings with doc_count=0/last_received_at=null returned rather than 500"
  - "filing_type_id query param filter is opt-in and backwards compatible — omitting param returns all documents (existing behaviour unchanged)"

patterns-established:
  - "Augment filings response with secondary document data via separate query + map merge — avoids PostgREST join cache issues"
  - "Optional query param filters use let query = ... + if(param) { query = query.eq(...) } pattern"

requirements-completed: [INT-API-01]

# Metrics
duration: 2min
completed: 2026-02-24
---

# Phase 20 Plan 01: Document API Consolidation Summary

**Single docSummaryMap query merges doc_count and last_received_at into filings response, eliminating redundant parallel document fetches; documents route gains server-side filing_type_id filter**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-24T12:55:08Z
- **Completed:** 2026-02-24T12:57:30Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- GET /api/clients/[id]/filings now returns doc_count (number) and last_received_at (string | null) embedded per filing — eliminates four redundant DocumentCard parallel fetches on page load
- FilingAssignmentResponse interface updated with two new fields; all existing callers unaffected (additive change)
- GET /api/clients/[id]/documents accepts optional ?filing_type_id= query param; expanded cards can fetch only their own documents instead of all client documents

## Task Commits

Each task was committed atomically:

1. **Task 1: Augment GET /api/clients/[id]/filings to embed document summary** - `61c4890` (feat)
2. **Task 2: Add optional filing_type_id filter to GET /api/clients/[id]/documents** - `7c3efb5` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `app/api/clients/[id]/filings/route.ts` - Added docSummaryMap aggregation query and merge into FilingAssignmentResponse; updated interface with doc_count and last_received_at fields
- `app/api/clients/[id]/documents/route.ts` - Added optional ?filing_type_id= server-side filter; refactored to let query builder pattern for conditional .eq() chaining

## Decisions Made
- docSummaryMap uses a single descending-ordered query; first row per filing_type_id is the most recent — O(n) pass, no secondary sort needed
- Document query failure is non-fatal: console.warn and default all filings to doc_count=0/last_received_at=null rather than returning 500 (document count failure must not break the filing management view)
- filing_type_id filter is backwards compatible: omitting the param runs the unfiltered query (pre-existing behaviour)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript errors found in `settings-tabs.tsx` and `checklist-item.tsx` (unrelated files, not caused by these changes). Logged as out-of-scope per deviation rules.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 20-01 API foundation is complete: filing cards can now read doc_count/last_received_at from the filings endpoint without separate document fetches
- Plan 20-02 (filing card UI integration) can use doc_count and last_received_at from GET /filings for collapsed header display
- Expanded card view can call GET /documents?filing_type_id=X to fetch only relevant documents server-side

---
*Phase: 20-document-integration-document-aware-reminders*
*Completed: 2026-02-24*
