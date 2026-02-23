import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { uploadDocument } from '@/lib/documents/storage';
import { classifyDocument } from '@/lib/documents/classify';
import { calculateRetainUntil } from '@/lib/documents/metadata';
import crypto from 'crypto';
import type { FilingTypeId } from '@/lib/types/database';

// App Router: no body size limit on formData() — reads stream directly
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const supabase = createServiceClient();

  // Validate token
  const { data: portalToken } = await supabase
    .from('upload_portal_tokens')
    .select('id, org_id, client_id, filing_type_id, tax_year, expires_at, revoked_at')
    .eq('token_hash', tokenHash)
    .single();

  if (!portalToken || portalToken.revoked_at || new Date(portalToken.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 403 });
  }

  // Parse multipart form data
  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file || file.size === 0) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  // File type validation: accept PDF, JPEG, PNG, and common office formats
  const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json({ error: 'File type not allowed. Supported: PDF, images, Word, Excel.' }, { status: 400 });
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const classification = await classifyDocument(file.name, file.type, supabase);

  // Derive tax period end from tax_year stored on the token
  const taxYear = portalToken.tax_year ?? String(new Date().getFullYear());
  const taxPeriodEndDate = new Date(`${taxYear}-12-31`); // best-effort; accountant corrects if needed
  const filingTypeId = portalToken.filing_type_id as FilingTypeId;
  const retainUntil = calculateRetainUntil(filingTypeId, taxPeriodEndDate);

  try {
    const { storagePath } = await uploadDocument({
      orgId: portalToken.org_id,
      clientId: portalToken.client_id,
      filingTypeId: portalToken.filing_type_id,
      taxYear,
      file: fileBuffer,
      originalFilename: file.name,
      mimeType: file.type,
    });

    const { data: docRow } = await supabase.from('client_documents').insert({
      org_id: portalToken.org_id,
      client_id: portalToken.client_id,
      filing_type_id: portalToken.filing_type_id,
      document_type_id: classification.documentTypeId,
      storage_path: storagePath,
      original_filename: file.name,
      tax_period_end_date: taxPeriodEndDate.toISOString().split('T')[0],
      retain_until: retainUntil.toISOString().split('T')[0],
      classification_confidence: classification.confidence,
      source: 'portal_upload',
    }).select('id').single();

    // Mark token used_at (non-critical)
    await supabase.from('upload_portal_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', portalToken.id);

    return NextResponse.json({
      success: true,
      documentId: docRow?.id,
      originalFilename: file.name,
      documentTypeCode: classification.documentTypeCode,
      documentTypeLabel: classification.documentTypeCode ?? 'Document',
      confidence: classification.confidence,
    });
  } catch (err) {
    console.error('[Portal Upload] Storage or DB error:', err);
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 });
  }
}
