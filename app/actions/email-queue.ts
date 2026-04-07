'use server';

/**
 * Error convention:
 * - Server actions throw on failure (Next.js catches via error boundaries)
 * - Return { success, message } for operations where the caller needs to display a specific message
 * - Never return { error } — either throw or return a success result
 */

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendRichEmailForOrg } from '@/lib/email/sender';
import { previewQueuedEmail } from '@/app/actions/audit-log';
import { logger } from '@/lib/logger';

// --- Shared helper ---

/**
 * Normalises the result of a reminder_queue status update into a consistent
 * { success, message, count } shape. Centralises the try/catch and error
 * logging pattern shared by cancelScheduling, pauseScheduling, and
 * uncancelScheduling.
 *
 * Each caller executes its own filtered Supabase query (because each needs a
 * different status guard: .neq / .in / .eq) and passes the awaited
 * { error, count } result here along with a success message factory.
 */
async function updateReminderQueueStatus(
  queryFn: () => Promise<{ error: { message: string } | null; count: number | null }>,
  successMessage: (count: number) => string
): Promise<{ success: boolean; message: string; count: number }> {
  try {
    const { error, count } = await queryFn();

    if (error) {
      logger.error('Error updating reminder queue status:', { error: (error as any)?.message ?? String(error) });
      throw error;
    }

    return { success: true, message: successMessage(count || 0), count: count || 0 };
  } catch (error) {
    logger.error('Error in updateReminderQueueStatus:', { error: (error as any)?.message ?? String(error) });
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      count: 0,
    };
  }
}

export interface CancelSchedulingParams {
  reminderIds: string[];
}

export interface CancelSchedulingResult {
  success: boolean;
  message: string;
  cancelledCount: number;
}

export async function cancelScheduling(params: CancelSchedulingParams): Promise<CancelSchedulingResult> {
  const supabase = await createClient();
  const { reminderIds } = params;

  if (reminderIds.length === 0) {
    return { success: false, message: 'No reminders selected', cancelledCount: 0 };
  }

  const result = await updateReminderQueueStatus(
    () => supabase
      .from('reminder_queue')
      .update({ status: 'cancelled' })
      .in('id', reminderIds)
      .neq('status', 'sent'), // Don't cancel already sent emails
    (count) => `Successfully cancelled ${count} scheduled email(s)`
  );

  return { success: result.success, message: result.message, cancelledCount: result.count };
}

export interface PauseSchedulingParams {
  reminderIds: string[];
}

export interface PauseSchedulingResult {
  success: boolean;
  message: string;
  pausedCount: number;
}

export async function pauseScheduling(params: PauseSchedulingParams): Promise<PauseSchedulingResult> {
  const supabase = await createClient();
  const { reminderIds } = params;

  if (reminderIds.length === 0) {
    return { success: false, message: 'No reminders selected', pausedCount: 0 };
  }

  const result = await updateReminderQueueStatus(
    () => supabase
      .from('reminder_queue')
      .update({ status: 'paused' })
      .in('id', reminderIds)
      .in('status', ['scheduled', 'rescheduled']), // Only pause active reminders
    (count) => `Successfully paused ${count} email(s)`
  );

  return { success: result.success, message: result.message, pausedCount: result.count };
}

export interface UncancelSchedulingParams {
  reminderIds: string[];
}

export interface UncancelSchedulingResult {
  success: boolean;
  message: string;
  uncancelledCount: number;
}

export async function uncancelScheduling(params: UncancelSchedulingParams): Promise<UncancelSchedulingResult> {
  const supabase = await createClient();
  const { reminderIds } = params;

  if (reminderIds.length === 0) {
    return { success: false, message: 'No reminders selected', uncancelledCount: 0 };
  }

  const result = await updateReminderQueueStatus(
    () => supabase
      .from('reminder_queue')
      .update({ status: 'scheduled' })
      .in('id', reminderIds)
      .eq('status', 'cancelled'), // Only uncancel cancelled emails
    (count) => `Successfully uncancelled ${count} email(s)`
  );

  return { success: result.success, message: result.message, uncancelledCount: result.count };
}

