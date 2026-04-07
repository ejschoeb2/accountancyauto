import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from '@/lib/logger';

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
  // AUDIT-025: Execution metadata
  const executionId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const startTime = Date.now();

  try {
    // AUDIT-007: Timing-safe auth
    const authHeader = request.headers.get("authorization") || "";
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
    const isAuthorized =
      authHeader.length === expectedAuth.length &&
      timingSafeEqual(Buffer.from(authHeader), Buffer.from(expectedAuth));
    if (!isAuthorized) {
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
        execution_id: executionId,
        started_at: startedAt,
        ended_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
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
      logger.info(
        `[Cron:trial-expiry] Expired trial for org "${org.name}" (${org.id}), trial_ends_at: ${org.trial_ends_at}`
      );
    }

    return NextResponse.json({
      execution_id: executionId,
      started_at: startedAt,
      ended_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      success: true,
      processed: expiredOrgs.length,
      orgIds: expiredIds,
    });
  } catch (error) {
    logger.error("[Cron:trial-expiry] Error:", { error: (error as any)?.message ?? String(error) });
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({
      execution_id: executionId,
      started_at: startedAt,
      ended_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      error: message,
    }, { status: 500 });
  }
}
