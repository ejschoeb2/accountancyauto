---
phase: quick-5
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/20260222000001_add_owner_id_and_drop_user_count_limit.sql
  - supabase/migrations/20260222000002_rewrite_clients_rls_with_owner_scoping.sql
  - lib/stripe/plans.ts
  - lib/stripe/webhook-handlers.ts
  - lib/billing/trial.ts
  - lib/billing/usage-limits.ts
  - app/api/clients/route.ts
  - app/actions/clients.ts
  - app/actions/team.ts
  - app/actions/csv.ts
  - app/(dashboard)/billing/page.tsx
  - app/(dashboard)/billing/components/usage-bars.tsx
  - app/(dashboard)/admin/page.tsx
  - app/(dashboard)/admin/[slug]/page.tsx
  - app/(dashboard)/admin/components/org-table.tsx
  - app/(dashboard)/settings/page.tsx
  - app/pricing/page.tsx
  - app/(auth)/onboarding/page.tsx
  - PRICING.md
autonomous: true
requirements: []

must_haves:
  truths:
    - "Members see only clients where owner_id matches their auth.uid()"
    - "Admins see all clients within their org (org_id scoping only)"
    - "New clients auto-assign owner_id to the creating user"
    - "No user seat limits exist anywhere in the system"
    - "Admins can see per-accountant client breakdown"
    - "Admins can reassign clients from one accountant to another"
  artifacts:
    - path: "supabase/migrations/20260222000001_add_owner_id_and_drop_user_count_limit.sql"
      provides: "owner_id column on clients, drop user_count_limit from organisations"
      contains: "owner_id"
    - path: "supabase/migrations/20260222000002_rewrite_clients_rls_with_owner_scoping.sql"
      provides: "RLS policies scoping member SELECT/UPDATE/DELETE to owner_id"
      contains: "auth.uid()"
    - path: "app/(dashboard)/settings/page.tsx"
      provides: "Admin overview card with per-accountant client counts"
    - path: "app/actions/clients.ts"
      provides: "reassignClients server action"
  key_links:
    - from: "supabase/migrations/20260222000002_rewrite_clients_rls_with_owner_scoping.sql"
      to: "supabase/migrations/20260219000004_create_jwt_hook.sql"
      via: "auth_org_id() and JWT org_role claim"
      pattern: "auth_org_id\\(\\)|org_role"
    - from: "app/api/clients/route.ts"
      to: "supabase/migrations/20260222000001_add_owner_id_and_drop_user_count_limit.sql"
      via: "INSERT includes owner_id from auth session"
      pattern: "owner_id"
---

<objective>
Implement accountant-scoped client isolation and remove user seat limits from all plans.

Purpose: Members (accountants) should only see and manage their own clients. Admins see all clients within the org. Seat limits are removed entirely -- only client count matters for billing. This creates a proper multi-accountant workspace where each accountant works independently on their own book.

Output: Migration files, updated RLS policies, updated application code, admin overview with per-accountant breakdown, client reassignment action, updated PRICING.md.
</objective>

<execution_context>
@C:/Users/ejsch/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/ejsch/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@ARCHITECTURE.md
@PRICING.md
@DESIGN.md
@lib/auth/org-context.ts
@lib/stripe/plans.ts
@lib/stripe/webhook-handlers.ts
@lib/billing/trial.ts
@lib/billing/usage-limits.ts
@app/api/clients/route.ts
@app/actions/clients.ts
@app/actions/team.ts
@app/(dashboard)/billing/page.tsx
@app/(dashboard)/billing/components/usage-bars.tsx
@app/(dashboard)/admin/page.tsx
@app/(dashboard)/admin/[slug]/page.tsx
@app/(dashboard)/admin/components/org-table.tsx
@app/(dashboard)/settings/page.tsx
@app/pricing/page.tsx
@app/(auth)/onboarding/page.tsx
@supabase/migrations/20260219000005_rewrite_rls_policies.sql
@supabase/migrations/20260219000004_create_jwt_hook.sql
@supabase/migrations/20260219000001_create_organisations_and_user_orgs.sql
</context>

<tasks>

