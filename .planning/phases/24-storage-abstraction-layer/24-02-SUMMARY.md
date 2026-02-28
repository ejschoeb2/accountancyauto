---
phase: 24-storage-abstraction-layer
plan: "02"
subsystem: storage
tags: [storage, typescript, abstraction, refactor, provider-pattern]
dependency_graph:
  requires: [24-01]
  provides: [StorageProvider interface, SupabaseStorageProvider, resolveProvider factory]
  affects: [lib/documents/storage.ts, app/api/portal/[token]/upload/route.ts, app/api/postmark/inbound/route.ts, app/api/clients/[id]/documents/route.ts, app/api/clients/[id]/documents/dsar/route.ts]
tech_stack:
  added: []
  patterns: [provider-pattern, factory-function, backwards-compatible-wrappers]
key_files:
  modified:
    - lib/documents/storage.ts
    - app/(dashboard)/billing/page.tsx
decisions:
  - "[D-24-02-01] StorageProvider interface defines upload(), getDownloadUrl(), delete(), getBytes() — four methods sufficient for all current and Phase 25-27 provider use cases"
  - "[D-24-02-02] resolveProvider() defaults to SupabaseStorageProvider for null storage_backend — safe default for pre-migration rows; never throws on unknown backend"
  - "[D-24-02-03] Backwards-compatible named exports use @deprecated JSDoc — signals intent to new callers; existing callers unchanged"
  - "[D-24-02-04] getBytes() reuses getDownloadUrl() internally — avoids duplicating signed URL logic; consistent with DSAR export pattern"
metrics:
  duration: "~8 minutes"
  completed: "2026-02-28"
  tasks_completed: 1
  files_changed: 2
  commits: 1
---

# Phase 24 Plan 02: StorageProvider Interface and SupabaseStorageProvider Summary

**One-liner:** Provider-agnostic StorageProvider interface with SupabaseStorageProvider class and resolveProvider() factory — non-breaking extraction enabling Phase 25-27 cloud storage providers.

## What Was Built

`lib/documents/storage.ts` was refactored from three standalone named functions into a structured provider pattern:

1. **`StorageBackend` type** — union of `'supabase' | 'google_drive' | 'onedrive' | 'dropbox'` mirroring the Postgres enum
2. **`OrgStorageConfig` interface** — minimal org config for the factory (`id`, `storage_backend`)
3. **`UploadParams` interface** — extracted named type for upload parameters (shared across all providers)
4. **`StorageProvider` interface** — four methods: `upload()`, `getDownloadUrl()`, `delete()`, `getBytes()`
5. **`SupabaseStorageProvider` class** — implements `StorageProvider` with identical logic to the original three functions; `getBytes()` reuses `getDownloadUrl()` + `fetch()`
6. **`resolveProvider(orgConfig)` factory** — switch on `storage_backend`; defaults to `SupabaseStorageProvider`; Phase 25-27 cases stubbed as comments
7. **Backwards-compatible named exports** — `uploadDocument()`, `getSignedDownloadUrl()`, `deleteDocument()` kept as thin wrappers; all four existing call sites compile without modification

## Verification Results

All 13 checks passed:
- StorageProvider interface exported with all four method signatures
- SupabaseStorageProvider class exported implementing StorageProvider
- resolveProvider factory exported accepting OrgStorageConfig
- All three backwards-compatible named exports present with identical signatures
- `npm run build` passes with zero TypeScript errors

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed missing props on BillingStatusCard usage in billing/page.tsx**
- **Found during:** Task 1 (build verification)
- **Issue:** `app/(dashboard)/billing/page.tsx` called `<BillingStatusCard>` without the `orgId` and `hasSubscription` props that were recently added to the component's interface. This caused a TypeScript compilation error that blocked build verification.
- **Fix:** Added `orgId={orgId}` and `hasSubscription={hasActiveSubscription}` props to the `BillingStatusCard` usage. Both values were already available in scope from the page's data fetching.
- **Files modified:** `app/(dashboard)/billing/page.tsx`
- **Commit:** b2be301

## Commits

| Hash | Message |
|------|---------|
| b2be301 | feat(24-02): introduce StorageProvider interface and SupabaseStorageProvider |

## Self-Check: PASSED
