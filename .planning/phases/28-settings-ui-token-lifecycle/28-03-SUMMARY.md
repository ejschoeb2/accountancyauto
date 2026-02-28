---
phase: 28-settings-ui-token-lifecycle
plan: "03"
subsystem: infra
tags: [cron, storage, health-check, gdpr, privacy, google-drive, onedrive, dropbox]

requires:
  - phase: 24-storage-abstraction-layer
    provides: organisations schema with storage_backend, storage_backend_status, token columns
  - phase: 25-google-drive-integration
    provides: google_access_token_enc, google_refresh_token_enc, withTokenRefresh pattern
  - phase: 26-microsoft-onedrive-integration
    provides: ms_token_cache_enc, ms_home_account_id, PostgresMsalCachePlugin
  - phase: 27-dropbox-integration
    provides: dropbox_refresh_token_enc, dropbox_access_token_enc, DropboxAuth pattern
  - phase: 15-per-accountant-config
    provides: app_settings table with (org_id, user_id, key) NULLS NOT DISTINCT unique constraint

provides:
  - Daily storage health-check cron at GET /api/cron/storage-health-check
  - Idempotent error notification email to org admins (one email per error period)
  - Automatic recovery detection (error -> active status reset on next healthy check)
  - Privacy policy sub-processor entries for Google LLC, Microsoft Corporation, Dropbox Inc.

affects:
  - 29-hardening-integration-testing
  - settings-ui (storage backend status surfaced to StorageCard via storage_backend_status column)

tech-stack:
  added: []
  patterns:
    - "Storage health-check uses dynamic import() for provider SDKs to keep cold-start fast"
    - "Idempotency via app_settings (org_id, user_id=null, key=storage_health_error_notified)"
    - "reauth_required guard: cron skips orgs already flagged with stronger signal"
    - "Recovery detection: status 'error' -> 'active' + idempotency flag cleared on healthy check"

key-files:
  created:
    - app/api/cron/storage-health-check/route.ts
  modified:
    - vercel.json
    - app/(marketing)/privacy/page.tsx

key-decisions:
  - "D-28-03-01: PostgresMsalCachePlugin takes only orgId: string (not admin client) — actual constructor signature differs from plan interfaces; OneDrive health-check uses createMsalClient pattern from OneDriveProvider"
  - "D-28-03-02: app_settings upsert uses onConflict: 'org_id,user_id,key' with user_id: null payload — matches NULLS NOT DISTINCT unique constraint from Phase 15 migration; plan showed 'org_id,key' which would conflict"
  - "D-28-03-03: Idempotency queries use .is('user_id', null) not .eq('user_id', null) — correct PostgREST IS NULL pattern"
  - "D-28-03-04: Recovery clear uses .is('user_id', null) filter on delete — ensures org-level flag only is cleared, not any user-scoped rows with same key"

patterns-established:
  - "Cron health-check pattern: fetch orgs -> per-org provider check -> error flag with idempotent email -> recovery detection"

requirements-completed:
  - TOKEN-04
  - TOKEN-05

duration: 20min
completed: "2026-02-28"
---

# Phase 28 Plan 03: Storage Health-Check Cron and Privacy Policy Summary

**Daily storage health-check cron (GET /api/cron/storage-health-check) with idempotent admin email alerts and UK GDPR-compliant sub-processor entries for all three optional storage providers**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-02-28T17:37:00Z
- **Completed:** 2026-02-28T17:57:35Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- Built GET /api/cron/storage-health-check — proactively checks Google Drive, OneDrive, and Dropbox connections for all non-Supabase orgs before accountants discover failures at upload time
- Idempotent notification: one email per error period via `storage_health_error_notified` in app_settings; recovery resets the flag so admins are notified again if the error recurs
- vercel.json updated to 7 cron entries — storage-health-check scheduled at 0 6 * * * (6am UTC daily)
- Privacy policy section 7 updated with Google LLC, Microsoft Corporation, and Dropbox Inc. as conditional sub-processors — satisfies UK GDPR Art. 13/14 transparency hard gate

## Task Commits

Each task was committed atomically:

1. **Task 1: Build storage health-check cron route** - `919c8e8` (feat)
2. **Task 2: Add cron schedule to vercel.json and update privacy policy** - `9a7590c` (feat)

