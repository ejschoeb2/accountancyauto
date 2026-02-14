'use server';

import { createClient } from '@/lib/supabase/server';

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
  offset: number;
  limit: number;
}

export interface AuditLogResult {
  data: AuditEntry[];
  totalCount: number;
}

export async function getAuditLog(params: AuditLogParams): Promise<AuditLogResult> {
  const supabase = await createClient();
  const { clientSearch, dateFrom, dateTo, clientId, offset, limit } = params;

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
    .select('id, deadline_date, step_index');
  const reminderQueueMap = new Map(
    (reminderQueue || []).map((rq: { id: string; deadline_date: string; step_index: number }) => [rq.id, { deadline_date: rq.deadline_date, step_index: rq.step_index }])
  );

  // Build the query - no embedded joins, fetch base table only
  let query = supabase
    .from('email_log')
    .select('*', { count: 'exact' });

  // Apply filters
  if (clientId) {
    query = query.eq('client_id', clientId);
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
      template_name: row.filing_type_id ? (scheduleMap.get(row.filing_type_id) || null) : null,
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
  status: 'scheduled' | 'rescheduled' | 'pending' | 'sent' | 'cancelled' | 'failed' | 'records_received';
  subject: string | null;
  step_index: number;
  created_at: string;
}

export interface QueuedRemindersParams {
  clientSearch?: string;
  dateFrom?: string;
  dateTo?: string;
  clientId?: string;
  statusFilter?: string;
  offset: number;
  limit: number;
}

export interface QueuedRemindersResult {
  data: QueuedReminder[];
  totalCount: number;
}

export async function getQueuedReminders(params: QueuedRemindersParams): Promise<QueuedRemindersResult> {
  const supabase = await createClient();
  const { clientSearch, dateFrom, dateTo, clientId, statusFilter, offset, limit } = params;

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

  // Fetch clients lookup (to avoid PostgREST FK join cache issues - PGRST200)
  const { data: clients } = await supabase
    .from('clients')
    .select('id, company_name, client_type');
  const clientMap = new Map(
    (clients || []).map((c: { id: string; company_name: string; client_type: string | null }) => [c.id, { company_name: c.company_name, client_type: c.client_type }])
  );

  // Build the query - no embedded joins, fetch base table only
  let query = supabase
    .from('reminder_queue')
    .select('*', { count: 'exact' });

  // Apply filters
  if (clientId) {
    query = query.eq('client_id', clientId);
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

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
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
      // Use schedule name based on filing_type_id (schedules replaced reminder_templates)
      template_name: row.filing_type_id ? (scheduleMap.get(row.filing_type_id) || null) : null,
      send_date: row.send_date,
      deadline_date: row.deadline_date,
      status: row.status,
      subject: row.resolved_subject,
      step_index: row.step_index,
      created_at: row.created_at,
    };
  });

  return {
    data: reminders,
    totalCount: count || 0,
  };
}
