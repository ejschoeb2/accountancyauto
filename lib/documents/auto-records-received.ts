import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Checks whether all mandatory effective-checklist items for a given client + filing type
 * have been satisfied by uploaded documents with high or medium classification confidence.
 *
 * If all mandatory items are satisfied AND the filing type is not already in the client's
 * records_received_for array, this function appends it and returns true (auto-set fired).
 *
 * Returns false in all other cases:
 *  - No mandatory items in effective checklist
 *  - Not all mandatory items satisfied
 *  - Filing type already present in records_received_for (idempotent — no double-write)
 *
 * IMPORTANT — read-then-write pattern is intentional. The worst case is an idempotent write
 * (same value already present), which is safe. Do NOT use a revoke-then-insert pattern here.
 *
 * IMPORTANT — use the supabase parameter passed in. Do NOT create a new client inside this
 * function. The caller decides whether to use an authenticated or service client.
 *
 * Called from the upload handler response path after a new document is stored. When this
 * function returns true, the caller should surface a toast notification to the accountant
 * that Records Received was auto-set for the filing type.
 */
export async function checkAndAutoSetRecordsReceived(
  supabase: SupabaseClient,
  clientId: string,
  filingTypeId: string,
  orgId: string
): Promise<boolean> {
  // Step 1: Fetch mandatory filing document requirements for this filing type
  const { data: requirements, error: reqError } = await supabase
    .from('filing_document_requirements')
    .select('document_type_id, is_mandatory, document_types(label)')
    .eq('filing_type_id', filingTypeId)
    .eq('is_mandatory', true);

  if (reqError) {
    console.error('[auto-records-received] Failed to fetch requirements:', reqError.message);
    return false;
  }

  if (!requirements || requirements.length === 0) {
    // No mandatory items configured — nothing to satisfy
    return false;
  }

  // Step 2: Fetch per-client checklist customisations for this client + filing type
  const { data: customisations, error: custError } = await supabase
    .from('client_document_checklist_customisations')
    .select('document_type_id, is_enabled')
    .eq('client_id', clientId)
    .eq('filing_type_id', filingTypeId);

  if (custError) {
    console.error('[auto-records-received] Failed to fetch customisations:', custError.message);
    // Proceed with all requirements (no customisations available)
  }

  // Step 3: Build customisation map and determine effective mandatory list
  const customisationMap = new Map<string, boolean>();
  for (const c of customisations ?? []) {
    if (c.document_type_id) {
      customisationMap.set(c.document_type_id, c.is_enabled);
    }
  }

  // Effective mandatory = requirements not explicitly disabled by a customisation
  const mandatoryItems = requirements.filter(
    (req) => customisationMap.get(req.document_type_id) !== false
  );

  // Step 4: If effective mandatory list is empty, nothing to satisfy
  if (mandatoryItems.length === 0) {
    return false;
  }

  // Step 5: Fetch client documents with high or medium confidence for this client + filing type
  const { data: documents, error: docsError } = await supabase
    .from('client_documents')
    .select('document_type_id')
    .eq('client_id', clientId)
    .eq('filing_type_id', filingTypeId)
    .in('classification_confidence', ['high', 'medium']);

  if (docsError) {
    console.error('[auto-records-received] Failed to fetch client documents:', docsError.message);
    return false;
  }

  // Step 6: Build a set of satisfied document_type_id values
  const satisfiedSet = new Set<string>(
    (documents ?? [])
      .map((d) => d.document_type_id)
      .filter((id): id is string => id !== null)
  );

  // Step 6b: Also include manually received items
  const { data: manualRows } = await supabase
    .from('client_document_checklist_customisations')
    .select('document_type_id')
    .eq('client_id', clientId)
    .eq('filing_type_id', filingTypeId)
    .eq('manually_received', true);

  for (const row of manualRows ?? []) {
    if (row.document_type_id) {
      satisfiedSet.add(row.document_type_id);
    }
  }

  // Step 7: Check if all mandatory items are satisfied
  const allSatisfied = mandatoryItems.every((item) =>
    satisfiedSet.has(item.document_type_id)
  );

  if (!allSatisfied) {
    return false;
  }

  // Step 8: Fetch the current records_received_for array for this client
  const { data: clientRow, error: clientError } = await supabase
    .from('clients')
    .select('records_received_for')
    .eq('id', clientId)
    .single();

  if (clientError || !clientRow) {
    console.error('[auto-records-received] Failed to fetch client records_received_for:', clientError?.message);
    return false;
  }

  const currentArray: string[] = clientRow.records_received_for ?? [];

  // Step 9: Idempotency check — already set for this filing type
  if (currentArray.includes(filingTypeId)) {
    return false;
  }

  // Step 10: Append filing type and update client record
  const updatedArray = [...currentArray, filingTypeId];

  const { error: updateError } = await supabase
    .from('clients')
    .update({ records_received_for: updatedArray })
    .eq('id', clientId)
    .eq('org_id', orgId);

  if (updateError) {
    console.error('[auto-records-received] Failed to update records_received_for:', updateError.message);
    return false;
  }

  return true;
}
