'use server';

import { createClient } from '@/lib/supabase/server';

export interface PortalUpload {
  id: string;
  client_id: string | null;
  client_name: string | null;
  filing_type_id: string | null;
  filing_type_name: string | null;
  document_type_label: string | null;
  original_filename: string;
  received_at: string;
  classification_confidence: string | null;
  extracted_tax_year: string | null;
}

export interface PortalUploadsParams {
  clientSearch?: string;
  dateFrom?: string;
  dateTo?: string;
  offset: number;
  limit: number;
}

export interface PortalUploadsResult {
  data: PortalUpload[];
  totalCount: number;
}

export async function getPortalUploads(params: PortalUploadsParams): Promise<PortalUploadsResult> {
  const supabase = await createClient();
  const { clientSearch, dateFrom, dateTo, offset, limit } = params;

  // Fetch filing types lookup
  const { data: filingTypes } = await supabase
    .from('filing_types')
    .select('id, name');
  const filingTypeMap = new Map(
    (filingTypes || []).map((ft: { id: string; name: string }) => [ft.id, ft.name])
  );

  // Fetch document types lookup separately (avoids PostgREST FK cache issues)
  const { data: documentTypes } = await supabase
    .from('document_types')
    .select('id, label');
  const documentTypeMap = new Map(
    (documentTypes || []).map((dt: { id: string; label: string }) => [dt.id, dt.label])
  );

  // If client search provided, resolve matching client IDs first
  let matchingClientIds: string[] | undefined;
  if (clientSearch) {
    const { data: matchingClients } = await supabase
      .from('clients')
      .select('id')
      .ilike('company_name', `%${clientSearch}%`);
    matchingClientIds = (matchingClients || []).map((c: { id: string }) => c.id);
    if (matchingClientIds.length === 0) {
      return { data: [], totalCount: 0 };
    }
  }

  // Fetch clients lookup for name mapping
  const { data: clients } = await supabase
    .from('clients')
    .select('id, company_name');
  const clientMap = new Map(
    (clients || []).map((c: { id: string; company_name: string }) => [c.id, c.company_name])
  );

  // Build query — portal uploads only
  let query = supabase
    .from('client_documents')
    .select('id, client_id, filing_type_id, document_type_id, original_filename, received_at, classification_confidence, extracted_tax_year', { count: 'exact' })
    .eq('source', 'portal_upload');

  if (matchingClientIds && matchingClientIds.length > 0) {
    query = query.in('client_id', matchingClientIds);
  }

  if (dateFrom) {
    query = query.gte('received_at', dateFrom);
  }
  if (dateTo) {
    const dateToEnd = new Date(dateTo);
    dateToEnd.setDate(dateToEnd.getDate() + 1);
    query = query.lt('received_at', dateToEnd.toISOString().split('T')[0]);
  }

  query = query.order('received_at', { ascending: false });
  query = query.range(offset, offset + limit - 1);

  const { data: uploads, error, count } = await query;

  if (error) {
    console.error('Error fetching portal uploads:', error);
    throw new Error('Failed to fetch portal uploads');
  }

  const mappedData: PortalUpload[] = (uploads || []).map((upload: any) => ({
    id: upload.id,
    client_id: upload.client_id,
    client_name: upload.client_id ? (clientMap.get(upload.client_id) ?? null) : null,
    filing_type_id: upload.filing_type_id,
    filing_type_name: upload.filing_type_id ? (filingTypeMap.get(upload.filing_type_id) ?? null) : null,
    document_type_label: upload.document_type_id ? (documentTypeMap.get(upload.document_type_id) ?? null) : null,
    original_filename: upload.original_filename,
    received_at: upload.received_at,
    classification_confidence: upload.classification_confidence,
    extracted_tax_year: upload.extracted_tax_year,
  }));

  return {
    data: mappedData,
    totalCount: count || 0,
  };
}
