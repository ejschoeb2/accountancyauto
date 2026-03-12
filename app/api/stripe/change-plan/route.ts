import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";
import {
  getPlanByTier,
  PAID_PLAN_TIERS,
  type PlanTier,
} from "@/lib/stripe/plans";

/**
 * POST /api/stripe/change-plan
 *
 * Updates an existing Stripe subscription to a new plan tier.
 * Uses stripe.subscriptions.update() to swap the price, which
 * Stripe handles with proration automatically.
 *
 * The webhook handler (customer.subscription.updated) will sync
 * the new plan_tier and client_count_limit back to the database.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    let body: { planTier?: string; orgId?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { planTier, orgId } = body;

    if (!planTier || !orgId) {
      return NextResponse.json(
        { error: "planTier and orgId are required" },
        { status: 400 }
      );
    }

    if (!PAID_PLAN_TIERS.includes(planTier as PlanTier)) {
      return NextResponse.json(
        { error: `Invalid plan tier: ${planTier}` },
        { status: 400 }
      );
    }

    // Verify user is admin of this org
    const admin = createAdminClient();

    const { data: membership, error: memberError } = await admin
      .from("user_organisations")
      .select("role")
      .eq("user_id", user.id)
      .eq("org_id", orgId)
      .single();

    if (memberError || !membership) {
      return NextResponse.json(
        { error: "You are not a member of this organisation" },
        { status: 403 }
      );
    }

    if (membership.role !== "admin") {
      return NextResponse.json(
        { error: "Only organisation admins can manage billing" },
        { status: 403 }
      );
    }

    // Fetch org to get existing subscription
    const { data: org, error: orgError } = await admin
      .from("organisations")
      .select("stripe_subscription_id, plan_tier")
      .eq("id", orgId)
      .single();

    if (orgError || !org) {
      return NextResponse.json(
        { error: "Organisation not found" },
        { status: 404 }
      );
    }

    if (!org.stripe_subscription_id) {
      return NextResponse.json(
        { error: "No active subscription found. Please subscribe first." },
        { status: 400 }
      );
    }

    if (org.plan_tier === planTier) {
      return NextResponse.json(
        { error: "You are already on this plan" },
        { status: 400 }
      );
    }

    // Get new plan's price ID
    const newPlan = getPlanByTier(planTier as PlanTier);
    if (!newPlan.priceId) {
      return NextResponse.json(
        { error: "This plan is not yet available" },
        { status: 400 }
      );
    }

    // Retrieve current subscription to get the item ID
    const subscription = await stripe.subscriptions.retrieve(
      org.stripe_subscription_id
    );

    const subscriptionItemId = subscription.items.data[0]?.id;
    if (!subscriptionItemId) {
      return NextResponse.json(
        { error: "Could not find subscription item to update" },
        { status: 500 }
      );
    }

    // Update the subscription with the new price (Stripe handles proration)
    await stripe.subscriptions.update(org.stripe_subscription_id, {
      items: [
        {
          id: subscriptionItemId,
          price: newPlan.priceId,
        },
      ],
      metadata: {
        org_id: orgId,
        plan_tier: planTier,
      },
      proration_behavior: "create_prorations",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[change-plan] Error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to change plan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
