---
phase: 26-microsoft-onedrive-integration
plan: "03"
subsystem: storage
tags: [onedrive, msal, oauth2, storage, settings]
dependency_graph:
  requires:
    - 26-01 (PostgresMsalCachePlugin, @azure/msal-node installed)
    - 26-02 (OneDriveProvider, resolveProvider wired)
    - 25-05 (StorageCard component, Storage tab in settings, disconnectGoogleDrive pattern)
  provides:
    - MSAL OAuth2 connect route (app/api/auth/onedrive/connect/route.ts)
    - MSAL OAuth2 callback route (app/api/auth/onedrive/callback/route.ts)
    - disconnectOneDrive server action
    - OneDrive section in StorageCard UI
  affects:
    - app/(dashboard)/settings — OneDrive connect/disconnect now available in Storage tab
    - app/actions/settings.ts — new disconnectOneDrive export
tech_stack:
  added: []
  patterns:
    - MSAL ConfidentialClientApplication lazy instantiation (inside handler, not module scope)
    - CSRF state token via HttpOnly cookie (32-byte hex, maxAge=600)
    - AADSTS53003 Conditional Access detection in catch block
    - PostgresMsalCachePlugin injected for callback only (not connect — no tokens yet)
    - useSearchParams inside Suspense boundary for StorageCard error/success banners
key_files:
  created:
    - app/api/auth/onedrive/connect/route.ts
    - app/api/auth/onedrive/callback/route.ts
  modified:
    - app/actions/settings.ts
    - app/(dashboard)/settings/components/storage-card.tsx
    - app/(dashboard)/settings/components/settings-tabs.tsx
    - app/(dashboard)/settings/page.tsx
decisions:
  - "[D-26-03-01] MSAL client created lazily inside handler (not module scope) — mirrors D-11-05-01 Stripe pattern; prevents build failures when MS env vars absent at build time"
  - "[D-26-03-02] PostgresMsalCachePlugin injected in callback only, not connect — connect only generates auth URL, no tokens involved; plugin added for callback so afterCacheAccess fires to persist initial cache"
  - "[D-26-03-03] StorageCard uses Suspense boundary wrapping inner component — required for useSearchParams to work in Next.js App Router without blocking static rendering of the settings page"
  - "[D-26-03-04] oneDriveConnected prop derived from ms_home_account_id IS NOT NULL — homeAccountId is the reliable presence indicator; ms_token_cache_enc could be null during re-auth flows"
metrics:
  duration: "7 minutes"
  completed: "2026-02-28"
  tasks_completed: 2
  files_changed: 6
---

# Phase 26 Plan 03: OneDrive OAuth2 Routes and StorageCard Summary

**One-liner:** MSAL OAuth2 connect/callback routes with CSRF protection, AADSTS53003 handling, and OneDrive section added to StorageCard alongside Google Drive.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create MSAL OAuth2 connect and callback routes | 8194a11 | app/api/auth/onedrive/connect/route.ts, app/api/auth/onedrive/callback/route.ts |
| 2 | Add disconnectOneDrive action and update StorageCard | 5395d1d | app/actions/settings.ts, storage-card.tsx, settings-tabs.tsx, page.tsx |

## What Was Built

### Task 1: MSAL OAuth2 Routes

**Connect route** (`app/api/auth/onedrive/connect/route.ts`):
- Verifies user authentication via `createClient().auth.getUser()`
- Creates `ConfidentialClientApplication` lazily inside handler (not module scope)
- Generates 32-byte hex CSRF state token via `crypto.randomBytes(32)`
- Calls `getAuthCodeUrl` with `Files.ReadWrite + offline_access` scopes and `prompt: 'consent'`
- Sets `ms_oauth_state` HttpOnly cookie (maxAge=600, sameSite=lax)
- Returns `NextResponse.redirect(authUrl)` to Microsoft consent screen

**Callback route** (`app/api/auth/onedrive/callback/route.ts`):
- Validates CSRF state (cookie vs URL param) — redirects to `error=invalid_state` on mismatch
- Creates `ConfidentialClientApplication` WITH `PostgresMsalCachePlugin(orgId)` for token persistence
- Calls `acquireTokenByCode` — `afterCacheAccess` fires automatically, persisting encrypted cache to `ms_token_cache_enc`
- Catches `AADSTS53003` specifically — redirects to `error=conditional_access_blocked`
- Persists `homeAccountId` and sets `storage_backend='onedrive'` via admin client
- Deletes `ms_oauth_state` cookie on all code paths (success and error)
- Success redirect: `/settings?tab=storage&connected=onedrive`

### Task 2: DisconnectOneDrive and StorageCard Update

**disconnectOneDrive action** (`app/actions/settings.ts`):
- Clears `ms_token_cache_enc`, `ms_home_account_id`, resets `storage_backend='supabase'`, `storage_backend_status=null`
- Uses `getOrgContext()` for org scoping, `createAdminClient()` for write
- Calls `revalidatePath('/settings')` to trigger StorageCard re-render

**StorageCard** (`app/(dashboard)/settings/components/storage-card.tsx`):
- Extended with `oneDriveConnected: boolean` prop
- Added OneDrive card section below Google Drive, matching visual pattern
- Shows connect button (links to `/api/auth/onedrive/connect`) when not connected
- Shows green "Connected" status + "Apps/Prompt/ folder" note + Disconnect button when connected
- `conditional_access_blocked` error shown with actionable IT admin guidance
- `connected=onedrive` success shown as green banner
- `useSearchParams` wrapped in Suspense boundary (required for App Router)

**SettingsTabs** (`settings-tabs.tsx`): added `oneDriveConnected` prop, passed through to StorageCard.

**Settings page** (`page.tsx`): added `ms_home_account_id` to org SELECT; passes `oneDriveConnected={!!orgResult.data?.ms_home_account_id}`.

## Verification Checks (all passed)

1. `npm run build` — zero TypeScript errors
2. `AADSTS53003` caught in callback route
3. `prompt: 'consent'` in connect route
4. `ms_oauth_state` cookie deleted in all callback paths
5. `ms_home_account_id` persisted in DB update
6. `PostgresMsalCachePlugin` injected into ConfidentialClientApplication in callback
7. `disconnectOneDrive` exists in app/actions/settings.ts
8. OneDrive section in storage-card.tsx
9. `conditional_access_blocked` handled in storage-card.tsx

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- app/api/auth/onedrive/connect/route.ts: FOUND
- app/api/auth/onedrive/callback/route.ts: FOUND
- app/actions/settings.ts (disconnectOneDrive): FOUND
- app/(dashboard)/settings/components/storage-card.tsx (OneDrive section): FOUND
- Commit 8194a11: FOUND
- Commit 5395d1d: FOUND
