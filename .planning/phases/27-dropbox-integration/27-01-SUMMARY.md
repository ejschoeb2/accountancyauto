---
phase: 27-dropbox-integration
plan: "01"
subsystem: infra
tags: [dropbox, storage, oauth2, token-encryption, typescript, schema-migration, npm]

requires:
  - phase: 24-storage-abstraction-layer
    provides: "StorageProvider interface, resolveProvider factory, _enc columns on organisations, lib/crypto/tokens.ts"
  - phase: 24-03
    provides: "encryptToken() and decryptToken() for AES-256-GCM token encryption"

provides:
  - "lib/storage/dropbox.ts — DropboxProvider class implementing StorageProvider with upload(), getDownloadUrl(), getBytes(), delete()"
  - "resolveProvider() factory updated with case 'dropbox' returning DropboxProvider"
  - "dropbox npm package v10.34.0 installed with DropboxAuth built-in refresh lifecycle"
  - "Schema migration for dropbox_token_expires_at and dropbox_oauth_state on organisations"
  - "ENV_VARIABLES.md documents DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_REDIRECT_URI"

affects:
  - phase-27-02 (OAuth2 routes and settings UI)
  - phase-27-03 (portal/inbound/DSAR call-site updates)
  - phase-28-settings-ui-token-lifecycle

tech-stack:
  added:
    - "dropbox@^10.34.0 (official Dropbox JS SDK with DropboxAuth token refresh)"
  patterns:
    - "Dropbox rehydration pattern: reconstruct DropboxAuth from encrypted Postgres tokens, checkAndRefreshAccessToken(), persist refreshed token back to DB"
    - "App folder path convention: paths relative to app folder root (no /Apps/Prompt/ prefix) — Dropbox enforces boundary at platform level"
    - "Unrecoverable auth detection: invalid_grant / expired_access_token / Invalid refresh token / Token has been revoked -> set reauth_required + null token columns"
    - "Lazy DropboxAuth construction: new DropboxAuth() inside getAuthClient(), never at module scope — prevents build failures when env vars absent"

key-files:
  created:
    - lib/storage/dropbox.ts
    - supabase/migrations/20260228130000_add_dropbox_token_columns.sql
  modified:
    - lib/documents/storage.ts
    - ENV_VARIABLES.md
    - package.json
    - package-lock.json

key-decisions:
  - "[D-27-01-01] Use DropboxAuth.checkAndRefreshAccessToken() built-in method — SDK handles token refresh internally; no custom withTokenRefresh wrapper needed (contrast with Google Drive Phase 25)"
  - "[D-27-01-02] App folder path convention: upload paths are relative to app folder root with no /Apps/Prompt/ prefix — Dropbox platform enforces the /Apps/{appname}/ boundary when app type = App folder"
  - "[D-27-01-03] getBytes() reuses getDownloadUrl() to get 4-hour temporary link then fetches bytes — consistent with SupabaseStorageProvider pattern; avoids duplicating filesGetTemporaryLink call"
  - "[D-27-01-04] schema migration uses IF NOT EXISTS — idempotent; columns were already present from Phase 24 storage abstraction layer schema changes"

patterns-established:
  - "Dropbox provider rehydration: createAdminClient() -> SELECT token columns -> new DropboxAuth({...decrypted tokens}) -> checkAndRefreshAccessToken() -> persist refreshed token -> new Dropbox({ auth })"
  - "Token column null check pattern: throw 'Dropbox not connected' if dropbox_refresh_token_enc IS NULL"

requirements-completed: [DRPBX-02, DRPBX-03]

duration: ~15min
completed: 2026-02-28
---

# Phase 27 Plan 01: DropboxProvider and Storage Factory Summary

**DropboxProvider with DropboxAuth token rehydration, AES-256-GCM encrypted token persistence, app-folder-scoped upload paths, and 4-hour TTL download URLs via filesGetTemporaryLink**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-02-28T13:18:47Z
- **Completed:** 2026-02-28T13:33:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Installed `dropbox@^10.34.0` npm package (official Dropbox SDK with DropboxAuth and built-in checkAndRefreshAccessToken() token refresh lifecycle)
- Built `lib/storage/dropbox.ts` with DropboxProvider implementing all four StorageProvider methods: upload(), getDownloadUrl(), getBytes(), delete()
- Implemented token rehydration from encrypted Postgres columns, proactive refresh via checkAndRefreshAccessToken(), and back-persistence of refreshed tokens
- Wired DropboxProvider into resolveProvider() factory with `case 'dropbox'`
- Documented DROPBOX_APP_KEY, DROPBOX_APP_SECRET, and DROPBOX_REDIRECT_URI in ENV_VARIABLES.md
- Created schema migration for dropbox_token_expires_at and dropbox_oauth_state columns (both already present via Phase 24 storage abstraction layer)