<task type="auto">
  <name>Task 1: Database migration -- add owner_id to clients, drop user_count_limit, rewrite clients RLS</name>
  <files>
    supabase/migrations/20260222000001_add_owner_id_and_drop_user_count_limit.sql
    supabase/migrations/20260222000002_rewrite_clients_rls_with_owner_scoping.sql
  </files>
  <action>
Create two migration files:

**Migration 1: `20260222000001_add_owner_id_and_drop_user_count_limit.sql`**

1. Add `owner_id UUID REFERENCES auth.users(id)` to `clients` table (nullable initially for backfill).
2. Backfill all existing clients: set `owner_id` to the earliest admin user in their org (from `user_organisations` where role='admin' ORDER BY created_at ASC LIMIT 1). Use a subquery: `UPDATE clients SET owner_id = (SELECT uo.user_id FROM user_organisations uo WHERE uo.org_id = clients.org_id AND uo.role = 'admin' ORDER BY uo.created_at ASC LIMIT 1)`.
3. After backfill, set `owner_id` to NOT NULL: `ALTER TABLE clients ALTER COLUMN owner_id SET NOT NULL`.
4. Create index: `CREATE INDEX idx_clients_owner_id ON clients(owner_id)`.
5. Drop `user_count_limit` column from `organisations`: `ALTER TABLE organisations DROP COLUMN IF EXISTS user_count_limit`.
6. Add a comment explaining the owner_id purpose.

**Migration 2: `20260222000002_rewrite_clients_rls_with_owner_scoping.sql`**

Replace the four existing clients RLS policies (`clients_select_org`, `clients_insert_org`, `clients_update_org`, `clients_delete_org`) with role-aware policies.

The JWT hook already injects `org_role` into `app_metadata`. Create a helper function `auth_org_role()` (similar to `auth_org_id()`):

```sql
CREATE OR REPLACE FUNCTION public.auth_org_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'org_role',
    'member'
  );
$$;
GRANT EXECUTE ON FUNCTION public.auth_org_role TO authenticated;
```

Then rewrite the clients policies:

- **SELECT**: Drop `clients_select_org`. Create `clients_select_admin` for admins (`USING (org_id = auth_org_id() AND auth_org_role() = 'admin')`) and `clients_select_member` for members (`USING (org_id = auth_org_id() AND owner_id = auth.uid())`). Both are permissive policies -- PostgreSQL OR's them together.
- **INSERT**: Drop `clients_insert_org`. Create `clients_insert_org` with `WITH CHECK (org_id = auth_org_id() AND owner_id = auth.uid())`. Both admins and members insert with their own user ID as owner (admins can reassign later via a server action using admin client).
- **UPDATE**: Drop `clients_update_org`. Create `clients_update_admin` (`USING (org_id = auth_org_id() AND auth_org_role() = 'admin')`) and `clients_update_member` (`USING (org_id = auth_org_id() AND owner_id = auth.uid())`).
- **DELETE**: Drop `clients_delete_org`. Create `clients_delete_admin` (`USING (org_id = auth_org_id() AND auth_org_role() = 'admin')`) and `clients_delete_member` (`USING (org_id = auth_org_id() AND owner_id = auth.uid())`).

Keep the existing `Service role full access to clients` policy unchanged.

Add a validation block at the end (DO $$ ... $$) verifying that the new policies exist and the old ones are gone.

IMPORTANT: The INSERT WITH CHECK must also include `owner_id = auth.uid()` to ensure nobody can insert a client owned by someone else. The service_role policy bypasses RLS for admin reassignment operations.
  </action>
  <verify>
Run `supabase db diff` or inspect migration files to confirm:
1. `owner_id` column exists on clients with NOT NULL constraint and FK to auth.users
2. `user_count_limit` column is dropped from organisations
3. New RLS policies reference both `auth_org_id()` and `auth.uid()` for member-scoped operations
4. Admin policies use `auth_org_role() = 'admin'` check
5. `auth_org_role()` helper function is created
  </verify>
  <done>
Clients table has owner_id column (NOT NULL, FK to auth.users, indexed). Organisations table no longer has user_count_limit. RLS policies enforce: members see only own clients, admins see all org clients. Service role bypasses for cron/webhooks unchanged.
  </done>
