import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getSignedDownloadUrl, resolveProvider, type StorageBackend } from '@/lib/documents/storage';
import JSZip from 'jszip';

export const maxDuration = 60;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const serviceSupabase = createServiceClient();

  // Fetch all documents for this client (org-scoped via the service call — verify client belongs to org)
  // Use the authenticated supabase for org-scoped query
  const { data: docs, error: docsError } = await supabase
    .from('client_documents')
    .select('id, storage_path, original_filename, filing_type_id, document_type_id, classification_confidence, source, created_at, retain_until, retention_hold, retention_flagged, tax_period_end_date, storage_backend')
    .eq('client_id', clientId)
    .order('created_at', { ascending: true });

  if (docsError) return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  if (!docs || docs.length === 0) return NextResponse.json({ error: 'No documents found for this client' }, { status: 404 });

  // Fetch access log entries for all documents
  const { data: accessLog } = await serviceSupabase
    .from('document_access_log')
    .select('id, document_id, user_id, action, accessed_at')
    .in('document_id', docs.map(d => d.id))
    .order('accessed_at', { ascending: true });

  // Fetch client details for the manifest (include org_id for resolveProvider)
  const { data: clientRow } = await supabase
    .from('clients')
    .select('company_name, display_name, primary_email, org_id')
    .eq('id', clientId)
    .single();

  // Fetch org config once before the document loop — needed for Google Drive/OneDrive/Dropbox documents
  const { data: org } = await supabase
    .from('organisations')
    .select('id, storage_backend, google_drive_folder_id, ms_home_account_id')
    .eq('id', clientRow?.org_id ?? '')
    .single();

  // Phase 29 HRDN-03: Explicit null-guard — if org is null and any document uses a
  // third-party backend, we cannot instantiate the provider. Return 500 early rather than
  // silently assembling an empty or partial ZIP.
  // Per-document routing (doc.storage_backend, not org.storage_backend) is already correct —
  // this guard only fires when the org config itself is unreachable.
  const needsThirdPartyOrg = (docs ?? []).some(
    d => d.storage_backend && d.storage_backend !== 'supabase'
  );
  if (!org && needsThirdPartyOrg) {
    console.error('[DSAR] Cannot resolve org config for third-party documents', {
      clientId,
      orgId: clientRow?.org_id,
    });
    return NextResponse.json(
      { error: 'Storage configuration unavailable for this client' },
      { status: 500 }
    );
  }

  const zip = new JSZip();

  // Add each document to the ZIP
  for (const doc of docs) {
    try {
      let buffer: ArrayBuffer;
      if (!doc.storage_backend || doc.storage_backend === 'supabase') {
        // Supabase (default): existing signed URL fetch
        const { signedUrl } = await getSignedDownloadUrl(doc.storage_path);
        const response = await fetch(signedUrl);
        if (!response.ok) {
          console.warn(`[DSAR] Failed to fetch document ${doc.id}: ${response.status}`);
          continue;
        }
        buffer = await response.arrayBuffer();
      } else {
        // All third-party backends (google_drive, dropbox, onedrive): use resolveProvider().getBytes()
        // This is forward-compatible — any new backend added in the future routes through here automatically.
        // Per-document routing: use doc.storage_backend (NOT org.storage_backend) — D-24-01-02
        const provider = resolveProvider({
          id: org?.id ?? '',
          storage_backend: (doc.storage_backend ?? 'supabase') as StorageBackend,
          google_drive_folder_id: org?.google_drive_folder_id ?? null,
          ms_home_account_id: org?.ms_home_account_id ?? null,
        });
        const bytes = await provider.getBytes(doc.storage_path);
        buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      }
      // Prefix with filing type to avoid filename collisions
      const safeFilename = `${doc.filing_type_id}/${doc.original_filename}`;
      zip.file(safeFilename, buffer);
    } catch (err) {
      console.error(`[DSAR] Error fetching document ${doc.id} (backend: ${doc.storage_backend ?? 'supabase'}):`, err);
      // Continue — add remaining documents; omission is noted in server logs
    }
  }

  // Build manifest (COMP-03: metadata + access log)
  // Note: storage_path is intentionally excluded from manifest — raw storage paths
  // must never be exposed per DOCS-05
  const manifest = {
    generated_at: new Date().toISOString(),
    client: {
      id: clientId,
      name: clientRow?.display_name || clientRow?.company_name || 'Unknown',
      email: clientRow?.primary_email,
    },
    documents: docs.map(d => ({
      id: d.id,
      original_filename: d.original_filename,
      filing_type_id: d.filing_type_id,
      document_type_id: d.document_type_id,
      classification_confidence: d.classification_confidence,
      source: d.source,
      received_at: d.created_at,
      tax_period_end_date: d.tax_period_end_date,
      retain_until: d.retain_until,
      retention_hold: d.retention_hold,
      retention_flagged: d.retention_flagged,
    })),
    access_log: accessLog ?? [],
    _note: 'Generated by Prompt in response to a Data Subject Access Request (UK GDPR Art. 15). Storage paths are omitted from this export.',
  };

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  // Generate ZIP as ArrayBuffer (compatible with Web API Response BodyInit)
  const content = await zip.generateAsync({
    type: 'arraybuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const clientName = (clientRow?.display_name || clientRow?.company_name || clientId)
    .replace(/[^a-zA-Z0-9-_]/g, '_')
    .toLowerCase();

  return new Response(content, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="dsar-${clientName}-${new Date().toISOString().split('T')[0]}.zip"`,
    },
  });
}
