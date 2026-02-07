import { SupabaseClient } from '@supabase/supabase-js';
import { UTCDate } from '@date-fns/utc';
import { subDays, format } from 'date-fns';
import { FilingTypeId, ClientFilingAssignment, ReminderTemplate, ClientDeadlineOverride, ClientTemplateOverride, TemplateStep } from '@/lib/types/database';
import { calculateDeadline } from '@/lib/deadlines/calculators';
import { getNextWorkingDay } from '@/lib/deadlines/working-days';
import { getUKBankHolidaySet } from '@/lib/bank-holidays/cache';
import { resolveTemplateForClient } from '@/lib/templates/inheritance';

interface Client {
  id: string;
  company_name: string;
  year_end_date: string | null;
  vat_quarter: string | null;
  reminders_paused: boolean;
  records_received_for: string[];
}

interface BuildResult {
  created: number;
  skipped: number;
}

/**
 * Build reminder queue from templates, filing assignments, and deadlines
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

  // Fetch all active reminder templates
  const { data: templates, error: templatesError } = await supabase
    .from('reminder_templates')
    .select('*')
    .eq('is_active', true);

  if (templatesError) {
    throw new Error(`Failed to fetch templates: ${templatesError.message}`);
  }

  if (!templates || templates.length === 0) {
    return { created: 0, skipped: 0 };
  }

  // Fetch all client overrides (deadline and template)
  const { data: deadlineOverrides, error: deadlineError } = await supabase
    .from('client_deadline_overrides')
    .select('*');

  if (deadlineError) {
    throw new Error(`Failed to fetch deadline overrides: ${deadlineError.message}`);
  }

  const { data: templateOverrides, error: templateError } = await supabase
    .from('client_template_overrides')
    .select('*');

  if (templateError) {
    throw new Error(`Failed to fetch template overrides: ${templateError.message}`);
  }

  // Fetch bank holidays
  const holidays = await getUKBankHolidaySet();

  // Group overrides by client for quick lookup
  const deadlineOverrideMap = new Map<string, Map<string, ClientDeadlineOverride>>();
  (deadlineOverrides || []).forEach((override) => {
    if (!deadlineOverrideMap.has(override.client_id)) {
      deadlineOverrideMap.set(override.client_id, new Map());
    }
    deadlineOverrideMap.get(override.client_id)!.set(override.filing_type_id, override);
  });

  const templateOverrideMap = new Map<string, Map<string, ClientTemplateOverride[]>>();
  (templateOverrides || []).forEach((override) => {
    const key = `${override.client_id}_${override.template_id}`;
    if (!templateOverrideMap.has(key)) {
      templateOverrideMap.set(key, new Map());
    }
    if (!templateOverrideMap.get(key)!.has(override.template_id)) {
      templateOverrideMap.get(key)!.set(override.template_id, []);
    }
    templateOverrideMap.get(key)!.get(override.template_id)!.push(override);
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
        vat_quarter: client.vat_quarter ?? undefined,
      });
    }

    if (!deadlineDate) {
      // Can't calculate deadline (missing metadata)
      skipped++;
      continue;
    }

    // Find the reminder template for this filing type
    const template = templates.find((t) => t.filing_type_id === filingTypeId);
    if (!template) {
      // No template exists for this filing type
      skipped++;
      continue;
    }

    // Resolve template steps with client overrides
    const clientOverrides = templateOverrideMap.get(`${client.id}_${template.id}`)?.get(template.id) || [];
    const overrideEntries = clientOverrides.map((override) => ({
      step_index: override.step_index,
      overridden_fields: override.overridden_fields,
    }));
    const resolvedSteps = resolveTemplateForClient(template.steps, overrideEntries);

    // Create queue entries for each step
    for (let i = 0; i < resolvedSteps.length; i++) {
      const step = resolvedSteps[i];

      // Calculate send_date = deadline_date - delay_days
      let sendDate = subDays(new UTCDate(deadlineDate), step.delay_days);

      // Adjust send_date to next working day if on weekend/bank holiday
      sendDate = new UTCDate(getNextWorkingDay(sendDate, holidays));

      const sendDateStr = format(sendDate, 'yyyy-MM-dd');
      const deadlineDateStr = format(deadlineDate, 'yyyy-MM-dd');

      // Check if this exact reminder already exists (idempotent)
      const { data: existing, error: existingError } = await supabase
        .from('reminder_queue')
        .select('id')
        .eq('client_id', client.id)
        .eq('filing_type_id', filingTypeId)
        .eq('step_index', i)
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
          template_id: template.id,
          step_index: i,
          deadline_date: deadlineDateStr,
          send_date: sendDateStr,
          status: 'scheduled',
        });

      if (insertError) {
        // Log error but continue processing
        console.error(`Failed to insert reminder for client ${client.id}, filing ${filingTypeId}, step ${i}:`, insertError);
        skipped++;
      } else {
        created++;
      }
    }
  }

  return { created, skipped };
}

/**
 * Rebuild queue entries for a specific client
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

  // Fetch active templates
  const { data: templates, error: templatesError } = await supabase
    .from('reminder_templates')
    .select('*')
    .eq('is_active', true);

  if (templatesError) {
    throw new Error(`Failed to fetch templates: ${templatesError.message}`);
  }

  // Fetch client overrides
  const { data: deadlineOverrides, error: deadlineError } = await supabase
    .from('client_deadline_overrides')
    .select('*')
    .eq('client_id', clientId);

  if (deadlineError) {
    throw new Error(`Failed to fetch deadline overrides: ${deadlineError.message}`);
  }

  const { data: templateOverrides, error: templateError } = await supabase
    .from('client_template_overrides')
    .select('*')
    .eq('client_id', clientId);

  if (templateError) {
    throw new Error(`Failed to fetch template overrides: ${templateError.message}`);
  }

  const holidays = await getUKBankHolidaySet();

  // Build overrides maps
  const deadlineOverrideMap = new Map<string, ClientDeadlineOverride>();
  (deadlineOverrides || []).forEach((override) => {
    deadlineOverrideMap.set(override.filing_type_id, override);
  });

  const templateOverrideMap = new Map<string, ClientTemplateOverride[]>();
  (templateOverrides || []).forEach((override) => {
    if (!templateOverrideMap.has(override.template_id)) {
      templateOverrideMap.set(override.template_id, []);
    }
    templateOverrideMap.get(override.template_id)!.push(override);
  });

  // Process each assignment
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
        vat_quarter: client.vat_quarter ?? undefined,
      });
    }

    if (!deadlineDate) {
      continue;
    }

    // Find template
    const template = templates?.find((t) => t.filing_type_id === filingTypeId);
    if (!template) {
      continue;
    }

    // Resolve steps
    const clientOverrides = templateOverrideMap.get(template.id) || [];
    const overrideEntries = clientOverrides.map((override) => ({
      step_index: override.step_index,
      overridden_fields: override.overridden_fields,
    }));
    const resolvedSteps = resolveTemplateForClient(template.steps, overrideEntries);

    // Create queue entries
    for (let i = 0; i < resolvedSteps.length; i++) {
      const step = resolvedSteps[i];
      let sendDate = subDays(new UTCDate(deadlineDate), step.delay_days);
      sendDate = new UTCDate(getNextWorkingDay(sendDate, holidays));

      const sendDateStr = format(sendDate, 'yyyy-MM-dd');
      const deadlineDateStr = format(deadlineDate, 'yyyy-MM-dd');

      await supabase.from('reminder_queue').insert({
        client_id: client.id,
        filing_type_id: filingTypeId,
        template_id: template.id,
        step_index: i,
        deadline_date: deadlineDateStr,
        send_date: sendDateStr,
        status: 'scheduled',
      });
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
