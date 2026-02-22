---
phase: quick-5
plan: 1
subsystem: multi-tenant-data-isolation
tags: [rls, owner-scoping, billing, admin-ui]
dependency_graph:
  requires:
    - 10-02 (auth_org_id JWT helper, org-scoped RLS foundation)
    - 10-04 (getOrgContext, getOrgId server helpers)
    - 13-04 (team management, admin role enforcement)
  provides:
    - Owner-scoped client isolation (members see only own clients)
    - Admin full-org client visibility
    - Per-accountant client distribution overview
    - Client reassignment between accountants
  affects:
    - All client queries (now filtered by owner_id for members)
    - Stripe webhook provisioning (user_count_limit removed)
    - Trial setup (user_count_limit removed)
    - Team invites (seat limit check removed)
tech_stack:
  added: []
  patterns:
    - auth_org_role() PostgreSQL helper from JWT claims (mirrors auth_org_id())
    - Split permissive RLS policies (admin + member, OR'd by PostgreSQL)
    - useTransition for reassign action with router.refresh() for count updates
    - service_role client to bypass owner-scoped RLS in reassignClients
key_files:
  created:
    - supabase/migrations/20260222000001_add_owner_id_and_drop_user_count_limit.sql
    - supabase/migrations/20260222000002_rewrite_clients_rls_with_owner_scoping.sql
    - app/(dashboard)/settings/components/accountant-overview-card.tsx
  modified:
    - lib/stripe/plans.ts
    - lib/stripe/webhook-handlers.ts
    - lib/billing/trial.ts
    - app/api/clients/route.ts
    - app/actions/clients.ts
    - app/actions/team.ts
    - app/(dashboard)/billing/page.tsx
    - app/(dashboard)/billing/components/usage-bars.tsx
    - app/(dashboard)/admin/page.tsx
    - app/(dashboard)/admin/[slug]/page.tsx
    - app/(dashboard)/admin/components/org-table.tsx
    - app/(dashboard)/settings/page.tsx
    - app/pricing/page.tsx
    - app/(auth)/onboarding/page.tsx
    - PRICING.md
decisions:
  - auth_org_role() defaults to 'member' on missing JWT claim — restricts access safely
  - Split permissive policies (admin + member) rather than single policy with OR — cleaner and matches PostgreSQL's OR semantics for permissive policies
  - INSERT policy requires owner_id = auth.uid() for all roles — admins reassign via service_role reassignClients action
  - reassignClients uses service_role client to bypass RLS — correct since owner-scoped RLS would block cross-account updates
  - Backfill assigns existing clients to oldest admin in org — safe default for existing single-user orgs
  - AccountantOverviewCard placed between TeamCard and InboundCheckerCard in settings
  - Reassign dropdown hidden when org has only one accountant (no reassignment targets)
metrics:
  duration: "~25 min"
  completed: "2026-02-22"
  tasks_completed: 3
  files_changed: 15
---

# Quick Task 5: Accountant-Scoped Client Isolation and Seat Limit Removal

## One-liner

Owner-scoped RLS for accountant client isolation with auth_org_role() JWT helper, user seat limit removal from all plans, and admin overview card with client reassignment.

## What Was Built

### Task 1: Database migrations

Two migration files establish the data foundation:

**`20260222000001_add_owner_id_and_drop_user_count_limit.sql`**
- Adds `owner_id UUID REFERENCES auth.users(id) NOT NULL` to the `clients` table
- Backfills existing clients to the oldest admin of their org (safe for current single-user orgs)
- Creates `idx_clients_owner_id` index for efficient owner-scoped queries
- Drops `user_count_limit` column from `organisations`

**`20260222000002_rewrite_clients_rls_with_owner_scoping.sql`**
- Creates `auth_org_role()` helper function that reads `org_role` from JWT `app_metadata` (defaults to `'member'`)
- Drops old `clients_select/insert/update/delete_org` policies (org-scoped only)
- Creates split permissive policies:
  - `clients_select_admin` / `clients_select_member` — PostgreSQL OR's them
  - `clients_insert_org` — both roles insert with `owner_id = auth.uid()`
  - `clients_update_admin` / `clients_update_member`
  - `clients_delete_admin` / `clients_delete_member`
- Service role policy unchanged (cron/webhooks still have full access)
- Validation DO block confirms new policies exist and old ones are gone

### Task 2: Remove user seat limits from application code

- **`lib/stripe/plans.ts`**: Removed `userLimit` from `PlanConfig` interface and all four `PLAN_TIERS` entries. Updated `getPlanLimits()` to return only `{ clientLimit }`.
- **`lib/stripe/webhook-handlers.ts`**: Removed `user_count_limit: plan.userLimit` from `handleCheckoutSessionCompleted` and `handleSubscriptionUpdated` payloads.
- **`lib/billing/trial.ts`**: Removed `TRIAL_USER_LIMIT` constant and `user_count_limit` from `createTrialForOrg` update payload.
- **`app/api/clients/route.ts`**: Added session lookup to get `userId`, added `owner_id: userId` to client INSERT payload, returns 401 if no session.
- **`app/actions/team.ts`**: Removed `activeCount` query, `pendingCount` query, `user_count_limit` from org select, and the seat limit conditional from `sendInvite()`. Org select now only fetches `name`.
- **`app/(dashboard)/billing/page.tsx`**: Removed `user_count_limit` from org select, removed `userCount` query, removed `userCount`/`userLimit` props from `UsageBars`.
- **`app/(dashboard)/billing/components/usage-bars.tsx`**: Removed `userCount`/`userLimit` from props interface, removed "Team members" `UsageBarItem`.
- **`app/(dashboard)/admin/page.tsx`**: Removed `user_count_limit` from org select.
- **`app/(dashboard)/admin/[slug]/page.tsx`**: Removed `user_count_limit` from org select, removed "User Limit" dt/dd block from settings card.
- **`app/(dashboard)/admin/components/org-table.tsx`**: Removed `user_count_limit` from `OrgRow` interface.
- **`app/pricing/page.tsx`**: Removed `{formatLimit(plan.userLimit, "users")}` from `CardDescription`.
- **`app/(auth)/onboarding/page.tsx`**: Removed the user limit `<p>` display block from plan cards.
- **`PRICING.md`**: Rewrote to reflect client-only billing axis. Removed Users rows from tier tables, removed "Secondary axis: user seats" paragraph, removed "Additional users" feature availability row, removed `user_count_limit` from schema section.

### Task 3: Admin overview with per-accountant stats and reassignment

**`app/(dashboard)/settings/components/accountant-overview-card.tsx`** (new client component):
- Shows "Accountant Overview" card with summary row (accountant count, total clients vs limit)
- Table with Name/Email, Role badge, Clients count, and optional Reassign column
- Reassign column hidden when only one accountant (no targets)
- Reassign dropdown (DropdownMenu from DESIGN.md) lists all other accountants as targets
- Calls `reassignClients(fromUserId, toUserId)` on selection
- Uses `useTransition` for pending state; calls `router.refresh()` after success to update counts
- Error and success feedback messages with 4s auto-clear for success

**`app/actions/clients.ts`** — added `reassignClients` server action:
- Validates caller is admin via `getOrgContext()`
- Calls `requireWriteAccess(orgId)` to enforce billing read-only mode
- Validates both `fromUserId` and `toUserId` belong to the caller's org via admin client
- Uses admin client (service_role) to `UPDATE clients SET owner_id = toUserId` — bypasses owner-scoped RLS
- Returns `{ reassigned: count }` or `{ error: string }`

**`app/(dashboard)/settings/page.tsx`** (updated):
- Imports `AccountantOverviewCard` and `AccountantStats`
- Fetches `user_organisations`, all `clients.owner_id`, and `organisations.client_count_limit` via admin client in parallel with existing settings fetches
- Builds `countMap` from client rows, resolves emails via auth admin API
- Sorts accountants: admins first, then by client count descending
- Renders `AccountantOverviewCard` between `TeamCard` and `InboundCheckerCard`

## Success Criteria Verification

- Members see only their own clients: confirmed by `clients_select_member` RLS policy (`owner_id = auth.uid()`)
- Admins see all org clients: confirmed by `clients_select_admin` RLS policy (org_id only)
- New clients have owner_id set to creating user: confirmed in `POST /api/clients` route
- `user_count_limit` column removed from organisations: confirmed in migration 1
- No seat limit enforcement anywhere: grep confirms zero matches for `user_count_limit|userLimit|TRIAL_USER_LIMIT` in `lib/` and `app/`
- Admin settings shows per-accountant client breakdown: `AccountantOverviewCard` in settings page
- Admin can reassign clients: `reassignClients` action with dropdown UI
- PRICING.md reflects client-only billing axis: rewritten to remove all user seat references
- TypeScript compiles with no errors: `npx tsc --noEmit` passes clean

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Hash | Description |
|------|-------------|
| fa9d7f5 | feat(quick-5): add owner_id to clients, rewrite clients RLS with owner scoping |
| 77c1de7 | feat(quick-5): remove user seat limits, add owner_id to client creation |
| dbd7884 | feat(quick-5): add accountant overview card and client reassignment action |

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `supabase/migrations/20260222000001_add_owner_id_and_drop_user_count_limit.sql` | FOUND |
| `supabase/migrations/20260222000002_rewrite_clients_rls_with_owner_scoping.sql` | FOUND |
| `app/(dashboard)/settings/components/accountant-overview-card.tsx` | FOUND |
| Commit fa9d7f5 (Task 1) | FOUND |
| Commit 77c1de7 (Task 2) | FOUND |
| Commit dbd7884 (Task 3) | FOUND |
