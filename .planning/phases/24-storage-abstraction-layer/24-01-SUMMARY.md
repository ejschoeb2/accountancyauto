---
phase: 24-storage-abstraction-layer
plan: 01
subsystem: database
tags: [postgres, supabase, migrations, enum, oauth, encryption]

# Dependency graph
requires:
  - phase: 18-document-collection-foundation
    provides: client_documents table that receives the new storage_backend column

provides:
  - storage_backend_enum Postgres type with four provider values
  - organisations.storage_backend column (enum, NOT NULL, DEFAULT 'supabase')
  - organisations.storage_backend_status column (TEXT, CHECK constraint)
  - organisations encrypted token columns (google_refresh_token_enc, google_access_token_enc, ms_token_cache_enc, dropbox_refresh_token_enc, dropbox_access_token_enc)
  - client_documents.storage_backend column (enum, NOT NULL, DEFAULT 'supabase')

affects:
  - 25-google-drive-integration
  - 26-onedrive-integration
  - 27-dropbox-integration
  - 28-settings-ui-token-lifecycle
  - 29-hardening-integration-testing

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TEXT + CHECK constraint for status columns (not enum) — allows future value additions without ALTER TYPE"
    - "_enc suffix convention on all encrypted token columns — signals encryption at all times"
    - "DEFAULT 'supabase' on storage_backend columns — backfills existing rows on column addition, zero-disruption migration"

key-files:
  created:
    - supabase/migrations/20260228000001_storage_abstraction_layer.sql
  modified: []

key-decisions:
  - "storage_backend_status uses TEXT + CHECK constraint (not enum) — values can be added in future phases without ALTER TYPE; initial CHECK includes 'active', 'error', 'reauth_required'"
  - "storage_backend column on client_documents set at insert time, never derived from org's current storage_backend — prevents broken routing after backend switches"
  - "All _enc columns are TEXT DEFAULT NULL, nullable — written only by lib/crypto/tokens.ts (Phase 24 Plan 02)"
  - "DEFAULT 'supabase' on both storage_backend columns backfills all existing rows — additive-only migration, no existing code broken"
  - "Enum type and dependent columns in a single migration — avoids ordering issues if migration timestamps get out of sync"

patterns-established:
  - "Migration repair pattern: supabase migration repair --status reverted <ids> to mark remote-only migrations, then --status applied for already-applied local migrations"

requirements-completed: [STOR-02, STOR-03, STOR-04]

# Metrics
duration: 12min
completed: 2026-02-28
---

# Phase 24 Plan 01: Storage Abstraction Layer Schema Summary

**Postgres storage_backend_enum type + 8 new columns across organisations and client_documents enabling provider-agnostic OAuth storage and per-document backend routing**

## Performance

- **Duration:** 12 min
- **Started:** 2026-02-28T02:55:38Z
- **Completed:** 2026-02-28T03:07:38Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Created `storage_backend_enum` Postgres type with all four provider values ('supabase', 'google_drive', 'onedrive', 'dropbox')
- Added 7 new columns to `organisations`: storage_backend, storage_backend_status (with CHECK constraint), and 5 encrypted token columns for all providers
- Added `storage_backend` column to `client_documents` with DEFAULT 'supabase' backfilling all existing rows
- Applied migration to remote database successfully — all Phase 25-27 provider integrations now have the schema foundation they require

## Task Commits

1. **Task 1: Create and apply the storage abstraction schema migration** - `aff7bad` (feat)

**Plan metadata:** TBD (docs: complete plan — created at state update)

## Files Created/Modified

- `supabase/migrations/20260228000001_storage_abstraction_layer.sql` — Single migration defining storage_backend_enum type, all organisations storage/token columns, and client_documents storage_backend column

## Decisions Made

- `storage_backend_status` uses TEXT + CHECK constraint (not a separate enum) so values can be added without `ALTER TYPE` — includes 'reauth_required' from the start (Phase 25 will write this value)
- Per-document `storage_backend` column set at INSERT time, never derived from `org.storage_backend` — prevents broken routing for orgs that switch backends
- All `_enc` columns are TEXT and nullable — no plaintext token ever goes in these columns directly; `lib/crypto/tokens.ts` (Plan 02) is the sole write path
- Enum type and all dependent columns in a single migration — consistent with existing project migration patterns, avoids ordering risk

## Deviations from Plan

None — plan executed exactly as written. The migration history repair steps (marking remote-only migrations as reverted and already-applied local migration as applied) are the established pattern documented in STATE.md D-15-01-04 and were anticipated by the plan's fallback instructions.

## Issues Encountered

Migration history was out of sync on `db push` (expected — established pattern from Phase 15). Remote had applied migrations that existed only on the Supabase Dashboard without local files. Resolution:
1. `supabase migration repair --status reverted 20260210 20260225235709 20260225235713 20260226122349 20260226181338 20260226235116 20260227004315 20260227173849` — marked the dashboard-applied remote-only migrations as reverted
2. `supabase migration repair --status applied 20260226000001` — marked the Postmark columns migration as already applied (columns existed from the remote-only 20260226181338 migration)
3. `supabase migration repair --status reverted 20260210` — the bare `20260210` timestamp was a separate remote entry
4. `supabase db push --include-all` — applied the two pending local migrations (20260210 with NOTICE on already-existing column, and 20260228000001 clean)

## User Setup Required

None — schema changes are additive only. No environment variables required for this plan (ENCRYPTION_KEY is a Plan 02 concern).

## Next Phase Readiness

- Schema foundation for all three provider integrations is in place
- Plan 02 (TypeScript StorageProvider interface + crypto module) can proceed immediately
- Phases 25-27 have their required DB columns; no further schema blockers

## Self-Check: PASSED

- FOUND: `supabase/migrations/20260228000001_storage_abstraction_layer.sql`
- FOUND: `.planning/phases/24-storage-abstraction-layer/24-01-SUMMARY.md`
- FOUND: commit `aff7bad` (feat(24-01): add storage abstraction layer schema migration)
- Migration `20260228000001` shows Local + Remote both applied in `supabase migration list`

---
*Phase: 24-storage-abstraction-layer*
*Completed: 2026-02-28*
