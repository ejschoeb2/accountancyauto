---
phase: 25-google-drive-integration
plan: "04"
subsystem: api
tags: [google-drive, storage, documents, portal, postmark, inbound-email]

# Dependency graph
requires:
  - phase: 25-02
    provides: GoogleDriveProvider, resolveProvider() factory, UploadParams with clientName
  - phase: 25-03
    provides: OAuth2 connect/callback routes, encrypted token storage in organisations table
  - phase: 24-01
    provides: storage_backend column on client_documents (per-document backend at insert time)
provides:
  - "Document download route with server-proxied Google Drive bytes response (no signed URL for Drive docs)"
  - "Portal upload route using resolveProvider() with org storage config and clientName"
  - "Postmark inbound attachment handler using resolveProvider() with org storage config and clientName"
  - "Both upload paths record storage_backend on client_documents INSERT"
affects: [25-05, 25-06, phase-28-storage-settings-ui, phase-29-hardening]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-proxied bytes download: branch on doc.storage_backend; google_drive -> resolveProvider.getBytes() -> return new Response(new Uint8Array(bytes), { headers })"
    - "Portal upload provider resolution: expand token SELECT with !inner joins; fallback to separate queries on PGRST200; cast join result through unknown for TypeScript"
    - "Postmark inbound provider resolution: fetch orgConfig once before attachment loop; resolveProvider inside fire-and-forget processAttachments"
    - "storage_backend captured at INSERT time on client_documents (never derived from org's current backend post-insert)"

key-files:
  created: []
  modified:
    - app/api/clients/[id]/documents/route.ts
    - app/api/portal/[token]/upload/route.ts
    - app/api/postmark/inbound/route.ts

key-decisions:
  - "Buffer -> Uint8Array conversion for Response BodyInit: TypeScript does not accept Buffer as BodyInit; new Uint8Array(bytes) is the correct cast"
  - "PostgREST join cast through unknown: !inner join infers array type; cast through unknown first avoids TypeScript overlap error"
  - "maxDuration = 60 on documents/route.ts: Google Drive getBytes() streams a full file; 10s Vercel default too short for large PDFs"
  - "orgConfig fetched once before attachment loop in processAttachments: not per-attachment to avoid N extra DB queries"

patterns-established:
  - "Google Drive download pattern: doc.storage_backend === 'google_drive' -> fetch org config -> resolveProvider -> getBytes() -> new Response(new Uint8Array(bytes))"
  - "Portal join fallback pattern: attempt !inner join; if orgJoin/clientJoin null, fall back to Promise.all separate queries"

requirements-completed: [GDRV-06, GDRV-07]

# Metrics
duration: 15min
completed: 2026-02-28
---

# Phase 25 Plan 04: File Route Wiring for Google Drive Summary

**Server-proxied Google Drive downloads and resolveProvider() upload routing wired into all three file-movement routes — documents download, portal upload, and Postmark inbound**

## Performance

- **Duration:** 15 min
- **Started:** 2026-02-28T12:46:51Z
- **Completed:** 2026-02-28T13:02:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Document download route now branches on `doc.storage_backend`; Google Drive path fetches bytes via `resolveProvider().getBytes()` and returns a proxied HTTP response with `Content-Disposition` header — the raw Drive file ID is never sent to the browser in JSON
- Portal upload route upgraded from deprecated `uploadDocument()` to `resolveProvider().upload()`, with org storage config fetched via `!inner` join (fallback to separate queries for PGRST200) and `clientName` passed for Drive folder hierarchy
- Postmark inbound attachment handler upgraded from deprecated `uploadDocument()` to `resolveProvider().upload()` with org config fetched once before the loop; both upload paths now write `storage_backend` to `client_documents` at insert time

## Task Commits

Each task was committed atomically:

1. **Task 1: Update document download action for server-proxied Google Drive response** - `ae7718e` (feat)
2. **Task 2: Update portal upload and Postmark inbound to use resolveProvider** - `825744d` (feat)

**Plan metadata:** (see below — docs commit)

