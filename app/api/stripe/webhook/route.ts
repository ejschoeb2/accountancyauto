import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  handleCheckoutSessionCompleted,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleInvoicePaymentFailed,
} from "@/lib/stripe/webhook-handlers";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";

/**
 * Stripe webhook endpoint.
 *
 * Verifies the webhook signature, enforces idempotency via the
 * processed_webhook_events table, and dispatches to event-specific handlers.
 *
 * Returns 200 for all processed events (even if handler errors occur) to
 * prevent Stripe from retrying and causing double-processing.
 */
export async function POST(req: Request) {
  // CRITICAL: Read raw body as text BEFORE any parsing.
  // Stripe signature verification requires the raw request body.
  const body = await req.text();

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  // Verify webhook signature
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`Stripe webhook signature verification failed: ${message}`);
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${message}` },
      { status: 400 }
    );
  }

  // Use admin client (service_role) for all database operations.
  // Webhooks have no user session, and processed_webhook_events
  // requires service_role access (RLS policy).
  const supabase = createAdminClient();

  // ── Idempotency check ──────────────────────────────────────────────
  // Query processed_webhook_events to see if we already handled this event.
  const { data: existing } = await supabase
    .from("processed_webhook_events")
    .select("id")
    .eq("event_id", event.id)
    .maybeSingle();

  if (existing) {
    // Already processed -- return 200 immediately to acknowledge
    return NextResponse.json({ received: true, duplicate: true });
  }

  // Mark event as processed BEFORE handling to prevent race conditions.
  // If two identical webhook deliveries arrive simultaneously, the UNIQUE
  // constraint on event_id will cause the second insert to fail.
  const { error: insertError } = await supabase
    .from("processed_webhook_events")
    .insert({
      event_id: event.id,
      event_type: event.type,
    });

  if (insertError) {
    // If insert fails due to unique constraint, this is a duplicate
    if (insertError.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error("Failed to record webhook event:", insertError);
    // Continue processing anyway -- better to handle than to miss
  }

  // ── Event dispatch ──────────────────────────────────────────────────
  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session,
          supabase
        );
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription,
          supabase
        );
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
          supabase
        );
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(
          event.data.object as Stripe.Invoice,
          supabase
        );
        break;

      default:
        console.log(`Unhandled Stripe webhook event type: ${event.type}`);
    }
  } catch (err) {
    // Log the error but still return 200.
    // The event is already marked as processed in the idempotency table,
    // so retrying would just skip it anyway. Logging ensures visibility.
    console.error(
      `Error handling Stripe webhook event ${event.type} (${event.id}):`,
      err
    );
  }

  return NextResponse.json({ received: true });
}
