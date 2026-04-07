import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendRichEmailForOrg } from '@/lib/email/sender';
import { addMinutes } from 'date-fns';

// Force dynamic for cron
export const dynamic = 'force-dynamic';

// Allow 5 minutes for cron execution (Vercel Pro limit)
export const maxDuration = 300;

// AUDIT-054: Structured error type for cron error classification
interface CronError {
  org_id: string;
  code: 'LOCK_CONTENTION' | 'DB_ERROR' | 'SEND_FAILED' | 'UNKNOWN';
  message: string;
  retryable: boolean;
}

interface OrgSendResult {
  org: string;
  org_id: string;
  processed: number;
  sent: number;
  failed: number;
  errors: CronError[];
  error?: string;
}

/**
 * GET /api/cron/send-emails
 * Processes pending reminder_queue entries and sends HTML emails via Postmark
 * Iterates over organisations sequentially — one org's failure doesn't affect others
 * Each org uses its own Postmark token (falling back to env var)
 * Includes List-Unsubscribe headers for better deliverability
 * Runs at :10 past 8am and 9am UTC (10 minutes after reminders cron)
 * Validates CRON_SECRET header for security
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
      .select('id, name, slug, postmark_server_token, postmark_sender_domain')
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
    const allResults: OrgSendResult[] = [];
    let totalProcessed = 0;
    let totalSent = 0;
    let totalFailed = 0;
    const allErrors: CronError[] = [];
    let orgsFullyFailed = 0;
    const totalOrgs = orgs.length;

    for (const org of orgs) {
      // Skip orgs without Postmark token — no fallback to prevent cross-org email leakage
      if (!org.postmark_server_token) {
        console.warn(`[Cron:send-emails] Skipping org ${org.name} (${org.slug}) — no Postmark token configured`);
        allResults.push({
          org: org.name,
          org_id: org.id,
          processed: 0,
          sent: 0,
          failed: 0,
          errors: [{
            org_id: org.id,
            code: 'UNKNOWN',
            message: 'Skipped: no Postmark token configured',
            retryable: false,
          }],
        });
        continue;
      }

      console.log(`[Cron:send-emails] Processing org: ${org.name} (${org.id})`);

      try {
        const orgResult = await processOrgEmails(adminClient, org);
        allResults.push(orgResult);
        totalProcessed += orgResult.processed;
        totalSent += orgResult.sent;
        totalFailed += orgResult.failed;
        allErrors.push(...orgResult.errors);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Cron:send-emails] Failed processing org ${org.name} (${org.id}):`, error);
        const cronErr: CronError = {
          org_id: org.id,
          code: 'DB_ERROR',
          message: `[${org.name}] ${message}`,
          retryable: true,
        };
        allResults.push({
          org: org.name,
          org_id: org.id,
          processed: 0,
          sent: 0,
          failed: 0,
          errors: [cronErr],
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
          Subject: `[CRITICAL] Cron send-emails — all orgs failed`,
          TextBody: `All ${totalOrgs} orgs failed processing.\n\nErrors:\n${allErrors.map(e => e.message).join('\n')}`,
        });
      } catch (alertError) {
        console.error('Failed to send cron failure alert:', alertError);
      }
    }

    return NextResponse.json({
      execution_id: executionId,
      started_at: startedAt,
      ended_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      success: true,
      orgs_processed: orgs.length,
      total_processed: totalProcessed,
      total_sent: totalSent,
      total_failed: totalFailed,
      errors: allErrors,
      results: allResults,
    });
  } catch (error) {
    console.error('Cron job failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      execution_id: executionId,
      started_at: startedAt,
      ended_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      error: message,
    }, { status: 500 });
  }
}

/**
 * Process pending emails for a single organisation
 */
