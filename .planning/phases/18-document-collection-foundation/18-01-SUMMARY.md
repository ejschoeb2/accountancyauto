---
phase: 18-document-collection-foundation
plan: 01
subsystem: database
tags: [postgres, supabase, rls, migrations, hmrc, document-retention]

# Dependency graph
requires:
  - phase: 10-org-data-model-rls-foundation
    provides: auth_org_id() SQL function, organisations table, per-operation RLS pattern
  - phase: 02-reminder-engine
    provides: filing_types table (filing_type_id FK target), clients table

provides:
  - Five document collection tables with RLS: document_types, filing_document_requirements, client_documents, document_access_log, upload_portal_tokens
  - 23 HMRC document type rows with retention years, descriptions, and MIME type hints
  - 27 filing_document_requirements rows mapping documents to SA100, CT600, VAT, and Companies House filings
  - INSERT-only audit log pattern for document_access_log
  - SHA-256 token hash storage pattern for upload_portal_tokens

affects:
  - 18-document-collection-foundation (plans 02+)
  - 19-collection-mechanisms (all plans)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Global reference tables (document_types, filing_document_requirements) follow filing_types pattern: no org_id, USING(true) for authenticated SELECT, service_role-only writes"
    - "INSERT-only RLS: document_access_log has INSERT + SELECT for authenticated but NO UPDATE or DELETE — audit trail integrity"
    - "Token hash storage: upload_portal_tokens stores SHA-256 hex of raw token; raw token never persisted (crypto.randomBytes(32) + sha256)"
    - "Partial index pattern: idx_client_documents_retain_until WHERE NOT retention_hold for cron efficiency"
    - "Subquery-based seed inserts: filing_document_requirements uses SELECT id FROM document_types WHERE code = 'X' to avoid hardcoded UUIDs"

key-files:
  created:
    - supabase/migrations/20260224000001_document_collection_tables.sql
    - supabase/migrations/20260224000002_document_types_seed.sql
  modified: []

key-decisions:
  - "document_types and filing_document_requirements modelled as global reference tables (no org_id) — same pattern as filing_types; RLS USING(true) for authenticated SELECT"
  - "document_access_log: INSERT + SELECT only for authenticated role; no UPDATE or DELETE RLS policies — audit trail must be immutable for HMRC enquiry compliance"
  - "upload_portal_tokens.token_hash TEXT NOT NULL UNIQUE — raw token never stored; SHA-256 hex of crypto.randomBytes(32)"
  - "client_documents.tax_period_end_date DATE NOT NULL — retention anchor cannot be null; HMRC TMA 1970 s12B / CH14600 compliance"
  - "SA100-specific docs: 5-year retention; all company docs (CT600, VAT, CH) and shared docs: 6-year retention"
  - "BANK_STATEMENT expected_mime_types includes text/csv in addition to pdf/jpeg/png"
  - "corporation_tax_payment excluded from filing_document_requirements — payment deadline only, no client-submitted documents"
  - "Supabase CLI migration push with --include-all and prior migration repair required due to remote-only migrations in history"

patterns-established:
  - "Seed data via subquery: INSERT INTO ... SELECT filing_type_id, document_type_id FROM document_types WHERE code = 'X' — resolves UUIDs without hardcoding"
  - "Retention years decision: 5 for individual SA100 docs, 6 for everything else"
  - "BANK_STATEMENT is the only mandatory document for SA100 (binary is_mandatory flag; conditional docs marked false)"

requirements-completed: [DOCS-01, DOCS-02, DOCS-03, DOCS-04, DOCS-06]

# Metrics
duration: 8min
completed: 2026-02-23
---

# Phase 18 Plan 01: Document Collection Foundation Summary

**Five document collection tables with org-scoped RLS, INSERT-only audit log, SHA-256 token hash storage, and 23-row HMRC document catalog seeded across all four UK filing types (SA100, CT600, VAT, Companies House)**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-23T14:05:51Z
- **Completed:** 2026-02-23T14:13:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created all five document collection tables in FK-dependency order with correct schema and RLS policies matching project's per-operation pattern
- document_access_log is INSERT-only for authenticated (no UPDATE/DELETE policies) — audit trail integrity for HMRC enquiry compliance
- Seeded 23 HMRC document types with labels, portal checklist descriptions, retention years, and MIME type hints
- Seeded 27 filing_document_requirements rows covering all four filing types; verified counts via Supabase REST API

## Task Commits

Each task was committed atomically:

1. **Task 1: DB table DDL migration — all five tables with RLS** - `f8b09c6` (feat)
2. **Task 2: Seed migration — HMRC document catalog + filing requirements mapping** - `c27f03c` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `supabase/migrations/20260224000001_document_collection_tables.sql` - Five table DDL with RLS policies and indexes; applied to remote Supabase
- `supabase/migrations/20260224000002_document_types_seed.sql` - 23 document_types rows + 27 filing_document_requirements rows; applied to remote Supabase

## Decisions Made
- document_types and filing_document_requirements have no org_id — same global reference pattern as filing_types
- document_access_log: INSERT + SELECT for authenticated, no UPDATE/DELETE — immutable audit trail
- upload_portal_tokens.token_hash TEXT NOT NULL UNIQUE — raw token never in database
- client_documents.tax_period_end_date DATE NOT NULL — retention anchor; null would be HMRC compliance violation
- 5-year retention for SA100-specific individual docs; 6-year for all company/shared docs
- BANK_STATEMENT accepts text/csv in addition to pdf/image
- corporation_tax_payment filing type excluded from requirements mapping (payment deadline, no documents)

## Deviations from Plan

None — plan executed exactly as written.

The Supabase CLI push required a migration repair step (`supabase migration repair --status reverted`) due to remote-only migrations in the history. This is the established pattern from D-15-01-04 and was handled automatically.

## Issues Encountered

- Supabase CLI migration history conflicts required repair before each push. Standard pattern in this project (documented in D-15-01-04). Used `npx supabase migration repair --status reverted` to resolve before `db push --include-all`. Applied successfully on first attempt after repair.

## User Setup Required

None — no external service configuration required. Supabase Storage bucket creation (`prompt-documents`) is a separate manual step documented in Phase 18 plan 02.

## Next Phase Readiness

- All five document collection tables exist in the remote database with correct RLS policies
- 23 document types seeded and verified; 27 filing requirements mapped
- Phase 18 Plan 02 can proceed (Storage bucket RLS, utility functions)
- Phase 19 can begin once all Phase 18 plans are complete

---
*Phase: 18-document-collection-foundation*
*Completed: 2026-02-23*
