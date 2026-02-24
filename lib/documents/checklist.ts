import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Resolves the effective checklist for a client + filing type combination.
 *
 * Starts from the global filing_document_requirements for the filing type, then
 * applies per-client customisations from client_document_checklist_customisations.
 * Items disabled by the client customisation are excluded; all others are included.
 *
 * @returns Array of checklist items with document type ID, label, and mandatory flag.
 */
export async function resolveEffectiveChecklist(
  supabase: SupabaseClient,
  clientId: string,
  filingTypeId: string
): Promise<Array<{ documentTypeId: string; label: string; is_mandatory: boolean }>> {
  // Fetch global requirements for this filing type with document type labels
  const { data: requirements, error: reqError } = await supabase
    .from('filing_document_requirements')
    .select('document_type_id, is_mandatory, document_types(id, label)')
    .eq('filing_type_id', filingTypeId);

  if (reqError) {
    throw new Error(`Failed to fetch filing document requirements: ${reqError.message}`);
  }

  if (!requirements || requirements.length === 0) {
    return [];
  }

  // Fetch per-client customisations for this client + filing type
  const { data: customisations, error: customError } = await supabase
    .from('client_document_checklist_customisations')
    .select('document_type_id, is_enabled')
    .eq('client_id', clientId)
    .eq('filing_type_id', filingTypeId);

  if (customError) {
    throw new Error(`Failed to fetch checklist customisations: ${customError.message}`);
  }

  // Build customisation map keyed by document_type_id
  const customisationMap = new Map<string, boolean>();
  for (const c of customisations ?? []) {
    customisationMap.set(c.document_type_id, c.is_enabled);
  }

  // Filter and map requirements — keep row if not explicitly disabled by customisation
  return requirements
    .filter((req) => customisationMap.get(req.document_type_id) !== false)
    .map((req) => {
      // PostgREST FK join may return array — normalise to single object
      const docTypes = req.document_types as { label: string } | { label: string }[] | null;
      const label = Array.isArray(docTypes)
        ? (docTypes as { label: string }[])[0]?.label ?? req.document_type_id
        : (docTypes as { label: string } | null)?.label ?? req.document_type_id;

      return {
        documentTypeId: req.document_type_id,
        label,
        is_mandatory: req.is_mandatory,
      };
    });
}

/**
 * Resolves the {{documents_required}} template variable for a client + filing type.
 *
 * Returns an HTML <ul><li>...</li></ul> fragment containing outstanding mandatory
 * documents (those not yet received with high or medium classification confidence).
 * Returns empty string when all mandatory documents are satisfied or there are no
 * mandatory requirements.
 *
 * HTML is safe for injection: labels are seeded from HMRC document type names
 * (not user-controlled input). Rendered via the existing dangerouslySetInnerHTML
 * path in the TipTap email renderer (per CONTEXT.md anti-patterns analysis).
 *
 * @param supabase - Supabase client (admin or authenticated)
 * @param clientId - Client UUID
 * @param filingTypeId - Filing type ID (e.g. 'corporation_tax_payment')
 * @returns HTML string with outstanding mandatory items, or empty string if none
 */
export async function resolveDocumentsRequired(
  supabase: SupabaseClient,
  clientId: string,
  filingTypeId: string
): Promise<string> {
  // Get the effective checklist (global requirements minus client exclusions)
  const checklist = await resolveEffectiveChecklist(supabase, clientId, filingTypeId);

  // Filter to mandatory items only
  const mandatoryItems = checklist.filter((item) => item.is_mandatory);

  if (mandatoryItems.length === 0) {
    return '';
  }

  // Fetch received documents for this client + filing type with acceptable confidence
  const { data: receivedDocs, error: docsError } = await supabase
    .from('client_documents')
    .select('document_type_id')
    .eq('client_id', clientId)
    .eq('filing_type_id', filingTypeId)
    .in('classification_confidence', ['high', 'medium']);

  if (docsError) {
    throw new Error(`Failed to fetch client documents: ${docsError.message}`);
  }

  // Build set of satisfied document type IDs
  const receivedSet = new Set<string>((receivedDocs ?? []).map((d) => d.document_type_id));

  // Determine outstanding mandatory items
  const outstanding = mandatoryItems.filter((item) => !receivedSet.has(item.documentTypeId));

  if (outstanding.length === 0) {
    return '';
  }

  // Build HTML bullet list
  return `<ul>${outstanding.map((item) => `<li>${item.label}</li>`).join('')}</ul>`;
}
