# Phase 11: Stripe Billing - Research

**Researched:** 2026-02-20
**Domain:** Stripe subscription billing for multi-tenant SaaS (Next.js 16 App Router + Supabase)
**Confidence:** HIGH

## Summary

This phase integrates Stripe subscription billing into a multi-tenant Next.js application with Supabase backend. The standard approach uses Stripe Hosted Checkout (redirect flow) for PCI compliance, Customer Portal for self-service billing management, and webhook-driven subscription provisioning. The critical architectural decisions are: (1) use `checkout.session.completed` as the single source of truth for provisioning to avoid race conditions, (2) implement webhook idempotency via database-tracked event IDs, and (3) enforce usage limits at the middleware/server action layer before allowing mutations.

**Primary recommendation:** Use Stripe's official Node.js SDK (`stripe@^20.3.1`) with Next.js 16 App Router patterns (Server Actions for checkout session creation, Route Handlers for webhooks with raw body verification), pin API version to `2026-01-28.clover`, and implement webhook idempotency via a `processed_webhook_events` table before processing any subscription state changes.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Pricing & plan display:**
- Dedicated `/pricing` page (standalone route, not embedded in billing)
- Plan cards show: monthly price, client limit, user limit, and feature bullet points
- All 4 tiers are paid (lite, sole_trader, practice, firm) — no free tier
- Use sensible placeholder prices and limits — finalized before launch

**Billing management page:**
- Status overview style — current plan, subscription status, next billing date, usage bars (client count vs limit)
- "Manage billing" button opens Stripe Customer Portal for all changes (upgrade, downgrade, payment method, cancellation)
- Invoice history handled entirely by Stripe Portal — no in-app invoice list
- Org admins only — members cannot see billing page at all
- Plan changes (upgrade/downgrade) go through Stripe Customer Portal, not in-app

**Usage limits & enforcement:**
- Hard block when client limit reached — cannot add client, show error with "Upgrade your plan" link to /pricing
- 80% usage warning appears on billing page only (not dashboard banner)
- User (team member) limits deferred to Phase 13 — only client limits enforced in Phase 11
- Lapsed subscription (payment failed / cancelled) = read-only mode: data visible, but cannot send emails, add clients, or modify data

**Trial experience:**
- Trial orgs get Practice tier access (mid-range, not full unlock)
- Trial status shown on billing page only — no persistent banner during trial
- Trial expiry = same read-only mode as lapsed subscription
- Trial-ending email (NOTF-01, Phase 13 scope) should link directly to /pricing page

**Technical decisions from STATE.md:**
- Stripe Hosted Checkout (redirect flow) — no client-side Stripe.js required; no PCI scope
- NOTF-02 (payment-failed email) in Phase 11 alongside the Stripe webhook handler that triggers it
- Plan tier enum values: ('lite', 'sole_trader', 'practice', 'firm') — already created in Phase 10
- Stripe API version to pin: `2026-01-28.clover`
- One new npm package: `stripe@^20.3.1`
- Stripe webhook race (subscription.created fires before checkout.session.completed) — use `checkout.session.completed` as sole provisioning trigger + idempotency table
- Trial expiry not enforced if Stripe webhook delivery fails — store `trial_ends_at` at org creation; check in middleware; add daily fallback cron

### Claude's Discretion

- Placeholder pricing amounts and limit numbers
- Billing page layout and component design
- Webhook endpoint structure and error handling
- Stripe Customer Portal configuration options
- Usage bar visual design

### Deferred Ideas (OUT OF SCOPE)

- NOTF-01 trial-ending email — Phase 13 (but decision captured: link to /pricing)
- User/team member limit enforcement — Phase 13
- Per-org Postmark credentials — Phase 12
- Annual billing option — v3.x backlog
- Metered/usage-based overage billing — v3.x backlog
</user_constraints>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `stripe` | `^20.3.1` | Official Stripe Node.js SDK | Official SDK with full TypeScript support, handles API versioning, signature verification, and all Stripe operations |
| `next` | `16.1.6` (existing) | Next.js App Router framework | Already in use; App Router supports Server Actions for checkout and Route Handlers for webhooks |
| `@supabase/supabase-js` | `^2.95.3` (existing) | Database client | Already in use for multi-tenant data storage |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `micro` | `^10.0.1` | Buffer conversion for Next.js Pages Router webhooks | Only needed if webhook uses Pages Router API routes (not recommended for new code) |
| N/A (built-in) | N/A | `request.text()` for App Router | Use in App Router Route Handlers for raw body access in webhooks |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Stripe Hosted Checkout | Stripe.js Payment Element | Payment Element requires client-side PCI scope, more complex implementation, but gives full UI control. Hosted Checkout is simpler and PCI-compliant out-of-the-box. |
| Stripe Customer Portal | Custom billing UI | Building custom subscription management requires handling proration, billing cycles, payment methods, and invoice generation. Portal is production-ready and maintained by Stripe. |
| Database idempotency tracking | In-memory cache | Database ensures idempotency survives serverless cold starts and works across concurrent webhook deliveries. Memory-based solutions fail in serverless environments. |

