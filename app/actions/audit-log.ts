'use server';

import { createClient } from '@/lib/supabase/server';
import { renderTipTapEmail } from '@/lib/email/render-tiptap';
import { resolveDocumentsRequired } from '@/lib/documents/checklist';

export interface AuditEntry {
  id: string;
  sent_at: string;
  client_id: string;
  client_name: string;
  client_type: string | null;
  filing_type_id: string | null;
  filing_type_name: string | null;
  deadline_date: string | null;
  step_index: number | null;
  template_name: string | null;
  delivery_status: 'sent' | 'delivered' | 'bounced' | 'failed';
  recipient_email: string;
  subject: string;
  send_type: 'scheduled' | 'ad-hoc';
}

export interface AuditLogParams {
  clientSearch?: string;
  dateFrom?: string;
  dateTo?: string;
  clientId?: string;
  filingTypeId?: string;
  offset: number;
  limit: number;
}

export interface AuditLogResult {
  data: AuditEntry[];
  totalCount: number;
}

export async function getAuditLog(params: AuditLogParams): Promise<AuditLogResult> {
  const supabase = await createClient();
  const { clientSearch: rawClientSearch, dateFrom, dateTo, clientId, filingTypeId, offset, limit } = params;
  const clientSearch = rawClientSearch?.slice(0, 200);

  // Fetch filing types lookup (small reference table)
  const { data: filingTypes } = await supabase
    .from('filing_types')
    .select('id, name');
  const filingTypeMap = new Map(
    (filingTypes || []).map((ft: { id: string; name: string }) => [ft.id, ft.name])
  );

  // Fetch schedules lookup (small reference table)
  const { data: schedules } = await supabase
    .from('schedules')
    .select('id, filing_type_id, name');
  const scheduleMap = new Map(
    (schedules || []).map((s: { id: string; filing_type_id: string; name: string }) => [s.filing_type_id, s.name])
  );

  // Build step-level template name lookup: (schedule_id:step_number) → email template name
  const { data: scheduleSteps } = await supabase
    .from('schedule_steps')
    .select('schedule_id, step_number, email_template_id');
  const { data: emailTemplates } = await supabase
    .from('email_templates')
    .select('id, name');
  const emailTemplateNameMap = new Map(
    (emailTemplates || []).map((t: { id: string; name: string }) => [t.id, t.name])
  );
  const stepTemplateNameMap = new Map(
    (scheduleSteps || []).map((s: { schedule_id: string; step_number: number; email_template_id: string }) => [
      `${s.schedule_id}:${s.step_number}`,
      emailTemplateNameMap.get(s.email_template_id) || null,
    ])
  );
  const filingTypeToScheduleId = new Map(
    (schedules || []).map((s: { id: string; filing_type_id: string }) => [s.filing_type_id, s.id])
  );

  // If client search is provided, find matching client IDs first
  let matchingClientIds: string[] | undefined;
  if (clientSearch) {
    const { data: matchingClients } = await supabase
      .from('clients')
      .select('id')
      .ilike('company_name', `%${clientSearch}%`);
    matchingClientIds = (matchingClients || []).map((c: { id: string }) => c.id);

    // If no clients match, return empty result early
    if (matchingClientIds.length === 0) {
      return { data: [], totalCount: 0 };
    }
  }

  // Fetch clients lookup (to avoid PostgREST FK join cache issues - PGRST200)
  const { data: clients } = await supabase
    .from('clients')
    .select('id, company_name, client_type');
  const clientMap = new Map(
    (clients || []).map((c: { id: string; company_name: string; client_type: string | null }) => [c.id, { company_name: c.company_name, client_type: c.client_type }])
  );

  // Fetch reminder_queue separately (to avoid PostgREST FK join cache issues)
  const { data: reminderQueue } = await supabase
    .from('reminder_queue')
    .select('id, deadline_date, step_index, template_id');
  const reminderQueueMap = new Map(
    (reminderQueue || []).map((rq: { id: string; deadline_date: string; step_index: number; template_id: string | null }) => [rq.id, { deadline_date: rq.deadline_date, step_index: rq.step_index, template_id: rq.template_id }])
  );

  // Build the query - no embedded joins, fetch base table only
  let query = supabase
    .from('email_log')
    .select('*', { count: 'exact' });

  // Apply filters
  if (clientId) {
    query = query.eq('client_id', clientId);
  }

  if (filingTypeId) {
    query = query.eq('filing_type_id', filingTypeId);
  }

  // Apply client search filter by client IDs
  if (matchingClientIds && matchingClientIds.length > 0) {
    query = query.in('client_id', matchingClientIds);
  }

  if (dateFrom) {
    query = query.gte('sent_at', dateFrom);
  }

  if (dateTo) {
    const dateToEnd = new Date(dateTo);
    dateToEnd.setHours(23, 59, 59, 999);
    query = query.lte('sent_at', dateToEnd.toISOString());
  }

  // Always sort by sent_at DESC
  query = query.order('sent_at', { ascending: false });

  // Apply pagination
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching audit log:', error);
    throw error;
  }

  // Transform the data to match AuditEntry interface, mapping reference data from lookups
  const entries: AuditEntry[] = (data || []).map((row: any) => {
    const client = clientMap.get(row.client_id);
    const reminderQueueData = row.reminder_queue_id ? reminderQueueMap.get(row.reminder_queue_id) : null;

    return {
      id: row.id,
      sent_at: row.sent_at,
      client_id: row.client_id,
      client_name: client?.company_name || 'Unknown',
      client_type: client?.client_type || null,
      filing_type_id: row.filing_type_id,
      filing_type_name: row.filing_type_id ? (filingTypeMap.get(row.filing_type_id) || null) : null,
      deadline_date: reminderQueueData?.deadline_date || null,
      step_index: reminderQueueData?.step_index ?? null,
      template_name: (() => {
        const rq = row.reminder_queue_id ? reminderQueueMap.get(row.reminder_queue_id) : null;
        const scheduleId = row.filing_type_id ? filingTypeToScheduleId.get(row.filing_type_id) : rq?.template_id;
        const stepIndex = rq?.step_index;
        if (scheduleId && stepIndex != null) {
          return stepTemplateNameMap.get(`${scheduleId}:${stepIndex}`) || scheduleMap.get(row.filing_type_id) || null;
        }
        return row.filing_type_id ? (scheduleMap.get(row.filing_type_id) || null) : null;
      })(),
      delivery_status: row.delivery_status,
      recipient_email: row.recipient_email,
      subject: row.subject,
      send_type: row.send_type || 'scheduled',
    };
  });

  return {
    data: entries,
    totalCount: count || 0,
  };
}

