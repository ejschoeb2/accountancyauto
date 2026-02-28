---
phase: 25-google-drive-integration
plan: "03"
subsystem: auth
tags: [google-drive, oauth2, csrf, token-encryption, typescript, api-routes]

# Dependency graph
requires:
  - phase: 25-01
    provides: withTokenRefresh utility, GoogleCredentials interface, @googleapis/drive package, auth named export pattern
  - phase: 24-03
    provides: encryptToken/decryptToken from lib/crypto/tokens.ts, AES-256-GCM encryption
  - phase: 24-01
    provides: organisations schema with google_access_token_enc, google_refresh_token_enc, google_drive_folder_id, storage_backend columns
provides:
  - GET /api/auth/google-drive/connect — OAuth2 connect route with CSRF state cookie
  - GET /api/auth/google-drive/callback — OAuth2 callback with token exchange, Prompt/ folder creation, encrypted DB write
affects: [25-04, 25-05, 28-settings-storage-tab]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "OAuth2 CSRF state pattern: 32-byte hex state token in HttpOnly cookie (maxAge=600, sameSite=lax)"
    - "All OAuth callback errors redirect to /settings with error query param — never raw error pages"
    - "Lazy OAuth2Client construction with getOAuth2Client() function — mirrors D-11-05-01 (Stripe lazy init)"
    - "Token guards: redirect on missing refresh_token before any Drive API call (should not happen with prompt=consent)"
    - "State cookie deleted after callback via response.cookies.delete() — prevents replay attacks"

key-files:
  created:
    - app/api/auth/google-drive/connect/route.ts
    - app/api/auth/google-drive/callback/route.ts
  modified: []

key-decisions:
  - "[D-25-03-01] Use extracted string variables (accessToken, refreshToken) after getToken() — avoids TypeScript mismatch between google-auth-library Credentials type (scope: string | undefined) and the returned token shape (scope: string | null); setCredentials() called with the original tokens object which has the correct type"
  - "[D-25-03-02] Redirect to /settings?tab=storage&error=X on all error cases rather than returning HTTP 500 or showing raw error pages — consistent OAuth2 UX pattern; errors are surfaced as UI notifications not raw pages"
  - "[D-25-03-03] Guard both access_token AND refresh_token absence after getToken() — plan only specified refresh_token guard but access_token is equally required for immediate Drive API use"

patterns-established:
  - "OAuth connect route pattern: auth check -> CSRF state generation -> authUrl with prompt=consent -> redirect with HttpOnly state cookie"
  - "OAuth callback route pattern: auth check -> CSRF validation -> code exchange -> resource creation -> encrypted DB write -> cookie cleanup -> success redirect"

requirements-completed: [GDRV-01, GDRV-02, GDRV-03]

# Metrics
duration: 12min
completed: 2026-02-28
---

# Phase 25 Plan 03: Google Drive OAuth2 Routes Summary

**Two-route Google Drive OAuth2 flow: connect route generates CSRF-protected auth URL; callback validates state, exchanges code, creates Prompt/ Drive folder, and persists AES-256-GCM encrypted tokens to organisations**

## Performance

- **Duration:** 12 min
- **Started:** 2026-02-28T12:31:07Z
- **Completed:** 2026-02-28T12:43:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `GET /api/auth/google-drive/connect` — generates 32-byte hex CSRF state, builds Google OAuth consent URL with `drive.file` scope + `access_type=offline` + `prompt=consent`, sets state in HttpOnly cookie (maxAge=600), redirects to Google
- `GET /api/auth/google-drive/callback` — validates CSRF state, exchanges code via `oauth2Client.getToken()`, creates `Prompt/` root folder in user's Drive root, persists encrypted tokens and folder ID to `organisations` table, cleans up state cookie, redirects to settings
- No plaintext token ever reaches the database — both `google_access_token_enc` and `google_refresh_token_enc` written via `encryptToken()` exclusively
- All error paths redirect to `/settings?tab=storage&error=X` — no raw error pages exposed to accountants