</task>

<task type="auto">
  <name>Task 2: Remove user seat limits from application code and update client creation to set owner_id</name>
  <files>
    lib/stripe/plans.ts
    lib/stripe/webhook-handlers.ts
    lib/billing/trial.ts
    lib/billing/usage-limits.ts
    app/api/clients/route.ts
    app/actions/clients.ts
    app/actions/team.ts
    app/actions/csv.ts
    app/(dashboard)/billing/page.tsx
    app/(dashboard)/billing/components/usage-bars.tsx
    app/(dashboard)/admin/page.tsx
    app/(dashboard)/admin/[slug]/page.tsx
    app/(dashboard)/admin/components/org-table.tsx
    app/pricing/page.tsx
    app/(auth)/onboarding/page.tsx
    PRICING.md
  </files>
  <action>
**A. Remove userLimit from plan config (`lib/stripe/plans.ts`):**
- Remove `userLimit` field from `PlanConfig` interface.
- Remove `userLimit` from all PLAN_TIERS entries (lite, sole_trader, practice, firm).
- Remove `userLimit` from `getPlanLimits()` return type and implementation.
- Update feature bullet points: remove any "X users" lines. Lite and Sole Trader features should not mention user counts at all. Practice and Firm already say "Unlimited users" -- just remove user count mentions entirely from feature arrays.

**B. Remove user_count_limit from webhook handlers (`lib/stripe/webhook-handlers.ts`):**
- In `handleCheckoutSessionCompleted`: remove `user_count_limit: plan.userLimit` from the update payload.
- In `handleSubscriptionUpdated`: remove `updatePayload.user_count_limit = newPlan.userLimit` from the plan change block.

**C. Remove user_count_limit from trial setup (`lib/billing/trial.ts`):**
- Remove `TRIAL_USER_LIMIT` constant.
- Remove `user_count_limit: TRIAL_USER_LIMIT` from the `createTrialForOrg` update payload.

