import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/trial-expiry
 *
 * Daily cron job that transitions expired trial organisations
 * from 'trialing' to 'unpaid'. This ensures orgs that don't
 * subscribe after their trial period lose write access.
 *
 * Secured via CRON_SECRET bearer token (same pattern as
 * /api/cron/reminders and /api/cron/send-emails).
 */
export async function GET(request: NextRequest) {
  try {
    // Verify CRON_SECRET
    const authHeader = request.headers.get("authorization");
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

    if (authHeader !== expectedAuth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // Find all trialing orgs whose trial has expired
    const { data: expiredOrgs, error: fetchError } = await adminClient
      .from("organisations")
      .select("id, name, trial_ends_at")
      .eq("subscription_status", "trialing")
      .lt("trial_ends_at", new Date().toISOString());

    if (fetchError) {
      throw new Error(
        `Failed to fetch expired trials: ${fetchError.message}`
      );
    }

    if (!expiredOrgs || expiredOrgs.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No expired trials found",
        processed: 0,
        orgIds: [],
      });
    }

    // Transition each expired org to 'unpaid'
    const expiredIds = expiredOrgs.map((org) => org.id);

    const { error: updateError } = await adminClient
      .from("organisations")
      .update({ subscription_status: "unpaid" })
      .in("id", expiredIds);

    if (updateError) {
      throw new Error(
        `Failed to update expired trials: ${updateError.message}`
      );
    }

    // Log each expired org
    for (const org of expiredOrgs) {
      console.log(
        `[Cron:trial-expiry] Expired trial for org "${org.name}" (${org.id}), trial_ends_at: ${org.trial_ends_at}`
      );
    }

    return NextResponse.json({
      success: true,
      processed: expiredOrgs.length,
      orgIds: expiredIds,
    });
  } catch (error) {
    console.error("[Cron:trial-expiry] Error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