## Files Created/Modified
- `app/api/clients/[id]/documents/route.ts` - Added `maxDuration = 60`; expanded SELECT to include `storage_backend`, `mime_type`, `original_filename`; added Google Drive branch that fetches org config, calls `resolveProvider().getBytes()`, writes access log, and returns `new Response(new Uint8Array(bytes))` with content headers
- `app/api/portal/[token]/upload/route.ts` - Replaced `uploadDocument()` import with `resolveProvider`; expanded token SELECT with `organisations!inner` and `clients!inner` joins; added fallback to separate org/client queries; added `clientName` to upload params; added `storage_backend` column to `client_documents` INSERT
- `app/api/postmark/inbound/route.ts` - Replaced `uploadDocument()` with `resolveProvider()` inside `processAttachments`; added org storage config fetch before attachment loop; added `clientName` and `storage_backend` to each attachment's upload call and INSERT

## Decisions Made
- `Buffer -> Uint8Array` conversion: TypeScript's `Response` constructor accepts `BodyInit` which does not include Node.js `Buffer` — cast via `new Uint8Array(bytes)` is the correct fix
- PostgREST `!inner` join result cast through `unknown`: the Supabase SDK infers array types for joined relations; direct `as { ... }` assertion fails; routing through `unknown` first avoids the TypeScript overlap error while preserving runtime behavior
- `maxDuration = 60` added to documents route: Google Drive `getBytes()` streams a full file over the network; the Vercel default 10-second function timeout is too short for PDFs
- `orgConfig` fetched once before the attachment loop, not per-attachment: prevents N extra DB round-trips for emails with multiple attachments

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Buffer not assignable to Response BodyInit**
- **Found during:** Task 1 (document download action)
- **Issue:** `new Response(bytes, ...)` fails TypeScript type check — `Buffer<ArrayBufferLike>` is not assignable to `BodyInit | null | undefined`
- **Fix:** Changed to `new Response(new Uint8Array(bytes), ...)` — Uint8Array is accepted as BodyInit
- **Files modified:** `app/api/clients/[id]/documents/route.ts`
- **Verification:** `npm run build` passes with zero TypeScript errors after fix
- **Committed in:** ae7718e (Task 1 commit)

**2. [Rule 1 - Bug] PostgREST join type assertion incompatibility**
- **Found during:** Task 2 (portal upload route)
- **Issue:** TypeScript infers `!inner` join result as `{ ... }[]` (array) — direct `as { storage_backend: ... }` assertion errors with "neither type sufficiently overlaps"
- **Fix:** Cast through `unknown` first: `(portalToken.organisations as unknown) as { ... }`
- **Files modified:** `app/api/portal/[token]/upload/route.ts`
- **Verification:** `npm run build` passes with zero TypeScript errors after fix
- **Committed in:** 825744d (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - type bugs surfaced at build time)
**Impact on plan:** Both fixes necessary for TypeScript correctness. No scope creep.

## Issues Encountered
None beyond the two auto-fixed TypeScript type errors above.

## User Setup Required
None — no new environment variables or external service configuration required for this plan.

## Next Phase Readiness
- All three file-movement routes (download, portal upload, inbound) are now Google Drive-aware
- A Google Drive-connected org can upload documents from the portal or via inbound email, and accountants can download them through the server-proxy route
- GDRV-06 and GDRV-07 requirements fulfilled
- Phase 25 Plans 01-04 complete — remaining plans (05, 06 if any) can proceed

## Self-Check: PASSED

- FOUND: app/api/clients/[id]/documents/route.ts
- FOUND: app/api/portal/[token]/upload/route.ts
- FOUND: app/api/postmark/inbound/route.ts
- FOUND: .planning/phases/25-google-drive-integration/25-04-SUMMARY.md
- FOUND: ae7718e (Task 1 commit)
- FOUND: 825744d (Task 2 commit)
- Build: passes with zero TypeScript errors

---
*Phase: 25-google-drive-integration*
*Completed: 2026-02-28*
