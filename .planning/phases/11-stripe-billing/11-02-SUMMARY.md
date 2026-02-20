---
phase: 11-stripe-billing
plan: 02
subsystem: payments
tags: [stripe, webhooks, idempotency, postmark, email-notification, billing]

# Dependency graph
requires:
  - phase: 11-stripe-billing
    provides: processed_webhook_events table, Stripe SDK client, plan tier config with getPlanByTier/getPlanByPriceId
  - phase: 10-org-data-model-rls-foundation
    provides: organisations table with stripe_customer_id, stripe_subscription_id, subscription_status, plan_tier columns; user_organisations with role column
provides:
  - Stripe webhook POST endpoint with signature verification and idempotency
  - 4 event-specific handlers (checkout.session.completed, subscription.updated, subscription.deleted, invoice.payment_failed)
  - Payment-failed email notification function (NOTF-02)
affects: [11-03 checkout session creation, 11-04 billing page, 11-05 enforcement middleware]

# Tech tracking
tech-stack:
  added: []
  patterns: [insert-before-handle idempotency, service_role webhook processing, auth.admin.getUserById for email resolution]

key-files:
  created:
    - app/api/stripe/webhook/route.ts
    - lib/stripe/webhook-handlers.ts
    - lib/billing/notifications.ts
  modified: []

key-decisions:
  - "Insert-before-handle idempotency: mark event processed before dispatching to handlers, with unique constraint fallback for race conditions"
  - "Return 200 even on handler errors to prevent Stripe retries causing double-processing"
  - "Use supabase.auth.admin.getUserById() to resolve admin emails (avoids PostgREST FK join issues with auth.users)"
  - "Payment-failed email uses platform Postmark token (system notification), not org-specific token"

patterns-established:
  - "Webhook handler pattern: raw body -> signature verify -> idempotency check -> event dispatch -> always 200"
  - "Org lookup by stripe_subscription_id for subscription events, by stripe_customer_id for invoice events"
  - "Admin email resolution: query user_organisations for admin user_ids, then auth.admin.getUserById() for each"

# Metrics
duration: 4min
completed: 2026-02-20
---

# Phase 11 Plan 02: Stripe Webhook Handler Summary

**Stripe webhook endpoint with signature verification, insert-before-handle idempotency, 4 event handlers for subscription lifecycle, and payment-failed admin email notification (NOTF-02)**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-20T23:48:46Z
- **Completed:** 2026-02-20T23:52:29Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created Stripe webhook endpoint that verifies signatures, enforces idempotency via processed_webhook_events, and dispatches to 4 event-specific handlers
- Implemented checkout.session.completed handler that provisions org with all Stripe IDs, plan tier, and correct limits from plan config
- Built payment-failed email notification (NOTF-02) that sends to all org admins with a CTA to update payment method at /billing

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Stripe webhook route handler with idempotency** - `06df132` (feat)
2. **Task 2: Create payment-failed email notification (NOTF-02)** - `d88dcba` (feat)

## Files Created/Modified
- `app/api/stripe/webhook/route.ts` - POST endpoint with raw body signature verification, idempotency, and event dispatch
- `lib/stripe/webhook-handlers.ts` - handleCheckoutSessionCompleted, handleSubscriptionUpdated, handleSubscriptionDeleted, handleInvoicePaymentFailed
- `lib/billing/notifications.ts` - sendPaymentFailedEmail with HTML/text templates, admin email resolution via auth admin API

## Decisions Made
- **Insert-before-handle idempotency:** Event is marked as processed before handler dispatch, with PostgreSQL unique constraint on event_id as fallback for race conditions between concurrent webhook deliveries
- **Always return 200:** Even on handler errors, return 200 to Stripe. The event is already marked processed, so retries would just be skipped. Logging ensures visibility.
- **Auth admin API for email resolution:** Used supabase.auth.admin.getUserById() to get admin email addresses instead of attempting a PostgREST FK join to auth.users (which may not resolve -- known issue documented in MEMORY.md)
- **Platform Postmark token for NOTF-02:** Payment-failed emails are system notifications sent from the platform, not org-specific reminders, so they use the env var POSTMARK_SERVER_TOKEN

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

Environment variable `STRIPE_WEBHOOK_SECRET` must be configured after this webhook endpoint is deployed:
1. Deploy the app (endpoint lives at `/api/stripe/webhook`)
2. In Stripe Dashboard > Developers > Webhooks, create a webhook endpoint pointing to `{APP_URL}/api/stripe/webhook`
3. Select events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
4. Copy the signing secret and set it as `STRIPE_WEBHOOK_SECRET` in env vars

## Next Phase Readiness
- Webhook handler ready to receive events from Stripe once deployed and configured
- Plan 11-03 (Checkout Session) can proceed -- it will create checkout sessions that trigger checkout.session.completed
- Plan 11-04 (Billing Page) can proceed -- payment-failed email links to /billing
- All handlers tested for TypeScript correctness (tsc --noEmit passes)

## Self-Check: PASSED

---
*Phase: 11-stripe-billing*
*Completed: 2026-02-20*