async function processOrgEmails(
  adminClient: ReturnType<typeof createAdminClient>,
  org: { id: string; name: string; slug: string; postmark_server_token: string | null; postmark_sender_domain: string | null }
): Promise<OrgSendResult> {
  const result: OrgSendResult = {
    org: org.name,
    org_id: org.id,
    processed: 0,
    sent: 0,
    failed: 0,
    errors: [],
  };

  // Acquire org-scoped lock
  const lockId = `cron_send_emails_${org.id}`;
  const expiresAt = addMinutes(new Date(), 5);

  try {
    // Clear any expired lock for this org before acquiring (handles crashed/timed-out runs)
    await adminClient
      .from('locks')
      .delete()
      .eq('id', lockId)
      .lt('expires_at', new Date().toISOString());

    const { error: lockError } = await adminClient
      .from('locks')
      .insert({ id: lockId, org_id: org.id, expires_at: expiresAt.toISOString() });

    if (lockError) {
      result.errors.push({
        org_id: org.id,
        code: 'LOCK_CONTENTION',
        message: `[${org.name}] Lock already held by another process`,
        retryable: true,
      });
      return result;
    }
  } catch {
    result.errors.push({
      org_id: org.id,
      code: 'LOCK_CONTENTION',
      message: `[${org.name}] Failed to acquire lock`,
      retryable: true,
    });
    return result;
  }

  try {
    // Query scheduled reminders for this org that have been resolved (have subject/body/html)
    const { data: dueReminders, error: queryError } = await adminClient
      .from('reminder_queue')
      .select('*, clients!inner(company_name, primary_email, owner_id)')
      .eq('org_id', org.id)
      .eq('status', 'scheduled')
      .not('resolved_subject', 'is', null)
      .not('resolved_body', 'is', null)
      .not('html_body', 'is', null);

    if (queryError) {
      throw new Error(`Failed to query due reminders: ${queryError.message}`);
    }

    if (!dueReminders || dueReminders.length === 0) {
      return result;
    }

    result.processed = dueReminders.length;

    // Process each reminder sequentially (avoid Postmark rate limits)
    for (const reminder of dueReminders) {
      const client = reminder.clients as { company_name: string; primary_email: string; owner_id: string };

      // Check if client has primary_email
      if (!client?.primary_email) {
        result.errors.push({
          org_id: org.id,
          code: 'UNKNOWN',
          message: `[${org.name}] No email address for client ${reminder.client_id}`,
          retryable: false,
        });

        // Mark as failed in queue
        await adminClient
          .from('reminder_queue')
          .update({ status: 'failed' })
          .eq('id', reminder.id);

        result.failed++;
        continue;
      }

      try {
        // Send HTML email via Postmark using org's credentials + per-user sender settings
        const sendResult = await sendRichEmailForOrg({
          to: client.primary_email,
          subject: reminder.resolved_subject!,
          html: reminder.html_body!,
          text: reminder.resolved_body!,
          clientId: reminder.client_id,
          orgPostmarkToken: org.postmark_server_token,
          supabase: adminClient,
          orgId: org.id,
          userId: client.owner_id,  // Per-user sender settings (name, reply-to)
        });

        // Update reminder_queue: status = sent, sent_at = now
        const { error: updateError } = await adminClient
          .from('reminder_queue')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
          })
          .eq('id', reminder.id);

        if (updateError) {
          throw new Error(`Failed to update reminder_queue: ${updateError.message}`);
        }

        // Insert email_log entry for successful send
        const { error: logError } = await adminClient
          .from('email_log')
          .insert({
            org_id: org.id,
            reminder_queue_id: reminder.id,
            client_id: reminder.client_id,
            filing_type_id: reminder.filing_type_id,
            postmark_message_id: sendResult.messageId,
            recipient_email: client.primary_email,
            subject: reminder.resolved_subject,
            delivery_status: 'sent',
          });

        if (logError) {
          console.error(`[${org.name}] Failed to insert email_log:`, logError);
          result.errors.push({
            org_id: org.id,
            code: 'DB_ERROR',
            message: `[${org.name}] Sent email to ${client.primary_email} but failed to log: ${logError.message}`,
            retryable: true,
          });
        }

        result.sent++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[${org.name}] Failed to send email for reminder ${reminder.id}:`, error);
        result.errors.push({
          org_id: org.id,
          code: 'SEND_FAILED',
          message: `[${org.name}] Failed to send to ${client.primary_email}: ${errorMessage}`,
          retryable: true,
        });

        const MAX_SEND_ATTEMPTS = 5;
        const newAttemptCount = (reminder.attempt_count ?? 0) + 1;
        const exhausted = newAttemptCount >= MAX_SEND_ATTEMPTS;

        // Increment attempt_count; mark failed if cap reached, otherwise keep scheduled for retry
        await adminClient
          .from('reminder_queue')
          .update({
            attempt_count: newAttemptCount,
            ...(exhausted ? { status: 'failed' } : {}),
          })
          .eq('id', reminder.id);

        if (exhausted) {
          console.warn(`[${org.name}] Reminder ${reminder.id} exceeded max send attempts — marking failed`);
        }

        // Insert email_log entry for failed send
        await adminClient
          .from('email_log')
          .insert({
            org_id: org.id,
            reminder_queue_id: reminder.id,
            client_id: reminder.client_id,
            filing_type_id: reminder.filing_type_id,
            recipient_email: client.primary_email,
            subject: reminder.resolved_subject,
            delivery_status: 'failed',
            bounce_description: exhausted
              ? `${errorMessage} (max attempts reached)`
              : errorMessage,
          });

        result.failed++;
        // Continue processing remaining entries (don't abort the batch)
      }
    }

    return result;
  } finally {
    // Release org-scoped lock
    await adminClient.from('locks').delete().eq('id', lockId);
  }
}
