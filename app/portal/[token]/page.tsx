import type { Metadata } from 'next';
import { createServiceClient } from '@/lib/supabase/service';
import crypto from 'crypto';
import { AlertCircle, Brain } from 'lucide-react';
import { PortalChecklist } from './components/portal-checklist';

export const metadata: Metadata = {
  other: { referrer: 'no-referrer' },
};

export interface ChecklistItem {
  id: string;
  is_ad_hoc?: boolean;
  is_mandatory?: boolean;
  document_type_id?: string | null;
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
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full bg-card rounded-xl shadow-sm border p-8">
          <div className="flex items-start gap-3 p-4 bg-red-500/10 rounded-xl">
            <AlertCircle className="size-5 text-red-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-red-500">
                {isRevoked ? 'This link has been revoked' : 'This link has expired'}
              </p>
              <p className="text-sm text-red-500/80">
                {isRevoked
                  ? 'Your accountant has generated a new link. Please check your email for an updated link.'
                  : 'This upload link is no longer valid. Please contact your accountant to request a new link.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fetch checklist and org/client names server-side
  const [requirementsResult, customisationsResult, clientResult, filingTypeResult] = await Promise.all([
    supabase.from('filing_document_requirements')
      .select('id, document_type_id, is_mandatory, document_types(id, code, label, expected_mime_types)')
      .eq('filing_type_id', portalToken.filing_type_id),
    supabase.from('client_document_checklist_customisations')
      .select('document_type_id, is_enabled, is_ad_hoc, ad_hoc_label')
      .eq('client_id', portalToken.client_id)
      .eq('filing_type_id', portalToken.filing_type_id),
    supabase.from('clients')
      .select('company_name, display_name, organisations(name)')
      .eq('id', portalToken.client_id)
      .single(),
    supabase.from('filing_types')
      .select('name')
      .eq('id', portalToken.filing_type_id)
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
  const filingTypeName = filingTypeResult.data?.name ?? null;

  // Mark token used_at (non-critical, fire-and-forget)
  supabase.from('upload_portal_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', portalToken.id)
    .then(() => {});

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-background">
        <div className="max-w-screen-xl mx-auto px-4">
          <div className="flex items-center h-16">
            <a href="/" className="flex items-center gap-2 shrink-0">
              <Brain className="text-violet-600" size={24} />
              <span className="font-bold text-lg text-foreground">Prompt</span>
            </a>
            <span className="w-px h-4 bg-border mx-3" />
            <span className="font-bold text-lg text-foreground">{orgName}</span>
          </div>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              {filingTypeName ? `${filingTypeName} document upload` : 'Document upload'}
            </h1>
            <div className="px-3 py-2 rounded-md inline-flex items-center bg-green-500/10 shrink-0">
              <span className="text-sm font-medium text-green-600">Secure upload</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Uploading for {clientName}</p>
        </div>
        <PortalChecklist
          checklist={checklist}
          rawToken={token}
          orgName={orgName}
        />
      </main>
    </div>
  );
}
