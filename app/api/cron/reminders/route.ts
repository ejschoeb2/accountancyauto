import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { processRemindersForUser, ProcessResult } from '@/lib/reminders/scheduler';

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
  users_processed?: number;
}

/**
 * GET /api/cron/reminders
 * Cron job to process reminders for all active organisations.
 * For each org, iterates over all org members and processes each user independently.
 * Each user's reminders are built from their own schedules, templates, and send hour setting.
 * Runs at 8am and 9am UTC (covers both GMT and BST for 9am UK time).
 * Validates CRON_SECRET header for security.
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
      // Skip orgs without a Postmark token — no point queuing reminders
      // they cannot send (consistent with send-emails cron behaviour)
      if (!org.postmark_server_token) {
        console.warn(
          `[Cron:reminders] Skipping org ${org.name} (${org.slug}) — no Postmark token configured`
        );
        allResults.push({
          org: org.name,
          org_id: org.id,
          queued: 0,
          rolled_over: 0,
          errors: [],
          skipped_wrong_hour: false,
          error: "Skipped: no Postmark token configured",
        });
        continue;
      }

      console.log(`[Cron:reminders] Processing org: ${org.name} (${org.id})`);

      try {
        // Fetch all members of this org
        const { data: members } = await adminClient
          .from('user_organisations')
          .select('user_id')
          .eq('org_id', org.id);

        let orgQueued = 0;
        let orgRolledOver = 0;
        const orgErrors: string[] = [];
        // Start true — set to false if any user actually processes (i.e. isn't hour-skipped)
        let orgSkippedWrongHour = true;
        let usersProcessed = 0;

        // Process each org member independently with their own schedules and send hour
        for (const member of members ?? []) {
          try {
            const userResult = await processRemindersForUser(adminClient, org, member.user_id);
            orgQueued += userResult.queued;
            orgRolledOver += userResult.rolled_over;
            orgErrors.push(...userResult.errors);
            if (!userResult.skipped_wrong_hour) orgSkippedWrongHour = false;
            usersProcessed++;
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error(
              `[Cron:reminders] Failed processing user ${member.user_id} in org ${org.name}:`,
              error
            );
            orgErrors.push(`[user:${member.user_id}] ${message}`);
          }
        }

        allResults.push({
          org: org.name,
          org_id: org.id,
          queued: orgQueued,
          rolled_over: orgRolledOver,
          errors: orgErrors,
          skipped_wrong_hour: orgSkippedWrongHour,
          users_processed: usersProcessed,
        });
        totalQueued += orgQueued;
        totalRolledOver += orgRolledOver;
        allErrors.push(...orgErrors);
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
