import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getSignedDownloadUrl, resolveProvider } from '@/lib/documents/storage';

// Google Drive downloads may be large PDFs — allow up to 60 seconds on Vercel
export const maxDuration = 60;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Optional server-side filter: ?filing_type_id=<value>
  const url = new URL(request.url);
  const filingTypeId = url.searchParams.get('filing_type_id');

  // List documents for this client — RLS ensures org-scoping
  // Phase 22: SELECT now includes Phase 21 OCR extraction columns
  // Phase 30: SELECT now includes needs_review and validation_warnings columns
  let query = supabase
    .from('client_documents')
    .select(
      'id, filing_type_id, document_type_id, original_filename, received_at, classification_confidence, source, created_at, retention_flagged, document_types(code, label), extracted_tax_year, extracted_employer, extracted_paye_ref, extraction_source, page_count, needs_review, validation_warnings'
    )
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  // Apply optional filing_type_id filter when present
  if (filingTypeId) {
    query = query.eq('filing_type_id', filingTypeId);
  }

  const { data: docs, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ documents: docs ?? [] });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params;
  const body = await request.json();
  const { action } = body as { action: string };

  // Shared auth — both actions require authentication
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // ── Download action ──────────────────────────────────────────────────────
  if (action === 'download') {
    const { documentId } = body as { documentId: string };

    // Fetch document using service client (bypasses RLS) — also verifies client_id matches
    // Phase 25: include storage_backend, mime_type, original_filename for Google Drive branch
    const serviceSupabase = createServiceClient();
    const { data: doc } = await serviceSupabase
      .from('client_documents')
      .select('id, storage_path, org_id, storage_backend, mime_type, original_filename')
      .eq('id', documentId)
      .eq('client_id', clientId)
      .single();

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // ── Google Drive: server-proxied bytes response ────────────────────────
    // drive.file scope cannot produce public or short-lived sharing links.
    // All Google Drive downloads must be proxied through the server.
    if (doc.storage_backend === 'google_drive') {
      // Fetch org storage config (needed to construct the provider)
      const { data: orgData } = await serviceSupabase
        .from('organisations')
        .select('id, storage_backend, google_drive_folder_id, ms_home_account_id')
        .eq('id', doc.org_id)
        .single();

      if (!orgData) {
        return NextResponse.json({ error: 'Org config not found' }, { status: 500 });
      }

      const provider = resolveProvider({
        id: orgData.id,
        storage_backend: orgData.storage_backend,
        google_drive_folder_id: orgData.google_drive_folder_id,
        ms_home_account_id: orgData.ms_home_account_id,
      });

      const bytes = await provider.getBytes(doc.storage_path);

      // Write access log before returning bytes — audit trail requirement
      await serviceSupabase.from('document_access_log').insert({
        org_id: doc.org_id,
        document_id: documentId,
        user_id: user.id,
        action: 'download',
      });

      // Return raw bytes — do NOT return { signedUrl } for Google Drive documents
      // Convert Buffer to Uint8Array: Response BodyInit accepts Uint8Array but not Buffer directly
      return new Response(new Uint8Array(bytes), {
        headers: {
          'Content-Type': doc.mime_type ?? 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${doc.original_filename ?? 'document'}"`,
        },
      });
    }

    // ── OneDrive: pre-authenticated temporary link response ───────────────
    // OneDrive natively provides @microsoft.graph.downloadUrl — a short-lived
    // pre-authenticated link. Return the same { signedUrl } shape for client compatibility.
    if (doc.storage_backend === 'onedrive') {
      const { data: orgData } = await serviceSupabase
        .from('organisations')
        .select('id, storage_backend, ms_home_account_id')
        .eq('id', doc.org_id)
        .single();

      if (!orgData) {
        return NextResponse.json({ error: 'Org config not found' }, { status: 500 });
      }

      const provider = resolveProvider({
        id: orgData.id,
        storage_backend: 'onedrive',
        ms_home_account_id: orgData.ms_home_account_id,
      });

      const { url } = await provider.getDownloadUrl(doc.storage_path);

      await serviceSupabase.from('document_access_log').insert({
        org_id: doc.org_id,
        document_id: documentId,
        user_id: user.id,
        action: 'download',
      });

      return NextResponse.json({ signedUrl: url });
    }

    // ── Dropbox: temporary link response (4-hour TTL) ─────────────────────
    // Unlike Google Drive, Dropbox CAN produce direct download URLs via
    // filesGetTemporaryLink. Return the same { signedUrl } shape for client compatibility.
    if (doc.storage_backend === 'dropbox') {
      // Use per-document storage_backend for routing (D-24-01-02)
      // Org config needed to instantiate the DropboxProvider
      const { data: orgData } = await serviceSupabase
        .from('organisations')
        .select('id, storage_backend')
        .eq('id', doc.org_id)
        .single();

      if (!orgData) {
        return NextResponse.json({ error: 'Org config not found' }, { status: 500 });
      }

      const provider = resolveProvider({
        id: orgData.id,
        storage_backend: 'dropbox', // Always dropbox — routing by doc.storage_backend
      });

      const { url } = await provider.getDownloadUrl(doc.storage_path);

      // Insert access log BEFORE returning URL — audit trail requirement
      await serviceSupabase.from('document_access_log').insert({
        org_id: doc.org_id,
        document_id: documentId,
        user_id: user.id,
        action: 'download',
      });

      // Return same response shape as Supabase signed URL for client-side compatibility
      return NextResponse.json({ signedUrl: url });
    }

    // ── Supabase (default): signed URL response ───────────────────────────
    const { signedUrl } = await getSignedDownloadUrl(doc.storage_path);

    // Insert access log (INSERT-only per DOCS-04 RLS design)
    // document_access_log schema: id, org_id, document_id, user_id, action, session_context, created_at
    await serviceSupabase.from('document_access_log').insert({
      org_id: doc.org_id,
      document_id: documentId,
      user_id: user.id,
      action: 'download',
    });

    return NextResponse.json({ signedUrl });
  }

  // ── Update extraction fields action (Phase 22) ───────────────────────────
  if (action === 'update-extraction') {
    const { documentId, field, value } = body as { documentId: string; field: string; value: string | null };

    // Allowlist: only the three extraction fields may be edited via this action
    const ALLOWED_FIELDS = ['extracted_tax_year', 'extracted_employer', 'extracted_paye_ref'] as const;
    type AllowedField = typeof ALLOWED_FIELDS[number];
    if (!ALLOWED_FIELDS.includes(field as AllowedField)) {
      return NextResponse.json({ error: 'Invalid field' }, { status: 400 });
    }

    // Use session-scoped client (NOT service client) — RLS enforces org ownership
    const { error } = await supabase
      .from('client_documents')
      .update({
        [field as AllowedField]: value?.trim() || null,  // empty string → null
        extraction_source: 'manual',                      // mark as manually corrected
      })
      .eq('id', documentId)
      .eq('client_id', clientId);  // belt-and-braces ownership check

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
