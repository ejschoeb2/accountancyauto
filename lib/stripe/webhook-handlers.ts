/**
 * Event-specific Stripe webhook handler functions.
 *
 * Each handler receives the typed Stripe event object and a Supabase
 * admin client (service_role) to update the organisations table.
 *
 * IMPORTANT: checkout.session.completed is the sole provisioning trigger.
 * We do NOT handle customer.subscription.created to avoid race conditions
 * where subscription.created fires before checkout.session.completed.
 */

import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe/client";
import { getPlanByTier, getPlanByPriceId, type PlanTier } from "@/lib/stripe/plans";
import { sendPaymentFailedEmail } from "@/lib/billing/notifications";
import { logger } from '@/lib/logger';

/**
 * Handle checkout.session.completed
 *
 * This is the sole provisioning trigger. When a customer completes
 * checkout, we update the organisation with all Stripe IDs, the plan
 * tier, and correct limits.
 */
export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  supabase: SupabaseClient
): Promise<void> {
  const orgId = session.metadata?.org_id;
  const planTier = session.metadata?.plan_tier as PlanTier | undefined;

  if (!orgId || !planTier) {
    logger.error("checkout.session.completed missing metadata", { orgId, planTier, sessionId: session.id });
    return;
  }

  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  if (!subscriptionId) {
    logger.error("checkout.session.completed missing subscription ID:", { error: (session.id as any)?.message ?? String(session.id) });
    return;
  }

  // Retrieve the full subscription to get current status and price details
  let subscription: Stripe.Subscription;
  try {
    subscription = await stripe.subscriptions.retrieve(subscriptionId);
  } catch (err) {
    logger.error(`Failed to retrieve subscription ${subscriptionId}:`, { error: (err as any)?.message ?? String(err) });
    return;
  }

  // Get plan limits from the tier configuration.
  // NOTE: Legacy Firm subscribers may have plan_tier = 'firm' in the database.
  // The billing page maps 'firm' -> 'practice' for display via getEffectivePlanTier.
  // New checkouts with tier='firm' are rejected by the checkout route (not in PAID_PLAN_TIERS).
  const plan = getPlanByTier(planTier);

  const { error } = await supabase
    .from("organisations")
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      stripe_price_id: subscription.items.data[0]?.price.id ?? null,
      subscription_status: subscription.status,
      plan_tier: planTier,
      client_count_limit: plan.clientLimit,
      trial_ends_at: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orgId);

  if (error) {
    logger.error(`Failed to update org ${orgId} after checkout:`, { error: (error as any)?.message ?? String(error) });
    return;
  }

  logger.info(
    `checkout.session.completed: org ${orgId} provisioned with plan ${planTier}, subscription ${subscriptionId}`
  );
}

/**
 * Handle customer.subscription.updated
 *
 * Syncs subscription status changes (upgrades, downgrades, renewals,
 * cancellation scheduling) to the organisations table.
 */
export async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
  supabase: SupabaseClient
): Promise<void> {
  // Find the org by subscription ID
  const { data: org, error: lookupError } = await supabase
    .from("organisations")
    .select("id, stripe_price_id")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();

  if (lookupError) {
    logger.error(`Failed to look up org for subscription ${subscription.id}:`, { error: (lookupError as any)?.message ?? String(lookupError) });
    return;
  }

  if (!org) {
    logger.warn(
      `customer.subscription.updated: no org found for subscription ${subscription.id}`
    );
    return;
  }

  const newPriceId = subscription.items.data[0]?.price.id;

  // Build the update payload
  const updatePayload: Record<string, unknown> = {
    subscription_status: subscription.status,
    updated_at: new Date().toISOString(),
  };

  // Check if the plan has changed (new price ID differs from stored one)
  if (newPriceId && newPriceId !== org.stripe_price_id) {
    const newPlan = getPlanByPriceId(newPriceId);
    if (newPlan) {
      updatePayload.plan_tier = newPlan.tier;
      updatePayload.client_count_limit = newPlan.clientLimit;
      updatePayload.stripe_price_id = newPriceId;
      logger.info(
        `customer.subscription.updated: org ${org.id} plan changed to ${newPlan.tier}`
      );
    } else {
      // Price ID not in our plan config -- update the price ID anyway
      updatePayload.stripe_price_id = newPriceId;
      logger.warn(
        `customer.subscription.updated: unknown price ID ${newPriceId} for org ${org.id}`
      );
    }
  }

  const { error: updateError } = await supabase
    .from("organisations")
    .update(updatePayload)
    .eq("id", org.id);

  if (updateError) {
    logger.error(`Failed to update org ${org.id} subscription status:`, { error: (updateError as any)?.message ?? String(updateError) });
    return;
  }

  logger.info(
    `customer.subscription.updated: org ${org.id} status -> ${subscription.status}`
  );
}

