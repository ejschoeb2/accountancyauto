---
phase: 25-google-drive-integration
plan: "01"
subsystem: storage
tags: [google-drive, oauth2, token-refresh, typescript, schema-migration, npm]
dependency_graph:
  requires: [24-01, 24-03]
  provides: [withTokenRefresh utility, GoogleCredentials interface, @googleapis/drive package, google_drive_folder_id column, google_token_expires_at column]
  affects: [lib/storage/token-refresh.ts, ENV_VARIABLES.md, organisations table]
tech_stack:
  added: ["@googleapis/drive@^20.1.0 (scoped package ~2.3 MB, avoids 199 MB full googleapis)"]
  patterns: [lazy-oauth2-init, proactive-token-refresh, invalid-grant-nullification, aes-256-gcm-encryption]
key_files:
  created:
    - lib/storage/token-refresh.ts
    - supabase/migrations/20260228120924_add_google_drive_folder_columns.sql
  modified:
    - package.json
    - package-lock.json
    - ENV_VARIABLES.md
decisions:
  - "[D-25-01-01] Use auth.OAuth2 (named export from @googleapis/drive) not google.auth.OAuth2 — google is not a named export; auth is the correct AuthPlus instance providing OAuth2 constructor"
  - "[D-25-01-02] OAuth2Client construction is lazy (inside withTokenRefresh, not at module scope) — mirrors D-11-05-01 Stripe pattern; prevents build failures when Google env vars absent"
  - "[D-25-01-03] invalid_grant detection checks err.response.data.error AND err.message string — covers both google-auth-library response error format and edge-case string messages"
metrics:
  duration: "~9 minutes"
  completed: "2026-02-28"
  tasks_completed: 3
  files_changed: 5
  commits: 3
---

# Phase 25 Plan 01: Google Drive Foundation Summary

**One-liner:** @googleapis/drive installed, schema columns added, withTokenRefresh utility with proactive 5-minute refresh window and invalid_grant DB nullification — foundation for all Phase 25 Drive API calls.

## What Was Built

### 1. @googleapis/drive installed

`@googleapis/drive@^20.1.0` (scoped package, ~2.3 MB) added to package.json. This is the locked decision from STATE.md v5.0: the full `googleapis` package is 199 MB and risks Vercel's 250 MB function size limit. `google-auth-library` was installed automatically as a peer dependency.

### 2. Schema migration applied

Migration `20260228120924_add_google_drive_folder_columns.sql` applied to the remote Supabase database. Two new columns on `organisations`:
- `google_drive_folder_id TEXT DEFAULT NULL` — stores the Drive file ID of the `Prompt/` root folder created during the first OAuth connect
- `google_token_expires_at TIMESTAMPTZ DEFAULT NULL` — ISO timestamp used by withTokenRefresh to detect tokens expiring within 5 minutes

### 3. lib/storage/token-refresh.ts

The sole token refresh module for Google Drive. Every Drive API call in Phase 25 routes through `withTokenRefresh()`.

**Exports:**
- `GoogleCredentials` interface — encrypted credential bundle (`access_token_enc`, `refresh_token_enc`, `expires_at`, `org_id`)
- `withTokenRefresh<T>(creds, call)` — generic wrapper that:
  1. Constructs OAuth2Client lazily from env vars (prevents build failures)
  2. Checks if token expires within 5 minutes — triggers proactive refresh if so
  3. On successful refresh: persists new access token + expiry to `organisations` via admin client
  4. On `invalid_grant`: sets `storage_backend_status = 'reauth_required'`, nulls all three Google token columns, re-throws
  5. Executes `call(oauth2Client)` — catches `invalid_grant` at call-time too (token revoked mid-flight)

### 4. ENV_VARIABLES.md updated

New "Google Drive Integration Variables" section added after the Cryptography Variables section. Documents `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` with format, source (GCP Console paths), required-for lists, environment (prod/dev differences), and security notes.

## Verification Results

- `node -e "require('@googleapis/drive'); console.log('ok')"` — passes
- `npx tsc --noEmit` — zero TypeScript errors
- `npm run build` — passes with zero errors (workspace root warning unrelated to this plan)
- Migration applied: both columns visible in Supabase schema after `db push`
- ENV_VARIABLES.md: 8 occurrences of GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI across section headers, code blocks, and descriptions

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Import path correction: auth.OAuth2 not google.auth.OAuth2**
- **Found during:** Task 2 (implementation)
- **Issue:** The plan's import `import { google } from '@googleapis/drive'` is incorrect — `google` is not a named export from `@googleapis/drive`. Verified with `node -e "Object.keys(require('@googleapis/drive'))"` which returns `['VERSIONS', 'auth', 'drive_v2', 'drive_v3', 'AuthPlus', 'drive']`. The correct export is `auth` (an `AuthPlus` instance).
- **Fix:** Changed import to `import { auth } from '@googleapis/drive'` and OAuth2Client construction to `new auth.OAuth2(...)`. TypeScript type confirmed: `AuthPlus.OAuth2` is typed as `typeof OAuth2Client` from `google-auth-library`.
- **Files modified:** `lib/storage/token-refresh.ts`
- **Commit:** 7ebaf84

## Commits

| Hash | Message |
|------|---------|
| dd308d0 | chore(25-01): install @googleapis/drive and add google Drive schema columns |
| 7ebaf84 | feat(25-01): create lib/storage/token-refresh.ts with withTokenRefresh utility |
| 295a9c3 | docs(25-01): document Google Drive OAuth2 env vars in ENV_VARIABLES.md |

## Self-Check: PASSED