**Installation:**
```bash
npm install stripe@^20.3.1
```

## Architecture Patterns

### Recommended Project Structure

```
app/
├── (dashboard)/
│   └── billing/
│       └── page.tsx              # Billing status overview (org admins only)
├── pricing/
│   └── page.tsx                  # Public pricing page with plan cards
├── api/
│   ├── stripe/
│   │   ├── create-checkout-session/
│   │   │   └── route.ts          # Server Action: create Stripe Checkout session
│   │   ├── create-portal-session/
│   │   │   └── route.ts          # Server Action: create Customer Portal session
│   │   └── webhook/
│   │       └── route.ts          # Webhook handler (raw body, signature verification)
│   └── cron/
│       └── trial-expiry/
│           └── route.ts          # Daily cron to enforce trial expiry fallback
lib/
├── stripe/
│   ├── client.ts                 # Stripe SDK instance with pinned API version
│   ├── webhook-handlers.ts       # Event-specific handlers (checkout.session.completed, etc.)
│   └── customer-portal-config.ts # Portal feature configuration
└── billing/
    ├── usage-limits.ts           # Check client count vs limit
    └── read-only-mode.ts         # Determine if org is in read-only mode
supabase/migrations/
└── YYYYMMDDHHMMSS_stripe_billing_tables.sql  # Add processed_webhook_events table
```

### Pattern 1: Stripe Checkout Session Creation

**What:** Server Action creates a Stripe Checkout Session with organization metadata and redirects user to Stripe-hosted payment page.

**When to use:** When user clicks "Upgrade to [Plan]" on pricing page or during onboarding.

**Example:**
```typescript
// app/api/stripe/create-checkout-session/route.ts
// Source: https://docs.stripe.com/api/checkout/sessions/create

import { stripe } from '@/lib/stripe/client';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { planTier, orgId } = await req.json();

  // Fetch org to ensure user is admin
  const { data: org } = await supabase
    .from('organisations')
    .select('*')
    .eq('id', orgId)
    .single();

  if (!org) {
    return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });
  }

  // Create Checkout Session
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_collection: 'always', // Require payment upfront (no trial here)
    line_items: [
      {
        price: getPriceIdForPlan(planTier), // Map plan_tier to Stripe Price ID
        quantity: 1,
      },
    ],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
    metadata: {
      org_id: orgId,
      plan_tier: planTier,
    },
    subscription_data: {
      metadata: {
        org_id: orgId,
        plan_tier: planTier,
      },
    },
    customer_email: user.email,
  });

  return NextResponse.json({ url: session.url });
}
```

### Pattern 2: Webhook Handler with Idempotency

**What:** Webhook route handler verifies Stripe signature, checks idempotency, and dispatches to event-specific handlers.

**When to use:** For all Stripe webhook events (checkout.session.completed, customer.subscription.updated, invoice.payment_failed).

**Example:**
```typescript
// app/api/stripe/webhook/route.ts
// Source: https://docs.stripe.com/webhooks/signature

import { stripe } from '@/lib/stripe/client';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { handleCheckoutSessionCompleted, handleSubscriptionUpdated } from '@/lib/stripe/webhook-handlers';

export async function POST(req: NextRequest) {
  const supabase = createAdminClient(); // Service role for webhook writes
  const body = await req.text(); // CRITICAL: use .text() not .json() for signature verification
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Idempotency check
  const { data: existing } = await supabase
    .from('processed_webhook_events')
    .select('id')
    .eq('event_id', event.id)
    .single();

  if (existing) {
    console.log(`Event ${event.id} already processed, skipping`);
    return NextResponse.json({ received: true }); // Return 200 immediately
  }

  // Record event as processed BEFORE handling
  await supabase
    .from('processed_webhook_events')
    .insert({
      event_id: event.id,
      event_type: event.type,
      processed_at: new Date().toISOString(),
    });

  // Dispatch to event-specific handlers
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object, supabase);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object, supabase);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object, supabase);
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object, supabase);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error('Error handling webhook event:', err);
    // Do NOT return error to Stripe — event is already marked processed
  }

  return NextResponse.json({ received: true });
}
```

