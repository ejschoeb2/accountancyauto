---
phase: 27-dropbox-integration
plan: "03"
subsystem: api
tags: [dropbox, storage, dsar, documents, oauth2]

# Dependency graph
requires:
  - phase: 27-01
    provides: DropboxProvider in resolveProvider factory
  - phase: 25-04
    provides: resolveProvider call pattern already applied to portal upload and Postmark inbound routes

provides:
  - "DSAR export routes all non-Supabase backends through resolveProvider().getBytes() including Dropbox"
  - "Document download route handles Dropbox with filesGetTemporaryLink temporary URL (4-hour TTL)"
  - "Portal upload and Postmark inbound confirmed already routing through resolveProvider (Phase 25 state)"

affects: [28-settings-ui-token-lifecycle, 29-hardening-integration-testing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DSAR backend routing: null/'supabase' as default, all others via resolveProvider().getBytes() (forward-compatible)"
    - "Dropbox download: filesGetTemporaryLink returned as { signedUrl } for client-side shape compatibility"
    - "Per-document storage_backend (doc.storage_backend, not org.storage_backend) used throughout for routing — D-24-01-02"

key-files:
  created: []
  modified:
    - app/api/clients/[id]/documents/dsar/route.ts
    - app/api/clients/[id]/documents/route.ts

key-decisions:
  - "DSAR supabase-as-default branching: if (!doc.storage_backend || doc.storage_backend === 'supabase') rather than if (doc.storage_backend === 'google_drive') — forward-compatible for any new backend"
  - "Dropbox download returns { signedUrl: url } (temporary link) not proxied bytes — Dropbox filesGetTemporaryLink works under app folder scope, unlike Google Drive which requires server proxy"
  - "Org config SELECT uses 'id, storage_backend' (not google_drive_folder_id) for Dropbox download case — DropboxProvider does not need folder ID"

patterns-established:
  - "Non-Supabase DSAR bytes: resolveProvider(orgConfig).getBytes(doc.storage_path) handles all third-party backends uniformly"
  - "Download route branching: google_drive (proxy bytes) -> dropbox (temporary link) -> supabase (signed URL default)"
  - "audit log INSERT before URL/bytes returned for all backends — document_access_log write-before-return pattern"

requirements-completed: [DRPBX-04]

# Metrics
duration: 35min
completed: 2026-02-28
---

# Phase 27 Plan 03: Dropbox File Route Wiring Summary

**Dropbox integrated into DSAR export and document download routes via forward-compatible per-document backend routing; portal upload and Postmark inbound confirmed already routing through resolveProvider from Phase 25**

## Performance

- **Duration:** 35 min
- **Started:** 2026-02-28T13:19:38Z
- **Completed:** 2026-02-28T13:54:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Confirmed portal upload and Postmark inbound routes already use `resolveProvider()` from Phase 25; no upload-side changes needed — Dropbox uploads work transparently via the factory
- Fixed DSAR export: changed from `if (google_drive)` to `if (supabase)` as default, routing all non-Supabase backends through `resolveProvider().getBytes()` — Dropbox documents now correctly included in DSAR ZIPs
- Added Dropbox case to document download route: returns `filesGetTemporaryLink` 4-hour TTL URL as `{ signedUrl }` for client-side shape compatibility (same response format as Supabase)
- All three download paths audit-log before returning URL/bytes: audit trail integrity maintained across Supabase, Google Drive, and Dropbox backends

## Task Commits

Each task was committed atomically:

1. **Task 1: Verify portal upload and Postmark inbound** - `71283d4` (feat) — No code changes; State A confirmed (Phase 25 already applied)
2. **Task 2: Update DSAR export and document download** - `71283d4` (feat) — Combined commit covering both DSAR fix and download route Dropbox case

**Plan metadata:** `[to be added after docs commit]` (docs: complete plan)

## Files Created/Modified
- `app/api/clients/[id]/documents/dsar/route.ts` - Fixed DSAR backend branching: supabase as default, all other backends via resolveProvider().getBytes() (forward-compatible)
- `app/api/clients/[id]/documents/route.ts` - Added Dropbox case: getDownloadUrl() returns { signedUrl: url } for 4-hour TTL temporary link

## Decisions Made
- DSAR branching changed from `if (google_drive)` to `if (!storage_backend || supabase)` as default — ensures any future third-party backend added to resolveProvider() is automatically handled without code changes
- Dropbox download returns `{ signedUrl: url }` not proxied bytes — filesGetTemporaryLink works under app folder scope (unlike Google Drive drive.file scope which cannot produce public URLs)
- Dropbox download route uses `storage_backend: 'dropbox'` explicitly (routing by doc.storage_backend per D-24-01-02, not org.storage_backend)

## Deviations from Plan

### Auto-fixed Issues

None — plan included explicit guidance for both State A (Phase 25 already applied) and State B (not applied). State A was confirmed for upload routes. DSAR and download routes had the exact branching gaps described in the plan spec.

---

**Total deviations:** 0
**Impact on plan:** Plan executed exactly as specified.

## Issues Encountered
- Windows filesystem race condition in Turbopack build (ENOENT on `.tmp` files) — transient, unrelated to code. TypeScript check (`tsc --noEmit`) confirmed zero type errors. Final build succeeded on clean `.next` directory.

## Next Phase Readiness
- DRPBX-04 complete: Dropbox org can upload via portal, receive via Postmark inbound, download via temporary link, and export DSAR ZIP with mixed backends
- All four backends (supabase, google_drive, onedrive placeholder, dropbox) handled in all file-handling routes
- Phase 28 (Settings UI & Token Lifecycle) ready: DropboxConnectCard (27-02) exists; health-check cron and re-auth banner needed

---
*Phase: 27-dropbox-integration*
*Completed: 2026-02-28*
