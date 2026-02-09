import { SupabaseClient } from '@supabase/supabase-js';
import { UTCDate } from '@date-fns/utc';
import { subDays, format, addMonths, addYears } from 'date-fns';
import { FilingTypeId, ClientFilingAssignment, ClientDeadlineOverride, Schedule, ScheduleStep, EmailTemplate } from '@/lib/types/database';
import { calculateDeadline } from '@/lib/deadlines/calculators';
import { getNextWorkingDay } from '@/lib/deadlines/working-days';
import { getUKBankHolidaySet } from '@/lib/bank-holidays/cache';

interface Client {
  id: string;
  company_name: string;
  year_end_date: string | null;
  vat_stagger_group: number | null;
  reminders_paused: boolean;
  records_received_for: string[];
}

export interface BuildResult {
  created: number;
  skipped: number;
}

/**
 * Log warnings/errors to email_log for visibility
 */
async function logQueueWarning(supabase: SupabaseClient, entry: {
  message: string;
  client_id?: string;
  filing_type_id?: string;
}): Promise<void> {
  await supabase.from('email_log').insert({
    client_id: entry.client_id || null,
    filing_type_id: entry.filing_type_id || null,
    delivery_status: 'failed',
    bounce_description: `[QUEUE] ${entry.message}`,
    subject: 'Queue Builder Warning',
    sent_at: new Date().toISOString(),
  });
}

/**
 * Calculate the next occurrence date for a custom schedule
 */
function getNextCustomDate(schedule: {
  custom_date: string | null;
  recurrence_rule: string | null;
  recurrence_anchor: string | null;
}): Date | null {
  if (schedule.custom_date) {
    return new UTCDate(schedule.custom_date);
  }
  if (!schedule.recurrence_rule || !schedule.recurrence_anchor) return null;

  const anchor = new UTCDate(schedule.recurrence_anchor);
  const today = new UTCDate();

  // Find the next occurrence of the anchor date based on recurrence rule
  let next = anchor;
  while (next <= today) {
    switch (schedule.recurrence_rule) {
      case 'monthly': next = addMonths(next, 1); break;
      case 'quarterly': next = addMonths(next, 3); break;
      case 'annually': next = addYears(next, 1); break;
    }
  }
  return next;
}

/**
 * Build reminder queue from schedules, filing assignments, and deadlines (v1.1)
 * Idempotent: won't create duplicates if queue already populated
 */
