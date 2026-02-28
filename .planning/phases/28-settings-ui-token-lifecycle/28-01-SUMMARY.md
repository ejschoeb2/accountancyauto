---
phase: 28-settings-ui-token-lifecycle
plan: 01
subsystem: settings-ui
tags: [storage, ui, dropbox, reauth-banner]
dependency_graph:
  requires: [27-dropbox-integration]
  provides: [dropbox-storage-card-visible, provider-generic-reauth-banner]
  affects: [settings-page, dashboard-layout]
tech_stack:
  added: []
  patterns: [prop-chain, admin-role-guard, router-refresh-on-success]
key_files:
  created: []
  modified:
    - app/(dashboard)/settings/page.tsx
    - app/(dashboard)/settings/components/settings-tabs.tsx
    - app/(dashboard)/settings/components/storage-card.tsx
    - app/(dashboard)/settings/components/dropbox-connect-card.tsx
    - app/actions/settings.ts
    - app/(dashboard)/layout.tsx
decisions:
  - disconnectGoogleDrive return type changed from Promise<void> to Promise<{ error?: string }> for consistency with disconnectDropbox pattern; admin role guard added
  - providerName derived from org.storage_backend in layout.tsx (declared before try block with safe fallback); re-auth banner now provider-generic
  - error badge (amber) added alongside existing reauth_required badge (red) for all three provider cards — consistent status signalling
metrics:
  duration_seconds: 207
  completed_date: "2026-02-28"
  tasks_completed: 2
  files_modified: 6
---

# Phase 28 Plan 01: Storage UI Wiring and Provider-Generic Re-auth Banner Summary

Wire the orphaned DropboxConnectCard into the Storage tab and make the dashboard re-auth banner provider-generic using org.storage_backend.

## What Was Built

**Task 1 — dropboxConnected prop chain (page → tabs → StorageCard):**
- Added `dropbox_refresh_token_enc` to the organisations SELECT query in `settings/page.tsx`
- Derived `dropboxConnected = !!orgResult.data?.dropbox_refresh_token_enc`
- Passed `dropboxConnected` through `SettingsTabs` → `StorageCard` → `DropboxConnectCard`
- Added `DropboxConnectCard` import and render in `storage-card.tsx` after the OneDrive card
- Added amber "Connection error — checking automatically" badge for `storageBackendStatus === 'error'` in Google Drive, OneDrive, and Dropbox connected states
- Updated `disconnectGoogleDrive` to use `getOrgContext()` with admin role guard and return `{ error?: string }` for consistency
- Added `googleDisconnectError` state and `router.refresh()` on successful Google Drive disconnect

**Task 2 — Provider-generic re-auth banner:**
- Added `storage_backend` to organisations SELECT in `app/(dashboard)/layout.tsx`
- Derived `providerName` from `org.storage_backend` with human-readable labels (Google Drive, Microsoft OneDrive, Dropbox, fallback)
- Replaced hardcoded "Google Drive" in banner `<p>` and `<a>` text with `{providerName}`

## Deviations from Plan

None — plan executed exactly as written. Note: Task 1 changes were pre-committed in commit `919c8e8` (labeled `feat(28-03)`) before this plan execution. The layout.tsx (Task 2) was not included in that earlier commit and was applied here in commit `218155e`.

## Interfaces Updated

**StorageCardProps (storage-card.tsx):**
```typescript
interface StorageCardProps {
  storageBackend: string | null;
  googleDriveFolderExists: boolean;
  storageBackendStatus: string | null;
  oneDriveConnected: boolean;
  dropboxConnected: boolean;  // ADDED
}
```

**SettingsTabsProps (settings-tabs.tsx):**
```typescript
interface SettingsTabsProps {
  // ... existing fields ...
  dropboxConnected: boolean;  // ADDED
}
```

**disconnectGoogleDrive (settings.ts):**
```typescript
// Before: Promise<void> — threw on error, no admin guard
// After: Promise<{ error?: string }> — returns error string, has admin role guard
export async function disconnectGoogleDrive(): Promise<{ error?: string }>
```

## Self-Check: PASSED

- `app/(dashboard)/layout.tsx`: FOUND
- `app/(dashboard)/settings/components/storage-card.tsx`: FOUND
- `app/(dashboard)/settings/components/dropbox-connect-card.tsx`: FOUND
- `app/(dashboard)/settings/page.tsx`: FOUND
- `app/(dashboard)/settings/components/settings-tabs.tsx`: FOUND
- `app/actions/settings.ts`: FOUND
- Commit `218155e`: FOUND (Task 2 — layout.tsx)
- Commit `919c8e8`: FOUND (Task 1 — prop chain, error badges, disconnectGoogleDrive)
- TypeScript: passes with no errors
