---
phase: 26-microsoft-onedrive-integration
plan: "02"
subsystem: storage
tags: [onedrive, msal, graph-api, storage-provider, token-management]
dependency_graph:
  requires:
    - "26-01 (PostgresMsalCachePlugin, ms_home_account_id schema column, @azure/msal-node)"
    - "24-02 (StorageProvider interface, resolveProvider factory, OrgStorageConfig)"
    - "25-01 (withTokenRefresh pattern, reauth_required convention)"
  provides:
    - "OneDriveProvider implementing StorageProvider via Microsoft Graph REST API"
    - "resolveProvider 'onedrive' case wired — all four upload/download/DSAR routes support OneDrive automatically"
    - "ms_home_account_id in OrgStorageConfig — passed through from org SELECT to OneDriveProvider constructor"
  affects:
    - "app/api/clients/[id]/documents/route.ts (download action)"
    - "app/api/portal/[token]/upload/route.ts (portal upload)"
    - "app/api/postmark/inbound/route.ts (processAttachments)"
    - "app/api/clients/[id]/documents/dsar/route.ts (DSAR ZIP export)"
tech_stack:
  added: []
  patterns:
    - "OneDrive path-based PUT (auto-creates intermediate folders, no folder creation helper needed)"
    - "@microsoft.graph.downloadUrl pre-authenticated temporary link for downloads"
    - "Fresh MSAL client per request (avoids stale PostgresMsalCachePlugin cache reads)"
    - "InteractionRequiredAuthError -> reauth_required status + clear ms_token_cache_enc + ms_home_account_id"
key_files:
  created:
    - path: lib/storage/onedrive.ts
      role: "OneDriveProvider class — StorageProvider implementation via Graph API with MSAL token management"
  modified:
    - path: lib/documents/storage.ts
      role: "Added ms_home_account_id to OrgStorageConfig; imported OneDriveProvider; added 'onedrive' case to resolveProvider"
    - path: app/api/clients/[id]/documents/route.ts
      role: "Updated Google Drive org SELECT to include ms_home_account_id; added OneDrive download branch"
    - path: app/api/portal/[token]/upload/route.ts
      role: "Updated join SELECT and fallback query to include ms_home_account_id; pass through to resolveProvider"
    - path: app/api/postmark/inbound/route.ts
      role: "Updated org SELECT in processAttachments to include ms_home_account_id; pass through to resolveProvider"
    - path: app/api/clients/[id]/documents/dsar/route.ts
      role: "Updated org SELECT to include ms_home_account_id; pass through to resolveProvider"
decisions:
  - "[D-26-02-01] Fresh MSAL client per request — PostgresMsalCachePlugin.beforeCacheAccess fires once per client instance; reusing across requests would serve stale cache"
  - "[D-26-02-02] OneDrive item ID as storagePath — stored in client_documents.storage_path; stable identifier for getBytes, getDownloadUrl, and delete"
  - "[D-26-02-03] OneDrive download uses getDownloadUrl (temporary link) not getBytes — unlike Google Drive, OneDrive natively provides @microsoft.graph.downloadUrl under Files.ReadWrite scope"
  - "[D-26-02-04] Phase 29 stub comment removed from storage.ts (dropbox was already wired in Phase 27); onedrive case inserted before dropbox case"
metrics:
  duration: "9 minutes (548 seconds)"
  completed: "2026-02-28"
  tasks_completed: 2
  files_changed: 6
---

# Phase 26 Plan 02: OneDriveProvider Implementation Summary

**One-liner:** OneDriveProvider with MSAL acquireTokenSilent and PostgresMsalCachePlugin wired into resolveProvider factory; all four upload/download/DSAR routes support OneDrive automatically via existing Phase 25 resolveProvider call sites.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create lib/storage/onedrive.ts — OneDriveProvider class | d211a73 | lib/storage/onedrive.ts |
| 2 | Wire OneDriveProvider into resolveProvider factory | b808103 | lib/documents/storage.ts, 4 route files |