export async function buildReminderQueue(supabase: SupabaseClient): Promise<BuildResult> {
  let created = 0;
  let skipped = 0;

  // Fetch all clients with active filing assignments
  const { data: assignments, error: assignmentsError } = await supabase
    .from('client_filing_assignments')
    .select('*, clients!inner(*)')
    .eq('is_active', true);

  if (assignmentsError) {
    throw new Error(`Failed to fetch filing assignments: ${assignmentsError.message}`);
  }

  if (!assignments || assignments.length === 0) {
    return { created: 0, skipped: 0 };
  }

  // Fetch v1.1 normalized tables (PostgREST FK workaround: fetch separately and map in app)
  const { data: schedules, error: schedulesError } = await supabase
    .from('schedules')
    .select('*')
    .eq('is_active', true)
    .eq('schedule_type', 'filing');

  if (schedulesError) {
    throw new Error(`Failed to fetch schedules: ${schedulesError.message}`);
  }

  const { data: scheduleSteps, error: stepsError } = await supabase
    .from('schedule_steps')
    .select('*')
    .order('step_number', { ascending: true });

  if (stepsError) {
    throw new Error(`Failed to fetch schedule steps: ${stepsError.message}`);
  }

  const { data: emailTemplates, error: templatesError } = await supabase
    .from('email_templates')
    .select('*')
    .eq('is_active', true);

  if (templatesError) {
    throw new Error(`Failed to fetch email templates: ${templatesError.message}`);
  }

  if (!schedules || schedules.length === 0) {
    return { created: 0, skipped: 0 };
  }

  // Build application-level lookup maps
  const scheduleByFilingType = new Map<string, Schedule>();
  schedules.forEach((schedule) => {
    if (schedule.filing_type_id) {
      scheduleByFilingType.set(schedule.filing_type_id, schedule as Schedule);
    }
  });

  const stepsBySchedule = new Map<string, ScheduleStep[]>();
  (scheduleSteps || []).forEach((step) => {
    if (!stepsBySchedule.has(step.schedule_id)) {
      stepsBySchedule.set(step.schedule_id, []);
    }
    stepsBySchedule.get(step.schedule_id)!.push(step);
  });

  const templateMap = new Map<string, EmailTemplate>();
  (emailTemplates || []).forEach((template) => {
    templateMap.set(template.id, template);
  });

  // Fetch deadline overrides (these remain relevant - not template overrides)
  const { data: deadlineOverrides, error: deadlineError } = await supabase
    .from('client_deadline_overrides')
    .select('*');

  if (deadlineError) {
    throw new Error(`Failed to fetch deadline overrides: ${deadlineError.message}`);
  }

  const holidays = await getUKBankHolidaySet();

  const deadlineOverrideMap = new Map<string, Map<string, ClientDeadlineOverride>>();
  (deadlineOverrides || []).forEach((override) => {
    if (!deadlineOverrideMap.has(override.client_id)) {
      deadlineOverrideMap.set(override.client_id, new Map());
    }
    deadlineOverrideMap.get(override.client_id)!.set(override.filing_type_id, override);
  });

  // Process each client + filing type pair
  for (const assignment of assignments) {
    const client = assignment.clients as Client;
    const filingTypeId = assignment.filing_type_id;

    // Skip if client has reminders paused
    if (client.reminders_paused) {
      skipped++;
      continue;
    }

    // Skip if filing type is in records_received_for array
    if (client.records_received_for && client.records_received_for.includes(filingTypeId)) {
      skipped++;
      continue;
    }

    // Calculate or get override deadline
    let deadlineDate: Date | null = null;
    const deadlineOverride = deadlineOverrideMap.get(client.id)?.get(filingTypeId);

    if (deadlineOverride) {
      deadlineDate = new UTCDate(deadlineOverride.override_date);
    } else {
      // Calculate deadline
      deadlineDate = calculateDeadline(filingTypeId, {
        year_end_date: client.year_end_date ?? undefined,
        vat_stagger_group: client.vat_stagger_group ?? undefined,
      });
    }

    if (!deadlineDate) {
      // Can't calculate deadline (missing metadata)
      skipped++;
      continue;
    }

    // Look up schedule by filing type
    const schedule = scheduleByFilingType.get(filingTypeId);
    if (!schedule) {
      // Log warning to email_log and skip
      await logQueueWarning(supabase, {
        message: `No schedule found for filing type ${filingTypeId}`,
        client_id: client.id,
        filing_type_id: filingTypeId,
      });
      skipped++;
      continue;
    }

    // Get steps for this schedule
    const steps = stepsBySchedule.get(schedule.id) || [];
    if (steps.length === 0) {
      await logQueueWarning(supabase, {
        message: `Schedule ${schedule.id} has no steps`,
        client_id: client.id,
        filing_type_id: filingTypeId,
      });
      skipped++;
      continue;
    }

    // Create queue entries for each step
    for (const step of steps) {
      // Look up template for this step
      const template = templateMap.get(step.email_template_id);
      if (!template) {
        // Log warning and skip this step (continue with remaining steps)
        await logQueueWarning(supabase, {
          message: `Template ${step.email_template_id} not found for schedule ${schedule.id} step ${step.step_number}`,
          client_id: client.id,
          filing_type_id: filingTypeId,
        });
        skipped++;
        continue;
      }

      // Calculate send_date = deadline_date - delay_days
      let sendDate = subDays(new UTCDate(deadlineDate), step.delay_days);

      // Adjust send_date to next working day if on weekend/bank holiday
      sendDate = new UTCDate(getNextWorkingDay(sendDate, holidays));

      const sendDateStr = format(sendDate, 'yyyy-MM-dd');
      const deadlineDateStr = format(deadlineDate, 'yyyy-MM-dd');

      // Check if this exact reminder already exists (idempotent)
      // Idempotency check: client_id + filing_type_id + step_number + deadline_date
      const { data: existing, error: existingError } = await supabase
        .from('reminder_queue')
        .select('id')
        .eq('client_id', client.id)
        .eq('filing_type_id', filingTypeId)
        .eq('step_index', step.step_number)
        .eq('deadline_date', deadlineDateStr)
        .single();

      if (existing) {
        // Already exists, skip
        skipped++;
        continue;
      }

      // Insert into reminder_queue
      const { error: insertError } = await supabase
        .from('reminder_queue')
        .insert({
          client_id: client.id,
          filing_type_id: filingTypeId,
          template_id: schedule.id, // Points to schedule (not old reminder_templates)
          step_index: step.step_number, // Use step_number from schedule_steps
          deadline_date: deadlineDateStr,
          send_date: sendDateStr,
          status: 'scheduled',
        });

      if (insertError) {
        // Log error but continue processing
        console.error(`Failed to insert reminder for client ${client.id}, filing ${filingTypeId}, step ${step.step_number}:`, insertError);
        skipped++;
      } else {
        created++;
      }
    }
  }

  return { created, skipped };
}