// Queued reminder types
export interface QueuedReminder {
  id: string;
  client_id: string;
  client_name: string;
  client_type: string | null;
  filing_type_id: string | null;
  filing_type_name: string | null;
  template_id: string | null;
  template_name: string | null;
  send_date: string;
  deadline_date: string;
  status: 'scheduled' | 'rescheduled' | 'sent' | 'cancelled' | 'failed' | 'records_received' | 'paused';
  subject: string | null;
  step_index: number;
  created_at: string;
}

export interface QueuedRemindersParams {
  clientSearch?: string;
  dateFrom?: string;
  dateTo?: string;
  clientId?: string;
  filingTypeId?: string;
  statusFilter?: string[];
  offset: number;
  limit: number;
}

export interface QueuedRemindersResult {
  data: QueuedReminder[];
  totalCount: number;
}

export async function getQueuedReminders(params: QueuedRemindersParams): Promise<QueuedRemindersResult> {
  const supabase = await createClient();
  const { clientSearch: rawClientSearch, dateFrom, dateTo, clientId, filingTypeId, statusFilter, offset, limit } = params;
  const clientSearch = rawClientSearch?.slice(0, 200);

  // If client search is provided, find matching client IDs first
  let matchingClientIds: string[] | undefined;
  if (clientSearch) {
    const { data: matchingClients } = await supabase
      .from('clients')
      .select('id')
      .ilike('company_name', `%${clientSearch}%`);
    matchingClientIds = (matchingClients || []).map((c: { id: string }) => c.id);

    // If no clients match, return empty result early
    if (matchingClientIds.length === 0) {
      return { data: [], totalCount: 0 };
    }
  }

  // Fetch filing types lookup (small reference table)
  const { data: filingTypes } = await supabase
    .from('filing_types')
    .select('id, name');
  const filingTypeMap = new Map(
    (filingTypes || []).map((ft: { id: string; name: string }) => [ft.id, ft.name])
  );

  // Fetch schedules lookup (small reference table) - schedules replaced reminder_templates
  const { data: schedules } = await supabase
    .from('schedules')
    .select('id, filing_type_id, name');
  const scheduleMap = new Map(
    (schedules || []).map((s: { id: string; filing_type_id: string; name: string }) => [s.filing_type_id, s.name])
  );

  // Build step-level template name lookup: (schedule_id:step_number) → email template name
  const { data: scheduleSteps } = await supabase
    .from('schedule_steps')
    .select('schedule_id, step_number, email_template_id');
  const { data: emailTemplates } = await supabase
    .from('email_templates')
    .select('id, name, subject');
  const emailTemplateNameMap = new Map(
    (emailTemplates || []).map((t: { id: string; name: string }) => [t.id, t.name])
  );
  const stepTemplateNameMap = new Map(
    (scheduleSteps || []).map((s: { schedule_id: string; step_number: number; email_template_id: string }) => [
      `${s.schedule_id}:${s.step_number}`,
      emailTemplateNameMap.get(s.email_template_id) || null,
    ])
  );
  // Build step-level template subject lookup: (schedule_id:step_number) → email template subject
  const emailTemplateSubjectMap = new Map(
    (emailTemplates || []).map((t: { id: string; name: string; subject?: string }) => [t.id, (t as any).subject || null])
  );
  const stepTemplateSubjectMap = new Map(
    (scheduleSteps || []).map((s: { schedule_id: string; step_number: number; email_template_id: string }) => [
      `${s.schedule_id}:${s.step_number}`,
      emailTemplateSubjectMap.get(s.email_template_id) || null,
    ])
  );
  // Also build schedule_id lookup from filing_type_id
  const filingTypeToScheduleId = new Map(
    (schedules || []).map((s: { id: string; filing_type_id: string }) => [s.filing_type_id, s.id])
  );

  // Fetch clients lookup (to avoid PostgREST FK join cache issues - PGRST200)
  const { data: clients } = await supabase
    .from('clients')
    .select('id, company_name, client_type');
  const clientMap = new Map(
    (clients || []).map((c: { id: string; company_name: string; client_type: string | null }) => [c.id, { company_name: c.company_name, client_type: c.client_type }])
  );

  // Auto-cancel any queued/rescheduled reminders with send_date before today
  const today = new Date().toISOString().split('T')[0];
  await supabase
    .from('reminder_queue')
    .update({ status: 'cancelled' })
    .in('status', ['scheduled', 'rescheduled'])
    .lt('send_date', today);

  // Build the query - no embedded joins, fetch base table only
  let query = supabase
    .from('reminder_queue')
    .select('*', { count: 'exact' });

  // Apply filters
  if (clientId) {
    query = query.eq('client_id', clientId);
  }

  if (filingTypeId) {
    query = query.eq('filing_type_id', filingTypeId);
  }

  // Apply client search filter by client IDs
  if (matchingClientIds && matchingClientIds.length > 0) {
    query = query.in('client_id', matchingClientIds);
  }

  if (dateFrom) {
    query = query.gte('send_date', dateFrom);
  }

  if (dateTo) {
    query = query.lte('send_date', dateTo);
  }

  if (statusFilter && statusFilter.length > 0) {
    query = query.in('status', statusFilter);
  }

  // Sort by send_date ASC (next emails to send first)
  query = query.order('send_date', { ascending: true });

  // Apply pagination
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching queued reminders:', error);
    throw error;
  }

  // Transform the data, mapping reference data from lookups
  const reminders: QueuedReminder[] = (data || []).map((row: any) => {
    const client = clientMap.get(row.client_id);

    return {
      id: row.id,
      client_id: row.client_id,
      client_name: client?.company_name || 'Unknown',
      client_type: client?.client_type || null,
      filing_type_id: row.filing_type_id,
      filing_type_name: row.filing_type_id ? (filingTypeMap.get(row.filing_type_id) || null) : null,
      template_id: row.template_id,
      // Resolve the actual email template name for this specific step
      template_name: (() => {
        const scheduleId = row.filing_type_id ? filingTypeToScheduleId.get(row.filing_type_id) : row.template_id;
        if (scheduleId && row.step_index != null) {
          return stepTemplateNameMap.get(`${scheduleId}:${row.step_index}`) || scheduleMap.get(row.filing_type_id) || null;
        }
        return row.filing_type_id ? (scheduleMap.get(row.filing_type_id) || null) : null;
      })(),
      send_date: row.send_date,
      deadline_date: row.deadline_date,
      status: row.status,
      subject: row.resolved_subject || (() => {
        const scheduleId = row.filing_type_id ? filingTypeToScheduleId.get(row.filing_type_id) : row.template_id;
        if (scheduleId && row.step_index != null) {
          const templateSubject = stepTemplateSubjectMap.get(`${scheduleId}:${row.step_index}`);
          if (templateSubject) {
            // Resolve placeholders with available data
            const filingTypeName = row.filing_type_id ? (filingTypeMap.get(row.filing_type_id) || '') : '';
            const deadlineFormatted = row.deadline_date
              ? new Date(row.deadline_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
              : '';
            return templateSubject
              .replace(/\{\{client_name\}\}/g, client?.company_name || '')
              .replace(/\{\{filing_type\}\}/g, filingTypeName)
              .replace(/\{\{deadline\}\}/g, deadlineFormatted)
              .replace(/\{\{accountant_name\}\}/g, '');
          }
          return null;
        }
        return null;
      })(),
      step_index: row.step_index,
      created_at: row.created_at,
    };
  });

  return {
    data: reminders,
    totalCount: count || 0,
  };
}

