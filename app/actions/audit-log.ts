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

  // Build the query - include reminder_queue left join for deadline_date and step_index
  // Note: Using left join because ad-hoc emails may not have a reminder_queue_id
  let query = supabase
    .from('email_log')
    .select(`
      id,
      sent_at,
      client_id,
      filing_type_id,
      delivery_status,
      recipient_email,
      subject,
      send_type,
      reminder_queue_id,
      clients!inner(company_name, client_type),
      reminder_queue!left(deadline_date, step_index)
    `, { count: 'exact' });

  // Apply filters
  if (clientId) {
    query = query.eq('client_id', clientId);
  }

  if (clientSearch) {
    query = query.ilike('clients.company_name', `%${clientSearch}%`);
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

  // Transform the data to match AuditEntry interface
  const entries: AuditEntry[] = (data || []).map((row: any) => ({
    id: row.id,
    sent_at: row.sent_at,
    client_id: row.client_id,
    client_name: row.clients?.company_name || 'Unknown',
    client_type: row.clients?.client_type || null,
    filing_type_id: row.filing_type_id,
    filing_type_name: row.filing_type_id ? (filingTypeMap.get(row.filing_type_id) || null) : null,
    deadline_date: row.reminder_queue?.deadline_date || null,
    step_index: row.reminder_queue?.step_index ?? null,
    template_name: row.filing_type_id ? (scheduleMap.get(row.filing_type_id) || null) : null,
    delivery_status: row.delivery_status,
    recipient_email: row.recipient_email,
    subject: row.subject,
    send_type: row.send_type || 'scheduled',
  }));

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
  status: 'scheduled' | 'pending' | 'sent' | 'cancelled' | 'failed';
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

  // Build the query
  let query = supabase
    .from('reminder_queue')
    .select(`
      id,
      client_id,
      filing_type_id,
      template_id,
      send_date,
      deadline_date,
      status,
      resolved_subject,
      step_index,
      created_at,
      clients!inner(company_name, client_type)
    `, { count: 'exact' });

  // Apply filters
  if (clientId) {
    query = query.eq('client_id', clientId);
  }

  if (clientSearch) {
    query = query.ilike('clients.company_name', `%${clientSearch}%`);
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

  // Transform the data
  const reminders: QueuedReminder[] = (data || []).map((row: any) => ({
    id: row.id,
    client_id: row.client_id,
    client_name: row.clients?.company_name || 'Unknown',
    client_type: row.clients?.client_type || null,
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
  }));

  return {
    data: reminders,
    totalCount: count || 0,
  };
}