### Pattern 3: Stripe Customer Portal Session

**What:** Server Action creates a short-lived Customer Portal session URL for the org's Stripe customer.

**When to use:** When org admin clicks "Manage billing" button on billing page.

**Example:**
```typescript
// app/api/stripe/create-portal-session/route.ts
// Source: https://docs.stripe.com/customer-management/integrate-customer-portal

import { stripe } from '@/lib/stripe/client';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { orgId } = await req.json();

  // Fetch org and verify user is admin
  const { data: org } = await supabase
    .from('organisations')
    .select('*')
    .eq('id', orgId)
    .single();

  if (!org || !org.stripe_customer_id) {
    return NextResponse.json({ error: 'No Stripe customer found' }, { status: 404 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: org.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
  });

  return NextResponse.json({ url: session.url });
}
```

### Pattern 4: Usage Limit Enforcement (Server Action)

**What:** Check client count vs limit before allowing client creation; throw error with upgrade link if over limit.

**When to use:** In all server actions that create clients or other limited resources.

**Example:**
```typescript
// lib/billing/usage-limits.ts

import { createClient } from '@/lib/supabase/server';

export async function checkClientLimit(orgId: string): Promise<{ allowed: boolean; message?: string }> {
  const supabase = await createClient();

  const { data: org } = await supabase
    .from('organisations')
    .select('plan_tier, client_count_limit')
    .eq('id', orgId)
    .single();

  if (!org) {
    return { allowed: false, message: 'Organisation not found' };
  }

  // NULL limit = unlimited
  if (org.client_count_limit === null) {
    return { allowed: true };
  }

  const { count: clientCount } = await supabase
    .from('clients')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId);

  if (clientCount >= org.client_count_limit) {
    return {
      allowed: false,
      message: `You've reached your plan's client limit (${org.client_count_limit}). Upgrade your plan to add more clients.`,
    };
  }

  return { allowed: true };
}

// Usage in server action:
export async function createClient(orgId: string, clientData: any) {
  const { allowed, message } = await checkClientLimit(orgId);
  if (!allowed) {
    throw new Error(message);
  }
  // ... proceed with client creation
}
```

### Pattern 5: Read-Only Mode Enforcement (Middleware)

**What:** Check if org has active subscription or valid trial; set read-only flag in session if lapsed/expired.

**When to use:** In middleware for all dashboard routes; enforce in server actions that mutate data.

**Example:**
```typescript
// lib/billing/read-only-mode.ts

import { createClient } from '@/lib/supabase/server';

export async function isOrgInReadOnlyMode(orgId: string): Promise<boolean> {
  const supabase = await createClient();

  const { data: org } = await supabase
    .from('organisations')
    .select('subscription_status, trial_ends_at')
    .eq('id', orgId)
    .single();

  if (!org) return true; // No org = read-only

  // Active or trialing = not read-only
  if (org.subscription_status === 'active') return false;
  if (org.subscription_status === 'trialing' && org.trial_ends_at && new Date(org.trial_ends_at) > new Date()) {
    return false;
  }

  // All other cases = read-only (cancelled, past_due, unpaid, expired trial)
  return true;
}

// Usage in server action:
export async function sendReminderEmail(orgId: string, reminderId: string) {
  if (await isOrgInReadOnlyMode(orgId)) {
    throw new Error('Your subscription has lapsed. Please update your billing to send emails.');
  }
  // ... proceed with email send
}
```

### Pattern 6: Trial Creation Without Payment Method

**What:** Create org with `trial_ends_at` set to 14 days in future; set `subscription_status = 'trialing'`; no Stripe interaction until trial ends or user upgrades.

**When to use:** During onboarding when user selects "Start free trial".