// Preview a queued email with fully rendered HTML
export async function previewQueuedEmail(
  reminderId: string
): Promise<{ html: string; subject: string; text: string } | { error: string }> {
  try {
    const supabase = await createClient();

    // Fetch the reminder_queue row
    const { data: reminder, error: reminderError } = await supabase
      .from('reminder_queue')
      .select('*')
      .eq('id', reminderId)
      .single();

    if (reminderError || !reminder) {
      return { error: `Reminder not found: ${reminderError?.message || 'Unknown error'}` };
    }

    // If html_body is already populated (resolved/sent), return it directly
    if (reminder.html_body) {
      return {
        html: reminder.html_body,
        subject: reminder.resolved_subject || '',
        text: reminder.resolved_body || '',
      };
    }

    // Otherwise, resolve the template on-the-fly for scheduled reminders

    // Fetch the client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, company_name, client_type')
      .eq('id', reminder.client_id)
      .single();

    if (clientError || !client) {
      return { error: `Client not found: ${clientError?.message || 'Unknown error'}` };
    }

    // Fetch the schedule
    let schedule;
    if (reminder.filing_type_id) {
      const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .eq('filing_type_id', reminder.filing_type_id)
        .eq('is_active', true)
        .single();
      if (error || !data) {
        return { error: `Schedule not found for filing type: ${error?.message || 'Not found'}` };
      }
      schedule = data;
    } else if (reminder.template_id) {
      const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .eq('id', reminder.template_id)
        .eq('is_active', true)
        .single();
      if (error || !data) {
        return { error: `Custom schedule not found: ${error?.message || 'Not found'}` };
      }
      schedule = data;
    } else {
      return { error: 'Reminder has no filing_type_id or template_id' };
    }

    // Fetch schedule steps
    const { data: steps, error: stepsError } = await supabase
      .from('schedule_steps')
      .select('*')
      .eq('schedule_id', schedule.id)
      .order('step_number', { ascending: true });

    if (stepsError || !steps || steps.length === 0) {
      return { error: `Failed to fetch schedule steps: ${stepsError?.message || 'No steps found'}` };
    }

    // Find the step matching reminder.step_index
    const step = steps.find((s: any) => s.step_number === reminder.step_index);
    if (!step) {
      return { error: `Step ${reminder.step_index} not found in schedule` };
    }

    // Fetch email template
    const { data: template, error: templateError } = await supabase
      .from('email_templates')
      .select('*')
      .eq('id', step.email_template_id)
      .single();

    if (templateError || !template) {
      return { error: `Template not found: ${templateError?.message || 'Not found'}` };
    }

    // Resolve filing type name
    let filingTypeName = schedule.name;
    if (reminder.filing_type_id) {
      const { data: filingType } = await supabase
        .from('filing_types')
        .select('name')
        .eq('id', reminder.filing_type_id)
        .single();
      if (filingType) {
        filingTypeName = filingType.name;
      }
    }

    // Resolve documents_required for filing reminders
    let documentsRequired = '';
    if (reminder.filing_type_id) {
      try {
        documentsRequired = await resolveDocumentsRequired(supabase, client.id, reminder.filing_type_id);
      } catch {
        // Non-fatal — leave empty
      }
    }

    // Fetch org name for accountant_name
    let accountantName = 'Prompt';
    if (reminder.org_id) {
      const { data: org } = await supabase
        .from('organisations')
        .select('name')
        .eq('id', reminder.org_id)
        .single();
      if (org) {
        accountantName = org.name;
      }
    }

    // Render template
    const rendered = await renderTipTapEmail({
      bodyJson: template.body_json,
      subject: template.subject,
      context: {
        client_name: client.company_name,
        deadline: new Date(reminder.deadline_date + 'T00:00:00'),
        filing_type: filingTypeName,
        accountant_name: accountantName,
        documents_required: documentsRequired,
        portal_link: '#preview',
      },
      clientId: client.id,
    });

    return {
      html: rendered.html,
      subject: rendered.subject,
      text: rendered.text,
    };
  } catch (error) {
    console.error('previewQueuedEmail error:', error);
    return {
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function previewSentEmail(
  emailLogId: string
): Promise<{ html: string; subject: string; text: string } | { noBody: true } | { error: string }> {
  try {
    const supabase = await createClient();

    const { data: emailLog, error: logError } = await supabase
      .from('email_log')
      .select('reminder_queue_id, subject')
      .eq('id', emailLogId)
      .single();

    if (logError || !emailLog) {
      return { error: 'Email log entry not found' };
    }

    if (!emailLog.reminder_queue_id) {
      return { noBody: true };
    }

    return await previewQueuedEmail(emailLog.reminder_queue_id);
  } catch (error) {
    console.error('previewSentEmail error:', error);
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
