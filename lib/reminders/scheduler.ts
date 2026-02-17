import { SupabaseClient } from '@supabase/supabase-js';
import { UTCDate } from '@date-fns/utc';
import { toZonedTime } from 'date-fns-tz';
import { format, addMinutes } from 'date-fns';
import { buildReminderQueue, buildCustomScheduleQueue } from './queue-builder';
import { renderTipTapEmail } from '@/lib/email/render-tiptap';
import { rolloverDeadline } from '@/lib/deadlines/rollover';

export interface ProcessResult {
  queued: number;
  rolled_over: number;
  errors: string[];
  skipped_wrong_hour: boolean;
}

interface Client {
  id: string;
  company_name: string;
  year_end_date: string | null;
  vat_stagger_group: number | null;
}

interface FilingType {
  id: string;
  name: string;
}

/**
 * Process daily reminders (v1.1)
 * - Acquires distributed lock
 * - Checks if it's 9am UK time
 * - Builds/updates queue
 * - Marks due reminders as pending
 * - Resolves template variables using v1.1 TipTap rendering
 * - Handles deadline rollover
 */
export async function processReminders(supabase: SupabaseClient): Promise<ProcessResult> {
  const result: ProcessResult = {
    queued: 0,
    rolled_over: 0,
    errors: [],
    skipped_wrong_hour: false,
  };

  // Step 1: Acquire distributed lock
  const lockId = 'cron_reminders';
  const expiresAt = addMinutes(new Date(), 5);

  try {
    const { error: lockError } = await supabase
      .from('locks')
      .insert({ id: lockId, expires_at: expiresAt.toISOString() });

    if (lockError) {
      // Lock already held
      result.errors.push('Lock already held by another process');
      return result;
    }
  } catch (error) {
    result.errors.push('Failed to acquire lock');
    return result;
  }

  try {
    // Step 2: Get current UK hour and global send hour
    const ukTime = toZonedTime(new Date(), 'Europe/London');
    const ukHour = ukTime.getHours();

    const { data: sendHourRow } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'reminder_send_hour')
      .single();
    const globalSendHour = sendHourRow ? parseInt(sendHourRow.value, 10) : 9;

    // Check if any custom schedules have a send_hour matching the current hour
    const { data: customHourSchedules } = await supabase
      .from('schedules')
      .select('id')
      .eq('schedule_type', 'custom')
      .eq('is_active', true)
      .eq('send_hour', ukHour);

    const hasCustomHourMatch = customHourSchedules && customHourSchedules.length > 0;
    const isGlobalHour = ukHour === globalSendHour;

    // Skip early only if neither the global hour matches nor any custom schedules match
    if (!isGlobalHour && !hasCustomHourMatch) {
      result.skipped_wrong_hour = true;
      return result;
    }

    // Step 3: Build/update queue for any new reminders (filing + custom) — idempotent
    const buildResult = await buildReminderQueue(supabase);
    const customBuildResult = await buildCustomScheduleQueue(supabase);

    // Step 4: Find due reminders, split by hour matching
    const today = format(new UTCDate(), 'yyyy-MM-dd');

    // Fetch all due reminders for today
    const { data: allDueReminders, error: fetchError } = await supabase
      .from('reminder_queue')
      .select('*, clients!inner(*), filing_types(*)')
      .eq('send_date', today)
      .eq('status', 'scheduled');

    if (fetchError) {
      result.errors.push(`Failed to fetch due reminders: ${fetchError.message}`);
      return result;
    }

    if (!allDueReminders || allDueReminders.length === 0) {
      return result;
    }

    // Build set of custom schedule IDs that match the current hour
    const customHourScheduleIds = new Set(
      (customHourSchedules || []).map(s => s.id)
    );

    // Filter reminders based on hour matching:
    // - Filing reminders (filing_type_id IS NOT NULL): only at global hour
    // - Custom reminders with specific send_hour: only at their schedule's hour
    // - Custom reminders with NULL send_hour: only at global hour
    const dueReminders = allDueReminders.filter((reminder) => {
      if (reminder.filing_type_id) {
        // Filing reminder — uses global hour
        return isGlobalHour;
      } else if (reminder.template_id && customHourScheduleIds.has(reminder.template_id)) {
        // Custom reminder with a specific send_hour matching current hour
        return true;
      } else {
        // Custom reminder with NULL send_hour — uses global hour
        return isGlobalHour;
      }
    });

    if (dueReminders.length === 0) {
      return result;
    }

    // Step 5: Update their status to 'pending' and set queued_at
    const reminderIds = dueReminders.map((r) => r.id);
    const { error: updateError } = await supabase
      .from('reminder_queue')
      .update({
        status: 'pending',
        queued_at: new Date().toISOString(),
      })
      .in('id', reminderIds);

    if (updateError) {
      result.errors.push(`Failed to update reminder status: ${updateError.message}`);
      return result;
    }

    result.queued = dueReminders.length;

    // Step 6: Resolve template variables for each pending reminder using v1.1 TipTap rendering
    for (const reminder of dueReminders) {
      try {
        const client = reminder.clients as Client;
        const filingType = reminder.filing_types as FilingType | null;

        // Fetch the schedule for this reminder
        let schedule;
        if (reminder.filing_type_id) {
          // Filing schedule - lookup by filing_type_id
          const { data, error: scheduleError } = await supabase
            .from('schedules')
            .select('*')
            .eq('filing_type_id', reminder.filing_type_id)
            .eq('is_active', true)
            .single();

          if (scheduleError || !data) {
            result.errors.push(`Failed to fetch schedule for reminder ${reminder.id}: ${scheduleError?.message || 'No schedule found'}`);
            continue;
          }
          schedule = data;
        } else {
          // Custom schedule - lookup by template_id (which stores schedule.id)
          const { data, error: scheduleError } = await supabase
            .from('schedules')
            .select('*')
            .eq('id', reminder.template_id)
            .eq('is_active', true)
            .single();

          if (scheduleError || !data) {
            result.errors.push(`Failed to fetch custom schedule for reminder ${reminder.id}: ${scheduleError?.message || 'No schedule found'}`);
            continue;
          }
          schedule = data;
        }

        // Fetch schedule_steps for that schedule
        const { data: steps, error: stepsError } = await supabase
          .from('schedule_steps')
          .select('*')
          .eq('schedule_id', schedule.id)
          .order('step_number', { ascending: true });

        if (stepsError || !steps) {
          result.errors.push(`Failed to fetch schedule steps for reminder ${reminder.id}: ${stepsError?.message || 'No steps found'}`);
          continue;
        }

        // Find the step matching reminder.step_index
        const step = steps.find((s) => s.step_number === reminder.step_index);
        if (!step) {
          result.errors.push(`Step ${reminder.step_index} not found in schedule ${schedule.id} for reminder ${reminder.id}`);
          continue;
        }

        // Fetch the email template for that step
        const { data: template, error: templateError } = await supabase
          .from('email_templates')
          .select('*')
          .eq('id', step.email_template_id)
          .single();

        if (templateError || !template) {
          result.errors.push(`Failed to fetch template for reminder ${reminder.id}: ${templateError?.message || 'No template found'}`);
          continue;
        }

        // Render email using v1.1 TipTap pipeline
        // For custom schedules, use the schedule name as the filing_type placeholder
        const filingTypeName = filingType?.name ?? schedule.name;

        try {
          const rendered = await renderTipTapEmail({
            bodyJson: template.body_json,
            subject: template.subject,
            context: {
              client_name: client.company_name,
              deadline: new UTCDate(reminder.deadline_date),
              filing_type: filingTypeName,
              accountant_name: 'PhaseTwo',
            },
            clientId: client.id,
          });

          // Update reminder_queue with rendered content
          const { error: resolveError } = await supabase
            .from('reminder_queue')
            .update({
              resolved_subject: rendered.subject,
              resolved_body: rendered.text, // Plain text fallback
              html_body: rendered.html,     // Rich HTML from v1.1 pipeline
            })
            .eq('id', reminder.id);

          if (resolveError) {
            result.errors.push(`Failed to update resolved content for reminder ${reminder.id}: ${resolveError.message}`);
          }
        } catch (renderError) {
          const message = renderError instanceof Error ? renderError.message : 'Unknown rendering error';
          result.errors.push(`Failed to render template for reminder ${reminder.id}: ${message}`);

          // Log rendering failure to email_log
          await supabase.from('email_log').insert({
            client_id: reminder.client_id,
            filing_type_id: reminder.filing_type_id,
            delivery_status: 'failed',
            bounce_description: `[RENDER] ${message}`,
            subject: 'Template Rendering Failed',
            sent_at: new Date().toISOString(),
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Error processing reminder ${reminder.id}: ${message}`);
      }
    }

    // Step 7: Check for rollover - find deadlines that have passed
    // Only for filing type reminders (not custom schedules)
    const { data: pastDeadlines, error: pastError } = await supabase
      .from('reminder_queue')
      .select('*, clients!inner(*)')
      .lt('deadline_date', today)
      .eq('status', 'sent')
      .not('filing_type_id', 'is', null)
      .order('deadline_date', { ascending: false });

    if (pastError) {
      result.errors.push(`Failed to fetch past deadlines: ${pastError.message}`);
    } else if (pastDeadlines && pastDeadlines.length > 0) {
      // Group by client + filing type to get the most recent deadline for each
      const deadlineMap = new Map<string, typeof pastDeadlines[0]>();
      for (const deadline of pastDeadlines) {
        const key = `${deadline.client_id}_${deadline.filing_type_id}`;
        if (!deadlineMap.has(key)) {
          deadlineMap.set(key, deadline);
        }
      }

      // Rollover each unique client + filing type
      for (const [key, deadline] of deadlineMap) {
        try {
          const client = deadline.clients as Client;

          const nextDeadline = rolloverDeadline(
            deadline.filing_type_id,
            client.year_end_date ? new Date(client.year_end_date) : null,
            client.vat_stagger_group,
            new Date(deadline.deadline_date)
          );

          // Update client's year_end_date if applicable (for annual filings)
          if (client.year_end_date && ['corporation_tax_payment', 'ct600_filing', 'companies_house'].includes(deadline.filing_type_id)) {
            // For annual filings, advance the year_end_date by 1 year
            const nextYearEnd = new UTCDate(client.year_end_date);
            nextYearEnd.setUTCFullYear(nextYearEnd.getUTCFullYear() + 1);

            const { error: updateClientError } = await supabase
              .from('clients')
              .update({ year_end_date: format(nextYearEnd, 'yyyy-MM-dd') })
              .eq('id', client.id);

            if (updateClientError) {
              result.errors.push(`Failed to update client year_end_date: ${updateClientError.message}`);
            }
          }

          result.rolled_over++;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(`Failed to rollover deadline for ${key}: ${message}`);
        }
      }
    }

    return result;
  } finally {
    // Step 8: Release lock
    await supabase.from('locks').delete().eq('id', lockId);
  }
}