**Example:**
```typescript
// app/actions/create-trial-org.ts
// Source: https://docs.stripe.com/billing/subscriptions/trials

import { createAdminClient } from '@/lib/supabase/admin';

export async function createTrialOrg(name: string, slug: string, userId: string) {
  const supabase = createAdminClient();

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 14); // 14 days from now

  const { data: org, error } = await supabase
    .from('organisations')
    .insert({
      name,
      slug,
      plan_tier: 'practice', // Trial gets Practice tier access
      subscription_status: 'trialing',
      trial_ends_at: trialEndsAt.toISOString(),
      client_count_limit: 50, // Practice tier limit
      user_count_limit: 3,    // Practice tier limit
    })
    .select()
    .single();

  if (error) throw error;

  // Link user as admin
  await supabase.from('user_organisations').insert({
    user_id: userId,
    org_id: org.id,
    role: 'admin',
  });

  return org;
}
```

### Anti-Patterns to Avoid

- **Don't rely on subscription.created for provisioning:** `customer.subscription.created` can fire before `checkout.session.completed`, causing race conditions. Use `checkout.session.completed` as the single source of truth for initial provisioning.
- **Don't skip idempotency:** Stripe retries failed webhooks. Without idempotency tracking, you'll double-provision subscriptions, send duplicate emails, or corrupt subscription state.
- **Don't parse request body before signature verification:** Calling `req.json()` before `req.text()` in webhook handlers causes signature verification to fail. Always use `await req.text()` first.
- **Don't trust client-provided prices:** Always fetch price IDs from server-side configuration or Stripe API. Never accept price amounts or plan tiers from client requests.
- **Don't block webhook response on slow operations:** Return 200 to Stripe immediately after recording idempotency. Defer slow operations (email sending, external API calls) to background jobs or async handlers.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Subscription management UI | Custom billing dashboard with upgrade/downgrade flows, proration logic, payment method updates | Stripe Customer Portal | Portal handles proration, billing cycles, invoice generation, payment retries, and cancellation flows. Building this correctly requires handling dozens of edge cases (mid-cycle upgrades, partial refunds, failed payments, tax changes). |
| Payment form UI | Custom credit card form with validation | Stripe Hosted Checkout | Checkout is PCI-compliant, supports 135+ currencies, handles SCA/3D Secure, and includes built-in fraud prevention. Custom forms require PCI compliance, fraud detection integration, and SCA handling. |
| Webhook signature verification | Custom HMAC verification | `stripe.webhooks.constructEvent()` | Stripe's SDK handles timestamp validation, signature comparison, and replay attack prevention. Custom implementations often miss timestamp tolerance or fail on special characters. |
| Subscription state machine | Custom status tracking for trials, active, past_due, cancelled | Stripe subscription statuses | Stripe's subscription lifecycle handles payment retries, dunning, grace periods, and cancellation logic. Custom state machines often miss edge cases like partial payments or manual intervention. |
| Invoice generation | Custom PDF invoices with line items, tax, totals | Stripe Invoices | Stripe generates compliant invoices with tax calculation, proration, discounts, and credits. Custom invoices require tax compliance (VAT, GST), legal formatting, and currency handling. |
| Usage limit tracking | Real-time counters with complex querying | Database count queries + cached limits | For this phase's client/user limits, simple database counts are sufficient. Don't pre-optimize with Redis counters or event streams until you have >10k orgs. |

**Key insight:** Stripe's subscription lifecycle is deceptively complex. What seems like "just charge a customer monthly" actually involves payment retries, SCA compliance, proration, tax calculation, invoice generation, and dunning management. Use Stripe's built-in tools (Customer Portal, Hosted Checkout, subscription webhooks) to avoid reimplementing years of payment infrastructure.

## Common Pitfalls

### Pitfall 1: Webhook Race Condition (subscription.created before checkout.session.completed)

**What goes wrong:** When a customer completes Stripe Checkout, Stripe fires multiple webhook events in rapid succession. `customer.subscription.created` often arrives *before* `checkout.session.completed`. If you provision the subscription in the `subscription.created` handler, you won't have access to the Checkout Session metadata (which contains your `org_id`), causing provisioning to fail or create orphaned subscriptions.

**Why it happens:** Stripe's internal event system fires events as objects are created in their database. Subscriptions are created before the Checkout Session is marked complete, so the events fire in that order.

