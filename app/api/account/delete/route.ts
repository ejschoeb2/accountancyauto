import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";
import { logger } from '@/lib/logger';

/**
 * POST /api/account/delete
 *
 * Permanently deletes the authenticated user's account:
 *   1. Cancels any active Stripe subscription
 *   2. Deletes the organisation (cascades to clients, templates, etc.)
 *   3. Deletes the Supabase Auth user
 */
export async function POST() {
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

    const admin = createAdminClient();

    // Find user's org membership
    const { data: membership } = await admin
      .from("user_organisations")
      .select("org_id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (membership?.org_id) {
      // Only admins can delete the organisation
      if (membership.role !== "admin") {
        return NextResponse.json(
          { error: "Only organisation admins can delete the account" },
          { status: 403 }
        );
      }

      // Fetch org details for Stripe cleanup
      const { data: org } = await admin
        .from("organisations")
        .select("stripe_subscription_id")
        .eq("id", membership.org_id)
        .single();

      // Cancel Stripe subscription if active
      if (org?.stripe_subscription_id) {
        try {
          await stripe.subscriptions.cancel(org.stripe_subscription_id);
          logger.info(
            `[delete-account] Cancelled Stripe subscription for org ${membership.org_id}`
          );
        } catch (stripeErr) {
          // Log but don't block deletion if subscription is already cancelled
          logger.error(`[delete-account] Stripe cancellation error:`, { error: (stripeErr as any)?.message ?? String(stripeErr) });
        }
      }

      // Delete the organisation (cascades to clients, templates, email_logs, etc.)
      const { error: deleteOrgError } = await admin
        .from("organisations")
        .delete()
        .eq("id", membership.org_id);

      if (deleteOrgError) {
        logger.error(`[delete-account] Failed to delete org ${membership.org_id}:`, { error: (deleteOrgError as any)?.message ?? String(deleteOrgError) });
        return NextResponse.json(
          { error: "Failed to delete organisation data. Please contact support." },
          { status: 500 }
        );
      }

      logger.info(
        `[delete-account] Deleted org ${membership.org_id}`
      );
    }

    // Delete the Supabase Auth user (cascades to user_organisations)
    const { error: deleteUserError } = await admin.auth.admin.deleteUser(
      user.id
    );

    if (deleteUserError) {
      logger.error(`[delete-account] Failed to delete auth user ${user.id}:`, { error: (deleteUserError as any)?.message ?? String(deleteUserError) });
      return NextResponse.json(
        { error: "Failed to delete user account. Please contact support." },
        { status: 500 }
      );
    }

    // Sign out the current session
    await supabase.auth.signOut();

    logger.info(`[delete-account] Deleted user ${user.id}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("[delete-account] Error:", { error: (error as any)?.message ?? String(error) });
    const message =
      error instanceof Error ? error.message : "Failed to delete account";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
