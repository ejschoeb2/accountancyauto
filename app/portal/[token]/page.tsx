import type { Metadata } from 'next';
import { createServiceClient } from '@/lib/supabase/service';
import crypto from 'crypto';
import { PortalChecklist } from './components/portal-checklist';

export const metadata: Metadata = {
  other: { referrer: 'no-referrer' },
};

export interface ChecklistItem {
  id: string;
  is_ad_hoc?: boolean;
  is_mandatory?: boolean;
  document_type_id?: string | null;
  condition_description?: string | null;
  document_types?: {
    id?: string | null;
    code?: string | null;
    label: string;
    expected_mime_types?: string[] | null;
  };
}

export default async function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const supabase = createServiceClient();

  const { data: portalToken } = await supabase
    .from('upload_portal_tokens')
    .select('id, org_id, client_id, filing_type_id, tax_year, expires_at, revoked_at')
    .eq('token_hash', tokenHash)
    .single();

  const isExpired = !portalToken || new Date(portalToken.expires_at) < new Date();
  const isRevoked = portalToken?.revoked_at != null;

  if (isExpired || isRevoked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            {isRevoked ? 'This link has been revoked' : 'This link has expired'}
          </h1>
          <p className="text-gray-600 text-sm">
            {isRevoked
              ? 'Your accountant has generated a new link. Please check your email for an updated link.'
              : 'This upload link is no longer valid. Please contact your accountant to request a new link.'}
          </p>
        </div>
      </div>
    );
  }

  // Fetch checklist and org/client names server-side
  const [requirementsResult, customisationsResult, clientResult] = await Promise.all([
    supabase.from('filing_document_requirements')
      .select('id, document_type_id, is_mandatory, condition_description, document_types(id, code, label, expected_mime_types)')
      .eq('filing_type_id', portalToken.filing_type_id),
    supabase.from('client_document_checklist_customisations')
      .select('document_type_id, is_enabled, is_ad_hoc, ad_hoc_label')
      .eq('client_id', portalToken.client_id)
      .eq('filing_type_id', portalToken.filing_type_id),
    supabase.from('clients')
      .select('company_name, display_name, organisations(name)')
      .eq('id', portalToken.client_id)
      .single(),
  ]);

  const disabledTypeIds = new Set(
    customisationsResult.data?.filter(c => !c.is_enabled).map(c => c.document_type_id) ?? []
  );
  const adHocItems = customisationsResult.data?.filter(c => c.is_ad_hoc) ?? [];

  // PostgREST returns document_types as an array on FK joins; normalise to single object
  const normaliseRequirements = (data: typeof requirementsResult.data) =>
    (data ?? []).map(r => ({
      ...r,
      document_types: Array.isArray(r.document_types)
        ? (r.document_types[0] ?? { id: null, code: null, label: '', expected_mime_types: [] })
        : r.document_types,
    }));

  const checklist: ChecklistItem[] = [
    ...(normaliseRequirements(requirementsResult.data).filter(r => !disabledTypeIds.has(r.document_type_id)) as ChecklistItem[]),
    ...adHocItems.map(a => ({
      id: `adhoc-${a.ad_hoc_label}`,
      is_ad_hoc: true,
      is_mandatory: false,
      document_type_id: null,
      document_types: { id: null, code: null, label: a.ad_hoc_label ?? '', expected_mime_types: [] },
    })),
  ];

  const orgName = (clientResult.data?.organisations as { name?: string } | null)?.name ?? 'Your accountant';
  const clientName = clientResult.data?.display_name || clientResult.data?.company_name || 'Client';

  // Mark token used_at (non-critical, fire-and-forget)
  supabase.from('upload_portal_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', portalToken.id)
    .then(() => {});

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <p className="text-sm text-gray-500">{orgName} has requested documents from you</p>
          <h1 className="text-xl font-semibold text-gray-900 mt-1">
            Upload documents for {clientName}
          </h1>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-8">
        <PortalChecklist
          checklist={checklist}
          rawToken={token}
          orgName={orgName}
        />
      </main>
    </div>
  );
}
