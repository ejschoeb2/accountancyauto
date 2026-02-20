import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/client";

/**
 * POST /api/stripe/create-portal-session
 *
 * Creates a Stripe Customer Portal session so the org admin can
 * manage their subscription (change plan, update payment method,
 * view invoices, cancel). Redirects to Stripe's hosted portal.
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
    let body: { orgId?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { orgId } = body;

    if (!orgId) {
      return NextResponse.json(
        { error: "orgId is required" },
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

    // Fetch org to get Stripe customer ID
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

    if (!org.stripe_customer_id) {
      return NextResponse.json(
        {
          error:
            "No active subscription found. Please select a plan first.",
        },
        { status: 400 }
      );
    }

    // Create Customer Portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[create-portal-session] Error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to create portal session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