export interface RescheduleSpecificParams {
  reminderIds: string[];
  newDate: string; // ISO date string
}

export interface RescheduleOffsetParams {
  reminderIds: string[];
  offsetDays: number;
}

export interface RescheduleResult {
  success: boolean;
  message: string;
  rescheduledCount: number;
  errors?: string[];
}

export async function rescheduleToSpecificDate(params: RescheduleSpecificParams): Promise<RescheduleResult> {
  const supabase = await createClient();
  const { reminderIds, newDate } = params;

  if (reminderIds.length === 0) {
    return {
      success: false,
      message: 'No reminders selected',
      rescheduledCount: 0,
    };
  }

  try {
    const newDateTime = new Date(newDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Validate new date is in the future
    if (newDateTime < today) {
      return {
        success: false,
        message: 'New date must be in the future',
        rescheduledCount: 0,
      };
    }

    // Fetch the reminders to validate against deadline dates
    const { data: reminders, error: fetchError } = await supabase
      .from('reminder_queue')
      .select('id, client_id, deadline_date, send_date, status')
      .in('id', reminderIds)
      .neq('status', 'sent'); // Don't reschedule already sent emails

    if (fetchError) {
      logger.error('Error fetching reminders:', { error: (fetchError as any)?.message ?? String(fetchError) });
      throw fetchError;
    }

    if (!reminders || reminders.length === 0) {
      return {
        success: false,
        message: 'No eligible reminders found (may have already been sent)',
        rescheduledCount: 0,
      };
    }

    // Validate all reminders can be rescheduled to the new date
    const errors: string[] = [];
    for (const reminder of reminders) {
      const deadlineDate = new Date(reminder.deadline_date);
      if (newDateTime > deadlineDate) {
        errors.push(`Reminder for client cannot be scheduled after deadline (${reminder.deadline_date})`);
      }
    }

    if (errors.length > 0) {
      return {
        success: false,
        message: 'Some reminders cannot be rescheduled to this date',
        rescheduledCount: 0,
        errors,
      };
    }

    // Update all reminders to the new date
    const { error: updateError, count } = await supabase
      .from('reminder_queue')
      .update({
        send_date: newDate,
        status: 'rescheduled',
      })
      .in('id', reminderIds);

    if (updateError) {
      logger.error('Error updating reminders:', { error: (updateError as any)?.message ?? String(updateError) });
      throw updateError;
    }

    return {
      success: true,
      message: `Successfully rescheduled ${count || 0} email(s) to ${newDate}`,
      rescheduledCount: count || 0,
    };
  } catch (error) {
    logger.error('Error in rescheduleToSpecificDate:', { error: (error as any)?.message ?? String(error) });
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      rescheduledCount: 0,
    };
  }
}

export interface SendNowParams {
  reminderId: string;
}

export interface SendNowResult {
  success: boolean;
  message: string;
}

