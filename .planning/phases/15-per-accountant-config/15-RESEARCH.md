# Phase 15: Per-Accountant Configuration - Research

**Researched:** 2026-02-22
**Domain:** Multi-tenant resource ownership, RLS policy patterns, cron pipeline refactoring, per-user settings resolution
**Confidence:** HIGH (all findings derived from direct codebase inspection and live database schema)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

The CONTEXT.md file is structured as a technical specification rather than a decisions/discretion/deferred split. The following are treated as locked decisions because they are explicitly specified in the context document:

1. Add `owner_id` (FK to `auth.users`) to: `email_templates`, `schedules`, `schedule_steps`, `schedule_client_exclusions`
2. Add `user_id` (FK to `auth.users`) to: `app_settings` — so each user has own `reminder_send_hour`, `sender_name`, `sender_email`, `reply_to_email`
3. Backfill existing rows to the org's earliest admin (same COALESCE pattern as clients migration `20260222000001`)
4. RLS: same admin/member split pattern used for `clients`: member = `owner_id = auth.uid()`, admin = `auth_org_role() = 'admin'`
5. Service role stays unchanged (full access for cron jobs)
6. New user seeding on invite acceptance happens in `app/(auth)/invite/accept/actions.ts` or a post-accept hook
7. Postmark server token and sender domain stay org-level — per-user config is `sender_name` and `reply_to_email` only
8. Nav: remove `/schedules` and `/templates` from `ADMIN_ONLY_HREFS` in `components/nav-links.tsx`
9. Settings: members need access to their own email settings (send hour, sender name, reply-to)
10. `app_settings` unique constraint changes from `UNIQUE(org_id, key)` to `UNIQUE(org_id, user_id, key)` where `user_id` is nullable — NULL = org-level default, UUID = user-specific override
11. Settings resolution: user setting → org default fallback

### Claude's Discretion

The CONTEXT.md does not list explicit "Claude's Discretion" items. Based on what is not specified, the following are open for recommendation:

- **New user seeding strategy**: Clone from admin vs. system defaults vs. mini onboarding (CONTEXT.md lists all three as options with no decision). Research will recommend.
- **Member settings page**: Separate `/member-settings` page vs. conditional rendering on existing `/settings` page. Research will recommend.
- **Cron pipeline inner loop structure**: Exact shape of the per-user inner loop in `scheduler.ts` and `queue-builder.ts`.
- **`reminder_queue` owner tracking**: Whether to add `owner_id` to `reminder_queue` or resolve it at send time from the client's owner.

### Deferred Ideas (OUT OF SCOPE)

From CONTEXT.md — no explicit deferred section. The following items mentioned in CONTEXT.md are low-priority and should not block the core work:
- Mini onboarding wizard for new members (complex UX; seeding from defaults is sufficient)
- Per-member Postmark tokens (stated explicitly out of scope — org-level only)
</user_constraints>

---

## Summary

Phase 15 transforms templates, schedules, and email settings from org-wide shared resources to per-accountant-owned resources. Quick Task 5 already established the `owner_id` pattern on `clients` and the `auth_org_role()` helper function — Phase 15 applies the same pattern to the resource tables that drive the reminder pipeline.

The work divides into two tiers of complexity. The database migrations and RLS rewrites are mechanical and low-risk: they follow the exact same pattern already proven by Quick Task 5's migrations `20260222000001` and `20260222000002`. The cron pipeline refactor is the genuinely hard part: `scheduler.ts`, `queue-builder.ts`, and `send-emails/route.ts` are currently org-scoped, and must gain an inner per-user loop that respects owner-scoped resources while keeping the service-role bypass intact for all DB access.

The `app_settings` table is the trickiest structural change because its unique constraint `UNIQUE(org_id, key)` must be extended to `UNIQUE(org_id, user_id, key)` with `user_id` nullable, which requires dropping the old constraint, adding the new column, and rewriting both the constraint and the upsert conflict target. All settings read paths must gain a fallback: try user-specific row first, fall back to `user_id IS NULL` org default.

