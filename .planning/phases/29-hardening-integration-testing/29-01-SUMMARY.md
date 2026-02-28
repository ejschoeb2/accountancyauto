---
phase: 29-hardening-integration-testing
plan: "01"
subsystem: portal-uploads
tags: [chunked-upload, google-drive, onedrive, dropbox, vercel-limit]
dependency_graph:
  requires:
    - 25-01 # GoogleDriveProvider + withTokenRefresh
    - 26-01 # PostgresMsalCachePlugin + OneDriveProvider
    - 27-01 # DropboxProvider
    - 24-03 # lib/crypto/tokens.ts (encryptToken/decryptToken)
  provides:
    - upload-session route (session initiation for large portal uploads)
    - upload-finalize route (DB insert after chunked upload completes)
    - chunked upload routing in portal-checklist.tsx
  affects:
    - app/portal/[token] (upload UX for files > 4 MB)
tech_stack:
  added: []
  patterns:
    - "Provider-native resumable upload sessions (Google Drive Location header, OneDrive createUploadSession)"
    - "Content-Range PUT chunking from browser to provider (no Authorization header on pre-auth session URLs)"
    - "Browser-side SHA-256 via Web Crypto API (crypto.subtle.digest)"
    - "Server-session + browser-chunk + server-finalize three-step pattern"
key_files:
  created:
    - app/api/portal/[token]/upload-session/route.ts
    - app/api/portal/[token]/upload-finalize/route.ts
  modified:
    - app/portal/[token]/components/portal-checklist.tsx
decisions:
  - "LARGE_FILE_THRESHOLD = 4 MB (below Vercel 4.5 MB hard limit with margin)"
  - "CHUNK_SIZE = 1,310,720 bytes — LCM(262144, 327680) satisfying both Google Drive (256 KiB multiples) and OneDrive (320 KiB multiples)"
  - "Google Drive resumable session: POST to /upload/drive/v3/files?uploadType=resumable returns Location header — pre-authenticated for browser PUT"
  - "OneDrive session: POST to /me/drive/root:/{path}:/createUploadSession — uploadUrl is pre-authenticated, no Authorization needed in browser"
  - "Dropbox fallback: PROXY marker returned — no pre-authenticated session URL available; browser falls through to existing upload route (documented limitation)"
  - "Supabase fallback: provider: 'supabase' returned — browser falls through to existing upload route (Supabase handles multipart natively)"
  - "classifyDocument called without buffer in upload-finalize (keyword-only; OCR skipped since bytes never touched server)"
  - "SHA-256 computed browser-side via Web Crypto API — server never receives file bytes for large Drive/OneDrive uploads"
  - "uploadInChunks handles both 308 (Drive Resume Incomplete) and 202 (OneDrive) continuation statuses"
  - "Page count set to null for large files — pdf-parse cannot run without server-side buffer"
metrics:
  duration_minutes: 4
  tasks_completed: 2
  files_created: 2
  files_modified: 1
  completed_date: "2026-02-28"
---

# Phase 29 Plan 01: Provider-Native Chunked Portal Uploads Summary

Provider-native chunked upload sessions for portal files exceeding Vercel's 4.5 MB request body limit — Google Drive resumable sessions and OneDrive large file upload sessions allow the browser to PUT chunks directly to the provider, with server handling only session initiation and DB finalization.

## What Was Built

### Task 1: upload-session and upload-finalize routes

**`app/api/portal/[token]/upload-session/route.ts`**

POST endpoint called when `file.size > 4 MB`. Authenticates the portal token using the same SHA-256 hash pattern as the existing upload route. Resolves org storage config via FK join with PGRST200 fallback. Branches on `storage_backend`:

- **google_drive**: Fetches encrypted credentials from organisations, wraps Drive API call in `withTokenRefresh`, re-implements `findOrCreateFolder` inline to build the `root → clientName → filingTypeId → taxYear` folder hierarchy, then POSTs to `https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable` and extracts the `Location` header as `sessionUrl`. Returns `{ sessionUrl, provider: 'google_drive' }`.
- **onedrive**: Creates a fresh MSAL ConfidentialClientApplication with PostgresMsalCachePlugin, acquires token silently, POSTs to `/me/drive/root:/Apps/Prompt/{encodedPath}:/createUploadSession`, extracts `uploadUrl`. Returns `{ sessionUrl: uploadUrl, provider: 'onedrive' }`.
- **dropbox**: Returns `{ sessionId: 'PROXY', provider: 'dropbox' }` — no pre-authenticated URL available; browser falls through to existing route.
- **supabase**: Returns `{ provider: 'supabase' }` — browser falls through to existing route.

**`app/api/portal/[token]/upload-finalize/route.ts`**

POST endpoint called after the browser completes its chunked upload. Validates the portal token, classifies the document by keyword only (no buffer — bytes went directly to the provider), calculates retention dates, and inserts the `client_documents` row with `storage_backend = provider`, `storage_path = storagePath` (Drive file ID or OneDrive item ID), `file_hash = sha256Hash`, `file_size_bytes = fileSize`, `page_count = null`. Marks the token `used_at`. Returns `{ success, documentId, originalFilename, confidence }`.

### Task 2: Chunked upload routing in portal-checklist.tsx

Added to `portal-checklist.tsx` (existing small-file path 100% unchanged):

- `LARGE_FILE_THRESHOLD = 4 * 1024 * 1024` — 4 MB gate
- `CHUNK_SIZE = 1310720` — 1.25 MB, LCM of Drive (256 KiB) and OneDrive (320 KiB) chunk alignment requirements
- `computeSha256(file)` — Web Crypto API SHA-256 for browser-side integrity hash
- `uploadInChunks(sessionUrl, file, onProgress?)` — Content-Range PUT loop; handles 200/201 completion and 308/202 continuation statuses; no Authorization header (session URLs are pre-authenticated)
- Modified `handleUpload`: large-file guard at top calls upload-session → if Google Drive or OneDrive with `sessionUrl`, runs `uploadInChunks` then `upload-finalize` → returns early. Dropbox and Supabase fall through to existing FormData path.

## Deviations from Plan

None — plan executed exactly as written. One minor addition:

**[Rule 2 - Missing check] Added 308 status handling in uploadInChunks**
- **Found during:** Task 2 implementation review
- **Issue:** Plan specified only 202 as the "more chunks expected" status, but Google Drive uses 308 (Resume Incomplete) for intermediate chunk acknowledgement
- **Fix:** Added `res.status !== 308 && res.status !== 202` check — handles both providers correctly
- **Files modified:** `app/portal/[token]/components/portal-checklist.tsx`
- **Commit:** `bedf56c`

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `app/api/portal/[token]/upload-session/route.ts` exists | FOUND |
| `app/api/portal/[token]/upload-finalize/route.ts` exists | FOUND |
| `app/portal/[token]/components/portal-checklist.tsx` exists | FOUND |
| Commit `6570e95` (Task 1) exists | FOUND |
| Commit `bedf56c` (Task 2) exists | FOUND |
| `npx tsc --noEmit` clean | PASS |
