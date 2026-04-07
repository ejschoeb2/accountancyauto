import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { processRemindersForUser, ProcessResult } from '@/lib/reminders/scheduler';
import { logger } from '@/lib/logger';

// Allow 5 minutes for cron execution (Vercel Pro limit)
export const maxDuration = 300;

// AUDIT-054: Structured error type for cron error classification
interface CronError {
  org_id: string;
  code: 'LOCK_CONTENTION' | 'DB_ERROR' | 'SEND_FAILED' | 'UNKNOWN';
  message: string;
  retryable: boolean;
}

interface OrgResult {
  org: string;
  org_id: string;
  queued: number;
  rolled_over: number;
  errors: CronError[];
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
  // AUDIT-025: Execution metadata
  const executionId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const startTime = Date.now();

  try {
    // AUDIT-007: Timing-safe auth
    const authHeader = request.headers.get('authorization') || '';
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
    const isAuthorized =
      authHeader.length === expectedAuth.length &&
      timingSafeEqual(Buffer.from(authHeader), Buffer.from(expectedAuth));
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use admin client for service-role access
    const adminClient = createAdminClient();

    // Fetch all active organisations
    const { data: orgs, error: orgsError } = await adminClient
      .from('organisations')
      .select('id, name, slug, postmark_server_token, client_portal_enabled')
      .in('subscription_status', ['active', 'trialing']);

    if (orgsError) {
      throw new Error(`Failed to fetch organisations: ${orgsError.message}`);
    }

    if (!orgs || orgs.length === 0) {
      return NextResponse.json({
        execution_id: executionId,
        started_at: startedAt,
        ended_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        success: true,
        message: 'No active organisations found',
        results: [],
      });
    }

    // Process each org sequentially
    const allResults: OrgResult[] = [];
    let totalQueued = 0;
    let totalRolledOver = 0;
    const allErrors: CronError[] = [];
    let orgsFullyFailed = 0;
    const totalOrgs = orgs.length;

    for (const org of orgs) {
      // Skip orgs without a Postmark token — no point queuing reminders
      // they cannot send (consistent with send-emails cron behaviour)
      if (!org.postmark_server_token) {
        logger.warn('Skipping org — no Postmark token configured', { cron: 'reminders', orgName: org.name, orgSlug: org.slug });
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

      logger.info('Processing org', { cron: 'reminders', orgName: org.name, orgId: org.id });

      try {
        // Fetch all members of this org
        const { data: members } = await adminClient
          .from('user_organisations')
          .select('user_id')
          .eq('org_id', org.id);

        let orgQueued = 0;
        let orgRolledOver = 0;
        const orgErrors: CronError[] = [];
        // Start true — set to false if any user actually processes (i.e. isn't hour-skipped)
        let orgSkippedWrongHour = true;
        let usersProcessed = 0;

        // Process each org member independently with their own schedules and send hour
        for (const member of members ?? []) {
          try {
            const userResult = await processRemindersForUser(adminClient, org, member.user_id);
            orgQueued += userResult.queued;
            orgRolledOver += userResult.rolled_over;
            for (const errMsg of userResult.errors) {
              orgErrors.push({
                org_id: org.id,
                code: 'UNKNOWN',
                message: `[user:${member.user_id}] ${errMsg}`,
                retryable: true,
              });
            }
            if (!userResult.skipped_wrong_hour) orgSkippedWrongHour = false;
            usersProcessed++;
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Failed processing user', { cron: 'reminders', userId: member.user_id, orgName: org.name, error: message });
            orgErrors.push({
              org_id: org.id,
              code: 'UNKNOWN',
              message: `[user:${member.user_id}] ${message}`,
              retryable: true,
            });
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
        logger.error('Failed processing org', { cron: 'reminders', orgName: org.name, orgId: org.id, error: message });
        const cronErr: CronError = {
          org_id: org.id,
          code: 'DB_ERROR',
          message: `[${org.name}] ${message}`,
          retryable: true,
        };
        allResults.push({
          org: org.name,
          org_id: org.id,
          queued: 0,
          rolled_over: 0,
          errors: [cronErr],
          skipped_wrong_hour: false,
          error: message,
        });
        allErrors.push(cronErr);
        orgsFullyFailed++;
        // Continue to next org — don't let one failure stop others
      }
    }

    // AUDIT-005: Alert when ALL orgs fail
    if (orgsFullyFailed > 0 && orgsFullyFailed === totalOrgs) {
      try {
        const postmark = new (await import('postmark')).ServerClient(process.env.POSTMARK_SERVER_TOKEN!);
        await postmark.sendEmail({
          From: process.env.POSTMARK_SENDER_EMAIL || 'alerts@getprompt.app',
          To: process.env.ALERT_EMAIL || process.env.POSTMARK_SENDER_EMAIL || '',
          Subject: `[CRITICAL] Cron reminders — all orgs failed`,
          TextBody: `All ${totalOrgs} orgs failed processing.\n\nErrors:\n${allErrors.map(e => e.message).join('\n')}`,
        });
      } catch (alertError) {
        logger.error('Failed to send cron failure alert:', { error: (alertError as any)?.message ?? String(alertError) });
      }
    }

    return NextResponse.json({
      execution_id: executionId,
      started_at: startedAt,
      ended_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      success: true,
      orgs_processed: orgs.length,
      total_queued: totalQueued,
      total_rolled_over: totalRolledOver,
      errors: allErrors,
      results: allResults,
    });
  } catch (error) {
    logger.error('Cron job failed:', { error: (error as any)?.message ?? String(error) });
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Cron reminders job failed', { executionId, error: message });
    return NextResponse.json({
      execution_id: executionId,
      started_at: startedAt,
      ended_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      error: 'An internal error occurred',
    }, { status: 500 });
  }
}