## Task Commits

1. **Task 1: Install dropbox package and apply schema migration** - `3305156` (chore) — package.json, package-lock.json, supabase migration
2. **Task 2: Create lib/storage/dropbox.ts and wire into resolveProvider factory** - `3305156` (feat) — lib/storage/dropbox.ts, lib/documents/storage.ts, ENV_VARIABLES.md

Note: Both tasks were committed atomically in a single feat commit `3305156` as they were completed together.

## Files Created/Modified

- `lib/storage/dropbox.ts` — DropboxProvider class implementing StorageProvider; getAuthClient() rehydrates DropboxAuth from encrypted tokens, calls checkAndRefreshAccessToken(), persists refreshed tokens; upload()/getDownloadUrl()/getBytes()/delete() methods
- `lib/documents/storage.ts` — Added `import { DropboxProvider }` and `case 'dropbox': return new DropboxProvider(orgConfig)` to resolveProvider() factory
- `ENV_VARIABLES.md` — Added Dropbox Integration Variables section documenting DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_REDIRECT_URI
- `supabase/migrations/20260228130000_add_dropbox_token_columns.sql` — ADD COLUMN IF NOT EXISTS for dropbox_token_expires_at and dropbox_oauth_state
- `package.json` / `package-lock.json` — Added dropbox@^10.34.0

## Decisions Made

- **[D-27-01-01]** Used `DropboxAuth.checkAndRefreshAccessToken()` built-in method rather than a custom token refresh wrapper. The Dropbox SDK handles the entire refresh lifecycle internally — Phase 25 (Google Drive) needed a custom `withTokenRefresh` wrapper because the google-auth-library doesn't have this convenience method. Dropbox SDK simplifies the implementation significantly.
- **[D-27-01-02]** Upload paths use no `/Apps/Prompt/` prefix — Dropbox enforces the app folder boundary at the platform level when the app is registered with "App folder" access type. Paths in API calls are relative to the app folder root (e.g., `/{clientId}/{filingTypeId}/{taxYear}/{uuid}.ext` maps to `/Apps/Prompt/{clientId}/...` in the user's Dropbox).
- **[D-27-01-03]** `getBytes()` reuses `getDownloadUrl()` to obtain the 4-hour temporary link, then fetches the bytes with `fetch()` — consistent with the SupabaseStorageProvider pattern and avoids duplicating the `filesGetTemporaryLink` API call.
- **[D-27-01-04]** Schema migration uses `ADD COLUMN IF NOT EXISTS` guards — both columns were already present in the remote database (applied during Phase 24 storage abstraction layer). The migration is tracked in the local migrations directory for completeness but was idempotent on the remote.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- **Supabase CLI circuit breaker:** `npx supabase db push` failed with FATAL circuit breaker error after multiple SASL auth retry attempts from the CLI's temp-role login mechanism. Resolved by verifying columns existed directly via the Supabase REST API (`dropbox_token_expires_at`, `dropbox_oauth_state`, `dropbox_access_token_enc`, `dropbox_refresh_token_enc` all confirmed present). Migration file created with IF NOT EXISTS guards so subsequent CLI pushes will be safe.

## User Setup Required

External Dropbox App Console configuration is required before Phase 27 OAuth routes work at runtime. See plan frontmatter `user_setup` section for full steps:
- Create Dropbox app at https://www.dropbox.com/developers/apps (Scoped access, App folder type, name it "Prompt")
- Enable scopes: `files.content.write` and `files.content.read`
- Add Redirect URI matching DROPBOX_REDIRECT_URI
- Set env vars: `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`, `DROPBOX_REDIRECT_URI`

## Next Phase Readiness

- DropboxProvider is fully implemented and wired into resolveProvider() — Plan 02 (OAuth routes and Settings connect card) can proceed
- All four StorageProvider methods are ready; Plan 03 (call-site updates) can wire portal upload, inbound, and DSAR routes through resolveProvider() for Dropbox
- TypeScript compiles with zero errors (verified via `npx tsc --noEmit`)

---
*Phase: 27-dropbox-integration*
*Completed: 2026-02-28*
