# Technology Stack: v3.0 Multi-Tenancy & SaaS Platform

**Project:** Peninsula Accounting — v3.0 Multi-Tenancy
**Researched:** 2026-02-19
**Scope:** New dependencies and integration patterns for Stripe billing, Supabase multi-tenant RLS, and Next.js subdomain routing. Does NOT re-research existing stack.
**Overall confidence:** HIGH (all critical claims verified with official sources or npm registry)

---

## Existing Stack (Unchanged)

Do not re-research or alter these:

| Technology | Version | Notes |
|------------|---------|-------|
| Next.js | 16.1.6 | App Router, confirmed in package.json |
| React | 19.2.3 | confirmed in package.json |
| Supabase JS | @supabase/supabase-js ^2.95.3 | Auth + DB client |
| @supabase/ssr | ^0.8.0 | Server-side auth helpers |
| Postmark | ^4.0.5 | Transactional email (per-org credentials now stored in DB) |
| TipTap | ^3.19.0 | Rich text editor |
| Vercel Pro | — | Cron jobs, wildcard domains |
| Zod | ^4.3.6 | Validation (already in project) |

---

## New Dependencies

### Stripe Billing

| Package | Version | Purpose | Install as |
|---------|---------|---------|-----------|
| `stripe` | ^20.3.1 | Server-side Stripe SDK (checkout sessions, webhooks, billing portal, subscription management) | production |
| `@stripe/stripe-js` | ^8.7.0 | Client-side Stripe.js loader (needed ONLY if using Embedded Checkout; NOT needed for Stripe-Hosted Checkout redirect flow) | production |

**Recommendation: Use Stripe-Hosted Checkout (redirect), NOT Embedded Checkout.**

Rationale: Hosted Checkout is simpler — no client-side Stripe.js required, no PCI scope beyond redirect, works from a plain Next.js Server Action. For a B2B SaaS onboarding flow at Peninsula's volume, the UX difference is negligible. Embed only if there is a hard UX requirement to stay on-page.

This means `@stripe/stripe-js` is NOT required for the initial implementation. Add it only if the team later decides to embed payment UI inline.

**API Version:** `2026-01-28.clover` — pin this in the Stripe constructor to prevent breaking API changes.

```typescript
// lib/stripe.ts
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-01-28.clover',
  typescript: true,
});
```

### No Other New Runtime Packages Required

The subdomain routing and Supabase multi-tenant RLS work entirely with existing dependencies. No extra npm packages are needed for:
- Subdomain parsing (use `request.headers.get('host')` in middleware)
- RLS policies (SQL in Supabase migrations)
- JWT org_id injection (Postgres function in Supabase, no npm package)

---

## Stripe Integration Patterns

### Checkout Flow (Server Action)

Use Next.js Server Actions to create Stripe Checkout sessions server-side and redirect. No API route needed.