**Primary recommendation:** Implement in five sequential plans: (1) DB migrations + RLS, (2) cron pipeline per-user loop, (3) send-emails per-user sender settings + `sendRichEmailForUser`, (4) nav + settings page member access, (5) new-user seeding on invite accept.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Supabase (service role) | existing | All cron DB access — bypasses RLS | Cron must see all users' resources |
| `auth_org_role()` | already exists | SQL helper — extracts org_role from JWT | Established by Quick Task 5; no re-implementation |
| `auth_org_id()` | already exists | SQL helper — extracts org_id from JWT | Established by Phase 10; no re-implementation |
| `auth.uid()` | built-in | Owner comparison in RLS policies | Standard Supabase pattern |
| `getOrgContext()` | `lib/auth/org-context.ts` | Returns `{ orgId, orgRole }` from session | Used everywhere in server actions |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `createAdminClient()` | `lib/supabase/admin.ts` | Service-role client — bypasses RLS | Cron jobs, invite acceptance seeding, settings fallback reads |
| `useTransition` | React built-in | Non-blocking server action calls | Member settings card updates (same pattern as team-card.tsx) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Nullable `user_id` on `app_settings` | Separate `user_settings` table | New table is cleaner schema but app_settings already has CRUD actions, upsert logic, and org default rows — extending in-place is less surface area |
| Clone-from-admin seeding | System default templates | Admin's templates are bespoke to the practice; system defaults are generic. Clone is higher value for members. |
| owner_id on `reminder_queue` | Resolve owner at send time from `clients.owner_id` | Resolving at send time requires a JOIN but avoids a schema change to a high-write table. Research recommends resolving at send time. |

**Installation:** No new npm packages required. All dependencies already present.

---

## Architecture Patterns

### Recommended Project Structure

```
supabase/migrations/
├── 15-01-*_add_owner_id_to_resource_tables.sql     # owner_id to email_templates, schedules, schedule_steps, schedule_client_exclusions
├── 15-01-*_add_user_id_to_app_settings.sql          # user_id to app_settings, update unique constraint
├── 15-01-*_rewrite_resource_tables_rls.sql           # RLS rewrites for all resource tables

lib/reminders/
├── scheduler.ts       # Add per-user inner loop; pass user context to queue builder
├── queue-builder.ts   # Accept optional owner_id param to scope resource fetches

app/api/cron/
├── send-emails/route.ts   # Add per-user sender resolution inside processOrgEmails

lib/email/
├── sender.ts          # Add getEmailFromForUser() reading user-specific app_settings with fallback

app/(auth)/invite/accept/
├── actions.ts         # Add seedNewUserDefaults() called after successful user_organisations INSERT

app/(dashboard)/settings/
├── page.tsx           # Conditionally render member settings instead of admin-only redirect
├── components/
│   └── member-settings-card.tsx   # New: send hour + email settings for member role

components/
└── nav-links.tsx      # Remove /schedules and /templates from ADMIN_ONLY_HREFS
```

### Pattern 1: Owner-Scoped RLS on Resource Tables (Direct port of Quick Task 5 pattern)

**What:** Two permissive SELECT policies per table — admin sees all in org, member sees only their own. INSERT enforces `owner_id = auth.uid()`.

**When to use:** All resource tables that should be per-accountant: `email_templates`, `schedules`, `schedule_steps`, `schedule_client_exclusions`.

**Example (established by `20260222000002_rewrite_clients_rls_with_owner_scoping.sql`):**
```sql
-- Admin sees all in org
CREATE POLICY "email_templates_select_admin" ON email_templates
  FOR SELECT TO authenticated
  USING (
    org_id = auth_org_id()
    AND auth_org_role() = 'admin'
  );

-- Member sees only their own
CREATE POLICY "email_templates_select_member" ON email_templates
  FOR SELECT TO authenticated
  USING (
    org_id = auth_org_id()
    AND owner_id = auth.uid()
  );

-- INSERT enforces ownership
CREATE POLICY "email_templates_insert_org" ON email_templates
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = auth_org_id()
    AND owner_id = auth.uid()
  );
```

**Note:** `auth_org_role()` is already defined and GRANT'd (Quick Task 5). No re-creation needed.

### Pattern 2: app_settings user_id Column + Nullable Unique Constraint

**What:** Add nullable `user_id` column to `app_settings`. Change unique constraint from `UNIQUE(org_id, key)` to `UNIQUE(org_id, user_id, key)`. Postgres allows multiple NULL values in a unique constraint, so `user_id IS NULL` rows are the org-level defaults, and `user_id = uuid` rows are per-user overrides.