## What Was Built

### Task 1: OneDriveProvider (lib/storage/onedrive.ts)

Implements the `StorageProvider` interface for Microsoft OneDrive via raw fetch against the Microsoft Graph REST API:

- **`upload()`**: Path-based PUT to `Apps/Prompt/{clientName}/{filingTypeId}/{taxYear}/{filename}`. OneDrive auto-creates intermediate folders. Returns the OneDrive item ID as `storagePath`.
- **`getDownloadUrl()`**: Fetches item metadata and extracts `@microsoft.graph.downloadUrl` — a pre-authenticated temporary link (no Authorization header needed to follow it). Unlike Google Drive, OneDrive natively supports temporary links under `Files.ReadWrite` scope.
- **`getBytes()`**: Fetches raw bytes from `/me/drive/items/{id}/content` for DSAR export.
- **`delete()`**: HTTP DELETE on `/me/drive/items/{id}`. Expects 204 No Content.

**Token management via `getAccessToken()`:**
1. Creates a fresh `ConfidentialClientApplication` per call (critical — avoids stale PostgresMsalCachePlugin cache reads across requests)
2. Looks up account via `tokenCache.getAccountByHomeId(homeAccountId)`
3. If `account === null`: sets `storage_backend_status = 'reauth_required'`, clears `ms_token_cache_enc` and `ms_home_account_id`, throws
4. Calls `acquireTokenSilent` with `['Files.ReadWrite', 'offline_access']`
5. On `InteractionRequiredAuthError`: sets reauth_required, clears token columns, re-throws (never retries)
6. `afterCacheAccess` auto-persists refreshed cache back to Postgres

### Task 2: resolveProvider Factory + Route Call Sites

Two changes to `lib/documents/storage.ts`:
- `OrgStorageConfig.ms_home_account_id?: string | null` added (Phase 26)
- `case 'onedrive'` wired: validates `ms_home_account_id` present, returns `new OneDriveProvider(orgConfig.id, orgConfig.ms_home_account_id)`

Four route files updated to include `ms_home_account_id` in their org SELECT queries and pass it through `resolveProvider`:
- **documents/route.ts**: Google Drive org SELECT expanded; new OneDrive download branch added (uses `getDownloadUrl` + inserts access log)
- **portal upload route.ts**: Both the PostgREST FK join SELECT and the fallback query updated; `orgMsHomeAccountId` variable added
- **postmark/inbound route.ts**: `processAttachments` org SELECT expanded; `orgMsHomeAccountId` passed to `resolveProvider`
- **dsar route.ts**: Org SELECT expanded; `ms_home_account_id` passed to `resolveProvider`

## Deviations from Plan

**1. [Rule 2 - Missing functionality] OneDrive download branch added to documents/route.ts**
- **Found during:** Task 2
- **Issue:** The plan mentioned updating the four routes to include `ms_home_account_id` in org SELECT queries, but `documents/route.ts` had explicit Google Drive and Dropbox download branches — OneDrive had no branch, so `resolveProvider('onedrive')` would have been reached but the download response flow was Google Drive specific (proxied bytes via `getBytes()`). OneDrive should use `getDownloadUrl()` like Dropbox since it provides a native temporary link.
- **Fix:** Added explicit `if (doc.storage_backend === 'onedrive')` branch between Google Drive and Dropbox branches, using `getDownloadUrl()` + access log insert, returning `{ signedUrl: url }` (same shape as Dropbox for client compatibility).
- **Files modified:** `app/api/clients/[id]/documents/route.ts`
- **Commit:** b808103

## Self-Check: PASSED

- FOUND: lib/storage/onedrive.ts
- FOUND: commit d211a73 (feat(26-02): create OneDriveProvider)
- FOUND: commit b808103 (feat(26-02): wire OneDriveProvider into resolveProvider factory)
- Build: compiled successfully with zero TypeScript errors
