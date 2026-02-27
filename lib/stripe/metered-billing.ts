/**
 * Metered billing utilities for Practice tier overage.
 *
 * Practice tier charges £89/mo base + £0.60 per client above 300.
 * This module reports usage records to Stripe so overage is billed
 * at the end of each billing period.
 *
 * NOTE: This uses Stripe's new Billing Meter Events API
 * (stripe.billing.meterEvents.create), NOT the legacy
 * subscriptionItems.createUsageRecord which was removed in API versions
 * after 2022-08-01. The Stripe price must be configured with a Billing Meter
 * whose event_name matches PRACTICE_METER_EVENT_NAME.
 */

import { stripe } from "@/lib/stripe/client";
import {
  PRACTICE_OVERAGE_THRESHOLD,
  PRACTICE_OVERAGE_PRICE_ID,
  PRACTICE_METER_EVENT_NAME,
} from "@/lib/stripe/plans";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Calculate the number of clients above the overage threshold.
 * Returns 0 if the count is at or below the threshold.
 */
export function getOverageClientCount(totalClients: number): number {
  return Math.max(0, totalClients - PRACTICE_OVERAGE_THRESHOLD);
}

/**
 * Report current usage to Stripe for a Practice-tier org.
 *
 * This creates a Billing Meter event for the org's Stripe customer,
 * reporting the current overage client count. Stripe aggregates meter
 * events during the billing period and charges at invoice time.
 *
 * Using `last` aggregation on the meter is recommended for "current count"
 * usage (i.e. the most recent report reflects actual usage), vs `sum`
 * which would accumulate across all events.
 *
 * @returns The overage count reported, or null if the org is not on Practice
 *          or has no Stripe customer / meter event name configured.
 */
export async function reportUsageForOrg(orgId: string): Promise<number | null> {
  const supabase = createAdminClient();

  // Get org billing details
  const { data: org, error: orgError } = await supabase
    .from("organisations")
    .select("plan_tier, stripe_customer_id, stripe_subscription_id")
    .eq("id", orgId)
    .single();

  if (orgError || !org) {
    console.error(`reportUsageForOrg: org ${orgId} not found`);
    return null;
  }

  // Only Practice tier has metered billing
  if (org.plan_tier !== "practice" || !org.stripe_customer_id) {
    return null;
  }

  // Ensure overage price and meter event name are configured
  if (!PRACTICE_OVERAGE_PRICE_ID) {
    console.warn("reportUsageForOrg: STRIPE_PRICE_PRACTICE_OVERAGE not configured");
    return null;
  }

  if (!PRACTICE_METER_EVENT_NAME) {
    console.warn("reportUsageForOrg: STRIPE_METER_EVENT_NAME not configured");
    return null;
  }

  // Count clients for this org
  const { count, error: countError } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId);

  if (countError) {
    console.error(
      `reportUsageForOrg: failed to count clients for org ${orgId}:`,
      countError
    );
    return null;
  }

  const totalClients = count ?? 0;
  const overage = getOverageClientCount(totalClients);

  try {
    // Report usage via Stripe Billing Meter Events API.
    // The meter must be configured in Stripe Dashboard with:
    //   - event_name: matching PRACTICE_METER_EVENT_NAME
    //   - customer_mapping: by_id using stripe_customer_id key
    //   - value_settings: event_payload_key = "value"
    //   - default_aggregation: "last" (reports current client count)
    await stripe.billing.meterEvents.create({
      event_name: PRACTICE_METER_EVENT_NAME,
      payload: {
        stripe_customer_id: org.stripe_customer_id,
        value: String(overage),
      },
      timestamp: Math.floor(Date.now() / 1000),
    });

    console.log(
      `reportUsageForOrg: org ${orgId} reported ${overage} overage clients (${totalClients} total)`
    );

    return overage;
  } catch (err) {
    console.error(`reportUsageForOrg: Stripe API error for org ${orgId}:`, err);
    return null;
  }
}

/**
 * Report usage for all Practice-tier orgs.
 * Called by the usage reporting cron/API route.
 */
export async function reportUsageForAllPracticeOrgs(): Promise<{
  processed: number;
  reported: number;
  errors: number;
}> {
  const supabase = createAdminClient();

  const { data: orgs, error } = await supabase
    .from("organisations")
    .select("id")
    .eq("plan_tier", "practice")
    .not("stripe_customer_id", "is", null);

  if (error || !orgs) {
    console.error(
      "reportUsageForAllPracticeOrgs: failed to fetch practice orgs:",
      error
    );
    return { processed: 0, reported: 0, errors: 0 };
  }

  let reported = 0;
  let errors = 0;

  for (const org of orgs) {
    try {
      const result = await reportUsageForOrg(org.id);
      if (result !== null) reported++;
    } catch {
      errors++;
    }
  }

  return { processed: orgs.length, reported, errors };
}