**Verified:** Current constraint name is `app_settings_org_id_key_unique` (confirmed from live DB). The upsert conflict target in `app/actions/settings.ts` uses `onConflict: "org_id,key"` throughout — this must change to `onConflict: "org_id,user_id,key"` for user-specific rows.

**Migration approach:**
```sql
-- Step 1: Add user_id column (nullable)
ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Step 2: Drop old unique constraint
ALTER TABLE app_settings
  DROP CONSTRAINT IF EXISTS app_settings_org_id_key_unique;

-- Step 3: Add new unique constraint covering (org_id, user_id, key)
-- NULLS NOT DISTINCT ensures (org_id, NULL, key) is truly unique
ALTER TABLE app_settings
  ADD CONSTRAINT app_settings_org_user_key_unique
  UNIQUE NULLS NOT DISTINCT (org_id, user_id, key);
```

**CRITICAL NOTE:** `NULLS NOT DISTINCT` is required (PostgreSQL 15+, Supabase supports this). Without it, two rows with `user_id IS NULL` and the same `org_id, key` would both be allowed, breaking the org-default uniqueness. Supabase Cloud runs PostgreSQL 15+ so this is safe.

**Settings read pattern after migration:**
```typescript
// In settings actions — read user-specific, fallback to org default
export async function getSendHour(userId?: string): Promise<number> {
  const supabase = await createClient();
  const orgId = await getOrgId();

  // Try user-specific row first
  if (userId) {
    const { data: userRow } = await supabase
      .from('app_settings')
      .select('value')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .eq('key', 'reminder_send_hour')
      .maybeSingle();
    if (userRow) return parseInt(userRow.value, 10);
  }

  // Fallback to org-level default (user_id IS NULL)
  const { data: orgRow } = await supabase
    .from('app_settings')
    .select('value')
    .eq('org_id', orgId)
    .is('user_id', null)
    .eq('key', 'reminder_send_hour')
    .maybeSingle();

  return orgRow ? parseInt(orgRow.value, 10) : 9;
}
```

**Settings write pattern:**
```typescript
// Upsert with user_id — creates user-specific row
await supabase.from('app_settings').upsert(
  { org_id: orgId, user_id: userId, key: 'reminder_send_hour', value: String(hour) },
  { onConflict: 'org_id,user_id,key' }
);
```

### Pattern 3: Per-User Inner Loop in Cron Pipeline

**What:** The current cron pipeline iterates over orgs. After this phase it must iterate over orgs then over users within each org. The service-role client continues to be used for all DB access (bypasses RLS), but queries are filtered by both `org_id` and `owner_id`.

**Current structure (`app/api/cron/reminders/route.ts` + `scheduler.ts`):**
```
for each org:
  processReminders(adminClient, org)    ← org-scoped lock + queries
```

**Required structure:**
```
for each org:
  get org's members (user_organisations WHERE org_id = org.id)
  for each user in org:
    processRemindersForUser(adminClient, org, userId)   ← user-scoped lock + queries
```

**Key implementation notes:**
- Lock key must be per-user: `cron_reminders_${org.id}_${userId}` (prevents parallel user processing for same org)
- `buildReminderQueue` receives an additional `ownerId` filter: resource queries (schedules, email_templates, schedule_steps) add `.eq('owner_id', ownerId)`
- Client query in `buildCustomScheduleQueue` adds `.eq('owner_id', ownerId)` to scope custom schedule clients to those owned by this accountant
- `processReminders` send_hour check reads the user's specific send_hour setting (with org default fallback) instead of the org-level row
- `rebuildQueueForClient` is called from server actions where the user is authenticated — it already scopes to `org_id` and RLS handles owner filtering. No change needed for this path.

**Preserving existing queue entries:** `reminder_queue` already has `org_id`. The cron inner loop needs to be able to identify which user's resources to use when processing a reminder. Two approaches:
1. Add `owner_id` to `reminder_queue` at insert time (schema change, cleanest)
2. Derive owner at send time via `clients.owner_id` JOIN (no schema change)

**Recommendation:** Use option 2 (derive from `clients.owner_id` at send time). The `send-emails` cron already does `.select('*, clients!inner(company_name, primary_email)')`. Extending to `.select('*, clients!inner(company_name, primary_email, owner_id)')` gives the owner_id without adding a column to `reminder_queue`. This avoids a schema migration on a 246-row live table and a backfill step.

