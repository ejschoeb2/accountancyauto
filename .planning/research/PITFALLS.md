# Domain Pitfalls: Multi-Tenancy Migration (v3.0)

**Domain:** Adding multi-tenancy to an existing single-tenant Next.js + Supabase SaaS application
**Researched:** 2026-02-19
**Confidence:** HIGH (verified against Supabase docs, Stripe docs, PostgreSQL migration patterns, codebase analysis)

---

## Scope Note

This file supersedes the previous PITFALLS.md (which covered inbound email/AI classification for a prior milestone). These pitfalls are specific to the v3.0 Multi-Tenancy & SaaS Platform migration — moving an existing single-tenant app where all RLS policies use `USING (true)` to a multi-tenant system with org-scoped data isolation.

---

## Critical Pitfalls

Mistakes that cause data breaches, rewrites, or production outages.

---

### Pitfall 1: Service-Role Cron Jobs Bypass RLS — Every Query Becomes a Cross-Tenant Leak

**What goes wrong:**
The cron jobs (`/api/cron/reminders` and `/api/cron/send-emails`) use `createAdminClient()` which calls `createClient()` with the service role key. Service role **completely bypasses RLS**. Once `org_id` is added to tables, the RLS policies that enforce tenant isolation only apply to the `authenticated` role. The cron jobs never see those policies.

After migration, `processReminders(adminClient)` fetches **all clients from all orgs** and queues reminders for all of them. Every org's clients get reminder emails. Then the send-emails cron reads all pending `reminder_queue` rows — again from all orgs — and sends them.

This is not a theoretical risk. It will happen on the first cron run after migration.

**Why it happens:**
- The current codebase has `createAdminClient()` as a pattern for "background work"
- Service role bypass feels like a feature (no auth needed in cron)
- RLS is associated with user authentication, not with tenant filtering
- Developers add RLS policies for `org_id` but forget crons bypass them entirely

**Specific code locations at risk (current codebase):**
```
lib/reminders/scheduler.ts  — fetches ALL clients, ALL schedules, ALL app_settings
app/api/cron/send-emails     — fetches ALL pending reminder_queue rows
app/api/postmark/inbound     — uses service.ts (service role) for ALL inbound writes
app/api/webhooks/postmark    — uses service role for delivery status updates
```

**Prevention:**
Every service-role query MUST include an explicit `org_id` filter. This is not optional.

```typescript
// WRONG — after migration this fetches all orgs:
const { data: clients } = await adminClient.from('clients').select('*');

// CORRECT — org_id must be passed into processReminders():
const { data: clients } = await adminClient
  .from('clients')
  .select('*')
  .eq('org_id', orgId);
```

The `processReminders()` function signature must change to accept `orgId`:
```typescript
export async function processReminders(
  supabase: SupabaseClient,
  orgId: string      // NEW: required, not optional
): Promise<ProcessResult>
```

The cron route must iterate over all active orgs and call `processReminders()` per org:
```typescript
// In /api/cron/reminders:
const { data: orgs } = await adminClient
  .from('organisations')
  .select('id')
  .eq('status', 'active');  // Only active orgs (not trial-expired, not cancelled)

for (const org of orgs) {
  await processReminders(adminClient, org.id);
}
```

**Warning signs:**
- Cron logs show unexpected email counts (10x normal)
- Clients receive emails from other accounting firms
- `reminder_queue` grows faster than expected
- Logs show clients being processed that don't belong to this firm

**Phase to address:** Phase 1 (Org Data Model) — must be resolved before any cron runs in multi-tenant mode.