/**
 * Handle customer.subscription.deleted
 *
 * Marks the organisation's subscription as cancelled. The org will
 * enter read-only mode (enforced by isOrgReadOnly).
 */
export async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  supabase: SupabaseClient
): Promise<void> {
  // Find the org by subscription ID
  const { data: org, error: lookupError } = await supabase
    .from("organisations")
    .select("id, plan_tier")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();

  if (lookupError) {
    logger.error(`Failed to look up org for subscription ${subscription.id}:`, { error: (lookupError as any)?.message ?? String(lookupError) });
    return;
  }

  if (!org) {
    logger.warn(
      `customer.subscription.deleted: no org found for subscription ${subscription.id}`
    );
    return;
  }

  // If the org was already downgraded to free (via change-plan endpoint),
  // the subscription_id will have been cleared. If we still matched, it
  // means the webhook arrived before the DB update — skip overriding.
  if (org.plan_tier === "free") {
    logger.info(
      `customer.subscription.deleted: org ${org.id} already on free plan, skipping`
    );
    return;
  }

  const { error: updateError } = await supabase
    .from("organisations")
    .update({
      subscription_status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", org.id);

  if (updateError) {
    logger.error(`Failed to update org ${org.id} to cancelled:`, { error: (updateError as any)?.message ?? String(updateError) });
    return;
  }

  logger.info(
    `customer.subscription.deleted: org ${org.id} subscription cancelled`
  );
}

/**
 * Handle invoice.payment_failed
 *
 * Updates the org's subscription status to past_due and sends a
 * payment-failed email notification (NOTF-02) to all org admins.
 *
 * Idempotency is guaranteed at the webhook route level -- this
 * handler will only be called once per Stripe event.
 */
export async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
  supabase: SupabaseClient
): Promise<void> {
  const customerId = invoice.customer as string;

  if (!customerId) {
    logger.error("invoice.payment_failed: missing customer ID on invoice", { error: (invoice.id as any)?.message ?? String(invoice.id) });
    return;
  }

  // Find the org by Stripe customer ID
  const { data: org, error: lookupError } = await supabase
    .from("organisations")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (lookupError) {
    logger.error(`Failed to look up org for customer ${customerId}:`, { error: (lookupError as any)?.message ?? String(lookupError) });
    return;
  }

  if (!org) {
    logger.warn(
      `invoice.payment_failed: no org found for customer ${customerId}`
    );
    return;
  }

  // Update subscription status to past_due
  const { error: updateError } = await supabase
    .from("organisations")
    .update({
      subscription_status: "past_due",
      updated_at: new Date().toISOString(),
    })
    .eq("id", org.id);

  if (updateError) {
    logger.error(`Failed to update org ${org.id} to past_due:`, { error: (updateError as any)?.message ?? String(updateError) });
    // Continue to send email even if status update fails
  }

  // Send payment-failed email to org admins (NOTF-02)
  try {
    await sendPaymentFailedEmail(org.id, supabase);
  } catch (err) {
    logger.error(`Failed to send payment-failed email for org ${org.id}:`, { error: (err as any)?.message ?? String(err) });
  }

  logger.info(
    `invoice.payment_failed: org ${org.id} marked past_due, admin(s) notified`
  );
}