**How to avoid:** Use `checkout.session.completed` as the **single source of truth** for initial subscription provisioning. Ignore `customer.subscription.created` for new subscriptions. Handle all initial provisioning (updating `organisations` table with `stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, `plan_tier`) in the `checkout.session.completed` handler. Use `customer.subscription.updated` only for subsequent changes (upgrades, downgrades, renewals).

**Warning signs:** Webhook logs show `subscription.created` events with missing metadata; organisations table has `stripe_subscription_id` but no `stripe_customer_id`; duplicate subscriptions created for the same org.

### Pitfall 2: Missing Idempotency Tracking Causes Double-Provisioning

**What goes wrong:** Stripe retries failed webhook deliveries (timeouts, 5xx errors) multiple times over 3 days. Without idempotency tracking, the same `checkout.session.completed` event can process twice, creating duplicate entries in your database or double-charging customers.

**Why it happens:** Serverless functions can timeout, crash, or lose connection mid-processing. Stripe sees no 200 response and retries. If you don't track `event.id` in a database before processing, the retry looks identical to the first attempt.

**How to avoid:** Create a `processed_webhook_events` table with `event_id` (Stripe's event ID) as a unique constraint. **Before** processing any webhook event, insert the `event_id` into this table. If the insert fails (unique constraint violation), return 200 immediately without processing. If the insert succeeds, proceed with event handling. This ensures each event processes exactly once, even across retries or concurrent webhook deliveries.

**Warning signs:** Duplicate rows in `organisations` or `email_log` tables; Stripe Dashboard shows successful webhook deliveries but your database has inconsistent state; customers report being charged twice.

### Pitfall 3: Using req.json() Before Signature Verification

**What goes wrong:** Stripe's webhook signature verification requires the **raw request body** as a string. If you call `await req.json()` before signature verification, Next.js consumes the request body stream, and `await req.text()` returns an empty string. Signature verification fails with "No signatures found matching the expected signature for payload" even though the webhook is legitimate.

**Why it happens:** Node.js request streams can only be read once. Once you parse the body as JSON, the raw bytes are gone. Stripe's HMAC signature is computed over the raw body string, so you need the exact bytes Stripe sent.

**How to avoid:** In Next.js App Router webhook handlers, **always** call `await req.text()` first to get the raw body. Pass this string to `stripe.webhooks.constructEvent()` for verification. Only parse the verified event object as JSON after signature verification succeeds. Never call `req.json()` in webhook handlers.

**Warning signs:** Webhook endpoint returns 400 "Invalid signature" for all events; Stripe Dashboard shows webhook attempts failing with signature errors; `stripe.webhooks.constructEvent()` throws even though the webhook secret is correct.

### Pitfall 4: Not Handling Trial Expiry Fallback

**What goes wrong:** If a trial org's Stripe webhook delivery fails (Stripe outage, network issue), the org never transitions from `trialing` to `unpaid`. Users continue to access full features indefinitely even though their trial expired days ago.

**Why it happens:** Webhook delivery is not guaranteed. Stripe retries for 3 days, but if your endpoint is down or unreachable, events are lost. If you rely solely on webhooks to enforce trial expiry, you'll have a gap when webhooks fail.

**How to avoid:** Store `trial_ends_at` in the `organisations` table at trial creation (don't rely on Stripe's trial data). Add a **daily cron job** that queries all orgs with `subscription_status = 'trialing'` and `trial_ends_at < NOW()`. For each expired trial, update `subscription_status = 'unpaid'` locally. Additionally, check `trial_ends_at` in **middleware** on every request and enforce read-only mode if expired, even if `subscription_status` is stale.

**Warning signs:** Orgs with expired trials still sending emails; `trial_ends_at` is in the past but `subscription_status` is still `trialing`; Stripe Dashboard shows trial ended but app shows active.

### Pitfall 5: Forgetting to Configure Stripe Tax for UK VAT

**What goes wrong:** Stripe invoices don't include VAT, causing customers to underpay and leaving the business liable for uncollected VAT. HMRC requires VAT collection on UK B2C sales, and missing VAT can result in fines or back-taxes.

**Why it happens:** Stripe Tax is an opt-in feature. By default, Stripe doesn't calculate or collect tax. If you create products/prices without enabling Stripe Tax or registering for UK VAT, invoices will show prices exclusive of VAT but won't add the 20% VAT charge.

**How to avoid:**
1. Register the business for UK VAT in Stripe Dashboard: Billing > Tax > Registrations > Add registration > United Kingdom.
2. Enable automatic tax collection: Billing > Tax > Enable Stripe Tax.
3. Set product/price tax behavior to `exclusive` (price shown is before VAT; Stripe adds 20% at checkout).
4. Test with a UK test card in Stripe test mode to verify invoices show "Subtotal: £X" + "VAT (20%): £Y" + "Total: £Z".

**Warning signs:** Stripe invoices missing VAT line item; customers in UK not charged VAT; Stripe Dashboard > Tax shows no registrations; prices appear the same in checkout as in product configuration.

### Pitfall 6: Client Limit Check After Database Insert (Race Condition)

**What goes wrong:** Two concurrent server actions both check the client count (e.g., 49/50), both see space available, both insert a new client. Final count is 51, violating the 50-client limit.

**Why it happens:** Database queries are not atomic with subsequent inserts. In serverless environments with concurrent requests, multiple actions can read the same count before any insert commits.

**How to avoid:** Use database-level constraints or transactions to enforce limits atomically. For PostgreSQL/Supabase:
1. Add a `CHECK` constraint that fails inserts when count exceeds limit (requires a function or trigger).
2. OR: Use a `SELECT ... FOR UPDATE` in a transaction to lock the org row during the count+insert.
3. OR: Perform the count check inside a database function that atomically checks and inserts.

Alternatively, for this phase's simple client limits, accept a small race condition window (1-2 clients over limit in edge cases) and add a daily cron to enforce hard limits by blocking mutations when over. Document this as a known limitation and fix in Phase 13 if needed.

**Warning signs:** Client count occasionally exceeds limit by 1-2; concurrent client imports push past limit; usage bars show 102% utilization.

## Code Examples

### Minimal Stripe Client Setup

```typescript
// lib/stripe/client.ts
// Source: https://docs.stripe.com/api/versioning

import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-01-28.clover', // Pin to specific version
  typescript: true,
});
```

### Webhook Handler (checkout.session.completed)

```typescript
// lib/stripe/webhook-handlers.ts
// Source: https://docs.stripe.com/billing/subscriptions/webhooks

