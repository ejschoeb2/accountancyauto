import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import crypto from 'crypto';

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const supabase = createServiceClient();

  const { data: portalToken, error } = await supabase
    .from('upload_portal_tokens')
    .select('id, org_id, client_id, filing_type_id, tax_year, expires_at, revoked_at, used_at')
    .eq('token_hash', tokenHash)
    .single();

  if (error || !portalToken) return NextResponse.json({ error: 'Token not found' }, { status: 404 });
  if (portalToken.revoked_at) return NextResponse.json({ error: 'Token revoked', status: 'revoked' }, { status: 403 });
  if (new Date(portalToken.expires_at) < new Date()) return NextResponse.json({ error: 'Token expired', status: 'expired' }, { status: 403 });

  // Fetch checklist: merge filing_document_requirements with customisations
  const { data: requirements } = await supabase
    .from('filing_document_requirements')
    .select('id, document_type_id, is_mandatory, document_types(id, code, label, client_description, expected_mime_types)')
    .eq('filing_type_id', portalToken.filing_type_id);

  const { data: customisations } = await supabase
    .from('client_document_checklist_customisations')
    .select('document_type_id, is_enabled, is_ad_hoc, ad_hoc_label')
    .eq('client_id', portalToken.client_id)
    .eq('filing_type_id', portalToken.filing_type_id);

  const disabledTypeIds = new Set(customisations?.filter(c => !c.is_enabled).map(c => c.document_type_id) ?? []);
  const adHocItems = customisations?.filter(c => c.is_ad_hoc) ?? [];

  const checklist = [
    ...(requirements?.filter(r => !disabledTypeIds.has(r.document_type_id)) ?? []),
    ...adHocItems.map(a => ({ id: a.document_type_id ?? `adhoc-${a.ad_hoc_label}`, is_ad_hoc: true, ad_hoc_label: a.ad_hoc_label, document_types: { label: a.ad_hoc_label } })),
  ];

  // Fetch already-uploaded documents for this token's scope to show progress
  const { data: existingDocs } = await supabase
    .from('client_documents')
    .select('id, document_type_id, original_filename, created_at')
    .eq('client_id', portalToken.client_id)
    .eq('filing_type_id', portalToken.filing_type_id)
    .eq('source', 'portal_upload');

  // Fetch org/client name for portal branding
  const { data: clientRow } = await supabase
    .from('clients')
    .select('company_name, display_name, organisations(name)')
    .eq('id', portalToken.client_id)
    .single();

  return NextResponse.json({
    portalToken: { ...portalToken, token_hash: undefined },
    checklist,
    existingDocs: existingDocs ?? [],
    orgName: (clientRow?.organisations as { name?: string } | null)?.name ?? 'Your accountant',
    clientName: clientRow?.display_name || clientRow?.company_name || 'Client',
  });
}