### Pattern 4: sendRichEmailForUser — Per-User Sender Settings

**What:** The current `sendRichEmailForOrg` in `lib/email/sender.ts` calls `getEmailFromForOrg(supabase, orgId)` which reads `email_sender_name`, `email_sender_address`, `email_reply_to` from `app_settings` where `org_id = orgId`. After this phase, it must read user-specific rows first and fall back to org-level.

**Approach:** Add `getEmailFromForUser(supabase, orgId, userId)` that queries:
```typescript
// Try user-specific settings
const { data: userRows } = await supabase
  .from('app_settings')
  .select('key, value')
  .eq('org_id', orgId)
  .eq('user_id', userId)
  .in('key', ['email_sender_name', 'email_sender_address', 'email_reply_to']);

// Fall back to org-level defaults for any missing keys
const { data: orgRows } = await supabase
  .from('app_settings')
  .select('key, value')
  .eq('org_id', orgId)
  .is('user_id', null)
  .in('key', ['email_sender_name', 'email_sender_address', 'email_reply_to']);

// Merge: user row wins over org row
```

The `sendRichEmailForOrg` function signature should gain an optional `userId` param, or a new `sendRichEmailForUser` function should be added alongside it.

### Pattern 5: New User Seeding on Invite Accept

**What:** When a new member accepts an invite, they have zero templates, zero schedules, zero settings. The `acceptInvite` function in `app/(auth)/invite/accept/actions.ts` currently ends at inserting into `user_organisations`. A `seedNewUserDefaults(userId, orgId)` function must be called after the successful insert.

**Seeding strategy recommendation:** Clone from admin (highest value). The admin has already customized templates and schedules for this specific accounting practice. Cloning gives the new member a fully functional setup immediately.

**Implementation:**
```typescript
async function seedNewUserDefaults(userId: string, orgId: string): Promise<void> {
  const admin = createAdminClient();

  // Find the org's admin user
  const { data: adminMembership } = await admin
    .from('user_organisations')
    .select('user_id')
    .eq('org_id', orgId)
    .eq('role', 'admin')
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (!adminMembership) return; // No admin found, skip seeding

  const adminId = adminMembership.user_id;

  // Clone email_templates
  const { data: adminTemplates } = await admin
    .from('email_templates')
    .select('*')
    .eq('org_id', orgId)
    .eq('owner_id', adminId);

  if (adminTemplates && adminTemplates.length > 0) {
    const newTemplates = adminTemplates.map(({ id, created_at, updated_at, ...t }) => ({
      ...t,
      owner_id: userId,
    }));
    // Insert and capture mapping of old_id -> new_id for schedule_steps FK update
    await admin.from('email_templates').insert(newTemplates);
  }

  // Clone schedules + schedule_steps (with template ID remapping)
  // Clone app_settings org-level defaults as user-specific rows
}
```

**Note:** Cloning schedule_steps requires remapping `email_template_id` FKs to the newly-cloned template IDs. This requires a two-step insert: templates first (capture returned IDs), then steps with remapped FKs.

**Failure mode:** Seeding failure must be non-fatal. User is already added to the org — seeding failure should log a warning but not return an error to the user. The user can configure their templates manually.

### Anti-Patterns to Avoid

- **Auth client for cron resource queries**: Cron jobs must use `createAdminClient()` (service role). Owner-scoped RLS with `owner_id = auth.uid()` would return zero rows because cron has no auth session. Service role bypasses RLS entirely — this is correct and intentional.
- **Changing the upsert conflict target without updating the unique constraint**: If `app_settings` gets `user_id` but the old `UNIQUE(org_id, key)` constraint is not replaced, upserts will fail for rows that differ only in `user_id`.
- **Null vs undefined in PostgREST**: When filtering `user_id IS NULL`, use `.is('user_id', null)` not `.eq('user_id', null)`. PostgREST translates `.is()` to `IS NULL` correctly; `.eq(null)` may not behave as expected.
- **Missing `NULLS NOT DISTINCT` on the new unique constraint**: Without this, PostgreSQL treats NULLs as not-equal for uniqueness purposes, allowing duplicate `(org_id, NULL, key)` rows and breaking org-level defaults.
- **Processing `reminder_queue` entries for the wrong user's settings**: When `send-emails` resolves sender settings, it must use the client's `owner_id` (from the JOIN), not the cron's org-level settings.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-user SQL auth helper | Custom function | `auth_org_role()` already exists; `auth.uid()` is built-in | Re-implementing risks inconsistency |
| Settings fallback resolution | Custom caching layer | Direct DB query with `.maybeSingle()` on user row + `.maybeSingle()` on org row | Simple and transparent; no cache invalidation complexity |
| Template ID remapping during clone | Manual mapping code | Insert templates first, return IDs, then map steps | Standard multi-step insert pattern; do not try to do it in a single query |
| Constraint modification | Dropping/recreating table | `ALTER TABLE ... DROP CONSTRAINT ... ADD CONSTRAINT` | Safe in-place modification |

