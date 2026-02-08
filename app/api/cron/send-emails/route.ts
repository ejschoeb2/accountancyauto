import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendRichEmail } from '@/lib/email/sender';

// Force dynamic for cron
export const dynamic = 'force-dynamic';

// Allow 5 minutes for cron execution (Vercel Pro limit)
export const maxDuration = 300;

/**
 * GET /api/cron/send-emails (v1.1)
 * Processes pending reminder_queue entries and sends rich HTML emails via Postmark
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

    // Query pending reminders with resolved subject/body AND html_body
    const { data: pendingReminders, error: queryError } = await adminClient
      .from('reminder_queue')
      .select('*, clients!inner(company_name, primary_email)')
      .eq('status', 'pending')
      .not('resolved_subject', 'is', null)
      .not('resolved_body', 'is', null)
      .not('html_body', 'is', null); // v1.1: also check for html_body

    if (queryError) {
      throw new Error(`Failed to query pending reminders: ${queryError.message}`);
    }

    if (!pendingReminders || pendingReminders.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        sent: 0,
        failed: 0,
        errors: [],
      });
    }

    let sentCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    // Process each reminder sequentially (avoid Postmark rate limits)
    for (const reminder of pendingReminders) {
      const client = reminder.clients;

      // Check if client has primary_email
      if (!client?.primary_email) {
        errors.push(`No email address for client ${reminder.client_id}`);

        // Mark as failed in queue
        await adminClient
          .from('reminder_queue')
          .update({ status: 'failed' })
          .eq('id', reminder.id);

        failedCount++;
        continue;
      }

      try {
        // Send rich HTML email via Postmark (v1.1)
        const result = await sendRichEmail({
          to: client.primary_email,
          subject: reminder.resolved_subject!,
          html: reminder.html_body!,     // v1.1 rich HTML
          text: reminder.resolved_body!, // Plain text fallback
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
            reminder_queue_id: reminder.id,
            client_id: reminder.client_id,
            filing_type_id: reminder.filing_type_id,
            postmark_message_id: result.messageId,
            recipient_email: client.primary_email,
            subject: reminder.resolved_subject,
            delivery_status: 'sent',
          });

        if (logError) {
          console.error('Failed to insert email_log:', logError);
          errors.push(`Sent email to ${client.primary_email} but failed to log: ${logError.message}`);
        }

        sentCount++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Failed to send email for reminder ${reminder.id}:`, error);
        errors.push(`Failed to send to ${client.primary_email}: ${errorMessage}`);

        // Keep as pending for retry on next cron run (per user decision - no missed emails)
        await adminClient
          .from('reminder_queue')
          .update({ status: 'pending' })
          .eq('id', reminder.id);

        // Insert email_log entry for failed send
        await adminClient
          .from('email_log')
          .insert({
            reminder_queue_id: reminder.id,
            client_id: reminder.client_id,
            filing_type_id: reminder.filing_type_id,
            recipient_email: client.primary_email,
            subject: reminder.resolved_subject,
            delivery_status: 'failed',
            bounce_description: errorMessage,
          });

        failedCount++;
        // Continue processing remaining entries (don't abort the batch)
      }
    }

    return NextResponse.json({
      success: true,
      processed: pendingReminders.length,
      sent: sentCount,
      failed: failedCount,
      errors,
    });
  } catch (error) {
    console.error('Cron job failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
