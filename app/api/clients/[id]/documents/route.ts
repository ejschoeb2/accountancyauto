import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getSignedDownloadUrl } from '@/lib/documents/storage';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // List all documents for this client, grouped fetch — RLS ensures org-scoping
  const { data: docs, error } = await supabase
    .from('client_documents')
    .select(
      'id, filing_type_id, document_type_id, original_filename, received_at, classification_confidence, source, created_at, retention_flagged, document_types(code, label)'
    )
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ documents: docs ?? [] });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params;
  const body = await request.json();
  const { action, documentId } = body as { action: string; documentId: string };

  if (action !== 'download') {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Fetch document using service client (bypasses RLS) — also verifies client_id matches
  const serviceSupabase = createServiceClient();
  const { data: doc } = await serviceSupabase
    .from('client_documents')
    .select('id, storage_path, org_id')
    .eq('id', documentId)
    .eq('client_id', clientId)
    .single();

  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

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
