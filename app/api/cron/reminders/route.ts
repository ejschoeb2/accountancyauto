import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { processReminders, ProcessResult } from '@/lib/reminders/scheduler';

// Allow 5 minutes for cron execution (Vercel Pro limit)
export const maxDuration = 300;

interface OrgResult {
  org: string;
  org_id: string;
  queued: number;
  rolled_over: number;
  errors: string[];
  skipped_wrong_hour: boolean;
  error?: string;
}

/**
 * GET /api/cron/reminders
 * Cron job to process reminders for all active organisations
 * Iterates over organisations sequentially — one org's failure doesn't affect others
 * Runs at 8am and 9am UTC (covers both GMT and BST for 9am UK time)
 * Validates CRON_SECRET header for security
 */
export async function GET(request: NextRequest) {
  try {
    // Verify CRON_SECRET
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

    if (authHeader !== expectedAuth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use admin client for service-role access
    const adminClient = createAdminClient();

    // Fetch all active organisations
    const { data: orgs, error: orgsError } = await adminClient
      .from('organisations')
      .select('id, name, slug, postmark_server_token')
      .in('subscription_status', ['active', 'trialing']);

    if (orgsError) {
      throw new Error(`Failed to fetch organisations: ${orgsError.message}`);
    }

    if (!orgs || orgs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active organisations found',
        results: [],
      });
    }

    // Process each org sequentially
    const allResults: OrgResult[] = [];
    let totalQueued = 0;
    let totalRolledOver = 0;
    const allErrors: string[] = [];

    for (const org of orgs) {
      console.log(`[Cron:reminders] Processing org: ${org.name} (${org.id})`);
      try {
        const result = await processReminders(adminClient, org);
        allResults.push({
          org: org.name,
          org_id: org.id,
          queued: result.queued,
          rolled_over: result.rolled_over,
          errors: result.errors,
          skipped_wrong_hour: result.skipped_wrong_hour,
        });
        totalQueued += result.queued;
        totalRolledOver += result.rolled_over;
        allErrors.push(...result.errors);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Cron:reminders] Failed processing org ${org.name} (${org.id}):`, error);
        allResults.push({
          org: org.name,
          org_id: org.id,
          queued: 0,
          rolled_over: 0,
          errors: [message],
          skipped_wrong_hour: false,
          error: message,
        });
        allErrors.push(`[${org.name}] ${message}`);
        // Continue to next org — don't let one failure stop others
      }
    }

    return NextResponse.json({
      success: true,
      orgs_processed: orgs.length,
      total_queued: totalQueued,
      total_rolled_over: totalRolledOver,
      errors: allErrors,
      results: allResults,
    });
  } catch (error) {
    console.error('Cron job failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
