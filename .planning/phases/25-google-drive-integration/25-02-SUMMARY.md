---
phase: 25-google-drive-integration
plan: "02"
subsystem: storage
tags: [google-drive, googleapis, oauth2, storage-provider, typescript]

# Dependency graph
requires:
  - phase: 25-01
    provides: withTokenRefresh utility, GoogleCredentials interface, token-refresh.ts
  - phase: 24-02
    provides: StorageProvider interface, UploadParams, OrgStorageConfig, resolveProvider factory

provides:
  - GoogleDriveProvider class implementing StorageProvider (lib/storage/google-drive.ts)
  - findOrCreateFolder helper preventing duplicate Drive folders
  - resolveProvider factory updated with google_drive case
  - UploadParams.clientName optional field for folder hierarchy
  - OrgStorageConfig.google_drive_folder_id optional field

affects: [25-04, 25-05, upload-routes, download-routes, dsar-export]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Named export pattern for @googleapis/drive: import { drive as createDrive } not import { google }"
    - "Drive file ID as storagePath: returned from upload(), used directly in getBytes() and delete()"
    - "Lazy folder creation: findOrCreateFolder checks before creating to prevent duplicate folders"
    - "getDownloadUrl() throws intentionally — drive.file scope cannot produce public URLs"

key-files:
  created:
    - lib/storage/google-drive.ts
  modified:
    - lib/documents/storage.ts

key-decisions:
  - "[D-25-02-01] Use { drive as createDrive } named export from @googleapis/drive — google is not a named export from the scoped package (mirrors D-25-01-01 for auth)"
  - "[D-25-02-02] Drive file ID is the storagePath for Google Drive — stored in client_documents.storage_path, used directly for getBytes() and delete()"
  - "[D-25-02-03] clientName is optional in UploadParams, falls back to clientId — backwards compatible; SupabaseStorageProvider ignores the field"
  - "[D-25-02-04] getDownloadUrl() throws with a clear error message — drive.file scope cannot produce public URLs; all download routes must use getBytes() via server-proxy"

patterns-established:
  - "findOrCreateFolder: Drive list query with exact name + parent + mimeType + trashed=false before creating — prevents duplicate folder problem"
  - "Single-quote escaping in Drive query: name.replace(/'/g, \"\\\\'\") before embedding in q= string"

requirements-completed: [GDRV-03, GDRV-04]

# Metrics
duration: 8min
completed: 2026-02-28
---

# Phase 25 Plan 02: GoogleDriveProvider Summary

**GoogleDriveProvider class with lazy folder hierarchy (findOrCreateFolder), server-proxied getBytes(), and resolveProvider factory wired for 'google_drive' backend**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-28T12:21:10Z
- **Completed:** 2026-02-28T12:28:58Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created `lib/storage/google-drive.ts` with full `StorageProvider` implementation for Google Drive
- `findOrCreateFolder` uses Drive list API to find existing folders before creating, preventing duplicates (Research pitfall #3)
- `upload()` builds `Prompt/{clientName}/{filingTypeId}/{taxYear}/` folder hierarchy lazily; returns Drive file ID as storagePath
- `getBytes()` streams Drive alt=media response into a Buffer via `streamToBuffer` helper
- `getDownloadUrl()` throws immediately with a clear error — drive.file scope cannot produce public URLs
- `delete()` removes Drive file by file ID via admin credentials
- Updated `resolveProvider` factory in `lib/documents/storage.ts` with `google_drive` case; extended `UploadParams` with optional `clientName` and `OrgStorageConfig` with optional `google_drive_folder_id`

## Task Commits

Each task was committed atomically:

1. **Task 1: Create GoogleDriveProvider** - `dea5acf` (feat)
2. **Task 2: Wire resolveProvider + extend interfaces** - `336df8c` (feat)

## Files Created/Modified

- `lib/storage/google-drive.ts` - GoogleDriveProvider class implementing StorageProvider with upload, getBytes, delete, getDownloadUrl
- `lib/documents/storage.ts` - Added clientName to UploadParams, google_drive_folder_id to OrgStorageConfig, google_drive case in resolveProvider

## Decisions Made

- **D-25-02-01:** `@googleapis/drive` scoped package exports `drive` (function) directly, not via `google.drive`. Used `import { drive as createDrive }` to match the actual package API — mirrors D-25-01-01 (auth named export pattern).
- **D-25-02-02:** Drive file ID is the storagePath for Google Drive documents. This is the canonical identifier for all getBytes() and delete() operations — no path encoding needed.
- **D-25-02-03:** `clientName` is optional in UploadParams with fallback to `clientId`. Backwards-compatible: all existing SupabaseStorageProvider call sites continue working without modification.
- **D-25-02-04:** `getDownloadUrl()` throws intentionally with an explicit error message explaining the scope limitation. All download routes for Google Drive must use `getBytes()` via a server-proxy route (enforced in Plans 25-04 and 25-05).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed incorrect import of `google` from `@googleapis/drive`**
- **Found during:** Task 1 build verification
- **Issue:** Plan specified `import { google } from '@googleapis/drive'` but the scoped package does not export `google` — it exports `drive` (the factory function) and `auth` directly. TypeScript error: `Module '"@googleapis/drive"' has no exported member 'google'`.
- **Fix:** Changed import to `import { drive as createDrive } from '@googleapis/drive'` and updated all usages of `google.drive({ version: 'v3', auth })` to `createDrive({ version: 'v3', auth })`. Also updated the `findOrCreateFolder` parameter type annotation.
- **Files modified:** `lib/storage/google-drive.ts`
- **Verification:** `npm run build` passes with zero TypeScript errors after fix.
- **Committed in:** `dea5acf` (Task 1 commit)

**2. [Rule 3 - Blocking] Task 2 changes applied before Task 1 build verification**
- **Found during:** Task 1 build verification
- **Issue:** `google-drive.ts` references `params.clientName` which does not yet exist on `UploadParams` — Task 2 adds it. Build fails with `Property 'clientName' does not exist on type 'UploadParams'`.
- **Fix:** Implemented Task 2 (`storage.ts` changes) before Task 1 build verification could pass. Both tasks verified together with a single `npm run build` pass.
- **Files modified:** `lib/documents/storage.ts`
- **Verification:** `npm run build` passes after both tasks applied.
- **Committed in:** `336df8c` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug in import path, 1 blocking inter-task dependency)
**Impact on plan:** Both fixes necessary for correctness. No scope creep. Plan structure is correct — tasks are tightly coupled and must be built together.

## Issues Encountered

- `@googleapis/drive` scoped package API differs from the `googleapis` umbrella package. The scoped package exports `drive` and `auth` directly; the umbrella package wraps them under `google.drive` and `google.auth`. The plan's import example reflected the umbrella package API. Auto-fixed per deviation Rule 1.

## Next Phase Readiness

- `GoogleDriveProvider` is complete and wired into `resolveProvider`
- Plans 25-04 and 25-05 can now use `resolveProvider(orgConfig)` to get a `GoogleDriveProvider` for upload and download routes
- `getDownloadUrl()` intentionally throws — download routes must call `getBytes()` and proxy the response; this is a known constraint for Plans 25-04 and 25-05

---
*Phase: 25-google-drive-integration*
*Completed: 2026-02-28*
