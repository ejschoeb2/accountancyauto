import { SupabaseClient } from '@supabase/supabase-js';
import { UTCDate } from '@date-fns/utc';
import { toZonedTime } from 'date-fns-tz';
import { format, addMinutes } from 'date-fns';
import { buildReminderQueue } from './queue-builder';
import { substituteVariables } from '@/lib/templates/variables';
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
  vat_quarter: string | null;
}

interface FilingType {
  id: string;
  name: string;
}

/**
 * Process daily reminders
 * - Acquires distributed lock
 * - Checks if it's 9am UK time
 * - Builds/updates queue
 * - Marks due reminders as pending
 * - Resolves template variables
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
    // Step 2: Check if it's 9am UK time
    const ukTime = toZonedTime(new Date(), 'Europe/London');
    const ukHour = ukTime.getHours();

    if (ukHour !== 9) {
      result.skipped_wrong_hour = true;
      return result;
    }

    // Step 3: Build/update queue for any new reminders
    const buildResult = await buildReminderQueue(supabase);

    // Step 4: Find all reminder_queue entries where send_date = today and status = 'scheduled'
    const today = format(new UTCDate(), 'yyyy-MM-dd');
    const { data: dueReminders, error: fetchError } = await supabase
      .from('reminder_queue')
      .select('*, clients!inner(*), filing_types!inner(*)')
      .eq('send_date', today)
      .eq('status', 'scheduled');

    if (fetchError) {
      result.errors.push(`Failed to fetch due reminders: ${fetchError.message}`);
      return result;
    }

    if (!dueReminders || dueReminders.length === 0) {
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

    // Step 6: Resolve template variables for each pending reminder
    for (const reminder of dueReminders) {
      try {
        const client = reminder.clients as Client;
        const filingType = reminder.filing_types as FilingType;

        // Fetch the template to get subject and body
        const { data: template, error: templateError } = await supabase
          .from('reminder_templates')
          .select('*')
          .eq('id', reminder.template_id)
          .single();

        if (templateError || !template) {
          result.errors.push(`Failed to fetch template for reminder ${reminder.id}`);
          continue;
        }

        const step = template.steps[reminder.step_index];
        if (!step) {
          result.errors.push(`Step ${reminder.step_index} not found in template ${reminder.template_id}`);
          continue;
        }

        // Substitute variables
        const context = {
          client_name: client.company_name,
          deadline: new UTCDate(reminder.deadline_date),
          filing_type: filingType.name,
          accountant_name: 'Peninsula Accounting',
        };

        const resolvedSubject = substituteVariables(step.subject, context);
        const resolvedBody = substituteVariables(step.body, context);

        // Update the reminder with resolved content
        const { error: resolveError } = await supabase
          .from('reminder_queue')
          .update({
            resolved_subject: resolvedSubject,
            resolved_body: resolvedBody,
          })
          .eq('id', reminder.id);

        if (resolveError) {
          result.errors.push(`Failed to resolve variables for reminder ${reminder.id}: ${resolveError.message}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Error processing reminder ${reminder.id}: ${message}`);
      }
    }

    // Step 7: Check for rollover - find deadlines that have passed
    const { data: pastDeadlines, error: pastError } = await supabase
      .from('reminder_queue')
      .select('*, clients!inner(*)')
      .lt('deadline_date', today)
      .eq('status', 'sent')
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
            client.vat_quarter,
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
