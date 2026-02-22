import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/client";
import { getPlanByTier, type PlanTier } from "@/lib/stripe/plans";

const VALID_TIERS: PlanTier[] = ["sole_trader", "practice", "firm"];

/**
 * POST /api/stripe/create-checkout-session
 *
 * Creates a Stripe Checkout Session for initial subscription creation.
 * Only org admins can initiate checkout. The org_id is embedded in
 * both session and subscription metadata so the webhook handler can
 * provision the correct organisation.
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
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

    // Parse request body
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

    if (!VALID_TIERS.includes(planTier as PlanTier)) {
      return NextResponse.json(
        { error: `Invalid plan tier: ${planTier}` },
        { status: 400 }
      );
    }

    // Verify user is admin of this org
    const { data: membership, error: memberError } = await supabase
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

    // Get plan config
    const plan = getPlanByTier(planTier as PlanTier);
    if (!plan.priceId) {
      return NextResponse.json(
        { error: "This plan is not yet available for purchase" },
        { status: 400 }
      );
    }

    // Check if org already has a Stripe customer
    const { data: org, error: orgError } = await supabase
      .from("organisations")
      .select("stripe_customer_id")
      .eq("id", orgId)
      .single();

    if (orgError || !org) {
      return NextResponse.json(
        { error: "Organisation not found" },
        { status: 404 }
      );
    }

    const existingCustomerId = org.stripe_customer_id;

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_collection: "always",
      line_items: [{ price: plan.priceId, quantity: 1 }],
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
      customer: existingCustomerId || undefined,
      customer_email: existingCustomerId ? undefined : user.email,
      tax_id_collection: {
        enabled: process.env.STRIPE_TAX_ENABLED === "true",
      },
      automatic_tax: {
        enabled: process.env.STRIPE_TAX_ENABLED === "true",
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[create-checkout-session] Error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create checkout session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