**Plan metadata:** see final docs commit below

## Files Created/Modified

- `app/api/cron/storage-health-check/route.ts` - Daily cron checking Google Drive, OneDrive, Dropbox connections; sets error status; sends idempotent admin email; clears on recovery
- `vercel.json` - Added storage-health-check at 0 6 * * * (now 7 total cron entries)
- `app/(marketing)/privacy/page.tsx` - Added Google LLC, Microsoft Corporation, Dropbox Inc. rows to sub-processor table; added conditional note in section 7 paragraph

## Decisions Made

- **D-28-03-01:** `PostgresMsalCachePlugin` constructor takes only `orgId: string` (no admin client param) — the plan interfaces showed it taking `admin` but the actual implementation at `lib/storage/msal-cache-plugin.ts` takes `orgId` only. The health-check implementation follows the actual constructor. MSAL client is created fresh per-request using the same pattern as `OneDriveProvider.createMsalClient()`.

- **D-28-03-02:** app_settings upsert uses `onConflict: "org_id,user_id,key"` with `user_id: null` in the payload — matches the Phase 15 NULLS NOT DISTINCT unique constraint `app_settings_org_user_key_unique`. The plan interface showed `onConflict: "org_id,key"` which would fail against the actual constraint.

- **D-28-03-03:** Idempotency SELECT and recovery DELETE both use `.is("user_id", null)` — correct PostgREST IS NULL syntax; avoids matching user-scoped rows with the same key.

- **D-28-03-04:** `reauth_required` orgs are filtered at the query level (`.neq("storage_backend_status", "reauth_required")`) — not just skipped in the loop — so they never enter the processing path and the stronger signal is never overwritten.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed PostgresMsalCachePlugin constructor signature mismatch**
- **Found during:** Task 1 (Build storage health-check cron route)
- **Issue:** Plan interface showed `new PostgresMsalCachePlugin(admin, org.id)` (two args: admin client + orgId) but actual implementation at `lib/storage/msal-cache-plugin.ts` takes only `orgId: string`
- **Fix:** Used `new PostgresMsalCachePlugin(org.id)` matching the actual constructor; followed `OneDriveProvider`'s `createMsalClient()` pattern for acquiring tokens
- **Files modified:** `app/api/cron/storage-health-check/route.ts`
- **Verification:** `npx tsc --noEmit` passes with no errors
- **Committed in:** 919c8e8 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed app_settings onConflict field and upsert payload**
- **Found during:** Task 1 (Build storage health-check cron route)
- **Issue:** Plan interface showed `onConflict: "org_id,key"` but Phase 15 changed the unique constraint to `UNIQUE NULLS NOT DISTINCT (org_id, user_id, key)`. Without `user_id: null` in the payload and correct onConflict string, the upsert would fail at runtime
- **Fix:** Used `{ org_id, user_id: null, key, value }` payload with `onConflict: "org_id,user_id,key"` per Phase 15 D-15-01-01. Also used `.is("user_id", null)` for idempotency SELECT and recovery DELETE queries
- **Files modified:** `app/api/cron/storage-health-check/route.ts`
- **Verification:** `npx tsc --noEmit` passes with no errors
- **Committed in:** 919c8e8 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs in plan interfaces vs actual codebase)
**Impact on plan:** Both fixes required for correct runtime behavior. No scope creep. The health-check route is functionally identical to the plan's specification — only the constructor and conflict target were corrected to match actual codebase state.

## Issues Encountered

None — TypeScript compilation passed cleanly on first attempt after applying the two interface corrections above.

## User Setup Required

None — no new environment variables. The cron uses existing `CRON_SECRET`, `POSTMARK_SERVER_TOKEN`, `POSTMARK_SENDER_DOMAIN`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`, and `ENCRYPTION_KEY` — all already present from Phase 24-27 setup.

Vercel will automatically register the new cron schedule from vercel.json on next deployment.

## Next Phase Readiness

- Phase 28 Plan 03 complete — health-check cron and privacy policy delivered
- Phase 28 Plan 04 (if any) can proceed — all storage tokens, status columns, and provider SDKs are in place
- Phase 29 (Hardening & Integration Testing) can now test health-check behavior end-to-end with real provider connections

---
*Phase: 28-settings-ui-token-lifecycle*
*Completed: 2026-02-28*
