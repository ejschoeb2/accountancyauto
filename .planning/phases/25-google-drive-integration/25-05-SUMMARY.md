---
phase: 25-google-drive-integration
plan: "05"
subsystem: ui, api, storage
tags: [google-drive, storage, settings, dsar, react, next.js, supabase]

# Dependency graph
requires:
  - phase: 25-02
    provides: resolveProvider() factory and StorageProvider interface with getBytes()
  - phase: 25-03
    provides: Google Drive OAuth callback and token storage in organisations table
  - phase: 24-01
    provides: storage_backend column on client_documents and storage_backend_status on organisations

provides:
  - DSAR export handles both supabase and google_drive documents via per-document storage_backend routing
  - StorageCard component with Connect/Disconnect Google Drive UI
  - disconnectGoogleDrive server action clearing all encrypted token columns
  - Storage tab added to SettingsTabs (4th tab alongside General/Email/Billing)
  - Re-auth banner in dashboard layout when storage_backend_status='reauth_required'

affects: [25-google-drive-integration, 28-settings-ui-token-lifecycle, 29-hardening]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-document storage_backend routing in DSAR: check doc.storage_backend before choosing byte-fetch strategy"
    - "Org storage config fetched once before document loop — prevents N extra DB round-trips"
    - "Re-auth banner follows same amber banner pattern (bg-{color}-50, border-{color}-200) — red for Drive"
    - "StorageCard uses useTransition for disconnect action — same pattern as InboundCheckerCard"

key-files:
  created:
    - app/(dashboard)/settings/components/storage-card.tsx
  modified:
    - app/api/clients/[id]/documents/dsar/route.ts
    - app/actions/settings.ts
    - app/(dashboard)/settings/components/settings-tabs.tsx
    - app/(dashboard)/settings/page.tsx
    - app/(dashboard)/layout.tsx

key-decisions:
  - "Org config fetched via authenticated supabase client (not admin) in DSAR route — consistent with org-scoped query approach; RLS ensures org membership"
  - "Buffer.buffer.slice(byteOffset, byteOffset+byteLength) cast as ArrayBuffer for JSZip compatibility — Google Drive getBytes() returns Buffer (Uint8Array subclass) whose .buffer may be shared"
  - "disconnectGoogleDrive uses admin client (not session-scoped) — mirrors updatePostmarkSettings pattern for writing to organisations table"
  - "revalidatePath('/settings') called after disconnectGoogleDrive — ensures StorageCard re-renders with updated state on next page load"
  - "needsReauth declared before try block and initialised to false — prevents reference error if org context fails"

patterns-established:
  - "Banner pattern: bg-{color}-50 border-b border-{color}-200 px-8 py-3 with max-w-7xl container — matches existing amber read-only banner exactly"

requirements-completed: [GDRV-08, GDRV-09]

# Metrics
duration: 8min
completed: 2026-02-28
---

# Phase 25 Plan 05: DSAR Multi-Backend Export, Storage Settings Tab, and Re-Auth Banner Summary

**DSAR export routes bytes through resolveProvider() per document storage_backend; StorageCard with Connect/Disconnect Google Drive; red re-auth banner on layout**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-28T13:04:47Z
- **Completed:** 2026-02-28T13:12:47Z
- **Tasks:** 2
- **Files modified:** 6 (1 created, 5 modified)

## Accomplishments

- DSAR export now assembles ZIPs from both Supabase and Google Drive documents — org config fetched once, then per-document storage_backend determines byte-fetch strategy
- Settings page has a new Storage tab with StorageCard showing Google Drive connected/disconnected state, Connect button linking to OAuth, and Disconnect button calling server action
- disconnectGoogleDrive server action clears all encrypted token columns (google_access_token_enc, google_refresh_token_enc, google_token_expires_at, google_drive_folder_id) and resets storage_backend to 'supabase'
- Dashboard layout shows a red re-auth banner (distinct from amber subscription banner) when storage_backend_status='reauth_required', linking to /settings?tab=storage

## Task Commits

Each task was committed atomically:

1. **Task 1: Update DSAR export for per-document storage_backend routing** - `a58c1ad` (feat)
2. **Task 2: Create StorageCard, disconnectGoogleDrive action, add Storage tab, add re-auth banner** - `6616010` (feat)

**Plan metadata:** _(docs commit below)_

## Files Created/Modified

- `app/api/clients/[id]/documents/dsar/route.ts` - Added storage_backend to docs SELECT, org_id to clients SELECT, org config fetch, and conditional byte-fetch routing (google_drive via resolveProvider().getBytes(), supabase via existing signed URL path)
- `app/(dashboard)/settings/components/storage-card.tsx` - New "use client" component; shows Not connected state with Connect button or Connected state with status badge + optional Disconnect; uses useTransition for disconnect action
- `app/actions/settings.ts` - Added revalidatePath import and disconnectGoogleDrive server action (clears 6 token/config columns, resets storage_backend to 'supabase')
- `app/(dashboard)/settings/components/settings-tabs.tsx` - Added StorageCard import, 3 new props (storageBackend, googleDriveFolderExists, storageBackendStatus), Storage TabsTrigger and TabsContent
- `app/(dashboard)/settings/page.tsx` - Extended organisations SELECT to include storage_backend, storage_backend_status, google_drive_folder_id; passes 3 new props to SettingsTabs
- `app/(dashboard)/layout.tsx` - Added needsReauth variable (initialised false before try block), extended org SELECT to include storage_backend_status, added red re-auth banner JSX after amber read-only banner

## Decisions Made

- Org config fetched via authenticated supabase client (not admin) in DSAR route — consistent with the org-scoped query approach already used in the file; RLS ensures the caller is a member of the org
- Buffer.buffer.slice() cast as ArrayBuffer for JSZip compatibility — Google Drive getBytes() returns a Node.js Buffer (Uint8Array subclass) whose .buffer ArrayBuffer property may be shared/offset; the slice ensures a clean independent ArrayBuffer
- disconnectGoogleDrive uses admin client (mirrors updatePostmarkSettings pattern) — writing to organisations requires service role to bypass RLS
- revalidatePath('/settings') in disconnectGoogleDrive ensures StorageCard re-renders with updated state on next navigation to /settings

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required beyond what previous plans established.

## Next Phase Readiness

- Phase 25 is now complete — all 5 plans executed (OAuth, GoogleDriveProvider, token refresh, file route wiring, settings UI + DSAR)
- Google Drive integration is fully functional: upload, download, delete, DSAR export, connect, disconnect, re-auth banner
- Phase 26 (OneDrive) can begin — the StorageProvider interface, resolveProvider() factory, and settings UI patterns are all established

## Self-Check: PASSED

All created files verified on disk. All task commits verified in git log.

---
*Phase: 25-google-drive-integration*
*Completed: 2026-02-28*