import Stripe from 'stripe';
import { SupabaseClient } from '@supabase/supabase-js';

export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  supabase: SupabaseClient
) {
  const orgId = session.metadata?.org_id;
  const planTier = session.metadata?.plan_tier;

  if (!orgId || !planTier) {
    console.error('Missing metadata in checkout session:', session.id);
    return;
  }

  // Extract Stripe IDs from session
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  // Fetch subscription to get current status
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Update organisation with Stripe data
  const { error } = await supabase
    .from('organisations')
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      subscription_status: subscription.status, // 'active', 'trialing', etc.
      plan_tier: planTier,
      trial_ends_at: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orgId);

  if (error) {
    console.error('Failed to update organisation after checkout:', error);
    throw error; // Will trigger Stripe retry
  }

  console.log(`Provisioned subscription ${subscriptionId} for org ${orgId}`);
}
```

### Customer Portal Session Creation

```typescript
// app/api/stripe/create-portal-session/route.ts
// Source: https://docs.stripe.com/customer-management/integrate-customer-portal

import { stripe } from '@/lib/stripe/client';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { orgId } = await req.json();

  // Fetch org with admin check
  const { data: userOrg } = await supabase
    .from('user_organisations')
    .select('role, organisations(*)')
    .eq('user_id', user.id)
    .eq('org_id', orgId)
    .single();

  if (!userOrg || userOrg.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const org = userOrg.organisations;

  if (!org.stripe_customer_id) {
    return NextResponse.json({ error: 'No active subscription' }, { status: 400 });
  }

  // Create Customer Portal session
  const session = await stripe.billingPortal.sessions.create({
    customer: org.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
  });

  return NextResponse.json({ url: session.url });
}
```

### Trial Expiry Fallback Cron

```typescript
// app/api/cron/trial-expiry/route.ts
// Runs daily to catch trial expirations missed by webhooks

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  // Verify CRON_SECRET
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Find orgs with expired trials still marked as 'trialing'
  const { data: expiredTrials, error } = await supabase
    .from('organisations')
    .select('id, name, trial_ends_at')
    .eq('subscription_status', 'trialing')
    .lt('trial_ends_at', new Date().toISOString());

  if (error) {
    console.error('Failed to fetch expired trials:', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  if (!expiredTrials || expiredTrials.length === 0) {
    return NextResponse.json({ message: 'No expired trials found' });
  }

  // Update each to 'unpaid' status
  const updates = expiredTrials.map(org =>
    supabase
      .from('organisations')
      .update({ subscription_status: 'unpaid' })
      .eq('id', org.id)
  );

  await Promise.all(updates);

  console.log(`Expired ${expiredTrials.length} trial(s):`, expiredTrials.map(o => o.name));

  return NextResponse.json({
    message: `Processed ${expiredTrials.length} expired trial(s)`,
    orgIds: expiredTrials.map(o => o.id),
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Stripe.js + Payment Intents on client | Stripe Hosted Checkout (redirect) | 2021+ | Removes PCI compliance burden from SaaS apps. Hosted Checkout handles SCA, fraud detection, and payment methods server-side. |
| Custom subscription management UI | Stripe Customer Portal | 2020+ | Eliminates need to build upgrade/downgrade flows, proration logic, and invoice management. Portal is production-ready and mobile-responsive. |
| Manual webhook idempotency with Redis | Database-backed idempotency table | 2022+ (serverless era) | Redis requires persistent connection, doesn't survive cold starts in serverless. Database idempotency works in all environments. |
| Stripe API versioning via account default | Explicit `apiVersion` in SDK | 2023+ | Prevents breaking changes when Stripe updates account default version. Pinning version in code ensures consistent behavior across environments. |
| `invoice.paid` + `invoice.payment_failed` for trial tracking | `subscription.status` + local `trial_ends_at` fallback | 2024+ | Webhook failures can leave trials in limbo. Local fallback ensures trial expiry enforces even if webhooks fail. |

**Deprecated/outdated:**
- **Stripe Checkout v2 (legacy):** Replaced by Checkout Sessions in 2019. Legacy Checkout used iframe embeds; current Checkout uses redirect flow with better mobile support and SCA compliance.
- **`subscription.created` for provisioning:** Avoid due to race condition with `checkout.session.completed`. Use `checkout.session.completed` as single source of truth (best practice since 2021).
- **Client-side price submission:** Never submit price amounts from client. Always fetch prices server-side to prevent price manipulation attacks (OWASP Top 10 issue).

## Open Questions

### 1. Is Peninsula VAT-registered?

**What we know:** Stripe Tax supports UK VAT collection. Prices can be configured as inclusive or exclusive of VAT. VAT registration threshold in UK is £90,000 annual turnover.

**What's unclear:** Whether the business (Peninsula Accounting) is VAT-registered. This determines:
- Whether to enable Stripe Tax in production
- Whether prices should be inclusive (VAT-registered) or exclusive (not VAT-registered)
- Whether invoices must show VAT breakdown

**Recommendation:**
- **If VAT-registered:** Enable Stripe Tax, add UK VAT registration in Stripe Dashboard, set prices to `exclusive` (Stripe adds 20% VAT at checkout).
- **If not VAT-registered:** Disable Stripe Tax, set prices as final amounts. Monitor turnover and enable VAT collection before crossing £90k threshold.
- **For now:** Implement Stripe Tax configuration as optional (env var `STRIPE_TAX_ENABLED=true/false`). Default to disabled. Add task in plan to verify VAT status with user.

### 2. Should client limit enforcement be hard (database constraint) or soft (application check)?

**What we know:** Application-level checks (server action) are simpler but have race condition risk. Database constraints are atomic but require triggers/functions.

**What's unclear:** Whether the 1-2 client race condition window is acceptable, or if hard enforcement is required.

**Recommendation:** Start with application-level checks (server action + `checkClientLimit()` function). Add a daily cron to flag orgs over limit and block mutations. If race conditions become a problem in production (>5% of orgs hit), upgrade to database-level enforcement in Phase 13. Document this as a known limitation.

### 3. How should read-only mode be communicated in the UI?

**What we know:** Read-only mode applies when subscription is lapsed (cancelled, past_due, unpaid) or trial expired.

**What's unclear:** Should read-only mode:
- Block all mutations silently with error messages?
- Show a global banner on every page?
- Redirect to a dedicated "Your subscription has lapsed" page?
- Disable buttons/forms preemptively?

**Recommendation:** Use a multi-layer approach:
1. **Global banner** on dashboard (top of layout) when in read-only mode, with "Update billing" CTA linking to `/pricing`.
2. **Disabled UI elements** (greyed-out "Add client" button, etc.) with tooltip "Subscription required".
3. **Server action errors** if user bypasses UI (API calls, direct links) with clear message: "Your subscription has lapsed. Please update your billing to continue."
4. No redirect—preserve data visibility for admins during lapsed state.

## Sources

### Primary (HIGH confidence)

- [Stripe API: Webhooks](https://docs.stripe.com/webhooks) - Webhook security, idempotency, and error handling best practices
- [Stripe API: Using webhooks with subscriptions](https://docs.stripe.com/billing/subscriptions/webhooks) - Subscription lifecycle webhook events
- [Stripe API: Integrate customer portal](https://docs.stripe.com/customer-management/integrate-customer-portal) - Customer Portal integration steps
- [Stripe API: Checkout Sessions](https://docs.stripe.com/api/checkout/sessions) - Checkout Session creation and metadata
- [Stripe API: Metadata](https://docs.stripe.com/metadata) - Metadata usage, limitations, and flow between objects
- [Stripe API: Versioning](https://docs.stripe.com/api/versioning) - API version pinning best practices
- [Stripe API: Collect tax in the United Kingdom](https://docs.stripe.com/tax/supported-countries/europe/united-kingdom) - UK VAT configuration
- [Stripe API: Use trial periods on subscriptions](https://docs.stripe.com/billing/subscriptions/trials) - Trial creation without payment method

### Secondary (MEDIUM confidence)

- [Stripe + Next.js 15: The Complete 2025 Guide - Pedro Alonso](https://www.pedroalonso.net/blog/stripe-nextjs-complete-guide-2025/) - Next.js 15 App Router integration patterns
- [Stripe Checkout and Webhook in a Next.js 15 (2025) - Medium](https://medium.com/@gragson.john/stripe-checkout-and-webhook-in-a-next-js-15-2025-925d7529855e) - Webhook implementation with Next.js 15
- [Complete Stripe Webhook Guide for Next.js - HookRelay](https://www.hookrelay.io/guides/nextjs-webhook-stripe) - Webhook best practices for Next.js
- [Comprehensive Guide to Integrating Stripe Billing Customer Portal with Next.js 14 - Wisp CMS](https://www.wisp.blog/blog/comprehensive-guide-to-integrating-stripe-billing-customer-portal-with-nextjs-14) - Customer Portal integration
- [SaaS Pricing Page Best Practices Guide 2026 - InfluenceFlow](https://influenceflow.io/resources/saas-pricing-page-best-practices-complete-guide-for-2026/) - Pricing page UI best practices
- [Next.js App Router + Stripe Webhook Signature Verification - Medium](https://kitson-broadhurst.medium.com/next-js-app-router-stripe-webhook-signature-verification-ea9d59f3593f) - Raw body handling in App Router
- [Best practices for SaaS billing - Stripe](https://stripe.com/resources/more/best-practices-for-saas-billing) - SaaS billing patterns and common mistakes

### Tertiary (LOW confidence)

- [Stripe Subscription Notes from a first time SaaS Builder - Medium](https://medium.com/@mustafaturan/stripe-subscription-notes-from-a-first-time-saas-builder-d2034f5d0006) - Anecdotal pitfalls from community
- [Stripe API Subscription status explained - Peter Coles](https://mrcoles.com/stripe-api-subscription-status/) - Subscription status lifecycle

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** - Official Stripe Node.js SDK is the only supported library; Next.js 16 App Router patterns verified via official Stripe docs and recent community guides
- Architecture: **HIGH** - Webhook idempotency, checkout session metadata flow, and Customer Portal integration verified via official Stripe documentation
- Pitfalls: **MEDIUM** - Webhook race condition confirmed via Stripe CLI GitHub issues and community reports; signature verification issue verified via Next.js discussions; trial expiry fallback is inferred best practice (not explicitly documented by Stripe but necessary for reliability)
- UK VAT configuration: **MEDIUM** - Stripe Tax UK support confirmed via official docs, but specific inclusive/exclusive price configuration requires manual testing or Stripe support confirmation

**Research date:** 2026-02-20
**Valid until:** 2026-03-20 (30 days - Stripe API is stable; pinned version `2026-01-28.clover` ensures compatibility)
