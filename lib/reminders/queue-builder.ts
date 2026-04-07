import { SupabaseClient } from '@supabase/supabase-js';
import { UTCDate } from '@date-fns/utc';
import { subDays, format, addMonths, addYears } from 'date-fns';
import { FilingTypeId, ClientFilingAssignment, ClientDeadlineOverride, Schedule, ScheduleStep, EmailTemplate } from '@/lib/types/database';
import { calculateDeadline } from '@/lib/deadlines/calculators';
import { getNextWorkingDay } from '@/lib/deadlines/working-days';
import { getUKBankHolidaySet } from '@/lib/bank-holidays/cache';
import { logger } from '@/lib/logger';

interface Client {
  id: string;
  company_name: string;
  year_end_date: string | null;
  vat_stagger_group: number | null;
  reminders_paused: boolean;
  records_received_for: string[];
}

export interface Org {
  id: string;
  name: string;
  client_portal_enabled?: boolean;
}

export interface BuildResult {
  created: number;
  skipped: number;
}

/**
 * Log warnings/errors to email_log for visibility
 */
async function logQueueWarning(supabase: SupabaseClient, orgId: string, entry: {
  message: string;
  client_id?: string;
  filing_type_id?: string;
}): Promise<void> {
  await supabase.from('email_log').insert({
    org_id: orgId,
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
 * Org-scoped: all queries filtered by org_id
 * When ownerId is provided, all resource queries (schedules, steps, templates, clients, exclusions)
 * are additionally scoped to that user's owner_id. This is used by the cron pipeline to process
 * each org member independently. When ownerId is omitted, existing behavior is preserved
 * (for rebuildQueueForClient called from server actions where RLS handles scoping).
 */
export async function buildReminderQueue(supabase: SupabaseClient, org: Org, ownerId?: string): Promise<BuildResult> {
  let created = 0;
  let skipped = 0;

  // Fetch all clients with active filing assignments for this org
  // When ownerId provided, scope to that user's clients via clients.owner_id
  let assignmentsQuery = supabase
    .from('client_filing_assignments')
    .select('*, clients!inner(*)')
    .eq('org_id', org.id)
    .eq('is_active', true);

  if (ownerId) {
    assignmentsQuery = assignmentsQuery.eq('clients.owner_id', ownerId);
  }

  const { data: assignments, error: assignmentsError } = await assignmentsQuery;

  if (assignmentsError) {
    throw new Error(`Failed to fetch filing assignments: ${assignmentsError.message}`);
  }

  if (!assignments || assignments.length === 0) {
    return { created: 0, skipped: 0 };
  }

  // Fetch org-active filing types to filter assignments at queue-build time only.
  // Entries already in the queue were scheduled when the type was active — don't disturb them.
  const { data: orgActiveTypes } = await supabase
    .from('org_filing_type_selections')
    .select('filing_type_id')
    .eq('org_id', org.id)
    .eq('is_active', true);
  const activeTypeIds = new Set((orgActiveTypes ?? []).map(r => r.filing_type_id));

  // Fetch v1.1 normalized tables (PostgREST FK workaround: fetch separately and map in app)
  let schedulesQuery = supabase
    .from('schedules')
    .select('*')
    .eq('org_id', org.id)
    .eq('is_active', true)
    .eq('schedule_type', 'filing');

  if (ownerId) {
    schedulesQuery = schedulesQuery.eq('owner_id', ownerId);
  }

  const { data: schedules, error: schedulesError } = await schedulesQuery;

  if (schedulesError) {
    throw new Error(`Failed to fetch schedules: ${schedulesError.message}`);
  }

  let stepsQuery = supabase
    .from('schedule_steps')
    .select('*')
    .eq('org_id', org.id)
    .order('step_number', { ascending: true });

  if (ownerId) {
    stepsQuery = stepsQuery.eq('owner_id', ownerId);
  }

  const { data: scheduleSteps, error: stepsError } = await stepsQuery;

  if (stepsError) {
    throw new Error(`Failed to fetch schedule steps: ${stepsError.message}`);
  }

  let templatesQuery = supabase
    .from('email_templates')
    .select('*')
    .eq('org_id', org.id)
    .eq('is_active', true);

  if (ownerId) {
    templatesQuery = templatesQuery.eq('owner_id', ownerId);
  }

  const { data: emailTemplates, error: templatesError } = await templatesQuery;

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
    .select('*')
    .eq('org_id', org.id);

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

  // Fetch schedule-level client exclusions
  let exclusionsQuery = supabase
    .from('schedule_client_exclusions')
    .select('schedule_id, client_id')
    .eq('org_id', org.id);

  if (ownerId) {
    exclusionsQuery = exclusionsQuery.eq('owner_id', ownerId);
  }

  const { data: exclusionsData } = await exclusionsQuery;

  const exclusionSet = new Set(
    (exclusionsData || []).map(e => `${e.schedule_id}:${e.client_id}`)
  );

  // Collect all queue entries in memory, then batch-insert with ON CONFLICT DO NOTHING.
  // This replaces the old per-entry SELECT + INSERT loop which made hundreds of
  // individual requests and caused server action timeouts during wizard setup.
  const entriesToInsert: Array<{
    org_id: string;
    client_id: string;
    filing_type_id: string;
    template_id: string;
    step_index: number;
    deadline_date: string;
    send_date: string;
    status: string;
  }> = [];

  for (const assignment of assignments) {
    const client = assignment.clients as Client;
    const filingTypeId = assignment.filing_type_id;

    // Skip if this filing type is not active for the org.
    // Only filter at queue-build time — entries already in queue remain unaffected.
    if (activeTypeIds.size > 0 && !activeTypeIds.has(filingTypeId)) { skipped++; continue; }

    if (client.reminders_paused) { skipped++; continue; }
    if (client.records_received_for && client.records_received_for.includes(filingTypeId)) { skipped++; continue; }

    let deadlineDate: Date | null = null;
    const deadlineOverride = deadlineOverrideMap.get(client.id)?.get(filingTypeId);

    if (deadlineOverride) {
      deadlineDate = new UTCDate(deadlineOverride.override_date);
    } else {
      deadlineDate = calculateDeadline(filingTypeId, {
        year_end_date: client.year_end_date ?? undefined,
        vat_stagger_group: client.vat_stagger_group ?? undefined,
      });
    }

    if (!deadlineDate) { skipped++; continue; }

    const schedule = scheduleByFilingType.get(filingTypeId);
    if (!schedule) {
      await logQueueWarning(supabase, org.id, {
        message: `No schedule found for filing type ${filingTypeId}`,
        client_id: client.id,
        filing_type_id: filingTypeId,
      });
      skipped++;
      continue;
    }

    if (exclusionSet.has(`${schedule.id}:${client.id}`)) { skipped++; continue; }

    const steps = stepsBySchedule.get(schedule.id) || [];
    if (steps.length === 0) {
      await logQueueWarning(supabase, org.id, {
        message: `Schedule ${schedule.id} has no steps`,
        client_id: client.id,
        filing_type_id: filingTypeId,
      });
      skipped++;
      continue;
    }

    for (const step of steps) {
      const template = templateMap.get(step.email_template_id);
      if (!template) {
        await logQueueWarning(supabase, org.id, {
          message: `Template ${step.email_template_id} not found for schedule ${schedule.id} step ${step.step_number}`,
          client_id: client.id,
          filing_type_id: filingTypeId,
        });
        skipped++;
        continue;
      }

      let sendDate = subDays(new UTCDate(deadlineDate), step.delay_days);
      sendDate = new UTCDate(getNextWorkingDay(sendDate, holidays));

      entriesToInsert.push({
        org_id: org.id,
        client_id: client.id,
        filing_type_id: filingTypeId,
        template_id: schedule.id,
        step_index: step.step_number,
        deadline_date: format(deadlineDate, 'yyyy-MM-dd'),
        send_date: format(sendDate, 'yyyy-MM-dd'),
        status: 'scheduled',
      });
    }
  }

  // Batch insert with DB-level idempotency (unique index on client_id, template_id, step_index, deadline_date)
  if (entriesToInsert.length > 0) {
    const { data: inserted, error: batchError } = await supabase
      .from('reminder_queue')
      .upsert(entriesToInsert, {
        onConflict: 'client_id,template_id,step_index,deadline_date',
        ignoreDuplicates: true,
      })
      .select('id');

    if (batchError) {
      logger.error('Failed to batch insert reminder queue entries:', { error: (batchError as any)?.message ?? String(batchError) });
      skipped += entriesToInsert.length;
    } else {
      created = inserted?.length ?? 0;
      skipped += entriesToInsert.length - created;
    }
  }

  return { created, skipped };
}

/**
 * Build reminder queue entries for custom schedules (v1.1+)
 * When ownerId is provided: custom schedules apply only to that user's clients (owner_id match).
 * When ownerId is omitted: existing behaviour — schedules apply to all active, non-paused clients.
 * This is the correct per-accountant behaviour: a user's custom schedule should only fire for
 * clients they own. RLS handles scoping in server action context; ownerId handles cron context.
 */
export async function buildCustomScheduleQueue(supabase: SupabaseClient, org: Org, ownerId?: string): Promise<BuildResult> {
  let created = 0;
  let skipped = 0;

  // 1. Fetch all active custom schedules for this org
  // When ownerId provided, scope to that user's schedules
  let schedulesQuery = supabase
    .from('schedules')
    .select('*')
    .eq('org_id', org.id)
    .eq('is_active', true)
    .eq('schedule_type', 'custom');

  if (ownerId) {
    schedulesQuery = schedulesQuery.eq('owner_id', ownerId);
  }

  const { data: customSchedules, error: schedulesError } = await schedulesQuery;

  if (schedulesError) {
    throw new Error(`Failed to fetch custom schedules: ${schedulesError.message}`);
  }

  if (!customSchedules || customSchedules.length === 0) {
    return { created: 0, skipped: 0 };
  }

  // 2. Fetch all active, non-paused clients for this org
  // When ownerId provided, scope to that user's clients only
  let clientsQuery = supabase
    .from('clients')
    .select('*')
    .eq('org_id', org.id)
    .eq('reminders_paused', false);

  if (ownerId) {
    clientsQuery = clientsQuery.eq('owner_id', ownerId);
  }

  const { data: clients, error: clientsError } = await clientsQuery;

  if (clientsError) {
    throw new Error(`Failed to fetch clients: ${clientsError.message}`);
  }

  if (!clients || clients.length === 0) {
    return { created: 0, skipped: 0 };
  }

  // 3. Fetch schedule steps for this org
  const scheduleIds = customSchedules.map(s => s.id);
  let stepsQuery = supabase
    .from('schedule_steps')
    .select('*')
    .eq('org_id', org.id)
    .in('schedule_id', scheduleIds)
    .order('step_number', { ascending: true });

  if (ownerId) {
    stepsQuery = stepsQuery.eq('owner_id', ownerId);
  }

  const { data: scheduleSteps, error: stepsError } = await stepsQuery;

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

  // 4. Fetch schedule-level client exclusions for this org
  let exclusionsQuery = supabase
    .from('schedule_client_exclusions')
    .select('schedule_id, client_id')
    .eq('org_id', org.id);

  if (ownerId) {
    exclusionsQuery = exclusionsQuery.eq('owner_id', ownerId);
  }

  const { data: exclusionsData } = await exclusionsQuery;

  const exclusionSet = new Set(
    (exclusionsData || []).map(e => `${e.schedule_id}:${e.client_id}`)
  );

  // Collect all entries in memory, then batch-insert with ON CONFLICT DO NOTHING
  const entriesToInsert: Array<{
    org_id: string;
    client_id: string;
    filing_type_id: null;
    template_id: string;
    step_index: number;
    deadline_date: string;
    send_date: string;
    status: string;
  }> = [];

  for (const schedule of customSchedules) {
    const targetDate = getNextCustomDate({
      custom_date: schedule.custom_date,
      recurrence_rule: schedule.recurrence_rule,
      recurrence_anchor: schedule.recurrence_anchor,
    });

    if (!targetDate) {
      await logQueueWarning(supabase, org.id, {
        message: `Custom schedule ${schedule.id} (${schedule.name}) has no valid target date`,
      });
      skipped++;
      continue;
    }

    const steps = stepsBySchedule.get(schedule.id) || [];
    if (steps.length === 0) {
      await logQueueWarning(supabase, org.id, {
        message: `Custom schedule ${schedule.id} (${schedule.name}) has no steps`,
      });
      skipped++;
      continue;
    }

    const deadlineDateStr = format(targetDate, 'yyyy-MM-dd');

    for (const client of clients) {
      if (exclusionSet.has(`${schedule.id}:${client.id}`)) { skipped++; continue; }

      for (const step of steps) {
        let sendDate = subDays(new UTCDate(targetDate), step.delay_days);
        sendDate = new UTCDate(getNextWorkingDay(sendDate, holidays));

        entriesToInsert.push({
          org_id: org.id,
          client_id: client.id,
          filing_type_id: null,
          template_id: schedule.id,
          step_index: step.step_number,
          deadline_date: deadlineDateStr,
          send_date: format(sendDate, 'yyyy-MM-dd'),
          status: 'scheduled',
        });
      }
    }
  }

  // Batch insert with DB-level idempotency
  if (entriesToInsert.length > 0) {
    const { data: inserted, error: batchError } = await supabase
      .from('reminder_queue')
      .upsert(entriesToInsert, {
        onConflict: 'client_id,template_id,step_index,deadline_date',
        ignoreDuplicates: true,
      })
      .select('id');

    if (batchError) {
      logger.error('Failed to batch insert custom schedule queue entries:', { error: (batchError as any)?.message ?? String(batchError) });
      skipped += entriesToInsert.length;
    } else {
      created = inserted?.length ?? 0;
      skipped += entriesToInsert.length - created;
    }
  }

  return { created, skipped };
}

/**
 * Rebuild queue entries for a specific client (v1.1)
 * Used when client metadata, assignments, or overrides change
 * Org-scoped: all queries filtered by org_id
 *
 * When called from server actions, orgId can be derived from the client's org_id.
 * When called from cron, org is passed explicitly.
 */
export async function rebuildQueueForClient(
  supabase: SupabaseClient,
  clientId: string,
  orgId?: string
): Promise<void> {
  // Delete 'scheduled' reminders for this client that haven't been queued yet
  // Don't touch entries already queued (queued_at set), 'sent', or 'cancelled'
  const { error: deleteError } = await supabase
    .from('reminder_queue')
    .delete()
    .eq('client_id', clientId)
    .eq('status', 'scheduled')
    .is('queued_at', null);

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

  // Resolve org_id: use explicit parameter, or fall back to client's org_id
  const resolvedOrgId = orgId || client.org_id;

  // Fetch active assignments for this client
  const { data: assignments, error: assignmentsError } = await supabase
    .from('client_filing_assignments')
    .select('*')
    .eq('client_id', clientId)
    .eq('org_id', resolvedOrgId)
    .eq('is_active', true);

  if (assignmentsError) {
    throw new Error(`Failed to fetch assignments: ${assignmentsError.message}`);
  }

  if (!assignments || assignments.length === 0) {
    return;
  }

  // Fetch org-active filing types to filter at queue-build time only
  const { data: orgActiveTypesRebuild } = await supabase
    .from('org_filing_type_selections')
    .select('filing_type_id')
    .eq('org_id', resolvedOrgId)
    .eq('is_active', true);
  const activeTypeIdsRebuild = new Set((orgActiveTypesRebuild ?? []).map(r => r.filing_type_id));

  // Fetch v1.1 normalized tables scoped to org
  const { data: schedules, error: schedulesError } = await supabase
    .from('schedules')
    .select('*')
    .eq('org_id', resolvedOrgId)
    .eq('is_active', true);

  if (schedulesError) {
    throw new Error(`Failed to fetch schedules: ${schedulesError.message}`);
  }

  const { data: scheduleSteps, error: stepsError } = await supabase
    .from('schedule_steps')
    .select('*')
    .eq('org_id', resolvedOrgId)
    .order('step_number', { ascending: true });

  if (stepsError) {
    throw new Error(`Failed to fetch schedule steps: ${stepsError.message}`);
  }

  const { data: emailTemplates, error: templatesError } = await supabase
    .from('email_templates')
    .select('*')
    .eq('org_id', resolvedOrgId)
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
    .eq('client_id', clientId)
    .eq('org_id', resolvedOrgId);

  if (deadlineError) {
    throw new Error(`Failed to fetch deadline overrides: ${deadlineError.message}`);
  }

  const holidays = await getUKBankHolidaySet();

  // Build overrides maps
  const deadlineOverrideMap = new Map<string, ClientDeadlineOverride>();
  (deadlineOverrides || []).forEach((override) => {
    deadlineOverrideMap.set(override.filing_type_id, override);
  });

  // Fetch exclusions for this client
  const { data: clientExclusions } = await supabase
    .from('schedule_client_exclusions')
    .select('schedule_id')
    .eq('client_id', clientId)
    .eq('org_id', resolvedOrgId);

  const excludedScheduleIds = new Set(
    (clientExclusions || []).map(e => e.schedule_id)
  );

  // Process each assignment (filing schedules)
  for (const assignment of assignments) {
    const filingTypeId = assignment.filing_type_id;

    // Skip if this filing type is not active for the org
    if (activeTypeIdsRebuild.size > 0 && !activeTypeIdsRebuild.has(filingTypeId)) {
      continue;
    }

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
      await logQueueWarning(supabase, resolvedOrgId, {
        message: `No schedule found for filing type ${filingTypeId}`,
        client_id: clientId,
        filing_type_id: filingTypeId,
      });
      continue;
    }

    // Skip if client is excluded from this schedule
    if (excludedScheduleIds.has(schedule.id)) {
      continue;
    }

    const steps = stepsByScheduleMap.get(schedule.id) || [];
    if (steps.length === 0) {
      await logQueueWarning(supabase, resolvedOrgId, {
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
        await logQueueWarning(supabase, resolvedOrgId, {
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
        org_id: resolvedOrgId,
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
      // Skip if client is excluded from this schedule
      if (excludedScheduleIds.has(schedule.id)) continue;

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
          org_id: resolvedOrgId,
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
    .update({ status: 'records_received' })
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
 * Restore reminders when records are marked as NOT received
 * Changes status from 'records_received' back to 'scheduled'
 */
export async function restoreRemindersForUnreceivedRecords(
  supabase: SupabaseClient,
  clientId: string,
  filingTypeId: string
): Promise<number> {
  const { data, error } = await supabase
    .from('reminder_queue')
    .update({ status: 'scheduled' })
    .eq('client_id', clientId)
    .eq('filing_type_id', filingTypeId)
    .eq('status', 'records_received')
    .select();

  if (error) {
    throw new Error(`Failed to restore reminders: ${error.message}`);
  }

  return data?.length || 0;
}

/**
 * Handle client pause: mark all scheduled/rescheduled reminders as "paused"
 */
export async function handlePauseClient(
  supabase: SupabaseClient,
  clientId: string
): Promise<void> {
  const { error } = await supabase
    .from('reminder_queue')
    .update({ status: 'paused' })
    .eq('client_id', clientId)
    .in('status', ['scheduled', 'rescheduled']);

  if (error) {
    throw new Error(`Failed to pause reminders: ${error.message}`);
  }
}

/**
 * Handle client unpause: restore paused reminders, cancel any that were missed
 */
export async function handleUnpauseClient(
  supabase: SupabaseClient,
  clientId: string
): Promise<void> {
  const today = format(new UTCDate(), 'yyyy-MM-dd');

  // Cancel paused reminders whose send_date has passed
  const { error: cancelError } = await supabase
    .from('reminder_queue')
    .update({ status: 'cancelled' })
    .eq('client_id', clientId)
    .eq('status', 'paused')
    .lt('send_date', today);

  if (cancelError) {
    throw new Error(`Failed to cancel missed reminders: ${cancelError.message}`);
  }

  // Restore paused reminders whose send_date is still in the future back to scheduled
  const { error: restoreError } = await supabase
    .from('reminder_queue')
    .update({ status: 'scheduled' })
    .eq('client_id', clientId)
    .eq('status', 'paused')
    .gte('send_date', today);

  if (restoreError) {
    throw new Error(`Failed to restore paused reminders: ${restoreError.message}`);
  }
}
