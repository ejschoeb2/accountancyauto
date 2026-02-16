'use server';

import { createClient } from '@/lib/supabase/server';
import { autoUpdateRecordsReceived } from '@/lib/email/auto-update-records-received';
import { revalidatePath } from 'next/cache';

export interface InboundEmail {
  id: string;
  client_id: string | null;
  client_name: string | null;
  client_type: string | null;
  filing_type_id: string | null;
  filing_type_name: string | null;
  received_at: string;
  email_from: string;
  email_subject: string | null;
  email_body: string | null;
  read: boolean;
  records_received_detected: boolean;
}

export interface InboundEmailParams {
  clientSearch?: string;
  dateFrom?: string;
  dateTo?: string;
  offset: number;
  limit: number;
}

export interface InboundEmailResult {
  data: InboundEmail[];
  totalCount: number;
}

export async function getInboundEmails(params: InboundEmailParams): Promise<InboundEmailResult> {
  const supabase = await createClient();
  const { clientSearch, dateFrom, dateTo, offset, limit } = params;

  // Fetch filing types lookup (small reference table)
  const { data: filingTypes } = await supabase
    .from('filing_types')
    .select('id, name');
  const filingTypeMap = new Map(
    (filingTypes || []).map((ft: { id: string; name: string }) => [ft.id, ft.name])
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

  // Fetch clients lookup
  const { data: clients } = await supabase
    .from('clients')
    .select('id, company_name, client_type');
  const clientMap = new Map(
    (clients || []).map((c: { id: string; company_name: string; client_type: string | null }) => [
      c.id,
      { company_name: c.company_name, client_type: c.client_type },
    ])
  );

  // Build the query
  let query = supabase
    .from('inbound_emails')
    .select('*', { count: 'exact' });

  // Apply client search filter by client IDs
  if (matchingClientIds && matchingClientIds.length > 0) {
    query = query.in('client_id', matchingClientIds);
  }

  // Apply date range filter
  if (dateFrom) {
    query = query.gte('received_at', dateFrom);
  }
  if (dateTo) {
    // Add 1 day to include the entire day
    const dateToEnd = new Date(dateTo);
    dateToEnd.setDate(dateToEnd.getDate() + 1);
    query = query.lt('received_at', dateToEnd.toISOString().split('T')[0]);
  }

  // Sort by received_at descending (most recent first)
  query = query.order('received_at', { ascending: false });

  // Apply pagination
  query = query.range(offset, offset + limit - 1);

  const { data: inboundEmails, error, count } = await query;

  if (error) {
    console.error('Error fetching inbound emails:', error);
    throw new Error('Failed to fetch inbound emails');
  }

  // Map the data to include client and filing type names
  const mappedData: InboundEmail[] = (inboundEmails || []).map((email: any) => {
    const client = email.client_id ? clientMap.get(email.client_id) : null;
    const filingTypeName = email.filing_type_id ? filingTypeMap.get(email.filing_type_id) : null;

    return {
      id: email.id,
      client_id: email.client_id,
      client_name: client?.company_name || null,
      client_type: client?.client_type || null,
      filing_type_id: email.filing_type_id,
      filing_type_name: filingTypeName || null,
      received_at: email.received_at,
      email_from: email.email_from,
      email_subject: email.email_subject,
      email_body: email.email_body,
      read: email.read,
      records_received_detected: email.records_received_detected,
    };
  });

  return {
    data: mappedData,
    totalCount: count || 0,
  };
}

/**
 * Mark an inbound email as read
 */
export async function markInboundEmailAsRead(emailId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('inbound_emails')
      .update({ read: true })
      .eq('id', emailId);

    if (error) {
      console.error('Error marking email as read:', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/email-logs');
    return { success: true };
  } catch (error) {
    console.error('Unexpected error marking email as read:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Manually update records received status for a client filing type
 * (Used in "recommend" mode when accountant approves the detection)
 */
export async function updateRecordsReceivedManual(
  emailId: string,
  clientId: string,
  filingTypeId: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const supabase = await createClient();

    // Use the same auto-update logic that the webhook uses
    const result = await autoUpdateRecordsReceived(clientId, filingTypeId, supabase);

    if (!result.success) {
      return { success: false, error: result.message };
    }

    // Mark the email as processed/approved
    await supabase
      .from('inbound_emails')
      .update({ read: true })
      .eq('id', emailId);

    revalidatePath('/email-logs');
    revalidatePath(`/clients/${clientId}`);

    return { success: true, message: result.message };
  } catch (error) {
    console.error('Unexpected error updating records received:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
