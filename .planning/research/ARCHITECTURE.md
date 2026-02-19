# Architecture Patterns: Multi-Tenancy Migration

**Project:** Peninsula Accounting — v3.0 Multi-Tenancy & SaaS Platform
**Researched:** 2026-02-19
**Scope:** Migration from single-tenant (one Supabase project per firm) to shared-project multi-tenant
**Overall confidence:** HIGH — all core patterns verified against Supabase official documentation and Next.js official documentation

---

## Recommended Architecture Overview

```
                        Vercel (single deployment)
                   ┌─────────────────────────────────────────┐
                   │                                         │
  Browser ───────► │  middleware.ts                          │
  (firmA.          │  1. Extract orgSlug from host header    │
   app.domain.com) │  2. Set x-org-slug header               │
                   │  3. Rewrite to same App Router routes   │
                   │  4. Refresh Supabase session cookie     │
                   │                                         │
                   │  Server Components / Actions            │
                   │  Read x-org-slug, resolve org_id via   │
                   │  cached DB lookup (getCurrentOrg())     │
                   │                                         │
                   │  Cron routes                            │
                   │  Service role — must manually loop      │
                   │  over orgs and filter by org_id         │
                   └──────────────┬──────────────────────────┘
                                  │
                   ┌──────────────▼──────────────────────────┐
                   │   Supabase (SINGLE shared project)       │
                   │                                          │
                   │   organisations table                    │
                   │   user_organisations table               │
                   │   All existing tables + org_id column   │
                   │                                          │
                   │   RLS: USING (org_id = (auth.jwt()       │
                   │          ->> 'org_id')::uuid)            │
                   │                                          │
                   │   JWT custom claims via Auth Hook:       │
                   │   { org_id, org_role }                   │
                   └──────────────────────────────────────────┘
```

---

## 1. RLS Policy Pattern

### Decision: JWT Custom Claims (not direct table lookup)

**Recommended approach:** Store `org_id` as a JWT claim via the Supabase Custom Access Token Hook. RLS policies read `(auth.jwt() ->> 'org_id')::uuid` — no subquery on every row, Postgres caches the JWT parse per statement.

**Why not `user_organisations` table subquery directly in each policy:**
The Supabase performance documentation is explicit: any join table referenced in an RLS expression triggers that table's own RLS, compounding evaluation cost. A subquery like `(SELECT org_id FROM user_organisations WHERE user_id = auth.uid())` evaluates on every candidate row. On a scan of 50,000 `email_log` rows that is 50,000 subquery evaluations. JWT claim extraction runs once per statement and is cached by the Postgres query planner.

Sources: [Supabase RLS Performance and Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv), [Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security)

### Handling Users Who Belong to Multiple Orgs

For v3.0, the constraint is simpler than the general multi-org case: each user belongs to exactly one accounting firm, and that firm is identified by the subdomain they log in on. The `org_id` stored in `app_metadata` at user creation time is the single org this user belongs to.

If a future v4.0 requires users to switch orgs (e.g., a freelancer working across firms), the session token approach would need to change — the Custom Access Token Hook would read the "active org" from a per-session setting rather than a static `app_metadata` field. This is a deliberate scope cut for v3.0.

### Custom Access Token Hook — SQL

```sql
-- Create the hook function
-- Runs before every JWT is issued (login, token refresh)
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims        jsonb;
  v_org_id      uuid;
  v_role        text;
BEGIN
  claims := event -> 'claims';

  -- Read org_id from app_metadata (written at user creation / org assignment)
  v_org_id := (event -> 'claims' -> 'app_metadata' ->> 'org_id')::uuid;

  -- Look up the user's role within that org
  -- This single lookup at token-issuance time is acceptable performance-wise.
  -- It does NOT run on every row during a query — it runs once at login.
  IF v_org_id IS NOT NULL THEN
    SELECT uo.role
    INTO   v_role
    FROM   public.user_organisations uo
    WHERE  uo.user_id = (event ->> 'user_id')::uuid
      AND  uo.org_id  = v_org_id
    LIMIT  1;
  END IF;

  -- Embed org_id and org_role as top-level JWT claims
  IF v_org_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{org_id}', to_jsonb(v_org_id::text));
  END IF;

  claims := jsonb_set(
    claims,
    '{org_role}',
    to_jsonb(COALESCE(v_role, 'member'))
  );

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Grant execute only to the Supabase auth system role
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook
  FROM authenticated, anon, public;
```

