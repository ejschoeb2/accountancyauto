---
phase: 10-org-data-model-rls-foundation
plan: 05
title: "Verification & Activation"
subsystem: multi-tenancy
tags: [multi-tenancy, rls, jwt-hook, verification, isolation]
completed: 2026-02-20

dependency-graph:
  requires: ["10-01", "10-02", "10-03", "10-04"]
  provides:
    - "JWT Custom Access Token Hook verified and firing"
    - "RLS isolation confirmed between two orgs"
    - "Test org seeded for isolation verification"
    - "Sign-out card on settings page"
  affects: ["11-01"]

tech-stack:
  added: []
  patterns:
    - "supabase_auth_admin needs explicit RLS policy on tables it reads (grants alone are insufficient)"
    - "Supabase auth hooks must be enabled in Dashboard — cannot be automated via SQL"

key-files:
  created:
    - supabase/migrations/20260219000008_seed_test_org.sql
    - supabase/migrations/20260220220355_add_auth_admin_policy_for_jwt_hook.sql
    - app/(dashboard)/settings/components/sign-out-card.tsx
  modified:
    - app/(dashboard)/settings/page.tsx

decisions:
  - id: D-10-05-01
    decision: "Added RLS policy for supabase_auth_admin on user_organisations"
    context: "JWT hook runs as supabase_auth_admin; SELECT grant alone doesn't bypass RLS — query silently returned zero rows, causing hook to skip injecting claims"
  - id: D-10-05-02
    decision: "Demo user linked to Acme test org (not Prompt)"
    context: "Demo account should show test data; Prompt reserved for real account sign-in (phases 12/13)"
  - id: D-10-05-03
    decision: "Sign-out card added to settings page"
    context: "Provides accessible logout without needing to manually navigate to /auth/signout"

metrics:
  duration: "~20 min"
  tasks-completed: 2
  files-created: 3
  files-modified: 1
  lines-added: ~70
---

# Phase 10 Plan 05: Verification & Activation Summary

**One-liner:** JWT hook bug fixed (missing RLS policy for supabase_auth_admin), RLS isolation verified with two orgs, demo user linked to test org, sign-out card added to settings.

## What Was Done

### Task 1: Seed test org for isolation verification

Created migration `20260219000008_seed_test_org.sql` that seeds:
- Acme Accounting (Test) org with slug `acme-test`, plan tier `practice`
- One test client (`Acme Test Client`) in the test org
- A distinct `reminder_send_hour = '10'` app_setting (Prompt uses `9`)

Includes commented SQL isolation test queries for manual verification.

**Commit:** 0ca5b51

### Task 2: Fix JWT hook + verify isolation

**Bug found:** The Custom Access Token Hook was deployed and enabled in the Supabase Dashboard, but wasn't injecting `org_id`/`org_role` into JWTs. Root cause: RLS on `user_organisations` blocked `supabase_auth_admin` from reading rows — the SELECT grant alone is not enough when RLS is enabled; an explicit RLS policy is required.

**Fix:** Created migration `20260220220355_add_auth_admin_policy_for_jwt_hook.sql` adding:
```sql
CREATE POLICY "Allow auth admin to read user_organisations"
  ON public.user_organisations FOR SELECT TO supabase_auth_admin USING (true);
```

After the fix, JWT correctly contains `app_metadata.org_id` and `app_metadata.org_role`.

**Additional fixes:**
- Re-linked demo user to Acme test org (removed incorrect Prompt link)
- Added sign-out card component to settings page for accessible logout

**Verification results:**
- JWT decoded at jwt.io shows `org_id` and `org_role` in `app_metadata`
- Dashboard shows only the logged-in org's data (Acme test client, 10am send hour)
- RLS isolation confirmed: orgs cannot see each other's data

## Deviations from Plan

### Critical Bug Fix

**1. [Rule 2 - Critical] supabase_auth_admin needs RLS policy, not just SELECT grant**

- **Found during:** Task 2 verification
- **Issue:** The JWT hook function worked when called directly (as service_role) but Supabase Auth calls it as `supabase_auth_admin`. While GRANT SELECT was given, RLS policies only existed for `authenticated` and `service_role` — `supabase_auth_admin` saw zero rows
- **Fix:** Added permissive SELECT policy for `supabase_auth_admin` on `user_organisations`
- **Migration:** `20260220220355_add_auth_admin_policy_for_jwt_hook.sql`

### Additional Work (Not in Plan)

**2. Demo user org reassignment**
- Demo user was incorrectly linked to both orgs with Acme having earlier `created_at`
- Removed Prompt link, kept only Acme — demo shows test data, Prompt reserved for real accounts

**3. Sign-out card on settings page**
- User requested accessible logout without navigating to `/auth/signout`
- Created `sign-out-card.tsx` component, added to settings page

## Phase 10 Success Criteria — Final Status

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | organisations row exists; all data has org_id set, no NULLs | PASS | Migration 10-01 backfilled all rows; validated in 10-01 SUMMARY |
| 2 | JWT contains org_id and org_role in app_metadata | PASS | Decoded JWT at jwt.io confirms claims after hook fix |
| 3 | SELECT * FROM clients returns only user's org's clients | PASS | Dashboard shows only Acme test client when logged in as demo |
| 4 | Cron jobs process each org independently | PASS | Cron refactored in 10-03 to iterate orgs with org-scoped queries |
| 5 | app_settings rejects duplicate (org_id, key) | PASS | UNIQUE constraint created in 10-01; tested in verification |

## Self-Check: PASSED