**D. Update client creation to include owner_id (`app/api/clients/route.ts`):**
- After getting `orgId` via `getOrgId()`, also get the current user's ID from the session: `const supabase = await createClient(); const { data: { session } } = await supabase.auth.getSession(); const userId = session?.user?.id;`
- Note: the supabase client is already created above in the route. Reuse it. Get the session right after creating the client.
- Add `owner_id: userId` to the `.insert({...})` payload alongside `org_id: orgId`.
- If no userId (shouldn't happen since route requires auth), return 401.

**E. Update CSV import if it creates clients (`app/actions/csv.ts`):**
- Check if csv.ts does INSERT operations on clients. If it does, add `owner_id` from the current user session to the insert payload. If csv.ts only does UPDATE (matching existing clients by name), no change needed for owner_id.
- Read the full file to determine. (The csv.ts action does UPDATE matching, not INSERT, based on the interface showing "matchedClients" and "updatedClients" -- but verify.)

**F. Remove seat limit check from team invites (`app/actions/team.ts`):**
- In `sendInvite()`, remove the entire seat limit check block: remove the `activeCount` query, `pendingCount` query, the org `user_count_limit` select, and the `totalSeatsUsed >= org.user_count_limit` conditional. Keep the org name fetch but change the select to just `"name"` (remove `user_count_limit`).
- The function should still enforce admin-only and duplicate-email checks but no longer enforce seat limits.

**G. Remove user limit from billing page (`app/(dashboard)/billing/page.tsx`):**
- Remove `user_count_limit` from the org select query.
- Remove the `userCount` query (`supabase.from("user_organisations").select...`).
- Remove `userLimit={org.user_count_limit}` prop from UsageBars.
- Remove `userCount={userCount ?? 1}` prop from UsageBars.

**H. Simplify UsageBars component (`app/(dashboard)/billing/components/usage-bars.tsx`):**
- Remove `userCount` and `userLimit` from the `UsageBarsProps` interface.
- Remove the "Team members" `UsageBarItem` entirely.
- Only show the "Clients" bar.

**I. Remove user_count_limit from admin pages:**
- `app/(dashboard)/admin/page.tsx`: Remove `user_count_limit` from the org select query.
- `app/(dashboard)/admin/[slug]/page.tsx`: Remove `user_count_limit` from the org select query. Remove the "User Limit" `<dt>/<dd>` block from the organisation settings card. Keep the "Client Limit" display.
- `app/(dashboard)/admin/components/org-table.tsx`: Remove `user_count_limit` from the `OrgRow` interface.

**J. Remove user limit references from pricing page (`app/pricing/page.tsx`):**
- Remove the line displaying `plan.userLimit` (the `{formatLimit(plan.userLimit, "users")}` line).
- If there are user count references in feature lists, those were already updated in step A via the PLAN_TIERS features array.

**K. Remove user limit from onboarding page (`app/(auth)/onboarding/page.tsx`):**
- Remove the user limit display block (the conditional showing "Unlimited users" / "1 user" / "Up to N users").

**L. Update PRICING.md:**
- Remove "Users" row from all tier tables (the "| Users | 1 |", "| Users | 2 |", etc. lines).
- Remove "Secondary axis: user seats" paragraph from Pricing Philosophy.
- Update philosophy to state pricing is based solely on client count.
- Remove "Additional users" row from the Feature Availability table.
- Remove `user_count_limit` from the Database Schema section.
- Remove user-count mentions from tier descriptions ("second user seat", "Up to 5 users", etc.).
- Keep client count limits unchanged.

IMPORTANT: Do NOT remove `user_count_limit` from the founding org seed migration (20260219000001) -- that's historical. The DROP COLUMN in the new migration handles removal.
  </action>
  <verify>
1. `npx tsc --noEmit` passes (no type errors from removed userLimit/user_count_limit references).
2. `grep -r "user_count_limit\|userLimit\|user_limit\|TRIAL_USER_LIMIT" --include="*.ts" --include="*.tsx" lib/ app/` returns zero matches (excluding node_modules, .planning, old migrations).
3. `grep -r "owner_id" app/api/clients/route.ts` confirms owner_id is set on client creation.
  </verify>
  <done>
All user seat limit references removed from application code, UI components, Stripe integration, and PRICING.md. Client creation (POST /api/clients) includes owner_id from authenticated session. Team invites no longer enforce seat limits.
  </done>
</task>

<task type="auto">
  <name>Task 3: Admin overview with per-accountant stats and client reassignment action</name>
  <files>
    app/(dashboard)/settings/page.tsx
    app/(dashboard)/settings/components/accountant-overview-card.tsx
    app/actions/clients.ts
  </files>
  <action>
**A. Create AccountantOverviewCard component (`app/(dashboard)/settings/components/accountant-overview-card.tsx`):**

Build a server component that shows the admin an overview of their org's accountant workforce:
- Fetch all members of the current org from `user_organisations` (using admin client since we need to cross-reference auth.users for emails).
- For each member, count their clients: query `clients` table grouped by `owner_id` where `org_id` matches (use admin client to bypass owner-scoped RLS).
- Display a Card (following DESIGN.md patterns) with:
  - CardTitle: "Accountant Overview"
  - CardDescription: "Client distribution across your team"
  - Summary row at top: "Total accountants: {N} | Total clients: {N} / {limit or Unlimited}"
  - Table with columns: Name (or Email), Role, Clients, and an action column.
  - The action column shows a "Reassign" dropdown (using DropdownMenu pattern from DESIGN.md) for each accountant, listing all OTHER accountants as reassignment targets. When clicked, calls the `reassignClients` server action.
  - If only one accountant, hide the Reassign column (no one to reassign to).

Since this component needs interactivity (the reassign dropdown), split into:
- A server-side data-fetching wrapper in the settings page
- A client component `AccountantOverviewCard` that receives the data as props

Props interface:
```typescript
interface AccountantStats {
  userId: string;
  email: string;
  name: string | null;
  role: string;
  clientCount: number;
}
interface AccountantOverviewCardProps {
  accountants: AccountantStats[];
  totalClients: number;
  clientLimit: number | null;
}
```

**B. Add reassignClients server action to `app/actions/clients.ts`:**

```typescript
export async function reassignClients(
  fromUserId: string,
  toUserId: string
): Promise<{ error?: string; reassigned?: number }>
```

- Validate caller is admin via `getOrgContext()`.
- Use admin client (service_role) to bypass owner-scoped RLS.
- Validate both users belong to the same org by checking `user_organisations`.
- Run: `UPDATE clients SET owner_id = toUserId, updated_at = now() WHERE owner_id = fromUserId AND org_id = orgId`.
- Return count of reassigned clients.
- Use `requireWriteAccess(orgId)` to enforce billing read-only mode.

**C. Update settings page (`app/(dashboard)/settings/page.tsx`):**

- Import and render AccountantOverviewCard between the TeamCard and InboundCheckerCard.
- Fetch the data server-side: use admin client to get user_organisations + client counts per owner_id, resolve emails via auth admin API.
- Only show the AccountantOverviewCard for admins (the page already redirects non-admins).
- Fetch org's `client_count_limit` from organisations table for the total display.

Data fetching in settings page:
```typescript
const admin = createAdminClient();
const { data: memberships } = await admin
  .from("user_organisations")
  .select("user_id, role")
  .eq("org_id", orgId);

// Get client counts grouped by owner_id
const { data: clientCounts } = await admin
  .from("clients")
  .select("owner_id")
  .eq("org_id", orgId);

// Group and count
const countMap = new Map<string, number>();
(clientCounts ?? []).forEach(c => {
  countMap.set(c.owner_id, (countMap.get(c.owner_id) ?? 0) + 1);
});

// Resolve emails
// ... (same pattern as team.ts getTeamMembers)

const { data: org } = await admin
  .from("organisations")
  .select("client_count_limit")
  .eq("id", orgId)
  .single();
```

Pass this data as props to AccountantOverviewCard.

Use `useTransition` in the client component for the reassign action (same pattern as team-card.tsx uses for invite/role-change).

After a successful reassign, call `router.refresh()` to update the counts.
  </action>
  <verify>
1. `npx tsc --noEmit` passes.
2. Navigate to /settings as admin -- AccountantOverviewCard renders with accountant list and client counts.
3. If multiple accountants exist, the Reassign action appears and works (moves all clients from one accountant to another, counts update).
4. Members do not see the AccountantOverviewCard (redirected to /dashboard by existing guard).
  </verify>
  <done>
Settings page shows admin overview with: total accountant count, per-accountant client count, total clients vs limit. Admins can reassign all clients from one accountant to another via dropdown action. The reassignClients server action validates admin role, same-org membership, and uses service_role client to bypass owner-scoped RLS.
  </done>
</task>

</tasks>

<verification>
1. **Member isolation**: Log in as a member user. Verify `/clients` only shows clients where `owner_id` matches the member's user ID. Create a new client -- verify its `owner_id` is set to the member's ID.
2. **Admin full view**: Log in as admin. Verify `/clients` shows ALL clients in the org regardless of owner_id.
3. **No seat limits**: Verify team invite works without hitting any seat limit. Verify billing page shows no "Team members" usage bar. Verify pricing page shows no user count references.
4. **Admin overview**: Navigate to `/settings` as admin. Verify AccountantOverviewCard shows per-accountant client distribution.
5. **Client reassignment**: Use the reassign action to move clients between accountants. Verify the source accountant's count decreases and target's increases.
6. **Cron/webhook unaffected**: Service role policies still have full access -- cron jobs continue to process all clients across all owners within an org.
</verification>

<success_criteria>
- Members see only their own clients (owner_id = auth.uid())
- Admins see all org clients (org_id scoping only)
- New clients have owner_id set to creating user
- user_count_limit column removed from organisations
- No seat limit enforcement anywhere in app code
- Admin settings shows per-accountant client breakdown
- Admin can reassign clients between accountants
- PRICING.md reflects client-only billing axis
- TypeScript compiles with no errors
</success_criteria>

<output>
After completion, create `.planning/quick/5-accountant-scoped-client-isolation-and-r/5-SUMMARY.md`
</output>
