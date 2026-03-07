import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { classifyDocument } from '@/lib/documents/classify';
import { calculateRetainUntil } from '@/lib/documents/metadata';
import type { StorageBackend } from '@/lib/documents/storage';
import type { FilingTypeId } from '@/lib/types/database';
import crypto from 'crypto';

// App Router: force dynamic — reads portal token from URL params
export const dynamic = 'force-dynamic';

interface UploadFinalizeBody {
  storagePath: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  provider: StorageBackend;
  sha256Hash?: string;
  documentTypeId?: string | null;
}

/**
 * POST /api/portal/[token]/upload-finalize
 *
 * Called by the browser after a chunked upload to Google Drive or OneDrive completes.
 * Writes the client_documents row with the provider-assigned file ID / item ID.
 *
 * Body shape:
 *   { storagePath, filename, mimeType, fileSize, provider, sha256Hash? }
 *
 * This endpoint does NOT receive the file bytes — they were uploaded directly from
 * the browser to the provider (Google Drive or OneDrive). The storagePath (Drive file ID
 * or OneDrive item ID) is passed here after the browser completes the chunked upload.
 *
 * Classification runs without a buffer (keyword-only, no OCR) — acceptable for large
 * files since OCR is best-effort and confidence will be 'unclassified' or keyword-based.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const supabase = createServiceClient();

  // ── 1. Validate portal token ─────────────────────────────────────────────────
  const { data: portalToken } = await supabase
    .from('upload_portal_tokens')
    .select('id, org_id, client_id, filing_type_id, tax_year, expires_at, revoked_at')
    .eq('token_hash', tokenHash)
    .single();

  if (
    !portalToken ||
    portalToken.revoked_at ||
    new Date(portalToken.expires_at) < new Date()
  ) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 403 });
  }

  // ── 2. Parse request body ────────────────────────────────────────────────────
  let body: UploadFinalizeBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { storagePath, filename, mimeType, fileSize, provider, sha256Hash, documentTypeId: explicitDocumentTypeId } = body;

  if (!storagePath || !filename || !mimeType || !fileSize || !provider) {
    return NextResponse.json(
      { error: 'storagePath, filename, mimeType, fileSize, and provider are required' },
      { status: 400 }
    );
  }

  // ── 3. Classify document (keyword-only — no buffer for chunked uploads) ───────
  // classifyDocument accepts an optional buffer (Phase 21 backward-compatible design).
  // Passing no buffer gives keyword-only classification — acceptable for large files
  // since OCR is best-effort and the confidence level will reflect this accurately.
  const classification = await classifyDocument(filename, mimeType, supabase);

  // ── 4. Calculate retention fields ───────────────────────────────────────────
  const taxYear = portalToken.tax_year ?? String(new Date().getFullYear());
  const taxPeriodEndDate = new Date(`${taxYear}-12-31`); // best-effort; accountant corrects if needed
  const filingTypeId = portalToken.filing_type_id as FilingTypeId;
  const retainUntil = calculateRetainUntil(filingTypeId, taxPeriodEndDate);

  // ── 5. Insert client_documents row ─────────────────────────────────────────
  try {
    const { data: docRow } = await supabase
      .from('client_documents')
      .insert({
        org_id: portalToken.org_id,
        client_id: portalToken.client_id,
        filing_type_id: portalToken.filing_type_id,
        document_type_id: explicitDocumentTypeId || classification.documentTypeId,
        storage_path: storagePath,
        original_filename: filename,
        tax_period_end_date: taxPeriodEndDate.toISOString().split('T')[0],
        retain_until: retainUntil.toISOString().split('T')[0],
        classification_confidence: classification.confidence,
        source: 'portal_upload',
        // Per-document storage backend (D-24-01-02): set at insert time, not derived from org
        storage_backend: provider,
        // Phase 21 extraction fields — null for large files (no OCR buffer available)
        extracted_tax_year: null,
        extracted_employer: null,
        extracted_paye_ref: null,
        extraction_source: classification.extractionSource,
        // File integrity fields — sha256 computed in browser; size from body; no page count
        file_hash: sha256Hash ?? null,
        file_size_bytes: fileSize,
        page_count: null,
      })
      .select('id')
      .single();

    // ── 6. Mark token used_at (non-critical) ───────────────────────────────────
    await supabase
      .from('upload_portal_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', portalToken.id);

    return NextResponse.json({
      success: true,
      documentId: docRow?.id,
      originalFilename: filename,
      confidence: classification.confidence,
    });
  } catch (err) {
    console.error('[upload-finalize] DB insert error:', err);
    return NextResponse.json(
      { error: 'Failed to record document. Please contact your accountant.' },
      { status: 500 }
    );
  }
}