## Task Commits

Each task was committed atomically:

1. **Task 1: Create connect route** - `c61a50b` (feat)
2. **Task 2: Create callback route** - `9e6bb84` (feat)

## Files Created/Modified

- `app/api/auth/google-drive/connect/route.ts` — OAuth2 connect route: CSRF state generation, authorization URL, HttpOnly state cookie, redirect to Google consent screen
- `app/api/auth/google-drive/callback/route.ts` — OAuth2 callback: state validation, token exchange, Prompt/ folder creation, encrypted DB write, cookie cleanup, success redirect

## Decisions Made

- **D-25-03-01:** Used extracted string variables (`accessToken`, `refreshToken`) after `getToken()` rather than re-using the `tokens` object for the `encryptToken()` calls. This avoids a TypeScript type narrowing conflict: `google-auth-library`'s `Credentials` interface has `scope?: string | undefined` but the returned tokens can have `scope: null`. `setCredentials(tokens)` is called with the original `tokens` object (correct type), while the guard checks narrow the extracted strings to non-null before `encryptToken()`.

- **D-25-03-02:** All callback error paths redirect to `/settings?tab=storage&error=X` rather than returning HTTP error responses. OAuth callbacks should never expose raw error state to users — the Settings page reads the `error` query param and shows a UI notification.

- **D-25-03-03:** Added `access_token` guard alongside the `refresh_token` guard (plan only specified the latter). If `access_token` is absent, the Drive folder creation step would fail with a cryptic error — the redirect is cleaner UX.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected import pattern for @googleapis/drive**
- **Found during:** Task 1 (connect route creation)
- **Issue:** The plan's code examples use `import { google } from '@googleapis/drive'` and `new google.auth.OAuth2(...)`. As established in D-25-01-01 and D-25-02-01, `google` is NOT a named export from the scoped `@googleapis/drive` package. The correct exports are `auth` (AuthPlus instance) and `drive` (factory function).
- **Fix:** Used `import { auth, drive } from '@googleapis/drive'` in both routes. `getOAuth2Client()` constructs `new auth.OAuth2(...)`. Callback uses `drive({ version: 'v3', auth: oauth2Client })` for the Drive client.
- **Files modified:** `app/api/auth/google-drive/connect/route.ts`, `app/api/auth/google-drive/callback/route.ts`
- **Verification:** `npm run build` passes with zero TypeScript errors. Both routes appear in build output.
- **Committed in:** c61a50b, 9e6bb84 (part of each task commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in plan's import examples, same correction as D-25-01-01 and D-25-02-01)
**Impact on plan:** Auto-fix necessary for correctness — the scoped package API differs from the umbrella `googleapis` package. No scope creep.

## Issues Encountered

- TypeScript type mismatch between the locally-typed `tokens` variable and the `Credentials` type expected by `oauth2Client.setCredentials()`. The `Credentials` interface from `google-auth-library` has `scope?: string | undefined` but the actual runtime value can be `null`. Resolved by calling `setCredentials(tokens)` with the original `tokens` object from `getToken()` (which TypeScript infers correctly as `Credentials`) and extracting `accessToken`/`refreshToken` as separate `string` variables for the `encryptToken()` calls after null guards narrow them.

## Next Phase Readiness

- OAuth2 connect and callback routes are fully wired and compiled
- Plans 25-04 and 25-05 can now rely on `organisations.google_drive_folder_id` being set after successful OAuth connect
- The Settings storage tab (Phase 28) can link to `GET /api/auth/google-drive/connect` as the "Connect Google Drive" button target and read `connected=google_drive` from the success redirect query param

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `app/api/auth/google-drive/connect/route.ts` | FOUND |
| `app/api/auth/google-drive/callback/route.ts` | FOUND |
| Commit c61a50b (connect route) | FOUND |
| Commit 9e6bb84 (callback route) | FOUND |

---
*Phase: 25-google-drive-integration*
*Completed: 2026-02-28*