After creating this function, register it in the Supabase Dashboard:
**Authentication > Hooks > Custom Access Token Hook** — select the `public.custom_access_token_hook` function.

Sources: [Custom Access Token Hook | Supabase Docs](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook), [Custom Claims & RBAC | Supabase Docs](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac)

### RLS Policy Templates — Standard Tenant-Scoped Table

Apply this exact pattern to: `clients`, `client_filing_assignments`, `client_deadline_overrides`, `client_filing_status_overrides`, `email_templates`, `schedules`, `schedule_steps`, `schedule_client_exclusions`, `client_email_overrides`, `client_schedule_overrides`, `reminder_queue`, `email_log`, `inbound_emails`, `app_settings`, `locks`, `oauth_tokens`.

```sql
-- Enable RLS (required)
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- SELECT: user sees only their org's rows
CREATE POLICY "clients_org_select"
  ON public.clients
  FOR SELECT
  TO authenticated
  USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

-- INSERT: user can only insert into their own org
CREATE POLICY "clients_org_insert"
  ON public.clients
  FOR INSERT
  TO authenticated
  WITH CHECK (org_id = (auth.jwt() ->> 'org_id')::uuid);

-- UPDATE: same org on both sides
CREATE POLICY "clients_org_update"
  ON public.clients
  FOR UPDATE
  TO authenticated
  USING     (org_id = (auth.jwt() ->> 'org_id')::uuid)
  WITH CHECK (org_id = (auth.jwt() ->> 'org_id')::uuid);

-- DELETE: same org
CREATE POLICY "clients_org_delete"
  ON public.clients
  FOR DELETE
  TO authenticated
  USING (org_id = (auth.jwt() ->> 'org_id')::uuid);
```

### RLS Policies — Global Reference Tables (no change)

`filing_types` and `bank_holidays_cache` are global reference data, shared across all orgs. Keep existing `USING (true)` policies or replace with `TO authenticated USING (true)`. No `org_id` column needed on these tables.

### RLS Policies — organisations table

```sql
ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;

-- Users can read only their own org's record
CREATE POLICY "organisations_self_select"
  ON public.organisations
  FOR SELECT
  TO authenticated
  USING (id = (auth.jwt() ->> 'org_id')::uuid);

-- Only org admins can update org settings
-- Note: sensitive fields like postmark_server_token should be
-- updated only through a server action with additional auth checks,
-- not directly via client queries
CREATE POLICY "organisations_admin_update"
  ON public.organisations
  FOR UPDATE
  TO authenticated
  USING     (id = (auth.jwt() ->> 'org_id')::uuid
             AND (auth.jwt() ->> 'org_role') = 'admin')
  WITH CHECK (id = (auth.jwt() ->> 'org_id')::uuid
             AND (auth.jwt() ->> 'org_role') = 'admin');
```

### RLS Policies — user_organisations table

```sql
ALTER TABLE public.user_organisations ENABLE ROW LEVEL SECURITY;

-- Users can see members of their own org
CREATE POLICY "user_orgs_select"
  ON public.user_organisations
  FOR SELECT
  TO authenticated
  USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

-- Only admins can manage org membership
CREATE POLICY "user_orgs_admin_write"
  ON public.user_organisations
  FOR ALL
  TO authenticated
  USING     (org_id = (auth.jwt() ->> 'org_id')::uuid
             AND (auth.jwt() ->> 'org_role') = 'admin')
  WITH CHECK (org_id = (auth.jwt() ->> 'org_id')::uuid
             AND (auth.jwt() ->> 'org_role') = 'admin');
```

### Required Indexes

Every tenant-scoped table needs an index on `org_id`. Use `CONCURRENTLY` in production to avoid table locks:

```sql
CREATE INDEX CONCURRENTLY idx_clients_org_id
  ON public.clients(org_id);
CREATE INDEX CONCURRENTLY idx_client_filing_assignments_org_id
  ON public.client_filing_assignments(org_id);
CREATE INDEX CONCURRENTLY idx_reminder_queue_org_id
  ON public.reminder_queue(org_id);
CREATE INDEX CONCURRENTLY idx_email_log_org_id
  ON public.email_log(org_id);
CREATE INDEX CONCURRENTLY idx_inbound_emails_org_id
  ON public.inbound_emails(org_id);
CREATE INDEX CONCURRENTLY idx_schedules_org_id
  ON public.schedules(org_id);
CREATE INDEX CONCURRENTLY idx_email_templates_org_id
  ON public.email_templates(org_id);
CREATE INDEX CONCURRENTLY idx_app_settings_org_id
  ON public.app_settings(org_id);
CREATE INDEX CONCURRENTLY idx_locks_org_id
  ON public.locks(org_id);
```

---

## 2. Subdomain Routing — Next.js 15 App Router Middleware

### Pattern: URL Rewrite with Header Injection

The browser URL stays as `firmA.app.example.com/clients`. Middleware transparently rewrites to the same App Router route while injecting `x-org-slug` as a trusted request header. No changes to the route file structure are required. This is the pattern used by the Vercel Platforms reference implementation.