**Key insight:** The hardest part is the cron pipeline refactor — not because it requires new patterns, but because the per-user loop must be threaded through three files (`scheduler.ts`, `queue-builder.ts`, `send-emails/route.ts`) consistently. Start with the DB migrations and RLS (safe, reversible), then refactor the cron pipeline.

---

## Common Pitfalls

### Pitfall 1: `app_settings` unique constraint conflict during upsert after migration

**What goes wrong:** After adding `user_id` column and changing the unique constraint, the existing `upsert(..., { onConflict: 'org_id,key' })` calls in `app/actions/settings.ts` will fail with a "specified conflict target is not valid" error because the constraint now includes `user_id`.

**Why it happens:** Supabase/PostgREST upsert requires the `onConflict` columns to exactly match an existing unique constraint or unique index.

**How to avoid:** Update ALL upsert calls in `app/actions/settings.ts` simultaneously with the migration. For org-level admin upserts (no user_id), use `{ org_id: orgId, user_id: null, key: ..., value: ... }` with `onConflict: 'org_id,user_id,key'`. Note that PostgREST's `onConflict` with a null column requires `NULLS NOT DISTINCT` on the constraint.

**Warning signs:** Runtime error on the settings page after migration but before code update.

### Pitfall 2: Existing app_settings rows have no user_id — they become org defaults

**What goes wrong:** After adding `user_id` column (nullable), the 8 existing rows will have `user_id = NULL`. This is correct — they become the org-level defaults. But if the unique constraint is changed without `NULLS NOT DISTINCT`, there would be no uniqueness guarantee on `(org_id, NULL, key)`.

**Why it happens:** Standard PostgreSQL behavior: NULL != NULL in uniqueness checks unless `NULLS NOT DISTINCT` is specified (added in PostgreSQL 15).

**How to avoid:** Include `NULLS NOT DISTINCT` in the new unique constraint definition (see Pattern 2).

**Warning signs:** Duplicate `(org_id, NULL, key)` rows appearing, causing settings reads to return multiple rows and `.single()` calls to throw errors.

### Pitfall 3: Cron pipeline reads wrong user's resources for existing queue entries

**What goes wrong:** `reminder_queue` entries created before this migration don't have explicit owner tracking. When the cron processes them in a per-user loop, it must correctly associate each queue entry with the right user's templates/settings.

**Why it happens:** `reminder_queue` stores `client_id`. The client has `owner_id`. The per-user cron loop should only process `reminder_queue` entries where `clients.owner_id = current_user`. This avoids double-processing.

**How to avoid:** In the cron inner loop, filter `reminder_queue` by joining through `clients!inner(owner_id)` and filtering `owner_id = userId`. This scopes each user's cron processing to only their own clients' reminders.

**Warning signs:** Emails being sent with wrong sender name/reply-to, or the same reminder being sent twice.

### Pitfall 4: Clone seeding creates orphaned templates if schedule clone fails

**What goes wrong:** If templates clone successfully but schedule cloning fails (e.g., a timeout), the new user has templates but no schedules that reference them. Templates are orphaned.

**Why it happens:** Seeding is done in sequential async calls without a transaction. Partial failure leaves the DB in an inconsistent state for the new user.

**How to avoid:** Wrap the full seeding operation in a try/catch. If any step fails, log the error but do not throw — the user is already in the org. Their setup will be incomplete but not broken (no reminders will fire until they have schedules anyway).

**Warning signs:** New member has templates but empty schedules page.

### Pitfall 5: Settings page admin redirect blocks member access to their own settings

**What goes wrong:** `app/(dashboard)/settings/page.tsx` currently has `if (orgRole !== 'admin') { redirect('/dashboard'); }` at the top. Members need access to their own email settings after this phase.

