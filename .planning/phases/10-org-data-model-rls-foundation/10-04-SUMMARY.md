---
phase: 10-org-data-model-rls-foundation
plan: 04
title: "Server Action & API Route Org Scoping"
subsystem: server-actions
tags: [multi-tenancy, org-id, server-actions, api-routes, rls]
completed: 2026-02-19

dependency-graph:
  requires: ["10-01", "10-02", "10-03"]
  provides:
    - "Org context helper (getOrgId, getOrgContext)"
    - "All server actions work with org-scoped schema"
    - "All API route INSERT/upsert operations include org_id"
    - "app_settings queries filter by org_id"
  affects: ["10-05"]

tech-stack:
  added: []
  patterns:
    - "getOrgId() extracts org_id from JWT app_metadata for server actions"
    - "INSERT operations explicitly include org_id (RLS validates but doesn't auto-set)"
    - "app_settings upserts use onConflict: 'org_id,key' instead of 'key'"
    - "Webhook routes resolve org_id from matched client or founding org fallback"

key-files:
  created:
    - lib/auth/org-context.ts
  modified:
    - lib/supabase/middleware.ts
    - app/actions/settings.ts
    - app/actions/send-adhoc-email.ts
    - app/api/clients/route.ts
    - app/api/email-templates/route.ts
    - app/api/schedules/route.ts
    - app/api/schedules/[id]/route.ts
    - app/api/schedules/[id]/exclusions/route.ts
    - app/api/clients/[id]/filings/route.ts
    - app/api/clients/[id]/filing-status/route.ts
    - app/api/clients/bulk-status-update/route.ts
    - app/api/postmark/inbound/route.ts

decisions:
  - id: D-10-04-01
    decision: "getOrgId() uses supabase.auth.getUser() to extract org_id from app_metadata"
    context: "Server actions run in user session context; JWT claims carry org_id set by auth hook"
  - id: D-10-04-02
    decision: "API routes with INSERT/upsert also updated (not just server actions)"
    context: "All 15 data tables have org_id NOT NULL; any INSERT without org_id would fail"
  - id: D-10-04-03
    decision: "Postmark inbound webhook resolves org_id from matched client, falls back to founding org"
    context: "Webhook has no user session; Phase 12 will resolve org from Postmark server token"
  - id: D-10-04-04
    decision: "Server actions with only SELECT/UPDATE/DELETE operations unchanged (RLS handles filtering)"
    context: "clients.ts, email-queue.ts, audit-log.ts, inbound-emails.ts, csv.ts need no changes for reads/updates"

metrics:
  duration: "~8 min"
  tasks-completed: 2
  files-created: 1
  files-modified: 12
  lines-added: ~81
---

# Phase 10 Plan 04: Server Action & API Route Org Scoping Summary

**One-liner:** Org context helper extracts org_id from JWT; all settings queries, INSERT/upsert operations across 12 files now include org_id for multi-tenant correctness.

## What Was Done

### Task 1: Create org context helper and update middleware

Created `lib/auth/org-context.ts` with two exported functions:
- `getOrgId()` — extracts org_id from user's JWT app_metadata; throws if not authenticated or missing org
- `getOrgContext()` — returns both orgId and orgRole (defaults role to 'member')

Added Phase 12 comment to middleware noting future subdomain-based org resolution.

**Commit:** 53942be

### Task 2: Update server actions and API routes for org-scoped operations

**settings.ts (10 functions updated):**
All reads now filter with `.eq('org_id', orgId)`. All writes use `upsert({ org_id, key, value }, { onConflict: 'org_id,key' })`. Previous `.update()` calls changed to `.upsert()` for consistency with the new composite unique constraint.

**send-adhoc-email.ts:**
Added `org_id: orgId` to the `email_log` INSERT payload.

**API routes (9 routes updated):**
Every route that performs INSERT or upsert operations now includes `org_id` in the payload. Routes that only do SELECT/UPDATE/DELETE are unchanged (RLS handles filtering automatically).

**Postmark inbound webhook:**
Resolves org_id from the matched client's org_id field. Falls back to the founding org ('peninsula') when no client matches the sender email. Phase 12 will improve this with Postmark server token-based org resolution.

**Commit:** 5ac4bbf

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] API routes also need org_id in INSERT/upsert operations**

- **Found during:** Task 2
- **Issue:** The plan only listed server action files, but 9 API routes also have INSERT/upsert operations that would fail with NOT NULL constraint violations after the org_id migration
- **Fix:** Updated all API routes with INSERT/upsert operations to include org_id
- **Files modified:** 9 additional API route files beyond the plan
- **Commit:** 5ac4bbf

## Task Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create org context helper and update middleware | 53942be | lib/auth/org-context.ts, lib/supabase/middleware.ts |
| 2 | Update server actions and API routes for org-scoped operations | 5ac4bbf | app/actions/settings.ts, + 10 more files |

## Decisions Made

| ID | Decision | Context |
|----|----------|---------|
| D-10-04-01 | getOrgId() uses supabase.auth.getUser() to extract org_id from app_metadata | Server actions run in user session context |
| D-10-04-02 | API routes with INSERT/upsert also updated (not just server actions) | All 15 data tables have org_id NOT NULL |
| D-10-04-03 | Postmark inbound webhook resolves org_id from matched client, falls back to founding org | Webhook has no user session |
| D-10-04-04 | Server actions with only SELECT/UPDATE/DELETE unchanged (RLS handles filtering) | 5 action files need no changes |

## Files Not Changed (and why)

- **app/actions/clients.ts** — Only SELECT, UPDATE (via .update), RPC, DELETE ops. All covered by RLS.
- **app/actions/email-queue.ts** — Only SELECT and UPDATE on reminder_queue. RLS handles it.
- **app/actions/audit-log.ts** — Only SELECT queries across email_log, clients, reminder_queue. RLS handles it.
- **app/actions/inbound-emails.ts** — Only SELECT and UPDATE on inbound_emails. RLS handles it.
- **app/actions/csv.ts** — Uses RPC (bulk_update_client_metadata) which runs under RLS. No INSERT.
- **app/actions/send-reply-email.ts** — No database operations at all; just renders email and sends via Postmark.

## Next Phase Readiness

Plan 10-05 (verification and activation) can proceed. All code paths now include org_id where needed:
- Server actions: settings reads/writes, ad-hoc email logging
- API routes: client creation, template creation, schedule/step creation, filing assignments, status overrides, inbound emails
- Cron jobs: already handled in Plan 10-03
- RLS policies: already created in Plan 10-02

**Remaining concern:** The JWT auth hook must be enabled in the Supabase Dashboard before any of these changes can be tested with real data. Without the hook, `getOrgId()` will throw "No org_id in user session" for all operations.

## Self-Check: PASSED
