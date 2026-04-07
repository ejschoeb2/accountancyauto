import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTrialEndingSoonEmail } from "@/lib/billing/notifications";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/trial-reminder
 *
 * Daily cron job (9am UTC) that sends trial-ending-soon emails to org
 * admins whose trial expires in 3–4 days.
 *
 * Idempotency is enforced via the app_settings key "trial_reminder_sent":
 * if the key exists and is "true" for an org, the email has already been
 * sent and won't be sent again on subsequent runs.
 *
 * Secured via CRON_SECRET bearer token (same pattern as other cron routes).
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

    // Find orgs where trial ends in 3–4 days from now
    const now = new Date();
    const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const fourDays = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);

    const { data: orgs, error: fetchError } = await adminClient
      .from("organisations")
      .select("id, name, trial_ends_at")
      .eq("subscription_status", "trialing")
      .gte("trial_ends_at", threeDays.toISOString())
      .lt("trial_ends_at", fourDays.toISOString());

    if (fetchError) {
      throw new Error(
        `Failed to fetch trialing orgs: ${fetchError.message}`
      );
    }

    if (!orgs || orgs.length === 0) {
      return NextResponse.json({
        execution_id: executionId,
        started_at: startedAt,
        ended_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        success: true,
        message: "No orgs ending trial in 3 days",
        sent: 0,
        skipped: 0,
      });
    }

    let sent = 0;
    let skipped = 0;

    for (const org of orgs) {
      // Idempotency check: has reminder already been sent for this org?
      const { data: alreadySent } = await adminClient
        .from("app_settings")
        .select("id")
        .eq("org_id", org.id)
        .eq("key", "trial_reminder_sent")
        .eq("value", "true")
        .single();

      if (alreadySent) {
        console.log(
          `[Cron:trial-reminder] Skipping org "${org.name}" (${org.id}) — reminder already sent`
        );
        skipped++;
        continue;
      }

      // Send trial-ending-soon email to org admins
      try {
        await sendTrialEndingSoonEmail(
          org.id,
          org.name,
          org.trial_ends_at,
          adminClient
        );
      } catch (err) {
        console.error(
          `[Cron:trial-reminder] Failed to send email for org ${org.id}:`,
          err
        );
        // Don't mark as sent if email failed — cron will retry tomorrow
        continue;
      }

      // Mark as sent (idempotency flag)
      const { error: upsertError } = await adminClient
        .from("app_settings")
        .upsert(
          { org_id: org.id, key: "trial_reminder_sent", value: "true" },
          { onConflict: "org_id,key" }
        );

      if (upsertError) {
        console.error(
          `[Cron:trial-reminder] Failed to mark reminder sent for org ${org.id}:`,
          upsertError
        );
        // Non-fatal: email was sent, but idempotency flag failed.
        // Worst case: org receives a second email on the next cron run.
      } else {
        console.log(
          `[Cron:trial-reminder] Sent reminder for org "${org.name}" (${org.id}), trial ends: ${org.trial_ends_at}`
        );
      }

      sent++;
    }

    return NextResponse.json({
      execution_id: executionId,
      started_at: startedAt,
      ended_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      success: true,
      sent,
      skipped,
    });
  } catch (error) {
    console.error("[Cron:trial-reminder] Error:", error);
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
