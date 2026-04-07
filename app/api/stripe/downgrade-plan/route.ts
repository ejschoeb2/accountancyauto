import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";
import {
  getPlanByTier,
  PLAN_TIERS,
  PAID_PLAN_TIERS,
  type PlanTier,
} from "@/lib/stripe/plans";
import { logger } from '@/lib/logger';

const VALID_TIERS: PlanTier[] = ["free", ...PAID_PLAN_TIERS];

/**
 * POST /api/stripe/downgrade-plan
 *
 * Handles plan downgrade when the org has more clients than the target
 * plan allows. Stores pending removals in DB, executes the plan change,
 * then hard-deletes the selected clients.
 *
 * Body: { orgId, targetTier, clientIdsToRemove: string[] }
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

    let body: { targetTier?: string; orgId?: string; clientIdsToRemove?: string[] };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { targetTier, orgId, clientIdsToRemove } = body;

    if (!targetTier || !orgId || !clientIdsToRemove) {
      return NextResponse.json(
        { error: "targetTier, orgId, and clientIdsToRemove are required" },
        { status: 400 }
      );
    }

    if (!VALID_TIERS.includes(targetTier as PlanTier)) {
      return NextResponse.json(
        { error: `Invalid plan tier: ${targetTier}` },
        { status: 400 }
      );
    }

    if (!Array.isArray(clientIdsToRemove) || clientIdsToRemove.length === 0) {
      return NextResponse.json(
        { error: "At least one client must be selected for removal" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Verify user is admin of this org
    const { data: membership, error: memberError } = await admin
      .from("user_organisations")
      .select("role")
      .eq("user_id", user.id)
      .eq("org_id", orgId)
      .single();

    if (memberError || !membership || membership.role !== "admin") {
      return NextResponse.json(
        { error: "Only organisation admins can manage billing" },
        { status: 403 }
      );
    }

    // Fetch org details
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

    if (org.plan_tier === targetTier) {
      return NextResponse.json(
        { error: "You are already on this plan" },
        { status: 400 }
      );
    }

    // Validate that removing these clients brings count within limit
    const targetPlan = getPlanByTier(targetTier as PlanTier);
    const targetLimit = targetPlan.clientLimit;

    if (targetLimit !== null) {
      const { count: clientCount } = await admin
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId);

      const remainingAfterRemoval = (clientCount ?? 0) - clientIdsToRemove.length;
      if (remainingAfterRemoval > targetLimit) {
        return NextResponse.json(
          {
            error: `You need to remove at least ${(clientCount ?? 0) - targetLimit} clients. Only ${clientIdsToRemove.length} selected.`,
          },
          { status: 400 }
        );
      }
    }

    // Verify all client IDs belong to this org
    const { data: validClients } = await admin
      .from("clients")
      .select("id")
      .eq("org_id", orgId)
      .in("id", clientIdsToRemove);

    if (!validClients || validClients.length !== clientIdsToRemove.length) {
      return NextResponse.json(
        { error: "Some selected clients do not belong to this organisation" },
        { status: 400 }
      );
    }

    // Step 1: Store pending removals in DB for reliability
    await admin
      .from("pending_downgrade")
      .upsert({
        org_id: orgId,
        target_tier: targetTier,
        client_ids: clientIdsToRemove,
      }, { onConflict: "org_id" });

    // Step 2: Execute the plan change
    if (targetTier === "free") {
      const freePlan = PLAN_TIERS.free;

      if (org.stripe_subscription_id) {
        await stripe.subscriptions.cancel(org.stripe_subscription_id);
      }

      const { error: updateError } = await admin
        .from("organisations")
        .update({
          plan_tier: "free",
          client_count_limit: freePlan.clientLimit,
          subscription_status: "active",
          stripe_subscription_id: null,
          stripe_price_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orgId);

      if (updateError) {
        logger.error(`[downgrade-plan] Failed to reset org ${orgId} to free:`, { error: (updateError as any)?.message ?? String(updateError) });
        return NextResponse.json(
          { error: "Failed to change plan. Please contact support." },
          { status: 500 }
        );
      }
    } else {
      // Downgrade to a lower paid plan
      if (!org.stripe_subscription_id) {
        // No Stripe subscription — just update the DB directly
        const { error: updateError } = await admin
          .from("organisations")
          .update({
            plan_tier: targetTier,
            client_count_limit: targetPlan.clientLimit,
            updated_at: new Date().toISOString(),
          })
          .eq("id", orgId);

        if (updateError) {
          logger.error(`[downgrade-plan] Failed to update org ${orgId}:`, { error: (updateError as any)?.message ?? String(updateError) });
          return NextResponse.json(
            { error: "Failed to change plan. Please contact support." },
            { status: 500 }
          );
        }
      } else {
        // Has Stripe subscription — update via Stripe API
        if (!targetPlan.priceId) {
          return NextResponse.json(
            { error: "This plan is not yet available" },
            { status: 400 }
          );
        }

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

        await stripe.subscriptions.update(org.stripe_subscription_id, {
          items: [{ id: subscriptionItemId, price: targetPlan.priceId }],
          metadata: { org_id: orgId, plan_tier: targetTier },
          proration_behavior: "create_prorations",
        });
      }
    }

    // Step 3: Delete the selected clients
    const { error: deleteError } = await admin
      .from("clients")
      .delete()
      .eq("org_id", orgId)
      .in("id", clientIdsToRemove);

    if (deleteError) {
      logger.error(`[downgrade-plan] Failed to delete clients for org ${orgId}:`, { error: (deleteError as any)?.message ?? String(deleteError) });
      // Plan changed but clients not deleted — leave pending record for manual cleanup
      return NextResponse.json(
        { error: "Plan changed but some clients could not be removed. Please contact support." },
        { status: 500 }
      );
    }

    // Step 4: Clean up pending record
    await admin
      .from("pending_downgrade")
      .delete()
      .eq("org_id", orgId);

    logger.info(
      `[downgrade-plan] org ${orgId} downgraded to ${targetTier}, ${clientIdsToRemove.length} clients removed`
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("[downgrade-plan] Error:", { error: (error as any)?.message ?? String(error) });
    const message =
      error instanceof Error ? error.message : "Failed to downgrade plan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
