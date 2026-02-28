---
phase: 27-dropbox-integration
plan: "02"
subsystem: auth
tags: [dropbox, oauth2, encryption, settings, react]

# Dependency graph
requires:
  - phase: 27-01
    provides: DropboxProvider, dropbox npm package, DB columns (dropbox_refresh_token_enc, dropbox_access_token_enc, dropbox_token_expires_at, dropbox_oauth_state, storage_backend)
  - phase: 24-03
    provides: encryptToken / decryptToken (AES-256-GCM) in lib/crypto/tokens.ts
  - phase: 25-03
    provides: Google Drive connect/callback route pattern — established DB column update + encrypted token storage approach
provides:
  - GET /api/auth/dropbox/connect — OAuth2 initiation with token_access_type=offline and DB-based CSRF state
  - GET /api/auth/dropbox/callback — OAuth2 completion with CSRF validation, DRPBX-01 refresh_token guard, encrypted token persistence
  - disconnectDropbox server action in app/actions/settings.ts — admin-only, clears all token columns, resets storage_backend
  - DropboxConnectCard component — Settings UI card for connect/disconnect with loading state and error display
affects: [27-03, 28-settings-ui-token-lifecycle]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - DB-based CSRF state (organisations.dropbox_oauth_state) vs cookie-based state used in Google Drive — required by plan spec
    - Lazy DropboxAuth construction inside handler function — mirrors D-11-05-01 Stripe pattern; prevents build failures when env vars absent
    - DRPBX-01 guard pattern: explicit refresh_token presence check before any token storage; immediate redirect to error URL on absence
    - getOrgContext() for role-checking in server actions (orgRole !== 'admin' guard)

key-files:
  created:
    - app/api/auth/dropbox/connect/route.ts
    - app/api/auth/dropbox/callback/route.ts
    - app/(dashboard)/settings/components/dropbox-connect-card.tsx
  modified:
    - app/actions/settings.ts

key-decisions:
  - "DB-based CSRF state (organisations.dropbox_oauth_state) used for Dropbox vs HttpOnly cookie used for Google Drive — plan requirement matches Dropbox plan spec"
  - "disconnectDropbox uses getOrgContext() for admin role check — consistent with plan spec; Google Drive disconnect omitted this guard (historical)"
  - "DropboxConnectCard uses window.location.href for connect navigation — API route redirect, not client-side navigation"
  - "Disconnect error displayed inline below disconnect button — consistent with existing settings card error patterns"

patterns-established:
  - "dropbox-connect-card.tsx: useState for error state + useTransition for loading, router.refresh() on success — same pattern as team-card.tsx member actions"

requirements-completed: [DRPBX-01, DRPBX-05]

# Metrics
duration: 9min
completed: 2026-02-28
---

# Phase 27 Plan 02: Dropbox OAuth2 Routes and Settings UI Summary

**Dropbox OAuth2 connect/callback route handlers with DB-based CSRF, DRPBX-01 refresh_token guard, encrypted token storage, disconnectDropbox server action, and DropboxConnectCard settings component**

## Performance

- **Duration:** 9 min
- **Started:** 2026-02-28T13:19:18Z
- **Completed:** 2026-02-28T13:28:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- GET /api/auth/dropbox/connect generates Dropbox authorization URL with token_access_type='offline' (4th arg), stores UUID CSRF state in organisations.dropbox_oauth_state, redirects to consent screen
- GET /api/auth/dropbox/callback validates DB-based CSRF state, exchanges code for tokens, enforces DRPBX-01 (rejects immediately if refresh_token absent), persists encrypted tokens via encryptToken(), sets storage_backend='dropbox', storage_backend_status='active', clears CSRF state
- disconnectDropbox server action with admin-only guard, clears all 3 Dropbox token columns, resets storage_backend to 'supabase', revalidatePath
- DropboxConnectCard client component with connect/disconnect UI, reauth_required warning, loading state via useTransition, inline error display, router.refresh() on successful disconnect

## Task Commits

Each task was committed atomically:

1. **Task 1: Create OAuth2 connect and callback route handlers** - `5b40f9f` (feat)
2. **Task 2: Add disconnectDropbox server action and create DropboxConnectCard component** - `653f295` (feat)

## Files Created/Modified
- `app/api/auth/dropbox/connect/route.ts` - GET handler: auth check, CSRF state generation, DB storage, lazy DropboxAuth, getAuthenticationUrl with 'offline', redirect
- `app/api/auth/dropbox/callback/route.ts` - GET handler: auth check, DB-based CSRF validation, lazy DropboxAuth, token exchange, DRPBX-01 refresh_token guard, encryptToken for both tokens, DB update, success redirect
- `app/actions/settings.ts` - Added disconnectDropbox server action (admin-only guard via getOrgContext), added getOrgContext import
- `app/(dashboard)/settings/components/dropbox-connect-card.tsx` - DropboxConnectCard with connect/disconnect UI, reauth warning, loading state, inline error display

## Decisions Made
- DB-based CSRF state (organisations.dropbox_oauth_state column) vs cookie — plan required DB approach for Dropbox; differs from Google Drive's HttpOnly cookie approach
- disconnectDropbox uses getOrgContext() for admin role guard — plan spec; Google Drive's disconnectGoogleDrive omitted this check historically
- Error display is inline text below the disconnect button — consistent with existing settings card patterns; no toast library needed

## Deviations from Plan

None - plan executed exactly as written.

The DropboxConnectCard was already partially scaffolded (likely by the linter/autocomplete), but the file was incomplete — it was fully written to match plan spec including the error state display for disconnect failures.

## Issues Encountered
- Build lock file conflict during verification (`⨯ Unable to acquire lock at .next/lock`) — resolved by removing the stale lock file. TypeScript type-check (`npx tsc --noEmit`) confirmed zero errors independently.

## User Setup Required
None - no new external service configuration required beyond what Plan 01 established (DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_REDIRECT_URI env vars).

The DROPBOX_REDIRECT_URI must be set to `{NEXT_PUBLIC_APP_URL}/api/auth/dropbox/callback` in both Vercel and Dropbox App Console.

## Next Phase Readiness
- Dropbox OAuth2 flow (connect and disconnect) is fully implemented
- DropboxConnectCard is ready to be wired into the Settings Storage tab in Phase 28
- Plan 27-03 (DropboxProvider upload/download implementation) can proceed — auth routes are complete

## Self-Check: PASSED

- FOUND: app/api/auth/dropbox/connect/route.ts
- FOUND: app/api/auth/dropbox/callback/route.ts
- FOUND: app/(dashboard)/settings/components/dropbox-connect-card.tsx
- FOUND: app/actions/settings.ts (disconnectDropbox exported)
- FOUND: commit 5b40f9f (Task 1)
- FOUND: commit 653f295 (Task 2)
- Build: compiled successfully in ~32s, zero TypeScript errors

---
*Phase: 27-dropbox-integration*
*Completed: 2026-02-28*