```typescript
// app/actions/create-checkout.ts
'use server';
import { stripe } from '@/lib/stripe';
import { redirect } from 'next/navigation';

export async function createCheckoutSession(orgId: string, priceId: string) {
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    currency: 'gbp',                    // CRITICAL: UK pricing in GBP
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/onboarding/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/onboarding/plan`,
    subscription_data: {
      trial_period_days: 14,            // 14-day free trial
      metadata: { org_id: orgId },
    },
    metadata: { org_id: orgId },        // also on session for webhook lookup
  });
  redirect(session.url!);
}
```

### Webhook Handler (Route Handler)

Stripe webhooks MUST use a Route Handler (`/app/api/webhooks/stripe/route.ts`), not a Server Action. The raw body must be preserved for signature verification.

```typescript
// app/api/webhooks/stripe/route.ts
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = await request.text();              // raw body — do NOT use .json()
  const sig = (await headers()).get('stripe-signature')!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    return new Response(`Webhook Error: ${err}`, { status: 400 });
  }

  // handle event...
  return new Response('ok', { status: 200 });
}
```

### Required Webhook Events

Subscribe to exactly these events in the Stripe Dashboard. Do not subscribe to more — unnecessary events add noise.

| Event | Why Required |
|-------|-------------|
| `checkout.session.completed` | New subscription activated; write `stripe_subscription_id`, `stripe_customer_id`, `plan_tier`, `trial_ends_at` to `organisations` table |
| `customer.subscription.updated` | Plan change, trial→active transition, payment method change; sync `plan_tier` and `subscription_status` |
| `customer.subscription.deleted` | Subscription cancelled or payment failed → downgrade org to `inactive`; block new email sends |
| `invoice.payment_succeeded` | Monthly renewal confirmed; optional (for audit log) |
| `invoice.payment_failed` | First payment failure; send dunning email to admin user, set `subscription_status = 'past_due'` |

### Billing Portal

Generate a Stripe Customer Portal session server-side (Server Action). No new library needed.

```typescript
export async function createBillingPortalSession(stripeCustomerId: string) {
  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`,
  });
  redirect(session.url);
}
```

### UK/GBP Considerations (HIGH confidence)

- Set `currency: 'gbp'` explicitly on every Checkout Session creation. Stripe defaults to the account currency if omitted, which may not be GBP.
- Configure Stripe Products and Prices in GBP in the Stripe Dashboard. Prices are currency-specific; you cannot reuse a USD price for a GBP charge.
- UK VAT: Peninsula's plan prices (£20/£39/£89/£159) should be defined as **VAT-exclusive** in Stripe if Peninsula is VAT-registered and will add VAT at checkout. Configure Stripe Tax (automatic tax) or add VAT manually. This is a business decision, not a code decision — flag for the client.
- Stripe account must have GBP as a supported payout currency and a UK bank account for GBP payouts.

### Stripe Price IDs

Create prices in the Stripe Dashboard. Store price IDs in environment variables, not hardcoded.

```bash
STRIPE_PRICE_LITE=price_xxx          # £20/month
STRIPE_PRICE_SOLE_TRADER=price_xxx   # £39/month
STRIPE_PRICE_PRACTICE=price_xxx      # £89/month
STRIPE_PRICE_FIRM=price_xxx          # £159/month
```

---

## Supabase Multi-Tenant RLS Patterns

### The Core Pattern: JWT Claims via Custom Access Token Hook

**Recommendation: Store `org_id` in JWT `app_metadata` via a Supabase Custom Access Token Hook.**

This is the performance-correct approach. The alternative — querying a `user_organisations` join table inside each RLS policy — works but executes an extra SELECT per row per query. With JWT claims, the `org_id` is in the token: zero additional queries.

**Step 1: Postgres hook function**

```sql
-- Run in Supabase SQL Editor (or migration file)
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  claims jsonb;
  user_org_id uuid;
BEGIN
  -- Get the org_id for this user from user_organisations table
  SELECT o.id INTO user_org_id
  FROM public.user_organisations uo
  JOIN public.organisations o ON o.id = uo.organisation_id
  WHERE uo.user_id = (event->>'user_id')::uuid
  LIMIT 1;  -- users belong to exactly one org in Peninsula's model

  claims := event->'claims';

  IF user_org_id IS NOT NULL THEN
    claims := jsonb_set(
      claims,
      '{app_metadata, org_id}',
      to_jsonb(user_org_id::text)
    );
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Grant required permissions
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;
```

**Step 2: Register the hook in Supabase Dashboard**

Authentication → Hooks → Custom Access Token → select `public.custom_access_token_hook`.

(For local dev: add to `supabase/config.toml` under `[auth.hook.custom_access_token]`.)

**Step 3: RLS policies using the JWT claim**

```sql
-- Helper function (call once, reuse across all policies)
CREATE OR REPLACE FUNCTION public.get_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT (auth.jwt()->'app_metadata'->>'org_id')::uuid;
$$;

-- Example policy (apply same pattern to ALL tables with org_id)
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON public.clients
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());
```

**Why `RESTRICTIVE` not `PERMISSIVE`:** A `RESTRICTIVE` policy acts as a mandatory filter — it cannot be bypassed by other permissive policies. This is the correct security posture for tenant isolation. Without it, a future permissive policy could accidentally leak cross-tenant data.

**Performance note:** Wrap `auth.jwt()` in a `STABLE` function (`get_org_id()`). Postgres optimizer caches `STABLE` function results within a statement, so the JWT is parsed once per query, not once per row. This matters at scale.

**Index requirement:** Every table with `org_id` must have an index on `org_id`. Without it, Postgres scans all rows then filters — RLS becomes a full table scan.

```sql
CREATE INDEX idx_clients_org_id ON public.clients(org_id);
-- Repeat for every table with org_id
```

### Service-Role Bypass (for cron and webhooks)

Supabase `service_role` key bypasses RLS entirely. Use it for:
- The two-stage cron (queue builder + email sender) — these need cross-org access for scheduling
- Stripe webhook handler — needs to update `organisations` table without an authenticated user
- Migration scripts

```typescript
// lib/supabase/admin.ts (service role client — NEVER expose to browser)
import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,  // NOT the anon key
  );
}
```

### Cron Update: Per-Org Postmark Credentials

The existing cron (`/api/cron/send-emails`) currently uses a single global Postmark token. After multi-tenancy:
- Query `organisations` for each org's `postmark_server_token` before sending
- Use service_role client (bypasses RLS) to access all organisations
- No new package needed — existing `postmark` package supports multiple client instances

```typescript
// lib/email/sender.ts — updated pattern
import { ServerClient } from 'postmark';

export function getPostmarkClient(serverToken: string): ServerClient {
  return new ServerClient(serverToken);  // one instance per org, per send batch
}
```

### user_organisations Table Pattern

Store org membership in a junction table. Keep it simple: one role column (`admin` or `member`).

```sql
CREATE TABLE public.user_organisations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'member')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, organisation_id)
);

-- RLS: users can only see their own membership rows
ALTER TABLE public.user_organisations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_membership" ON public.user_organisations
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
```

---

## Next.js Subdomain Routing

### Pattern: Middleware + NextResponse.rewrite()

No new package is needed. Next.js middleware runs at the edge and has access to `request.headers` including `host`. Use `NextResponse.rewrite()` to map `orgslug.app.domain.com` to a dynamic route without changing the URL the user sees.

```typescript
// middleware.ts (project root)
import { NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';  // existing auth session refresh

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') ?? '';

  // Strip port for local dev (localhost:3000)
  const hostWithoutPort = hostname.replace(/:\d+$/, '');

  // Detect subdomain pattern: orgslug.app.domain.com
  // In local dev: orgslug.localhost
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'app.yourdomain.com';
  const isSubdomain =
    hostWithoutPort.endsWith(`.${appDomain}`) ||
    (process.env.NODE_ENV === 'development' && hostWithoutPort.endsWith('.localhost'));

  if (isSubdomain) {
    const orgSlug = hostWithoutPort.split('.')[0];

    // Rewrite to /[orgSlug]/... route group without changing browser URL
    const url = request.nextUrl.clone();
    url.pathname = `/${orgSlug}${request.nextUrl.pathname}`;

    // Pass orgSlug via header so layout/pages can read it without parsing hostname again
    const response = NextResponse.rewrite(url);
    response.headers.set('x-org-slug', orgSlug);
    return response;
  }

  // Main domain: onboarding, marketing, super-admin
  return await updateSession(request);  // existing Supabase session refresh
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

**Route structure:**

```
app/
  (marketing)/           # Main domain: app.yourdomain.com — onboarding, pricing
    page.tsx
    onboarding/
  [orgSlug]/             # Subdomain: orgslug.app.yourdomain.com — tenant app
    layout.tsx           # Resolves org from URL segment, verifies membership
    dashboard/
    clients/
    ...
  (admin)/               # app.yourdomain.com/admin — super-admin only
    dashboard/
```

**Reading orgSlug in layout:**

```typescript
// app/[orgSlug]/layout.tsx
import { headers } from 'next/headers';

export default async function OrgLayout({ params }: { params: { orgSlug: string } }) {
  // orgSlug comes from the rewritten path segment
  const orgSlug = params.orgSlug;

  // Fetch org from DB, verify user is a member
  // ...
}
```

### Vercel Configuration (HIGH confidence)

Wildcard subdomains on Vercel require the **nameserver method** — you must delegate your domain's DNS to Vercel's nameservers (`ns1.vercel-dns.com`, `ns2.vercel-dns.com`). The A record method does NOT support wildcard SSL.

Steps:
1. Update your domain registrar to use Vercel nameservers
2. In Vercel Dashboard → Project → Settings → Domains → Add `*.app.yourdomain.com`
3. Vercel automatically issues SSL certificates for each new subdomain via Let's Encrypt

**Local development:** Use `*.localhost` subdomains. Chrome resolves `*.localhost` natively. Add to `/etc/hosts` (macOS/Linux) or test with `app.localhost:3000`.

---

## Environment Variables Required for v3.0

Add these to `.env.local` (dev) and Vercel project environment variables (production):

```bash
# Stripe — Server Side (NEVER expose to browser)
STRIPE_SECRET_KEY=sk_live_...            # or sk_test_... for dev
STRIPE_WEBHOOK_SECRET=whsec_...          # from Stripe Dashboard → Webhooks → Signing Secret
STRIPE_PRICE_LITE=price_xxx
STRIPE_PRICE_SOLE_TRADER=price_xxx
STRIPE_PRICE_PRACTICE=price_xxx
STRIPE_PRICE_FIRM=price_xxx

# Stripe — Client Side (safe to expose, prefixed NEXT_PUBLIC_)
# Only needed if using Embedded Checkout (NOT recommended initially)
# NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# App Domain — used in middleware subdomain detection and Stripe success/cancel URLs
NEXT_PUBLIC_APP_DOMAIN=app.yourdomain.com
NEXT_PUBLIC_APP_URL=https://app.yourdomain.com

# Supabase — unchanged from v2.0
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...            # for cron, webhooks, admin operations
```

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Checkout UI | Stripe-Hosted Checkout | Embedded Checkout | Embedded requires `@stripe/stripe-js` + client setup. No UX benefit for B2B onboarding at this scale. |
| Org resolution | Subdomain + middleware rewrite | Custom domain per tenant | Custom domains need DNS verification flow (weeks of UX work). Subdomains work on day one. |
| JWT org_id injection | Custom Access Token Hook | Query join table in every RLS policy | Join table in RLS = extra SELECT per row per query. JWT claim = zero extra queries. JWT is the right tool. |
| RLS USING clause | `org_id = get_org_id()` | `org_id IN (SELECT org_id FROM user_organisations WHERE user_id = auth.uid())` | Subquery form is slower and risks N+1 at the Postgres level. JWT claim avoids the join entirely. |
| Stripe overage enforcement | Application-layer check (count clients before add) | Stripe metered billing | Metered billing adds significant complexity (usage records, metered prices, invoice line items). Application-layer count check is simpler, transparent to users, and sufficient at Peninsula's expected tenant scale. |
| Billing portal | Stripe Customer Portal | Custom billing UI | Portal is maintained by Stripe (handles card updates, invoice history, cancellation). Building custom is 2-4 weeks of work for no user-facing benefit. |

---

## What NOT to Add

| Do Not Add | Why |
|------------|-----|
| `@stripe/react-stripe-js` | Not needed for Hosted Checkout. Only add if switching to Embedded Checkout later. |
| `next-auth` or `clerk` for auth | Already using Supabase Auth. Adding a second auth layer creates session conflicts and doubles complexity. |
| Separate Supabase project per tenant | Architectural decision already made: single project, org_id isolation. Separate projects = separate API keys, separate migrations, separate cron configuration for each tenant. Not viable. |
| Stripe metered billing | Overage checking at application layer is sufficient (count clients before adding, return 402 if at limit). Metered billing requires usage record APIs and complicates invoicing. |
| Redis / Upstash for session caching | No evidence of session performance problems at current or expected scale. Premature. |
| `stripe-event-types` npm package | The official `stripe` package (v20+) ships full TypeScript types for all webhook events. No supplemental type package needed. |

---

## Installation

```bash
# New dependency (only one new package for the entire multi-tenancy milestone)
npm install stripe@^20.3.1

# Only add if switching to Embedded Checkout (not recommended for initial implementation)
# npm install @stripe/stripe-js@^8.7.0
```

---

## Integration Points with Existing Code

| Existing File | Change for v3.0 |
|---------------|----------------|
| `middleware.ts` | Add subdomain detection + `NextResponse.rewrite()` to `[orgSlug]` route; keep existing `updateSession()` call |
| `lib/supabase/client.ts` | No change — anon key client unchanged |
| `lib/supabase/server.ts` | No change — SSR client unchanged; RLS enforcement is transparent |
| `lib/email/sender.ts` | Accept `serverToken` parameter; remove hardcoded env var token; query per-org token before send |
| `/api/cron/send-emails/route.ts` | Use service_role client; fetch per-org Postmark tokens; loop by org |
| `/api/cron/build-queue/route.ts` | Use service_role client; no other changes (queue builder already operates on all rows) |
| All Supabase DB operations | No change in application code — RLS handles isolation transparently once policies are in place |

---

## Sources

- [stripe npm package](https://www.npmjs.com/package/stripe) — latest version 20.3.1 (verified Feb 2026)
- [@stripe/stripe-js npm package](https://www.npmjs.com/package/@stripe/stripe-js) — latest version 8.7.0 (verified Feb 2026)
- [stripe-node GitHub releases](https://github.com/stripe/stripe-node/releases) — API version 2026-01-28.clover
- [Stripe webhooks for subscriptions](https://docs.stripe.com/billing/subscriptions/webhooks) — required events
- [Stripe webhook signature verification](https://docs.stripe.com/webhooks/signature) — raw body requirement
- [Stripe build subscriptions guide](https://docs.stripe.com/billing/subscriptions/build-subscriptions) — checkout + webhook flow
- [Supabase Custom Access Token Hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook) — JWT claim injection pattern
- [Supabase Auth Hooks](https://supabase.com/docs/guides/auth/auth-hooks) — hook types and configuration
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) — policy patterns
- [Supabase RLS Performance](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) — STABLE function caching, indexing
- [Next.js Middleware docs](https://nextjs.org/docs/15/app/getting-started/route-handlers-and-middleware) — middleware pattern
- [Vercel wildcard domains](https://vercel.com/blog/wildcard-domains) — nameserver requirement for wildcard SSL
- [Vercel multi-tenant domain management](https://vercel.com/docs/multi-tenant/domain-management) — configuration steps
- [Next.js App Router Stripe webhook](https://kitson-broadhurst.medium.com/next-js-app-router-stripe-webhook-signature-verification-ea9d59f3593f) — `request.text()` for raw body

---

*Stack research for: Peninsula Accounting v3.0 — Multi-Tenancy & SaaS Platform*
*Researched: 2026-02-19*
*Confidence: HIGH — all package versions verified against npm registry; Supabase hook pattern verified against official docs; Stripe webhook pattern verified against official docs*