**Why it happens:** This guard was added in Phase 13 (D-13-03-02: only `/settings` and `/billing` get server-side protection for members, but settings was made admin-only). Phase 15 reverses this partially.

**How to avoid:** Remove the hard admin redirect. Instead, render different content based on `orgRole`: admins see the full settings page (all existing cards), members see a reduced settings card with only their send hour and email settings. The Postmark, Team, and AccountantOverview cards remain admin-only (conditionally rendered, not redirected).

**Warning signs:** Members see the full settings page including team management and Postmark configuration.

---

## Code Examples

Verified patterns from codebase inspection:

### Owner-scoped RLS rewrite (from `20260222000002_rewrite_clients_rls_with_owner_scoping.sql`)
```sql
-- SELECT: two permissive policies, PostgreSQL OR's them
CREATE POLICY "schedules_select_admin" ON schedules
  FOR SELECT TO authenticated
  USING (org_id = auth_org_id() AND auth_org_role() = 'admin');

CREATE POLICY "schedules_select_member" ON schedules
  FOR SELECT TO authenticated
  USING (org_id = auth_org_id() AND owner_id = auth.uid());

-- INSERT: both roles insert their own
CREATE POLICY "schedules_insert_org" ON schedules
  FOR INSERT TO authenticated
  WITH CHECK (org_id = auth_org_id() AND owner_id = auth.uid());
```

### Per-user inner loop in cron (new pattern, based on existing org loop)
```typescript
// In app/api/cron/reminders/route.ts
for (const org of orgs) {
  // Get org members for per-user loop
  const { data: members } = await adminClient
    .from('user_organisations')
    .select('user_id')
    .eq('org_id', org.id);

  for (const member of members ?? []) {
    const userResult = await processRemindersForUser(adminClient, org, member.user_id);
    // accumulate results
  }
}
```

### app_settings user_id fallback read pattern
```typescript
// Source: derived from existing getEmailFromForOrg in lib/email/sender.ts
async function getEmailFromForUser(
  supabase: SupabaseClient,
  orgId: string,
  userId: string
): Promise<{ from: string; replyTo: string }> {
  const keys = ['email_sender_name', 'email_sender_address', 'email_reply_to'];

  // Fetch user-specific rows
  const { data: userRows } = await supabase
    .from('app_settings')
    .select('key, value')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .in('key', keys);

  // Fetch org-level defaults
  const { data: orgRows } = await supabase
    .from('app_settings')
    .select('key, value')
    .eq('org_id', orgId)
    .is('user_id', null)
    .in('key', keys);

  // User rows win over org rows
  const map = new Map(orgRows?.map(r => [r.key, r.value]) ?? []);
  (userRows ?? []).forEach(r => map.set(r.key, r.value));

  return {
    from: `${map.get('email_sender_name') || 'PhaseTwo'} <${map.get('email_sender_address') || 'hello@phasetwo.uk'}>`,
    replyTo: map.get('email_reply_to') || map.get('email_sender_address') || 'hello@phasetwo.uk',
  };
}
```