Sources: [Guides: Multi-tenant | Next.js](https://nextjs.org/docs/app/guides/multi-tenant), [vercel/platforms](https://github.com/vercel/platforms), [Vercel multi-tenant domain management](https://vercel.com/docs/multi-tenant/domain-management)

### middleware.ts

```typescript
import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Set via NEXT_PUBLIC_ROOT_DOMAIN env var, e.g. "app.example.com"
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'app.example.com'

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone()
  // Strip port for local dev comparisons
  const hostname = (request.headers.get('host') ?? '').replace(/:\d+$/, '')

  // Determine org slug from subdomain
  // Production:  firmA.app.example.com  → orgSlug = 'firmA'
  // Local dev:   firmA.localhost         → orgSlug = 'firmA'
  let orgSlug: string | null = null

  if (hostname.endsWith(`.${ROOT_DOMAIN}`)) {
    orgSlug = hostname.slice(0, -(ROOT_DOMAIN.length + 1))
  } else if (hostname.endsWith('.localhost')) {
    orgSlug = hostname.slice(0, -('.localhost'.length))
  }

  // Root domain (no subdomain) — marketing site or login portal
  if (!orgSlug) {
    return NextResponse.next()
  }

  // Inject org slug as a trusted header.
  // This header is set by middleware (server-side); client code cannot spoof it.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-org-slug', orgSlug)

  // Rewrite: keep URL the same in browser, inject headers
  const response = NextResponse.rewrite(url, {
    request: { headers: requestHeaders },
  })

  // Run Supabase session refresh (must run on every request)
  return await updateSession(request, response)
}

export const config = {
  matcher: [
    // Run on all paths except Next.js internals and static files
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

### Resolving org_id in Server Components and Actions

```typescript
// lib/org/current-org.ts
import { headers } from 'next/headers'
import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'

export type OrgContext = {
  id: string
  name: string
  slug: string
  plan_tier: string
  postmark_server_token: string | null
  postmark_sender_domain: string | null
}

// React cache() deduplicates this DB call within a single request.
// Multiple server components calling getCurrentOrg() in the same
// request hit the DB only once.
export const getCurrentOrg = cache(async (): Promise<OrgContext | null> => {
  const headerStore = await headers()
  const orgSlug = headerStore.get('x-org-slug')
  if (!orgSlug) return null

  const supabase = createAdminClient()
  const { data: org } = await supabase
    .from('organisations')
    .select('id, name, slug, plan_tier, postmark_server_token, postmark_sender_domain')
    .eq('slug', orgSlug)
    .single()

  return org ?? null
})
```

Usage in a server action:

```typescript
// In any app/actions/*.ts
import { getCurrentOrg } from '@/lib/org/current-org'

export async function someAction() {
  const org = await getCurrentOrg()
  if (!org) throw new Error('Organisation not found')
  // org.id is the org_id to use for all queries
}
```

### Vercel DNS Setup

1. Add root domain in Vercel project settings: `app.example.com`
2. Add wildcard domain: `*.app.example.com`
3. Point domain nameservers to Vercel (`ns1.vercel-dns.com`, `ns2.vercel-dns.com`) — required for wildcard SSL certificate provisioning
4. For local development: entries in `/etc/hosts` like `127.0.0.1 firmA.localhost` or a local proxy tool

---

## 3. Database Migration Strategy — Zero Downtime

### Principle: Expand → Backfill → Contract

The migration runs in three phases. The application remains live throughout. No single step requires a maintenance window.

### Phase A: Expand — New tables and nullable columns

This migration is purely additive. No existing columns changed, no constraints added yet. Deploy and run this migration while the app is serving traffic.

```sql
-- ================================================================
-- Step 1: New tables
-- ================================================================

CREATE TABLE public.organisations (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   text        NOT NULL,
  slug                   text        NOT NULL UNIQUE,
  plan_tier              text        NOT NULL DEFAULT 'starter'
                           CHECK (plan_tier IN ('starter', 'pro', 'enterprise')),
  stripe_customer_id     text,
  stripe_subscription_id text,
  -- Postmark per-org config (replaces env vars)
  postmark_server_token  text,
  postmark_sender_domain text,
  trial_ends_at          timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_organisations (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id     uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'member'
               CHECK (role IN ('admin', 'member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, org_id)
);

CREATE TABLE public.invitations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  email       text        NOT NULL,
  role        text        NOT NULL DEFAULT 'member',
  token       text        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ================================================================
-- Step 2: Seed the first (existing) organisation
-- This must be done before adding FK columns below
-- ================================================================

INSERT INTO public.organisations (id, name, slug, plan_tier)
VALUES (
  gen_random_uuid(),  -- capture this UUID; used in backfill
  'Peninsula Accounting',
  'peninsula',
  'pro'
);

-- ================================================================
-- Step 3: Add nullable org_id FK to all tenant-scoped tables
-- No NOT NULL, no defaults — fast ALTER with no table rewrite
-- ================================================================

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organisations(id);
ALTER TABLE public.client_filing_assignments
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organisations(id);
ALTER TABLE public.client_deadline_overrides
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organisations(id);
ALTER TABLE public.client_filing_status_overrides
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organisations(id);
ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organisations(id);
ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organisations(id);
ALTER TABLE public.schedule_steps
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organisations(id);
ALTER TABLE public.schedule_client_exclusions
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organisations(id);
ALTER TABLE public.client_email_overrides
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organisations(id);
ALTER TABLE public.client_schedule_overrides
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organisations(id);
ALTER TABLE public.reminder_queue
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organisations(id);
ALTER TABLE public.email_log
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organisations(id);
ALTER TABLE public.inbound_emails
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organisations(id);
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organisations(id);
ALTER TABLE public.locks
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organisations(id);
ALTER TABLE public.oauth_tokens
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organisations(id);
```

After this migration: deploy application code that writes `org_id` on all new inserts (using the known first org's ID from `getCurrentOrg()`). Existing rows have NULL org_id but the app continues working because RLS has not been activated yet.

### Phase B: Backfill — Populate existing rows

Run this script after deploying the app code that writes org_id on new rows. Use batches to avoid locking large tables.

```sql
-- Backfill all tenant-scoped tables with the first org's ID
-- Run once per table; the DO block avoids long table locks

DO $$
DECLARE
  v_org_id      uuid;
  rows_updated  int;
  tables        text[] := ARRAY[
    'clients',
    'client_filing_assignments',
    'client_deadline_overrides',
    'client_filing_status_overrides',
    'email_templates',
    'schedules',
    'schedule_steps',
    'schedule_client_exclusions',
    'client_email_overrides',
    'client_schedule_overrides',
    'reminder_queue',
    'email_log',
    'inbound_emails',
    'app_settings',
    'locks',
    'oauth_tokens'
  ];
  t             text;
BEGIN
  SELECT id INTO v_org_id
  FROM public.organisations
  WHERE slug = 'peninsula'
  LIMIT 1;

  FOREACH t IN ARRAY tables LOOP
    RAISE NOTICE 'Backfilling table: %', t;
    LOOP
      EXECUTE format(
        'UPDATE public.%I
         SET    org_id = $1
         WHERE  org_id IS NULL
         AND    ctid IN (
                  SELECT ctid FROM public.%I
                  WHERE  org_id IS NULL
                  LIMIT  500
                )',
        t, t
      ) USING v_org_id;

      GET DIAGNOSTICS rows_updated = ROW_COUNT;
      EXIT WHEN rows_updated = 0;
      PERFORM pg_sleep(0.05);  -- 50ms pause between batches
    END LOOP;
    RAISE NOTICE 'Done: %', t;
  END LOOP;
END $$;
```

Verify before proceeding to Phase C:

```sql
-- Must return 0 for all tables before adding NOT NULL
SELECT 'clients' AS tbl, COUNT(*) AS nulls FROM public.clients WHERE org_id IS NULL
UNION ALL
SELECT 'email_log', COUNT(*) FROM public.email_log WHERE org_id IS NULL
UNION ALL
SELECT 'reminder_queue', COUNT(*) FROM public.reminder_queue WHERE org_id IS NULL;
-- ... add all tables
```

### Phase C: Contract — Lock in NOT NULL, add indexes, activate RLS

Run only after the Phase B verification query returns zero nulls for all tables.

```sql
-- Add NOT NULL constraints (fast in Postgres when no NULLs exist)
ALTER TABLE public.clients                        ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.client_filing_assignments      ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.client_deadline_overrides      ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.client_filing_status_overrides ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.email_templates                ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.schedules                      ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.schedule_steps                 ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.schedule_client_exclusions     ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.client_email_overrides         ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.client_schedule_overrides      ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.reminder_queue                 ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.email_log                      ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.inbound_emails                 ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.app_settings                   ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.locks                          ALTER COLUMN org_id SET NOT NULL;

-- Indexes (CONCURRENTLY avoids table locks — run outside a transaction block)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clients_org_id
  ON public.clients(org_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reminder_queue_org_id
  ON public.reminder_queue(org_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_log_org_id
  ON public.email_log(org_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inbound_emails_org_id
  ON public.inbound_emails(org_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedules_org_id
  ON public.schedules(org_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_templates_org_id
  ON public.email_templates(org_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_app_settings_org_id
  ON public.app_settings(org_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_locks_org_id
  ON public.locks(org_id);

-- Drop old USING (true) policies and replace with org_id-scoped policies
-- See Section 1 for full policy SQL.
-- Activate RLS on each table:
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
-- ... repeat for each table
```

**Critical note:** The Custom Access Token Hook (Section 1) MUST be deployed and verified before this step. If the hook is not working, users will not have `org_id` in their JWT and all RLS policies will block them immediately. Verify with a test login and `SELECT auth.jwt()` in the SQL editor.

---

## 4. Cron Jobs — Service Role Safety with Multi-Tenancy

### The Core Danger

The two cron routes use `createAdminClient()` (service role key). The service role bypasses ALL RLS. In multi-tenant mode, without explicit `org_id` filtering in every query, a cron job running against the full `clients` table will touch every org's data.

This is the highest-severity migration risk. RLS provides zero protection for service role queries.

Source: [Why is my service role key client bypassing RLS? | Supabase Docs](https://supabase.com/docs/guides/troubleshooting/why-is-my-service-role-key-client-getting-rls-errors-or-not-returning-data-7_1K9z)

### Required Pattern: Per-Org Iteration

Both cron routes must be rewritten to:
1. Fetch all active organisations
2. Iterate per org
3. Pass `org_id` explicitly to every query
4. Use per-org Postmark tokens

```typescript
// app/api/cron/reminders/route.ts — updated pattern
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createAdminClient()

  // Fetch all orgs with Postmark configured and active subscriptions
  const { data: orgs, error } = await supabase
    .from('organisations')
    .select('id, name, postmark_server_token, postmark_sender_domain')
    .not('postmark_server_token', 'is', null)
    // Add: .filter('trial_ends_at', 'gte', new Date().toISOString()) when billing is live

  if (error || !orgs) {
    console.error('Failed to fetch organisations:', error)
    return new Response('Error', { status: 500 })
  }

  const results = await Promise.allSettled(
    orgs.map(org => processRemindersForOrg(supabase, org))
  )

  const failed = results.filter(r => r.status === 'rejected')
  if (failed.length > 0) {
    console.error(`${failed.length} orgs failed cron processing`)
  }

  return new Response('OK', { status: 200 })
}

async function processRemindersForOrg(
  supabase: ReturnType<typeof createAdminClient>,
  org: { id: string; name: string; postmark_server_token: string | null }
) {
  // EVERY query must include .eq('org_id', org.id)
  // RLS will not enforce this — you must do it manually

  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .eq('org_id', org.id)  // MANDATORY

  const { data: schedules } = await supabase
    .from('schedules')
    .select('*, schedule_steps(*)')
    .eq('org_id', org.id)  // MANDATORY

  // ... queue population logic

  // Inserts must also include org_id
  await supabase
    .from('reminder_queue')
    .insert({
      org_id: org.id,  // MANDATORY
      client_id: '...',
      // ...
    })
}
```

### Lock Keys Must Be Org-Scoped

The existing `locks` table prevents duplicate cron runs. With multiple orgs, lock keys must include the org_id to allow concurrent runs across orgs:

```typescript
// Current (single-tenant)
const lockKey = 'send-emails'

// Required (multi-tenant)
const lockKey = `org:${org.id}:send-emails`
```

### app_settings Must Be Org-Filtered

The cron reads `app_settings` to get the send hour. This query must be org-scoped:

```typescript
// Current (broken in multi-tenant context)
const { data: settings } = await supabase
  .from('app_settings')
  .select('value')
  .eq('key', 'send_hour')
  .single()

// Required
const { data: settings } = await supabase
  .from('app_settings')
  .select('value')
  .eq('key', 'send_hour')
  .eq('org_id', org.id)  // MANDATORY
  .single()
```

---

## 5. Per-Org Postmark Token

### Current State

`POSTMARK_API_TOKEN` and `POSTMARK_SENDER_EMAIL` are Vercel environment variables on the single deployment. All emails for all future orgs would use the same token — which is incorrect. Each accounting firm needs its own Postmark server.

### Target State

`organisations.postmark_server_token` — each org holds its own Postmark Server API token. The sender domain is stored in `organisations.postmark_sender_domain`.

### Migration of Existing Token

At initial startup after Phase A migration, a seed script copies the env var value into the first org's row. This is a one-time operation:

```typescript
// scripts/seed-first-org-postmark.ts
// Run once via: npx ts-node scripts/seed-first-org-postmark.ts
import { createAdminClient } from '@/lib/supabase/admin'

const supabase = createAdminClient()
await supabase
  .from('organisations')
  .update({
    postmark_server_token: process.env.POSTMARK_API_TOKEN,
    postmark_sender_domain: process.env.POSTMARK_SENDER_DOMAIN,
  })
  .eq('slug', 'peninsula')
```

### Updated Email Sender

```typescript
// lib/email/sender.ts — updated signature
import { ServerClient } from 'postmark'

export function createPostmarkClient(serverToken: string): ServerClient {
  return new ServerClient(serverToken)
}

// In cron per-org processing:
const postmark = createPostmarkClient(org.postmark_server_token!)
// org.postmark_sender_domain used as the From domain
```

### Security

`postmark_server_token` must never be exposed to client-side code. The RLS policy on `organisations` allows authenticated users to SELECT their org — which means client-side queries could read this column. To prevent this:

**Option A (recommended for v3.0):** Exclude the column from client-side selects. Server actions and cron jobs use the admin client to read it; client queries only select `id, name, slug, plan_tier`.

**Option B (for v4.0):** Move sensitive fields to a separate `org_secrets` table with RLS that only allows server-side access.

---

## 6. Auth Flow Changes

### Login Page

Each subdomain's login page must verify that the user actually has membership in that org after authentication. Without this check, a user with Supabase credentials could log in at any firm's subdomain.

```typescript
// app/(auth)/login/actions.ts
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentOrg } from '@/lib/org/current-org'
import { redirect } from 'next/navigation'

export async function loginAction(formData: FormData) {
  const supabase = await createServerClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })

  if (error) return { error: error.message }

  // Verify membership in the current subdomain's org
  const org = await getCurrentOrg()
  if (!org) {
    await supabase.auth.signOut()
    return { error: 'Organisation not found' }
  }

  const { data: membership } = await supabase
    .from('user_organisations')
    .select('role')
    .eq('user_id', data.user.id)
    .eq('org_id', org.id)
    .single()

  if (!membership) {
    await supabase.auth.signOut()
    return { error: 'You do not have access to this organisation' }
  }

  redirect('/dashboard')
}
```

### User Creation (Writing app_metadata)

When a new user is invited and accepts their invitation, the server must write `org_id` into `app_metadata` so the Custom Access Token Hook can read it:

```typescript
// In invitation acceptance server action
const { data: { user } } = await adminSupabase.auth.admin.createUser({
  email: invitation.email,
  password: generatedOrUserSuppliedPassword,
  app_metadata: {
    org_id: invitation.org_id,  // Required for JWT hook
  },
})

await adminSupabase
  .from('user_organisations')
  .insert({
    user_id: user.id,
    org_id: invitation.org_id,
    role: invitation.role,
  })

await adminSupabase
  .from('invitations')
  .update({ accepted_at: new Date().toISOString() })
  .eq('id', invitation.id)
```

---

## 7. Component Boundaries — Updated for Multi-Tenancy

| Component | Responsibility | Multi-Tenancy Change |
|-----------|---------------|----------------------|
| `middleware.ts` | Session refresh + org resolution | CHANGED: adds x-org-slug header injection |
| `lib/org/current-org.ts` | Resolve slug to org record | NEW FILE |
| `lib/supabase/admin.ts` | Service role client | UNCHANGED — all callers must add `.eq('org_id', orgId)` |
| `lib/supabase/server.ts` | Authenticated user client | UNCHANGED — RLS enforces org_id via JWT |
| `lib/email/sender.ts` | Postmark sending | CHANGED: accepts `serverToken` param |
| `app/api/cron/reminders/route.ts` | Queue population | REWRITE: iterate over orgs, filter all queries |
| `app/api/cron/send-emails/route.ts` | Email delivery | REWRITE: iterate over orgs, per-org Postmark client |
| `app/actions/*.ts` | Server actions | ALL need `org = await getCurrentOrg()` at top |
| `organisations` table | Org config + Postmark tokens | NEW |
| `user_organisations` table | User membership + role | NEW |
| `invitations` table | Invite flow | NEW |
| `custom_access_token_hook` function | JWT claim injection | NEW |

---

## 8. Suggested Build Order

Steps are ordered by dependency. Each step must be verifiable before the next begins.

**Step 1 — Schema: New tables and nullable org_id (Phase A migration)**
Prerequisite for everything. Creates `organisations`, seeds first org, adds nullable `org_id` to all tables. Zero impact on running app.

**Step 2 — App code: Write org_id on all new inserts**
Deploy code changes so all server actions and cron routes write the hardcoded first org's ID on new rows. The org is read from `getCurrentOrg()` (which resolves `x-org-slug` from middleware). New rows get `org_id`; old rows still NULL (covered by backfill).

**Step 3 — Backfill (Phase B)**
Run the batched backfill script. Verify zero NULLs across all tables before proceeding.

**Step 4 — Middleware: Subdomain extraction**
Deploy updated `middleware.ts` with subdomain detection and `x-org-slug` header injection. Deploy `lib/org/current-org.ts`. Safe to deploy before RLS — the existing single org's subdomain routes correctly; root domain continues to work.

**Step 5 — Custom Access Token Hook**
Create and register the `custom_access_token_hook` function. VERIFY: log in as a test user on the subdomain, call `SELECT auth.jwt()` in Supabase SQL editor logged in as that user, confirm `org_id` and `org_role` are present in the output. Do not proceed to Step 6 without this verification.

**Step 6 — RLS activation (Phase C migration)**
Add NOT NULL constraints, create indexes, drop old USING(true) policies, apply new org_id-scoped policies. This is the point of no return. If the hook from Step 5 is not working, this step will lock out all users.

**Step 7 — Cron job rewrites**
Rewrite both cron routes to iterate over organisations. This should be done before or alongside Step 6 — if Step 6 activates RLS and the cron still lacks org_id filters, the cron will return empty results (harmless) rather than sending emails. The timing window is acceptable but the rewrite should not be deferred.

**Step 8 — Per-org Postmark token**
Run the one-time seed script to copy env var tokens into the first org's row. Update `sender.ts` to use the stored token. Remove env vars from Vercel once confirmed working.

**Step 9 — Login membership check**
Update the login action to verify org membership. Add user creation logic with `app_metadata.org_id`.

**Step 10 — User management UI (invite flow, membership management)**
Invite page, accept-invitation page, org member list. Not required for the data migration to work — the first org's users are manually inserted into `user_organisations`.

---

## 9. Anti-Patterns to Avoid

### Anti-Pattern 1: Service-role queries without org_id filter

**What goes wrong:** `supabase.from('clients').select('*')` in a cron route returns all orgs' clients.
**Consequences:** Org A's clients receive Org B's reminder emails. Data leaks across tenants. Completely silent — no error thrown.
**Prevention:** Every service-role query on a tenant-scoped table must include `.eq('org_id', orgId)`. Code review should treat this as a lint rule.

### Anti-Pattern 2: Activating RLS before the JWT hook is verified

**What goes wrong:** Drop USING(true) policies, apply org_id policies, hook not actually running → `(auth.jwt() ->> 'org_id')` returns NULL → every row fails the check → all users get 403 on login.
**Prevention:** Verify the hook with `SELECT auth.jwt()` in the SQL editor as an authenticated user before touching the RLS policies.

### Anti-Pattern 3: Table lookup in RLS expressions

**What goes wrong:** `USING (org_id IN (SELECT org_id FROM user_organisations WHERE user_id = auth.uid()))` evaluates a subquery per candidate row.
**Consequences:** Full-table scans on large tables become catastrophically slow. A query reading 100,000 email_log rows runs 100,000 subqueries.
**Prevention:** Use JWT claim: `USING (org_id = (auth.jwt() ->> 'org_id')::uuid)`

### Anti-Pattern 4: Postmark token in app_settings key/value rows

**What goes wrong:** Storing `postmark_server_token` as a row in `app_settings` rather than a typed column on `organisations`.
**Consequences:** Harder to query per org, no type safety, harder to exclude from client-side selects, pollutes the general settings namespace.
**Prevention:** Typed column on `organisations` table. Server-side only access.

### Anti-Pattern 5: Adding NOT NULL before backfill is complete

**What goes wrong:** `ALTER TABLE clients ALTER COLUMN org_id SET NOT NULL` with rows still having NULL values.
**Consequences:** Migration fails with a constraint violation error. If in a transaction block, the whole migration rolls back.
**Prevention:** `SELECT COUNT(*) FROM clients WHERE org_id IS NULL` must return 0 before running the NOT NULL ALTER.

### Anti-Pattern 6: Using `CREATE INDEX` (without CONCURRENTLY) on a live table

**What goes wrong:** Postgres acquires an exclusive lock on the table while building the index. All reads and writes block for the duration (minutes on large tables).
**Consequences:** Service downtime during migration.
**Prevention:** Always use `CREATE INDEX CONCURRENTLY`. Note: CONCURRENTLY cannot run inside a transaction block — run it as a standalone statement.

---

## Sources

- [Custom Access Token Hook | Supabase Docs](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook) — HIGH confidence
- [Custom Claims & RBAC | Supabase Docs](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac) — HIGH confidence
- [RLS Performance and Best Practices | Supabase Docs](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) — HIGH confidence
- [Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — HIGH confidence
- [JWT Claims Reference | Supabase Docs](https://supabase.com/docs/guides/auth/jwt-fields) — HIGH confidence
- [Auth Hooks | Supabase Docs](https://supabase.com/docs/guides/auth/auth-hooks) — HIGH confidence
- [Guides: Multi-tenant | Next.js](https://nextjs.org/docs/app/guides/multi-tenant) — HIGH confidence
- [vercel/platforms — Next.js multi-tenant reference implementation](https://github.com/vercel/platforms) — HIGH confidence
- [Domain management for multi-tenant | Vercel](https://vercel.com/docs/multi-tenant/domain-management) — HIGH confidence
- [Why service role key bypasses RLS | Supabase Docs](https://supabase.com/docs/guides/troubleshooting/why-is-my-service-role-key-client-getting-rls-errors-or-not-returning-data-7_1K9z) — HIGH confidence
- [Database Migrations at Scale: Zero-Downtime Strategies](https://medium.com/@sohail_saifii/database-migrations-at-scale-zero-downtime-strategies-b72be4833519) — MEDIUM confidence (verified against Postgres documentation patterns)
- [supabase-community/supabase-custom-claims](https://github.com/supabase-community/supabase-custom-claims) — MEDIUM confidence (community reference implementation)