/**
 * Build reminder queue entries for custom schedules (v1.1+)
 * Custom schedules apply to ALL active, non-paused clients
 */
export async function buildCustomScheduleQueue(supabase: SupabaseClient): Promise<BuildResult> {
  let created = 0;
  let skipped = 0;

  // 1. Fetch all active custom schedules
  const { data: customSchedules, error: schedulesError } = await supabase
    .from('schedules')
    .select('*')
    .eq('is_active', true)
    .eq('schedule_type', 'custom');

  if (schedulesError) {
    throw new Error(`Failed to fetch custom schedules: ${schedulesError.message}`);
  }

  if (!customSchedules || customSchedules.length === 0) {
    return { created: 0, skipped: 0 };
  }

  // 2. Fetch all active, non-paused clients
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('*')
    .eq('reminders_paused', false);

  if (clientsError) {
    throw new Error(`Failed to fetch clients: ${clientsError.message}`);
  }

  if (!clients || clients.length === 0) {
    return { created: 0, skipped: 0 };
  }

  // 3. Fetch schedule steps
  const scheduleIds = customSchedules.map(s => s.id);
  const { data: scheduleSteps, error: stepsError } = await supabase
    .from('schedule_steps')
    .select('*')
    .in('schedule_id', scheduleIds)
    .order('step_number', { ascending: true });

  if (stepsError) {
    throw new Error(`Failed to fetch custom schedule steps: ${stepsError.message}`);
  }

  const stepsBySchedule = new Map<string, ScheduleStep[]>();
  (scheduleSteps || []).forEach((step) => {
    if (!stepsBySchedule.has(step.schedule_id)) {
      stepsBySchedule.set(step.schedule_id, []);
    }
    stepsBySchedule.get(step.schedule_id)!.push(step);
  });

  const holidays = await getUKBankHolidaySet();

  // 4. Process each custom schedule x client
  for (const schedule of customSchedules) {
    const targetDate = getNextCustomDate({
      custom_date: schedule.custom_date,
      recurrence_rule: schedule.recurrence_rule,
      recurrence_anchor: schedule.recurrence_anchor,
    });

    if (!targetDate) {
      await logQueueWarning(supabase, {
        message: `Custom schedule ${schedule.id} (${schedule.name}) has no valid target date`,
      });
      skipped++;
      continue;
    }

    const steps = stepsBySchedule.get(schedule.id) || [];
    if (steps.length === 0) {
      await logQueueWarning(supabase, {
        message: `Custom schedule ${schedule.id} (${schedule.name}) has no steps`,
      });
      skipped++;
      continue;
    }

    const deadlineDateStr = format(targetDate, 'yyyy-MM-dd');

    for (const client of clients) {
      for (const step of steps) {
        let sendDate = subDays(new UTCDate(targetDate), step.delay_days);
        sendDate = new UTCDate(getNextWorkingDay(sendDate, holidays));
        const sendDateStr = format(sendDate, 'yyyy-MM-dd');

        // Idempotency check for custom schedules: client_id + template_id + step_index + deadline_date
        // (template_id stores schedule.id for custom schedules, filing_type_id is NULL)
        const { data: existing } = await supabase
          .from('reminder_queue')
          .select('id')
          .eq('client_id', client.id)
          .is('filing_type_id', null)
          .eq('template_id', schedule.id)
          .eq('step_index', step.step_number)
          .eq('deadline_date', deadlineDateStr)
          .single();

        if (existing) {
          skipped++;
          continue;
        }

        const { error: insertError } = await supabase
          .from('reminder_queue')
          .insert({
            client_id: client.id,
            filing_type_id: null,
            template_id: schedule.id,
            step_index: step.step_number,
            deadline_date: deadlineDateStr,
            send_date: sendDateStr,
            status: 'scheduled',
          });

        if (insertError) {
          console.error(`Failed to insert custom reminder for client ${client.id}, schedule ${schedule.id}, step ${step.step_number}:`, insertError);
          skipped++;
        } else {
          created++;
        }
      }
    }
  }

  return { created, skipped };
}