### Backfill migration pattern (from `20260222000001_add_owner_id_and_drop_user_count_limit.sql`)
```sql
-- Add column nullable
ALTER TABLE email_templates
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

-- Backfill to earliest admin (same COALESCE pattern as clients)
UPDATE email_templates
SET owner_id = COALESCE(
  (SELECT uo.user_id FROM user_organisations uo
   WHERE uo.org_id = email_templates.org_id AND uo.role = 'admin'
   ORDER BY uo.created_at ASC LIMIT 1),
  (SELECT uo.user_id FROM user_organisations uo
   WHERE uo.org_id = email_templates.org_id
   ORDER BY uo.created_at ASC LIMIT 1),
  (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
)
WHERE owner_id IS NULL;

-- Set NOT NULL
ALTER TABLE email_templates ALTER COLUMN owner_id SET NOT NULL;

-- Index
CREATE INDEX IF NOT EXISTS idx_email_templates_owner_id ON email_templates(owner_id);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Org-level `UNIQUE(org_id, key)` on app_settings | `UNIQUE NULLS NOT DISTINCT (org_id, user_id, key)` | This phase | Enables per-user settings with org fallback |
| Org-level schedules/templates (admin-only) | Per-user owned schedules/templates | This phase | Members get full reminder management |
| Cron iterates over orgs | Cron iterates over orgs → users | This phase | Each user's templates used for their clients |
| Members redirected from /settings to /dashboard | Members see own settings card | This phase | Members can configure sender name, reply-to, send hour |
| Nav hides /schedules and /templates from members | Nav shows them to all users (RLS handles scoping) | This phase | Members see their own templates/schedules |

---

## Open Questions

1. **Does `buildCustomScheduleQueue` scope clients to owner?**
   - What we know: Custom schedules currently apply to ALL active, non-paused clients in the org (per CONTEXT.md: "Custom schedules apply to ALL active, non-paused clients within the org")
   - What's unclear: Post-phase-15, should custom schedules apply to only the schedule-owner's clients, or still to all clients in the org?
   - Recommendation: After phase 15, a user's custom schedule should only fire for clients they own. The cron inner loop processes each user independently, and `buildCustomScheduleQueue` should filter clients by `owner_id = userId`. This is the consistent interpretation of "per-accountant model."

2. **What happens to `schedule_client_exclusions` when a client is reassigned?**
   - What we know: `schedule_client_exclusions` links a `schedule_id` (owner A's schedule) to a `client_id`. If the client is reassigned to owner B, the exclusion still references owner A's schedule.
   - What's unclear: Should exclusions be deleted on reassignment, or left as orphans?
   - Recommendation: On client reassignment (`reassignClients` server action), delete all `schedule_client_exclusions` rows where `client_id` is in the reassigned set. The new owner can re-configure exclusions for their own schedules.

3. **How does the admin's queue-building work after phase 15?**
   - What we know: Admins see all clients (org-scoped, no owner filter). Admins manage their own templates and schedules (owner_id = admin's uid).
   - What's unclear: In the cron loop, the admin's iteration will only build reminders for the admin's clients. But what about reminders that were created under the old system (before phase 15) where there was only one user?
   - Recommendation: The cron inner loop processes each org member independently (including the admin). All existing queue entries (`reminder_queue`) have `client_id` pointing to a client with `owner_id` = the org's first admin (per Quick Task 5 backfill). The admin's cron iteration will pick these up correctly. No special handling needed.

---

## Sources

### Primary (HIGH confidence)
- Live database schema (MCP Supabase tool) — actual column definitions, constraints, foreign keys, row counts for all tables
- `supabase/migrations/20260222000001_add_owner_id_and_drop_user_count_limit.sql` — exact backfill pattern
- `supabase/migrations/20260222000002_rewrite_clients_rls_with_owner_scoping.sql` — exact RLS pattern, `auth_org_role()` function
- `supabase/migrations/20260219000005_rewrite_rls_policies.sql` — current RLS policy names for all resource tables
- `lib/reminders/scheduler.ts` — full cron processing logic (354 lines)
- `lib/reminders/queue-builder.ts` — full queue building logic (743 lines)
- `app/api/cron/send-emails/route.ts` — full send cron (281 lines)
- `app/api/cron/reminders/route.ts` — cron entry point (126 lines)
- `app/actions/settings.ts` — all settings CRUD, upsert conflict targets
- `lib/email/sender.ts` — `getEmailFromForOrg`, `sendRichEmailForOrg`
- `components/nav-links.tsx` — `ADMIN_ONLY_HREFS` set
- `app/(dashboard)/settings/page.tsx` — admin redirect guard, current card structure
- `app/(auth)/invite/accept/actions.ts` — `acceptInvite` function, seeding hook point
- `lib/auth/org-context.ts` — `getOrgContext()`, `getOrgId()`

### Secondary (MEDIUM confidence)
- `.planning/phases/15-per-accountant-config/15-CONTEXT.md` — authored requirements and scope
- `.planning/quick/5-accountant-scoped-client-isolation-and-r/5-PLAN.md` — Quick Task 5 patterns
- `.planning/STATE.md` — project decisions log
- PostgreSQL 15 docs on `NULLS NOT DISTINCT` (knowledge base) — constraint behavior verified against known PostgreSQL behavior

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use, no new dependencies
- Architecture: HIGH — derived from direct codebase reading and live DB schema inspection
- Pitfalls: HIGH — pitfalls 1-3 identified from direct code analysis; pitfalls 4-5 from pattern reasoning

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (stable codebase; no planned external dependency changes)
