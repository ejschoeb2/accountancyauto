import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendRichEmailForOrg } from '@/lib/email/sender';
import { addMinutes } from 'date-fns';

// Force dynamic for cron
export const dynamic = 'force-dynamic';

// Allow 5 minutes for cron execution (Vercel Pro limit)
export const maxDuration = 300;

interface OrgSendResult {
  org: string;
  org_id: string;
  processed: number;
  sent: number;
  failed: number;
  errors: string[];
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
      .select('id, name, slug, postmark_server_token, postmark_sender_domain')
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
    const allResults: OrgSendResult[] = [];
    let totalProcessed = 0;
    let totalSent = 0;
    let totalFailed = 0;
    const allErrors: string[] = [];

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
          errors: [`Skipped: no Postmark token configured`],
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
        allResults.push({
          org: org.name,
          org_id: org.id,
          processed: 0,
          sent: 0,
          failed: 0,
          errors: [message],
          error: message,
        });
        allErrors.push(`[${org.name}] ${message}`);
        // Continue to next org — don't let one failure stop others
      }
    }

    return NextResponse.json({
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
    return NextResponse.json({ error: message }, { status: 500 });
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
    const { error: lockError } = await adminClient
      .from('locks')
      .insert({ id: lockId, org_id: org.id, expires_at: expiresAt.toISOString() });

    if (lockError) {
      result.errors.push(`[${org.name}] Lock already held by another process`);
      return result;
    }
  } catch {
    result.errors.push(`[${org.name}] Failed to acquire lock`);
    return result;
  }

  try {
    // Query pending reminders for this org with resolved subject/body and html_body
    const { data: pendingReminders, error: queryError } = await adminClient
      .from('reminder_queue')
      .select('*, clients!inner(company_name, primary_email)')
      .eq('org_id', org.id)
      .eq('status', 'pending')
      .not('resolved_subject', 'is', null)
      .not('resolved_body', 'is', null)
      .not('html_body', 'is', null);

    if (queryError) {
      throw new Error(`Failed to query pending reminders: ${queryError.message}`);
    }

    if (!pendingReminders || pendingReminders.length === 0) {
      return result;
    }

    result.processed = pendingReminders.length;

    // Process each reminder sequentially (avoid Postmark rate limits)
    for (const reminder of pendingReminders) {
      const client = reminder.clients;

      // Check if client has primary_email
      if (!client?.primary_email) {
        result.errors.push(`[${org.name}] No email address for client ${reminder.client_id}`);

        // Mark as failed in queue
        await adminClient
          .from('reminder_queue')
          .update({ status: 'failed' })
          .eq('id', reminder.id);

        result.failed++;
        continue;
      }

      try {
        // Send HTML email via Postmark using org's credentials
        const sendResult = await sendRichEmailForOrg({
          to: client.primary_email,
          subject: reminder.resolved_subject!,
          html: reminder.html_body!,
          text: reminder.resolved_body!,
          clientId: reminder.client_id,
          orgPostmarkToken: org.postmark_server_token,
          supabase: adminClient,
          orgId: org.id,
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
          result.errors.push(`[${org.name}] Sent email to ${client.primary_email} but failed to log: ${logError.message}`);
        }

        result.sent++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[${org.name}] Failed to send email for reminder ${reminder.id}:`, error);
        result.errors.push(`[${org.name}] Failed to send to ${client.primary_email}: ${errorMessage}`);

        // Keep as pending for retry on next cron run (per user decision - no missed emails)
        await adminClient
          .from('reminder_queue')
          .update({ status: 'pending' })
          .eq('id', reminder.id);

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
            bounce_description: errorMessage,
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