**Sources:**
- [Supabase RLS and Service Role](https://supabase.com/docs/guides/troubleshooting/why-is-my-service-role-key-client-getting-rls-errors-or-not-returning-data-7_1K9z)
- [Supabase RLS Best Practices](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices)

---

### Pitfall 2: Missing `org_id` on One Table Exposes All Tenant Data

**What goes wrong:**
You carefully add `org_id` to 12 tables. You miss `app_settings`. Org A's staff can read Org B's sender name, reply-to address, send hour configuration, and onboarding state. Worse: because `app_settings` uses key-value storage without `org_id`, every org's `updateSendHour()` call updates a shared row. All orgs share the same send hour.

**Current tables that need `org_id` (none currently have it):**
```
clients                      — core business data, obvious risk
client_filing_assignments    — which filings apply to which client
client_deadline_overrides    — custom deadline dates
client_filing_status_overrides — traffic light status
email_templates              — potentially org-specific templates
schedules                    — reminder schedule config
schedule_steps               — schedule step config
schedule_client_exclusions   — per-client exclusions
client_email_overrides       — per-client email customisation
client_schedule_overrides    — per-client timing
reminder_queue               — CRITICAL: contains pending emails
email_log                    — delivery history
inbound_emails               — inbound replies
app_settings                 — config (send hour, sender name, etc.)
locks                        — distributed locks (needs org scoping)
bank_holidays_cache          — SHARED (no org_id needed — same UK holidays for all)
filing_types                 — SHARED (seeded reference data, immutable)
oauth_tokens                 — LEGACY (can be removed in v3.0)
```

**Why it happens:**
- `app_settings` is a key-value store; it doesn't look like "business data"
- `locks` and `bank_holidays_cache` are operational infrastructure
- Developer adds `org_id` to "obvious" business tables but misses system tables
- RLS policies with `USING (true)` remain from old migration and look fine in the SQL editor

**Prevention — exhaustive checklist before migration:**
```sql
-- Query to find tables WITHOUT org_id (run after adding to expected tables):
SELECT table_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name NOT IN ('bank_holidays_cache', 'filing_types')  -- shared tables
GROUP BY table_name
HAVING NOT bool_or(column_name = 'org_id');
```

The SQL editor bypasses RLS. Always test data isolation from the **client SDK** with a test user from each org, not from the SQL editor.

**Warning signs:**
- `app_settings` rows are missing `org_id` after migration
- All orgs share the same send hour when you change one org's setting
- Org B's users can see Org A's email templates via API
- RLS policies still use `USING (true)` after migration

**Phase to address:** Phase 1 (Org Data Model) — create a migration checklist before starting.

---

### Pitfall 3: Adding `org_id NOT NULL` Fails If Existing Rows Have No Value

**What goes wrong:**
Migration adds `org_id UUID NOT NULL REFERENCES organisations(id)` to `clients`. The `NOT NULL` constraint fails immediately because the existing single-tenant rows have no `org_id`. The migration fails. In a worst case, if running against production, the migration partially applies (some statements succeed, some fail), leaving the schema in a broken state.

**Why it happens:**
- Developer writes the target schema (what it should look like) without thinking about the current state (existing rows)
- PostgreSQL enforces `NOT NULL` at migration time, not lazily

**Prevention — safe migration pattern (3-step):**
```sql
-- Step 1: Add column as nullable first, with no constraint
ALTER TABLE clients ADD COLUMN org_id UUID REFERENCES organisations(id);

-- Step 2: Backfill existing rows with the founding org's ID
-- (You must create the founding org first in a prior migration)
UPDATE clients SET org_id = (
  SELECT id FROM organisations WHERE slug = 'peninsula-accounting' LIMIT 1
);

-- Step 3: Add NOT NULL constraint AFTER backfill is complete
ALTER TABLE clients ALTER COLUMN org_id SET NOT NULL;
```

Do this in a single migration file to keep the state atomic. The backfill `UPDATE` should be batched if tables have >10,000 rows (not an issue for single-tenant, but important pattern to establish).

**Specific risk for `app_settings`:** Key-value store needs `org_id` per row, but existing rows like `reminder_send_hour` have no org context. The backfill must assign all existing key-value pairs to the founding org.

**Warning signs:**
- Migration fails with `null value in column "org_id" violates not-null constraint`
- Schema is partially migrated (some tables have org_id, others don't)
- Production database has inconsistent schema after failed migration

**Phase to address:** Phase 1 (Org Data Model) — backfill logic must be in the migration, not manual.

---

### Pitfall 4: Stripe Webhook Race — `subscription.created` Arrives Before `checkout.session.completed`

**What goes wrong:**
User completes Stripe Checkout. Stripe fires multiple webhook events. Your webhook handler processes `customer.subscription.created` first, tries to look up `stripe_customer_id` in your `organisations` table, finds nothing (because `checkout.session.completed` hasn't been processed yet), and throws an error. Stripe retries. Meanwhile `checkout.session.completed` is processed, creates the org record. On retry, `customer.subscription.created` finds the org and duplicates or errors.

**Why it happens:**
- Stripe does not guarantee webhook event ordering
- `checkout.session.completed` and `customer.subscription.created` fire almost simultaneously
- Webhook handler assumes a specific processing order
- No idempotency — same event processed twice causes duplicates

**Correct webhook handling strategy:**

```typescript
// Handler for checkout.session.completed:
// This is the PRIMARY event for provisioning. Always use this.
case 'checkout.session.completed': {
  const session = event.data.object;
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  // Upsert — idempotent, safe to run twice:
  await supabase.from('organisations').upsert({
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    status: 'active',
  }, { onConflict: 'stripe_customer_id' });
  break;
}

// Handler for customer.subscription.updated:
// Use this to sync status changes (active → past_due → cancelled)
case 'customer.subscription.updated': {
  const sub = event.data.object;
  await supabase.from('organisations')
    .update({ status: mapStripeStatus(sub.status) })
    .eq('stripe_subscription_id', sub.id);
  break;
}

// AVOID handling customer.subscription.created for provisioning.
// It fires before checkout.session.completed in some orderings.
// If you must handle it, treat it as an upsert not a create.
```

**Idempotency requirement:** Store processed `event.id` values. Before processing, check if this event ID was already handled:

```typescript
const { data: existing } = await adminClient
  .from('processed_webhook_events')
  .select('id')
  .eq('stripe_event_id', event.id)
  .single();

if (existing) return NextResponse.json({ received: true }); // Already processed

// Process event...

// Mark as processed:
await adminClient.from('processed_webhook_events').insert({
  stripe_event_id: event.id,
  processed_at: new Date().toISOString(),
});
```

**Warning signs:**
- Stripe dashboard shows events with 4xx responses
- Organisation records created without subscription data
- Duplicate organisation records for same Stripe customer
- Subscription status never updates after creation

**Phase to address:** Phase 2 (Stripe Billing) — design for idempotency from the first line.

**Sources:**
- [Stripe Webhooks with Subscriptions](https://docs.stripe.com/billing/subscriptions/webhooks)
- [Stripe Webhook Idempotency](https://excessivecoding.com/blog/billing-webhook-race-condition-solution-guide)

---

### Pitfall 5: Trial Expiry Not Enforced If Stripe Webhook Fails

**What goes wrong:**
Org signs up for a 14-day trial. On day 15, Stripe fires `customer.subscription.trial_will_end` (3 days before) and then `customer.subscription.updated` (status: `past_due` or `unpaid`). If your webhook endpoint was down for maintenance (Vercel deploy, DNS issue), the events fail. Stripe retries for up to 3 days. During this window, the org continues to use the app with full access despite an expired trial.

**Why it happens:**
- Webhook-only enforcement creates a dependency on Stripe event delivery
- Stripe retries webhooks for up to 3 days (with exponential backoff)
- A 6-hour deployment window means 6 hours of missed events

**Prevention — defence in depth:**

1. **Gate on `organisations.status` in middleware**, not just on subscription events:
```typescript
// middleware.ts — after resolving tenant:
const { data: org } = await supabase
  .from('organisations')
  .select('status, trial_ends_at')
  .eq('id', orgId)
  .single();

const isTrialExpired = org.trial_ends_at && new Date(org.trial_ends_at) < new Date();
const isSubscriptionInactive = ['cancelled', 'expired', 'past_due'].includes(org.status);

if (isTrialExpired && !org.stripe_subscription_id) {
  return NextResponse.redirect(new URL('/billing/upgrade', request.url));
}
if (isSubscriptionInactive) {
  return NextResponse.redirect(new URL('/billing/suspended', request.url));
}
```

2. **Set `trial_ends_at` at org creation time** (computed from trial period):
```typescript
const trialEndsAt = addDays(new Date(), 14);
await supabase.from('organisations').insert({
  trial_ends_at: trialEndsAt.toISOString(),
  status: 'trialing',
});
```

3. **Add a daily cron that checks for expired trials** as a fallback:
```typescript
// /api/cron/expire-trials — runs daily
const { data: expiredOrgs } = await adminClient
  .from('organisations')
  .select('id')
  .eq('status', 'trialing')
  .lt('trial_ends_at', new Date().toISOString())
  .is('stripe_subscription_id', null);

for (const org of expiredOrgs) {
  await adminClient.from('organisations')
    .update({ status: 'trial_expired' })
    .eq('id', org.id);
}
```

**Warning signs:**
- Orgs with `trial_ends_at` in the past still have `status: 'trialing'`
- Stripe dashboard shows webhook delivery failures
- Access logs show orgs with expired trials making API calls
- No Stripe subscription associated with active org after trial period

**Phase to address:** Phase 2 (Stripe Billing) + Phase 1 middleware.

---

### Pitfall 6: Subdomain Routing Cookie Scope — User Logged In On Wrong Tenant

**What goes wrong:**
User has two separate accounting practices (or tests from two accounts). They log into `firm-a.app.com`. Supabase sets a session cookie. They navigate directly to `firm-b.app.com`. The cookie is **scoped to `firm-a.app.com`** by default. The user appears unauthenticated on `firm-b` and is redirected to login. They log into `firm-b`. Now they have two active sessions on different subdomains.

The worse scenario: cookies are scoped to `.app.com` (shared across all subdomains). User logged into `firm-a` navigates to `firm-b` and is **authenticated as firm-a's user** on firm-b's subdomain. The tenant resolution reads the subdomain (`firm-b`) but the session user belongs to `firm-a`. If org-scoping is applied at the RLS level, this is safe. If org-scoping is applied at the application level (looking up the subdomain, not the user's org), this becomes a cross-tenant access vulnerability.

**The correct model:**
- Tenant identity comes from the **authenticated user's JWT claims** (specifically `app_metadata.org_id`), not from the subdomain
- The subdomain is used for routing and UX only
- Middleware validates that the authenticated user's `org_id` matches the subdomain's org

```typescript
// middleware.ts — correct pattern:
const subdomain = getSubdomain(request.url); // 'firm-a' from 'firm-a.app.com'

// Resolve subdomain to org_id from database
const { data: org } = await supabase
  .from('organisations')
  .select('id')
  .eq('slug', subdomain)
  .single();

if (!org) return NextResponse.redirect(new URL('/404', request.url));

// Check authenticated user belongs to this org
const { data: { user } } = await supabase.auth.getUser();
const userOrgId = user?.app_metadata?.org_id;

if (userOrgId !== org.id) {
  // Wrong tenant — redirect to their correct subdomain or show error
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/login', request.url));
}
```

**Local development warning:** `localhost` has no subdomains. Multi-tenant middleware must detect local dev and bypass subdomain routing:

```typescript
const isLocalDev = request.nextUrl.hostname === 'localhost';
if (isLocalDev) {
  // Use a query param or env var to specify tenant in dev
  orgId = process.env.DEV_ORG_ID;
}
```

**Warning signs:**
- User on `firm-b` subdomain authenticated with `firm-a` credentials
- Cross-tenant data visible after navigating between subdomains
- Local development breaks entirely because `localhost` has no subdomain
- Cookie errors in browser console for subdomain mismatch

**Phase to address:** Phase 3 (Subdomain Routing) — test cross-tenant navigation explicitly.

**Sources:**
- [Next.js Multi-Tenant Guide](https://nextjs.org/docs/app/guides/multi-tenant)
- [Multi-Tenant Subdomain Setup with Next.js and Supabase](https://github.com/vercel/next.js/discussions/84461)

---

### Pitfall 7: `user_metadata` in JWT Claims Is User-Modifiable — Never Use for RLS Org Scoping

**What goes wrong:**
Developer adds `org_id` to user JWT using `user_metadata` (the user-controlled part of the JWT). RLS policy reads `(auth.jwt() -> 'user_metadata' ->> 'org_id')`. An authenticated user calls `supabase.auth.updateUser({ data: { org_id: 'other-org-uuid' } })` from the browser. Their JWT is re-issued with the attacker's chosen `org_id`. They now have full RLS-authenticated access to another org's data.

**Why it happens:**
- `raw_user_metadata` is modifiable by the user themselves via the client SDK
- `raw_app_metadata` is only modifiable via the service role key
- Documentation doesn't always make this distinction clear
- Developer uses `user_metadata` because it's easier to set during signup

**Prevention:**
Always use `app_metadata` for security-sensitive claims:

```sql
-- WRONG — user can modify this claim themselves:
CREATE POLICY "Users see own org data" ON clients
  USING (org_id = (auth.jwt() -> 'user_metadata' ->> 'org_id')::uuid);

-- CORRECT — only service role can set app_metadata:
CREATE POLICY "Users see own org data" ON clients
  USING (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);
```

Set `app_metadata` when inviting or creating a user (requires service role):
```typescript
// Must be service role — not accessible from browser client:
await adminClient.auth.admin.updateUserById(userId, {
  app_metadata: { org_id: orgId, role: 'admin' },
});
```

**Warning signs:**
- RLS policies reference `user_metadata` for org or role claims
- Frontend code calls `supabase.auth.updateUser()` with org-related fields
- Test shows user can change their `org_id` in browser devtools

**Phase to address:** Phase 1 (Org Data Model) — JWT claim design must be correct from the start.

**Sources:**
- [Supabase Custom Claims and RBAC](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac)
- [JWT Claims Reference](https://supabase.com/docs/guides/auth/jwt-fields)

---

### Pitfall 8: Invite Tokens Without Expiry Enable Replay Attacks

**What goes wrong:**
Firm admin invites a new staff member. The invite email is forwarded, accidentally leaked in a support ticket, or sits in a former employee's inbox. Six months later, someone uses the invite link. It still works. They gain full access to the org as a legitimate member.

The subtler form: invite tokens are not invalidated after first use. User clicks the link, gets an error, clicks again — both attempts succeed and the user is created twice.

**Why it happens:**
- Invite token is stored as a simple UUID or random string with no expiry
- No cleanup of used or expired tokens
- Token validity is binary (exists/doesn't exist) rather than stateful

**Prevention — minimum viable invite security:**

```sql
CREATE TABLE org_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  role TEXT NOT NULL DEFAULT 'member',
  invited_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '48 hours'),
  accepted_at TIMESTAMPTZ,   -- NULL = not yet used
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Acceptance logic must be atomic:
```typescript
// Must be a single transaction:
const { data: invite } = await supabase
  .from('org_invites')
  .select('*')
  .eq('token', token)
  .is('accepted_at', null)           // Not already used
  .gt('expires_at', new Date())      // Not expired
  .eq('email', user.email)           // Must match invited email
  .single();

if (!invite) throw new Error('Invalid, expired, or already used invite');

// Mark used immediately (before creating membership, to prevent race):
await adminClient.from('org_invites')
  .update({ accepted_at: new Date().toISOString() })
  .eq('id', invite.id);
```

**Warning signs:**
- Invite links work indefinitely
- Same invite can be used multiple times
- Invite links don't verify the accepting user's email matches

**Phase to address:** Phase 4 (Team & Invite System).

---

### Pitfall 9: Super-Admin Routes Not Protected Against Org Users

**What goes wrong:**
Super-admin panel at `/admin` or `/api/admin/*` is secured only by authentication (any logged-in user) rather than by admin role. An org user navigates to `/admin`, is authenticated, and can see the org management panel. They can read all org names, change billing status, or access other tenants' data.

**Why it happens:**
- Early in development, "authentication = authorisation" is acceptable
- Super-admin features are added quickly without full RBAC
- Middleware checks `isAuthenticated` but not `isSuperAdmin`

**Prevention:**

```typescript
// lib/auth/super-admin.ts
export async function requireSuperAdmin(request: NextRequest) {
  const supabase = createServerClient(/* ... */);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Super admin flag must be in app_metadata (not user_metadata):
  const isSuperAdmin = user.app_metadata?.is_super_admin === true;

  if (!isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
}
```

Super-admin users should be a **separate auth concept** from org users. Consider using a completely separate Supabase project for the admin panel to provide full isolation.

**Warning signs:**
- `/admin` returns 200 for non-super-admin users
- Super-admin check uses `user_metadata` instead of `app_metadata`
- No tests for 403 responses on admin routes from regular org users

**Phase to address:** Phase 5 (Super-Admin Panel).

---

### Pitfall 10: Postmark Token Migration — Sending Silently Fails If Token Is Null

**What goes wrong:**
Current system uses a single `POSTMARK_SERVER_TOKEN` env var. In multi-tenant, each org needs its own Postmark server token (to send from their own domain/sender). You move the token to `organisations.postmark_server_token`. The cron job fetches the token from the database to initialise the Postmark client. For any org without a configured token (newly created, token not yet entered), `postmark_server_token` is `NULL`. The code path is:

```typescript
const token = org.postmark_server_token;
const client = new ServerClient(token);  // token is null
client.sendEmail(...)  // Postmark returns 401 — "bad or missing API token"
```

All emails for that org **silently fail**. The cron marks queue entries as `failed`, the org never notices (no notification), and clients miss reminder deadlines.

**Current code location at risk:**
```
lib/email/client.ts — currently reads from env var (POSTMARK_SERVER_TOKEN)
lib/email/sender.ts — calls getPostmarkClient() which reads the env var
```

After migration, the token must come from the org context, not a global env var.

**Prevention:**

1. **Validate token exists before processing any emails for an org:**
```typescript
if (!org.postmark_server_token) {
  // Log + notify org admin, don't silently fail:
  await adminClient.from('org_notifications').insert({
    org_id: org.id,
    type: 'email_sending_misconfigured',
    message: 'Postmark token not configured. Reminder emails are paused.',
    created_at: new Date().toISOString(),
  });
  continue; // Skip this org in the cron loop
}
```

2. **Add a setup/onboarding step that requires token configuration before reminders go live.**

3. **Keep the global env var as a fallback for the founding org during migration**, removing it only after all orgs have their own token.

**Warning signs:**
- Email send failures cluster around recently created orgs
- `email_log` shows `delivery_status: 'failed'` with Postmark 401 errors
- Cron logs show errors but the cron still returns 200 (errors are per-org, not fatal)

**Phase to address:** Phase 1 (Org Data Model) — schema; Phase 2 (Email config per org) — enforcement.

---

## Moderate Pitfalls

Mistakes that cause delays or technical debt (but not immediate data breaches).

---

### Pitfall 11: Forgetting `org_id` on a New Table in Future Development

**What goes wrong:**
After v3.0 ships, a developer adds a new table `client_notes` without an `org_id` column. RLS is added (`USING (true)` for authenticated users). Now all authenticated users from all orgs can read all notes.

**Prevention — architectural guardrails:**

1. **Linting rule**: Add a SQL check that runs in CI:
```sql
-- Test: every public table except shared ones has org_id
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name NOT IN (
    'bank_holidays_cache', 'filing_types',
    'processed_webhook_events', 'schema_migrations'
  )
  AND table_name NOT IN (
    SELECT table_name FROM information_schema.columns
    WHERE column_name = 'org_id'
  );
-- This query should return 0 rows
```

2. **RLS template for new tables:**
```sql
-- Standard pattern for any new tenant-scoped table:
ALTER TABLE {new_table} ENABLE ROW LEVEL SECURITY;

CREATE POLICY "{new_table} authenticated" ON {new_table}
  FOR ALL TO authenticated
  USING (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid)
  WITH CHECK (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

CREATE POLICY "{new_table} service role" ON {new_table}
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

3. **ARCHITECTURE.md must document** the org_id requirement and template.

**Phase to address:** Phase 1 — establish the pattern; ongoing vigilance.

---

### Pitfall 12: `app_settings` Key-Value Store Breaks Under Multi-Tenancy

**What goes wrong:**
Current `app_settings` uses a global key-value store (`key = 'reminder_send_hour'`, `value = '9'`). In multi-tenant, each org has its own send hour. Adding `org_id` means the primary key changes from `key` to `(org_id, key)`. All existing code that does:

```typescript
await supabase.from('app_settings').update({ value: String(hour) }).eq('key', 'reminder_send_hour');
```

Now updates ALL orgs' send hours (because `eq('key', ...)` without `eq('org_id', ...)` matches all).

**Prevention:**
1. Add `org_id` to `app_settings` with a composite unique constraint: `UNIQUE(org_id, key)`
2. Audit every `app_settings` read/write in `app/actions/settings.ts` (7 functions)
3. Each function must add `.eq('org_id', orgId)` to every query
4. The `orgId` must come from the authenticated session, not a parameter

**Phase to address:** Phase 1 (Org Data Model) — restructure `app_settings` before adding tenants.

---

### Pitfall 13: The `locks` Table Cron Lock Becomes Cross-Tenant After Migration

**What goes wrong:**
Current cron uses `locks` table with id `'cron_reminders'` as a distributed lock. In multi-tenant mode, if the cron iterates over orgs, using a single lock ID blocks processing across ALL orgs when one org's processing is running. If the cron fails mid-way through org 3 of 10, the lock isn't released, and ALL orgs are blocked until the lock TTL expires (5 minutes).

**Prevention:**
Use per-org lock IDs:
```typescript
const lockId = `cron_reminders_${orgId}`;
```

Or use a single outer lock for the cron invocation, but make the per-org processing resilient to individual failures (catch per-org errors, don't abort the outer loop).

**Phase to address:** Phase 1 (Org Data Model) + cron refactor.

---

## Minor Pitfalls

Mistakes that cause annoyance but are fixable.

---

### Pitfall 14: Subdomain Routing Breaks Vercel Preview Deployments

**What goes wrong:**
Vercel preview deployments have URLs like `project-git-main-username.vercel.app`. There are no subdomains. The multi-tenant middleware reads the subdomain to resolve the org. On preview deployments, there is no subdomain, middleware fails, and every page returns 404 or a redirect loop.

**Prevention:**
```typescript
// Detect Vercel preview environment:
const isVercelPreview = process.env.VERCEL_ENV === 'preview';
const isLocalDev = request.nextUrl.hostname === 'localhost';

if (isVercelPreview || isLocalDev) {
  // Fall through to a default org (env var or first org in DB)
  orgId = process.env.DEV_ORG_ID || await getFirstOrgId();
}
```

**Phase to address:** Phase 3 (Subdomain Routing).

---

### Pitfall 15: CSV Import Assigns Clients to Wrong Org

**What goes wrong:**
`app/actions/csv.ts` inserts clients without an `org_id`. After migration, the `INSERT` into `clients` fails (NOT NULL violation) OR inserts with `org_id = null` if the constraint isn't enforced. The clients are created but invisible to the org's users (RLS filters them out).

**Prevention:**
All INSERT operations via server actions must inject `org_id` from the user's session. A helper function:

```typescript
// lib/auth/get-org-id.ts
export async function getOrgId(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const orgId = user?.app_metadata?.org_id;
  if (!orgId) throw new Error('No org_id in session — user not associated with an organisation');
  return orgId;
}
```

Call `getOrgId()` at the start of every server action that creates data.

**Phase to address:** Phase 1 (Org Data Model) — refactor all server actions.

---

## Phase-Specific Warnings

| Phase | Likely Pitfall | Mitigation |
|-------|---------------|------------|
| Phase 1: Org Data Model | Missing `org_id` on `app_settings` or `locks` | Run the "tables without org_id" SQL query before migration |
| Phase 1: Org Data Model | `NOT NULL` migration fails on existing rows | Always: add nullable → backfill → add constraint (3 steps) |
| Phase 1: Org Data Model | `user_metadata` used for org claims | Must use `app_metadata` from day one — hard to change later |
| Phase 2: Stripe Billing | `subscription.created` race condition | Use `checkout.session.completed` as primary provisioning event |
| Phase 2: Stripe Billing | Trial expiry relies only on webhooks | Add `trial_ends_at` column + daily cron fallback |
| Phase 2: Stripe Billing | Duplicate webhook processing | Implement idempotency via `processed_webhook_events` table |
| Phase 3: Subdomain Routing | Wrong tenant from cookie leak | Validate `user.app_metadata.org_id` matches subdomain org |
| Phase 3: Subdomain Routing | Breaks on local dev / Vercel preview | Add env-based bypass for non-subdomain environments |
| Phase 4: Team & Invites | Invite tokens never expire | Set 48-hour expiry + invalidate on first use |
| Phase 4: Team & Invites | Email of acceptor not validated | Verify accepting user's email === invite email |
| Phase 5: Super-Admin | Super-admin accessible to org users | Role check must use `app_metadata`, not `user_metadata` |
| Ongoing: New tables | Missing `org_id` on new table | SQL lint check in CI; standard RLS template in ARCHITECTURE.md |
| Ongoing: Cron jobs | New cron queries without org filter | Code review checklist: "does this query have `.eq('org_id', orgId)`?" |

---

## "Looks Done But Isn't" Checklist

For multi-tenancy migration specifically:

- [ ] **RLS policies** still say `USING (true)` — looks authenticated, but any org can read any row
- [ ] **Cron jobs** compile and run — but without org filter they process all tenants' data
- [ ] **Service role queries** look correct in SQL editor — but SQL editor bypasses RLS, test from client SDK
- [ ] **Postmark sending** works — but with global env var token; per-org token path never tested
- [ ] **Subdomain routing** works on production domain — broken on localhost and Vercel preview
- [ ] **Invite links** work — but never expire and can be replayed
- [ ] **Trial enforcement** works when Stripe webhooks arrive — fails silently when they don't
- [ ] **CSV import** creates clients — but `org_id` is null, clients invisible in dashboard

---

## Recovery Strategies

| Incident | Recovery Cost | Recovery Steps |
|----------|---------------|----------------|
| Cron sent emails to all orgs' clients | HIGH | 1. Disable crons immediately<br>2. Query `email_log` for cross-org sends<br>3. Add `org_id` filters to all cron queries<br>4. Notify affected orgs<br>5. Re-enable crons per-org with testing |
| Org B sees Org A's data in dashboard | CRITICAL | 1. Take app offline or disable affected org<br>2. Audit all RLS policies for `USING (true)` without org filter<br>3. Fix and deploy within 1 hour<br>4. Audit logs for data access by wrong-org users |
| NOT NULL migration fails on production | MEDIUM | 1. Migration is transactional — schema unchanged<br>2. Fix migration to use 3-step pattern<br>3. Re-run from development first |
| Stripe webhook race — org created without subscription | LOW | 1. Query Stripe API directly for subscription status<br>2. Backfill missing subscription IDs<br>3. Add idempotency to webhook handlers |
| Super-admin route accessible to org users | HIGH | 1. Add `app_metadata.is_super_admin` check immediately<br>2. Audit access logs for unauthorised admin access<br>3. Rotate any super-admin credentials if accessed |
| Invite token used by wrong person | MEDIUM | 1. Revoke invite + remove org membership<br>2. Notify org admin<br>3. Add email validation to invite acceptance flow |

---

## Sources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Service Role Key and RLS](https://supabase.com/docs/guides/troubleshooting/why-is-my-service-role-key-client-getting-rls-errors-or-not-returning-data-7_1K9z)
- [Supabase Custom Claims and RBAC](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac)
- [Supabase RLS Performance and Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [Supabase JWT Claims Reference](https://supabase.com/docs/guides/auth/jwt-fields)
- [Stripe Webhooks with Subscriptions](https://docs.stripe.com/billing/subscriptions/webhooks)
- [Stripe Webhook Race Condition Solution](https://excessivecoding.com/blog/billing-webhook-race-condition-solution-guide)
- [Zero-downtime Postgres Migrations (GoCardless)](https://gocardless.com/blog/zero-downtime-postgres-migrations-the-hard-parts/)
- [Next.js Multi-Tenant Guide](https://nextjs.org/docs/app/guides/multi-tenant)
- [Multi-Tenant Subdomain with Next.js + Supabase (Vercel Discussion)](https://github.com/vercel/next.js/discussions/84461)
- [Supabase Multi-Tenancy Patterns (Discussion #1615)](https://github.com/orgs/supabase/discussions/1615)
- [Supabase RLS Best Practices (Makerkit)](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices)
- [Tenant Isolation Architecture (SecurityBoulevard, 2025)](https://securityboulevard.com/2025/12/tenant-isolation-in-multi-tenant-systems-architecture-identity-and-security/)

---

*Pitfalls research for: Peninsula Accounting v3.0 Multi-Tenancy & SaaS Platform*
*Researched: 2026-02-19*
*Confidence: HIGH (codebase-verified — all pitfalls traced to specific files/patterns in the existing codebase)*
