---
phase: 18-document-collection-foundation
plan: 04
subsystem: infra
tags: [supabase-storage, rls, postgres, security, gdpr]

# Dependency graph
requires:
  - phase: 18-01
    provides: document collection tables with client_documents using org-scoped RLS
  - phase: 18-02
    provides: storage.ts BUCKET_NAME constant and admin client patterns
  - service: supabase-storage
    provides: prompt-documents private bucket (manual Dashboard creation)

provides:
  - supabase/migrations/20260224000003_storage_objects_rls.sql — 5 org-scoped RLS policies on storage.objects for prompt-documents bucket

affects:
  - 19-collection-mechanisms (all plans — storage SDK calls will get RLS enforcement from this point)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Storage RLS path pattern: storage.foldername(name)[1]='orgs', storage.foldername(name)[2]=(auth_org_id())::text — UUID-to-text cast required"
    - "Separate per-operation policies on storage.objects (not FOR ALL) — consistent with D-10-02-03 pattern"
    - "Service role ALL policy: USING + WITH CHECK both check bucket_id only — service role bypasses org scoping by design (cron/webhook ops)"

key-files:
  created:
    - supabase/migrations/20260224000003_storage_objects_rls.sql
  modified: []

key-decisions:
  - "Storage RLS uses auth_org_id()::text cast — auth_org_id() returns UUID, storage.foldername returns text[], must cast"
  - "5 separate policies (not one FOR ALL) — matches project pattern D-10-02-03 for per-operation clarity"
  - "service_role ALL policy uses both USING and WITH CHECK clauses — required for complete coverage"
  - "Bucket creation was a manual Dashboard step (Task 1) — SQL migration cannot create buckets; confirmed via user 'bucket created' response"

requirements-completed: [DOCS-05]

# Metrics
duration: 9min
completed: 2026-02-23
---

# Phase 18 Plan 04: Storage Bucket and RLS Summary

**Org-scoped storage.objects RLS for prompt-documents bucket — 5 policies enforcing auth_org_id() path-prefix isolation (SELECT/INSERT/UPDATE/DELETE for authenticated, ALL for service_role)**

## Performance

- **Duration:** 9 min
- **Started:** 2026-02-23T14:33:25Z
- **Completed:** 2026-02-23T14:42:48Z
- **Tasks:** 2 (Task 1: human-action completed by user; Task 2: auto — migration applied)
- **Files modified:** 1

## Accomplishments

- User manually created `prompt-documents` private bucket in Supabase Dashboard (Task 1 — mandatory human step; SQL migration cannot create storage buckets)
- Applied 5-policy storage.objects RLS migration: per-operation policies for SELECT/INSERT/UPDATE/DELETE for the `authenticated` role, plus ALL for `service_role`
- All authenticated policies check `storage.foldername(name)[1] = 'orgs'` AND `storage.foldername(name)[2] = (auth_org_id())::text` — org members can only access their own org's path prefix
- Service role has unrestricted access for admin operations (cron jobs, inbound webhook attachment extraction)
- Migration applied successfully via supabase db push; confirmed in migration list (both local and remote columns show 20260224000003)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create prompt-documents private bucket** — human-action (no commit — Dashboard step)
2. **Task 2: Storage objects RLS migration** — `fbbb8e9` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `supabase/migrations/20260224000003_storage_objects_rls.sql` — 5 RLS policies on storage.objects; applied to remote Supabase

## Decisions Made

- auth_org_id() returns UUID; storage.foldername() returns text[] — explicit `::text` cast required (this is the most common source of silent bugs with this pattern)
- Per-operation policies (not FOR ALL) — consistent with D-10-02-03 established across all public schema tables
- service_role ALL policy specifies both USING and WITH CHECK — complete coverage for all DML operations
- Migration repair (`supabase migration repair --status reverted 20260210`) required before push — standard pattern D-15-01-04

## Deviations from Plan

None — plan executed exactly as written.

The migration repair step for 20260210 (remote-only) is the established pattern (D-15-01-04) and was handled automatically without user intervention.

## Issues Encountered

- supabase migration list showed 20260210 on remote but not local — standard repair pattern applied (`npx supabase migration repair --status reverted 20260210`). One-command fix, no impact on Phase 18 work.
- pg_policies verification via PostgREST REST API not directly available (no query RPC exposed). Verification confirmed via: (1) explicit "Applying migration..." message in push output, (2) matching 20260224000003 in both local and remote columns of migration list, (3) service role bucket list returning HTTP 200.

## User Setup Required

**Task 3 (checkpoint:human-verify) is pending** — user must run the full Phase 18 integration verification checks before Phase 19 can begin. See checkpoint details below.

## Next Phase Readiness

- Storage bucket `prompt-documents` exists (Private)
- 5 storage.objects RLS policies applied and migration confirmed on remote
- Full Phase 18 integration verification (Task 3 checkpoint) must pass before Phase 19 begins
- Phase 19 collection mechanisms can call uploadDocument/getSignedDownloadUrl from lib/documents/storage.ts with confidence that RLS will enforce org isolation

---
*Phase: 18-document-collection-foundation*
*Completed: 2026-02-23*
