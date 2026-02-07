'use server';

import { createClient } from '@/lib/supabase/server';

export interface AuditEntry {
  id: string;
  sent_at: string;
  client_id: string;
  client_name: string;
  filing_type_id: string | null;
  filing_type_name: string | null;
  delivery_status: 'sent' | 'delivered' | 'bounced' | 'failed';
  recipient_email: string;
  subject: string;
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

  // Build the query (avoid FK join on filing_types due to PostgREST schema cache issue)
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
      clients!inner(company_name)
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
    filing_type_id: row.filing_type_id,
    filing_type_name: row.filing_type_id ? (filingTypeMap.get(row.filing_type_id) || null) : null,
    delivery_status: row.delivery_status,
    recipient_email: row.recipient_email,
    subject: row.subject,
  }));

  return {
    data: entries,
    totalCount: count || 0,
  };
}
