import { NextRequest, NextResponse } from "next/server";
import { reportUsageForAllPracticeOrgs } from "@/lib/stripe/metered-billing";
import { logger } from '@/lib/logger';

/**
 * POST /api/stripe/report-usage
 *
 * Reports current client counts as Stripe Billing Meter events for all
 * Practice-tier orgs. Should be called daily by a Vercel cron job.
 *
 * Protected by CRON_SECRET header to prevent unauthorized access.
 */
export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await reportUsageForAllPracticeOrgs();

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err) {
    logger.error("[report-usage] Error:", { error: (err as any)?.message ?? String(err) });
    return NextResponse.json(
      { error: "Failed to report usage" },
      { status: 500 }
    );
  }
}
