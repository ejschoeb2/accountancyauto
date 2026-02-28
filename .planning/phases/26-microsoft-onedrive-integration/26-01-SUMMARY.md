---
phase: 26-microsoft-onedrive-integration
plan: "01"
subsystem: storage
tags: [msal, onedrive, oauth2, token-cache, migration]
dependency_graph:
  requires:
    - lib/crypto/tokens.ts (encryptToken/decryptToken — AES-256-GCM)
    - lib/supabase/admin.ts (createAdminClient — service role DB access)
    - organisations table (ms_token_cache_enc column — Phase 24)
  provides:
    - lib/storage/msal-cache-plugin.ts (PostgresMsalCachePlugin implementing ICachePlugin)
    - @azure/msal-node npm package
    - organisations.ms_home_account_id column
  affects:
    - lib/storage/onedrive.ts (Wave 2 — imports PostgresMsalCachePlugin)
    - app/api/auth/onedrive/ routes (Wave 3 — uses MSAL with cache plugin)
tech_stack:
  added:
    - "@azure/msal-node@5.0.5"
  patterns:
    - ICachePlugin interface for MSAL token persistence
    - Encrypted blob pattern — entire cache serialized and encrypted as single unit
    - Lazy admin client creation per method call (no module-level state)
key_files:
  created:
    - lib/storage/msal-cache-plugin.ts
    - supabase/migrations/20260228131000_add_ms_home_account_id.sql
  modified:
    - ENV_VARIABLES.md (Microsoft OneDrive Integration Variables section)
    - package.json (already contained @azure/msal-node from Phase 27 pre-execution)
decisions:
  - "@azure/msal-node@^5.0.5 chosen over @azure/msal-browser (browser-only, crashes in Node.js serverless)"
  - "Entire MSAL cache serialized and encrypted as a single blob — individual token encryption would require MSAL internals access"
  - "Each method creates its own admin client (stateless between calls) — mirrors D-11-05-01 Stripe lazy-init pattern"
  - "console.error on DB failure in beforeCacheAccess/afterCacheAccess — MSAL starts with empty cache on load failure; write failure is non-fatal for current session"
  - "cacheHasChanged guard in afterCacheAccess prevents unnecessary DB writes on read-only token operations"
metrics:
  duration: "~25 minutes"
  completed_date: "2026-02-28"
  tasks_completed: 3
  files_created: 2
  files_modified: 1
---

# Phase 26 Plan 01: MSAL Foundation — Package, Schema, Cache Plugin, Env Docs Summary

**One-liner:** PostgresMsalCachePlugin implementing ICachePlugin with AES-256-GCM encrypted Postgres persistence for MSAL OneDrive token cache.

## What Was Built

### Task 1: Install @azure/msal-node and apply schema migration

- Verified `@azure/msal-node@5.0.5` is installed and importable (was already in package.json from Phase 27 pre-execution)
- Created migration `20260228131000_add_ms_home_account_id.sql` adding `ms_home_account_id TEXT DEFAULT NULL` to the `organisations` table
- Applied migration via `supabase db push --include-all` after repairing migration history mismatch on `20260210`
- Verified column exists via PostgREST query: `[{"ms_home_account_id":null}]`

**Commit:** `a1ee835` — `feat(26-01): install @azure/msal-node and add ms_home_account_id column`

### Task 2: Create lib/storage/msal-cache-plugin.ts

Implemented `PostgresMsalCachePlugin` class implementing `ICachePlugin` from `@azure/msal-node`:

- `beforeCacheAccess`: SELECTs `ms_token_cache_enc` from `organisations`, decrypts with `decryptToken()`, deserializes into MSAL memory with `tokenCache.deserialize()`
- `afterCacheAccess`: Guards on `cacheHasChanged`, serializes MSAL cache, encrypts with `encryptToken()`, UPDATEs `organisations.ms_token_cache_enc`
- Constructor takes `orgId: string` — one instance per org per request
- DB failures logged but not thrown — MSAL starts empty on load failure; write failure is non-fatal for current session
- TypeScript check: zero errors

**Commit:** `3526f26` — `feat(26-01): create PostgresMsalCachePlugin for MSAL token cache persistence`

### Task 3: Document Microsoft OneDrive env vars in ENV_VARIABLES.md

Added "Microsoft OneDrive Integration Variables" section documenting:
- `MS_CLIENT_ID` — Azure app registration UUID, source, required-for routes, note on `/common` authority for M365 + personal accounts
- `MS_CLIENT_SECRET` — client secret, format, expiry rotation warning, AADSTS7000222 error on expiry
- `MS_REDIRECT_URI` — OAuth2 callback URL, exact-match requirement, local dev setup with multiple redirect URIs

Section placed before the Dropbox Integration Variables section (Dropbox section was already present from Phase 27 pre-execution).

**Commit:** `99aab2b` — `feat(26-01): document Microsoft OneDrive env vars in ENV_VARIABLES.md`

## Verification Results

| Check | Result |
|-------|--------|
| `@azure/msal-node` importable | PASS — `typeof ConfidentialClientApplication === 'function'` |
| `organisations.ms_home_account_id` column | PASS — PostgREST returns `[{"ms_home_account_id":null}]` |
| `lib/storage/msal-cache-plugin.ts` exports `PostgresMsalCachePlugin` | PASS |
| TypeScript: zero errors | PASS |
| `npm run build` | PASS |
| `ENV_VARIABLES.md` contains MS_CLIENT_ID, MS_CLIENT_SECRET, MS_REDIRECT_URI | PASS — 7 occurrences |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Migration history mismatch blocked supabase db push**

- **Found during:** Task 1
- **Issue:** Remote database had migration version `20260210` (applied via Dashboard) that showed as mismatched with local `20260210_add_schedule_send_hour.sql`. The `db push` command also blocked on duplicate migration timestamp when our initial migration file shared timestamp `20260228130000` with the already-applied Dropbox migration.
- **Fix:** Renamed migration from `20260228130000_add_ms_home_account_id.sql` to `20260228131000_add_ms_home_account_id.sql`. Repaired migration history via `supabase migration repair --status reverted 20260210` to allow `--include-all` flag to work, which applied both `20260210_add_schedule_send_hour.sql` (idempotently, with `NOTICE` skipping existing column) and `20260228131000_add_ms_home_account_id.sql` successfully.
- **Files modified:** `supabase/migrations/` (renamed)

**2. [Observation] Phase 27 was executed before Phase 26**

- **Found during:** Task 1 (package.json) and Task 3 (ENV_VARIABLES.md already had Dropbox section)
- **Issue:** The git log shows Phase 27 (Dropbox) plans were committed before Phase 26 (OneDrive). As a result, `@azure/msal-node` was already in package.json (committed in `3305156`), and ENV_VARIABLES.md already contained the Dropbox section.
- **Impact:** No code changes needed for package.json. ENV_VARIABLES.md addition was placed before the existing Dropbox section. No correctness impact.

## Self-Check

**Files:**
- [x] `lib/storage/msal-cache-plugin.ts` — FOUND
- [x] `supabase/migrations/20260228131000_add_ms_home_account_id.sql` — FOUND

**Commits:**
- [x] `a1ee835` — FOUND
- [x] `3526f26` — FOUND
- [x] `99aab2b` — FOUND

## Self-Check: PASSED