export async function sendNow(params: SendNowParams): Promise<SendNowResult> {
  const supabase = await createClient();
  const { reminderId } = params;

  if (!reminderId) {
    return { success: false, message: 'No reminder specified' };
  }

  try {
    // Fetch reminder with client info (RLS scopes to user's org)
    const { data: reminder, error: fetchError } = await supabase
      .from('reminder_queue')
      .select('*, clients!inner(company_name, primary_email, owner_id)')
      .eq('id', reminderId)
      .in('status', ['scheduled', 'rescheduled'])
      .single();

    if (fetchError || !reminder) {
      return { success: false, message: 'Reminder not found or not eligible for sending' };
    }

    const client = reminder.clients as { company_name: string; primary_email: string; owner_id: string };

    if (!client.primary_email) {
      return { success: false, message: 'Client has no email address' };
    }

    // Get org's Postmark token
    const { data: org } = await supabase
      .from('organisations')
      .select('id, postmark_server_token')
      .eq('id', reminder.org_id)
      .single();

    if (!org?.postmark_server_token) {
      return { success: false, message: 'No email configuration found for your organisation' };
    }

    // Get email content — use pre-resolved if available, otherwise generate on the fly
    let subject: string;
    let html: string;
    let text: string;

    if (reminder.html_body && reminder.resolved_subject && reminder.resolved_body) {
      subject = reminder.resolved_subject;
      html = reminder.html_body;
      text = reminder.resolved_body;
    } else {
      const preview = await previewQueuedEmail(reminderId);
      if ('error' in preview) {
        return { success: false, message: `Failed to resolve email content: ${preview.error}` };
      }
      subject = preview.subject;
      html = preview.html;
      text = preview.text;
    }

    // Send via org's Postmark (admin client needed for app_settings reads)
    const adminClient = createAdminClient();

    const sendResult = await sendRichEmailForOrg({
      to: client.primary_email,
      subject,
      html,
      text,
      clientId: reminder.client_id,
      orgPostmarkToken: org.postmark_server_token,
      supabase: adminClient,
      orgId: org.id,
      userId: client.owner_id,
    });

    // Update reminder status to sent
    await supabase
      .from('reminder_queue')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', reminderId);

    // Log to email_log
    await adminClient
      .from('email_log')
      .insert({
        org_id: org.id,
        reminder_queue_id: reminderId,
        client_id: reminder.client_id,
        filing_type_id: reminder.filing_type_id,
        postmark_message_id: sendResult.messageId,
        recipient_email: client.primary_email,
        subject,
        delivery_status: 'sent',
      });

    return { success: true, message: `Email sent to ${client.primary_email}` };
  } catch (error) {
    logger.error('Error in sendNow:', { error: (error as any)?.message ?? String(error) });
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to send email',
    };
  }
}

export async function rescheduleWithOffset(params: RescheduleOffsetParams): Promise<RescheduleResult> {
  const supabase = await createClient();
  const { reminderIds, offsetDays } = params;

  if (reminderIds.length === 0) {
    return {
      success: false,
      message: 'No reminders selected',
      rescheduledCount: 0,
    };
  }

  if (offsetDays === 0) {
    return {
      success: false,
      message: 'Offset must be non-zero',
      rescheduledCount: 0,
    };
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Fetch the reminders to calculate and validate new dates
    const { data: reminders, error: fetchError } = await supabase
      .from('reminder_queue')
      .select('id, client_id, deadline_date, send_date, status')
      .in('id', reminderIds)
      .neq('status', 'sent'); // Don't reschedule already sent emails

    if (fetchError) {
      logger.error('Error fetching reminders:', { error: (fetchError as any)?.message ?? String(fetchError) });
      throw fetchError;
    }

    if (!reminders || reminders.length === 0) {
      return {
        success: false,
        message: 'No eligible reminders found (may have already been sent)',
        rescheduledCount: 0,
      };
    }

    // Validate and calculate new dates for each reminder
    const errors: string[] = [];
    const updates: { id: string; newDate: string }[] = [];

    for (const reminder of reminders) {
      const currentDate = new Date(reminder.send_date);
      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() + offsetDays);

      // Validate new date is in the future
      if (newDate < today) {
        errors.push(`Offset would result in a past date for one or more reminders`);
        break;
      }

      // Validate new date is before deadline
      const deadlineDate = new Date(reminder.deadline_date);
      if (newDate > deadlineDate) {
        errors.push(`Offset would result in a date after deadline for one or more reminders`);
        break;
      }

      updates.push({
        id: reminder.id,
        newDate: newDate.toISOString().split('T')[0], // YYYY-MM-DD format
      });
    }

    if (errors.length > 0) {
      return {
        success: false,
        message: 'Some reminders cannot be rescheduled with this offset',
        rescheduledCount: 0,
        errors,
      };
    }

    // Update each reminder individually with its calculated new date
    let successCount = 0;
    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('reminder_queue')
        .update({
          send_date: update.newDate,
          status: 'rescheduled',
        })
        .eq('id', update.id);

      if (!updateError) {
        successCount++;
      }
    }

    return {
      success: true,
      message: `Successfully rescheduled ${successCount} email(s) with offset of ${offsetDays} day(s)`,
      rescheduledCount: successCount,
    };
  } catch (error) {
    logger.error('Error in rescheduleWithOffset:', { error: (error as any)?.message ?? String(error) });
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      rescheduledCount: 0,
    };
  }
}