/**
 * Rebuild queue entries for a specific client (v1.1)
 * Used when client metadata, assignments, or overrides change
 */
export async function rebuildQueueForClient(
  supabase: SupabaseClient,
  clientId: string
): Promise<void> {
  // Delete all 'scheduled' reminders for this client
  // Don't touch 'pending', 'sent', 'cancelled'
  const { error: deleteError } = await supabase
    .from('reminder_queue')
    .delete()
    .eq('client_id', clientId)
    .eq('status', 'scheduled');

  if (deleteError) {
    throw new Error(`Failed to delete scheduled reminders: ${deleteError.message}`);
  }

  // Rebuild queue entries for this client (same logic as buildReminderQueue but filtered)
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single();

  if (clientError || !client) {
    throw new Error(`Failed to fetch client: ${clientError?.message}`);
  }

  // Fetch active assignments for this client
  const { data: assignments, error: assignmentsError } = await supabase
    .from('client_filing_assignments')
    .select('*')
    .eq('client_id', clientId)
    .eq('is_active', true);

  if (assignmentsError) {
    throw new Error(`Failed to fetch assignments: ${assignmentsError.message}`);
  }

  if (!assignments || assignments.length === 0) {
    return;
  }

  // Fetch v1.1 normalized tables
  const { data: schedules, error: schedulesError } = await supabase
    .from('schedules')
    .select('*')
    .eq('is_active', true);

  if (schedulesError) {
    throw new Error(`Failed to fetch schedules: ${schedulesError.message}`);
  }

  const { data: scheduleSteps, error: stepsError } = await supabase
    .from('schedule_steps')
    .select('*')
    .order('step_number', { ascending: true });

  if (stepsError) {
    throw new Error(`Failed to fetch schedule steps: ${stepsError.message}`);
  }

  const { data: emailTemplates, error: templatesError } = await supabase
    .from('email_templates')
    .select('*')
    .eq('is_active', true);

  if (templatesError) {
    throw new Error(`Failed to fetch email templates: ${templatesError.message}`);
  }

  // Build lookup maps
  const scheduleByFilingType = new Map<string, Schedule>();
  (schedules || []).forEach((schedule) => {
    if (schedule.filing_type_id) {
      scheduleByFilingType.set(schedule.filing_type_id, schedule as Schedule);
    }
  });

  const stepsByScheduleMap = new Map<string, ScheduleStep[]>();
  (scheduleSteps || []).forEach((step) => {
    if (!stepsByScheduleMap.has(step.schedule_id)) {
      stepsByScheduleMap.set(step.schedule_id, []);
    }
    stepsByScheduleMap.get(step.schedule_id)!.push(step);
  });

  const templateMap = new Map<string, EmailTemplate>();
  (emailTemplates || []).forEach((template) => {
    templateMap.set(template.id, template);
  });

  const { data: deadlineOverrides, error: deadlineError } = await supabase
    .from('client_deadline_overrides')
    .select('*')
    .eq('client_id', clientId);

  if (deadlineError) {
    throw new Error(`Failed to fetch deadline overrides: ${deadlineError.message}`);
  }

  const holidays = await getUKBankHolidaySet();

  // Build overrides maps
  const deadlineOverrideMap = new Map<string, ClientDeadlineOverride>();
  (deadlineOverrides || []).forEach((override) => {
    deadlineOverrideMap.set(override.filing_type_id, override);
  });

  // Process each assignment (filing schedules)
  for (const assignment of assignments) {
    const filingTypeId = assignment.filing_type_id;

    // Skip if client has reminders paused
    if (client.reminders_paused) {
      continue;
    }

    // Skip if filing type is in records_received_for array
    if (client.records_received_for && client.records_received_for.includes(filingTypeId)) {
      continue;
    }

    // Calculate or get override deadline
    let deadlineDate: Date | null = null;
    const deadlineOverride = deadlineOverrideMap.get(filingTypeId);

    if (deadlineOverride) {
      deadlineDate = new UTCDate(deadlineOverride.override_date);
    } else {
      deadlineDate = calculateDeadline(filingTypeId, {
        year_end_date: client.year_end_date ?? undefined,
        vat_stagger_group: client.vat_stagger_group ?? undefined,
      });
    }

    if (!deadlineDate) {
      continue;
    }

    // Look up schedule
    const schedule = scheduleByFilingType.get(filingTypeId);
    if (!schedule) {
      await logQueueWarning(supabase, {
        message: `No schedule found for filing type ${filingTypeId}`,
        client_id: clientId,
        filing_type_id: filingTypeId,
      });
      continue;
    }

    const steps = stepsByScheduleMap.get(schedule.id) || [];
    if (steps.length === 0) {
      await logQueueWarning(supabase, {
        message: `Schedule ${schedule.id} has no steps`,
        client_id: clientId,
        filing_type_id: filingTypeId,
      });
      continue;
    }

    // Create queue entries
    for (const step of steps) {
      const template = templateMap.get(step.email_template_id);
      if (!template) {
        await logQueueWarning(supabase, {
          message: `Template ${step.email_template_id} not found for schedule ${schedule.id} step ${step.step_number}`,
          client_id: clientId,
          filing_type_id: filingTypeId,
        });
        continue;
      }

      let sendDate = subDays(new UTCDate(deadlineDate), step.delay_days);
      sendDate = new UTCDate(getNextWorkingDay(sendDate, holidays));

      const sendDateStr = format(sendDate, 'yyyy-MM-dd');
      const deadlineDateStr = format(deadlineDate, 'yyyy-MM-dd');

      await supabase.from('reminder_queue').insert({
        client_id: client.id,
        filing_type_id: filingTypeId,
        template_id: schedule.id,
        step_index: step.step_number,
        deadline_date: deadlineDateStr,
        send_date: sendDateStr,
        status: 'scheduled',
      });
    }
  }

  // Also rebuild custom schedule entries for this client
  if (!client.reminders_paused) {
    const customSchedules = (schedules || []).filter(
      (s) => s.schedule_type === 'custom'
    );

    for (const schedule of customSchedules) {
      const targetDate = getNextCustomDate({
        custom_date: schedule.custom_date,
        recurrence_rule: schedule.recurrence_rule,
        recurrence_anchor: schedule.recurrence_anchor,
      });

      if (!targetDate) continue;

      const steps = stepsByScheduleMap.get(schedule.id) || [];
      if (steps.length === 0) continue;

      const deadlineDateStr = format(targetDate, 'yyyy-MM-dd');

      for (const step of steps) {
        let sendDate = subDays(new UTCDate(targetDate), step.delay_days);
        sendDate = new UTCDate(getNextWorkingDay(sendDate, holidays));
        const sendDateStr = format(sendDate, 'yyyy-MM-dd');

        await supabase.from('reminder_queue').insert({
          client_id: client.id,
          filing_type_id: null,
          template_id: schedule.id,
          step_index: step.step_number,
          deadline_date: deadlineDateStr,
          send_date: sendDateStr,
          status: 'scheduled',
        });
      }
    }
  }
}

/**
 * Cancel all scheduled reminders for a client + filing type
 * Used when records are marked as received
 */
export async function cancelRemindersForReceivedRecords(
  supabase: SupabaseClient,
  clientId: string,
  filingTypeId: string
): Promise<number> {
  const { data, error } = await supabase
    .from('reminder_queue')
    .update({ status: 'cancelled' })
    .eq('client_id', clientId)
    .eq('filing_type_id', filingTypeId)
    .eq('status', 'scheduled')
    .select();

  if (error) {
    throw new Error(`Failed to cancel reminders: ${error.message}`);
  }

  return data?.length || 0;
}

/**
 * Handle client unpause: skip missed reminders, resume from next due step
 */
export async function handleUnpauseClient(
  supabase: SupabaseClient,
  clientId: string
): Promise<void> {
  const today = format(new UTCDate(), 'yyyy-MM-dd');

  // Find all 'scheduled' reminders for this client where send_date < today
  const { error } = await supabase
    .from('reminder_queue')
    .update({ status: 'cancelled' })
    .eq('client_id', clientId)
    .eq('status', 'scheduled')
    .lt('send_date', today);

  if (error) {
    throw new Error(`Failed to cancel missed reminders: ${error.message}`);
  }
}
