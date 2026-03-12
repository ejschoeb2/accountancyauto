import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getOrgId } from '@/lib/auth/org-context';
import { resolveProvider, type StorageBackend } from '@/lib/documents/storage';
import { classifyDocument } from '@/lib/documents/classify';
import { runIntegrityChecks } from '@/lib/documents/integrity';
import { calculateRetainUntil } from '@/lib/documents/metadata';
import type { FilingTypeId } from '@/lib/types/database';

// Google Drive downloads may be large — allow up to 60 seconds on Vercel
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const ALLOWED_MIME = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/tiff',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: clientId } = await params;

  // ── Auth ────────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let orgId: string;
  try {
    orgId = await getOrgId();
  } catch {
    return NextResponse.json({ error: 'No organisation found' }, { status: 400 });
  }

  // ── Parse form data ─────────────────────────────────────────────────────────
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const filingTypeId = formData.get('filingTypeId') as string | null;
  const taxYear = (formData.get('taxYear') as string | null) ?? String(new Date().getFullYear());
  // When uploading to a specific checklist slot the type is known — overrides classification
  const explicitDocumentTypeId = formData.get('documentTypeId') as string | null;

  if (!file || file.size === 0) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }
  if (!filingTypeId) {
    return NextResponse.json({ error: 'Filing type required' }, { status: 400 });
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json(
      { error: 'File type not allowed. Supported: PDF, images, Word, Excel, CSV.' },
      { status: 400 },
    );
  }

  const serviceSupabase = createServiceClient();

  // ── Verify client belongs to this org ───────────────────────────────────────
  const { data: clientData } = await serviceSupabase
    .from('clients')
    .select('id, company_name, display_name')
    .eq('id', clientId)
    .eq('org_id', orgId)
    .single();

  if (!clientData) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  // ── Fetch org storage config ─────────────────────────────────────────────────
  const { data: orgData } = await serviceSupabase
    .from('organisations')
    .select('storage_backend, google_drive_folder_id, ms_home_account_id, upload_check_mode')
    .eq('id', orgId)
    .single();

  if (!orgData) {
    return NextResponse.json({ error: 'Organisation config not found' }, { status: 500 });
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer());

  // ── Integrity checks (size, duplicate detection, page count) ─────────────────
  const integrity = await runIntegrityChecks(fileBuffer, file.type, clientId, serviceSupabase, {
    skipDuplicate: false,
  });

  if (!integrity.passed) {
    const status = integrity.isDuplicate ? 409 : 400;
    return NextResponse.json({ error: integrity.rejectionReason }, { status });
  }

  // ── Classification ───────────────────────────────────────────────────────────
  // Accountant uploads: run extraction for metadata but skip verification —
  // the accountant is manually placing the file so validation adds no value.
  // Checks run on the portal (client) side where uploads are unsupervised.
  const uploadCheckMode = orgData.upload_check_mode ?? 'both';
  const shouldOcr = uploadCheckMode !== 'none';

  const classification = await classifyDocument(
    file.name,
    file.type,
    serviceSupabase,
    shouldOcr ? fileBuffer : undefined,
  );

  if (shouldOcr && classification.isCorruptPdf) {
    return NextResponse.json(
      { error: 'This file appears to be protected or damaged. Please upload an unprotected copy.' },
      { status: 400 },
    );
  }

  // ── Retention ────────────────────────────────────────────────────────────────
  const taxPeriodEndDate = new Date(`${taxYear}-12-31`);
  const effectiveFilingTypeId = filingTypeId as FilingTypeId;
  const retainUntil = calculateRetainUntil(effectiveFilingTypeId, taxPeriodEndDate);

  // ── Upload to storage ────────────────────────────────────────────────────────
  try {
    const provider = resolveProvider({
      id: orgId,
      storage_backend: (orgData.storage_backend ?? 'supabase') as StorageBackend,
      google_drive_folder_id: orgData.google_drive_folder_id,
      ms_home_account_id: orgData.ms_home_account_id,
    });

    const { storagePath } = await provider.upload({
      orgId,
      clientId,
      filingTypeId,
      taxYear,
      file: fileBuffer,
      originalFilename: file.name,
      mimeType: file.type,
      clientName: clientData.display_name ?? clientData.company_name ?? clientId,
    });

    // ── Insert DB row ──────────────────────────────────────────────────────────
    const { data: docRow } = await serviceSupabase
      .from('client_documents')
      .insert({
        org_id: orgId,
        client_id: clientId,
        filing_type_id: filingTypeId,
        document_type_id: explicitDocumentTypeId ?? classification.documentTypeId,
        storage_path: storagePath,
        original_filename: file.name,
        mime_type: file.type,
        tax_period_end_date: taxPeriodEndDate.toISOString().split('T')[0],
        retain_until: retainUntil.toISOString().split('T')[0],
        // If uploading to a specific slot the accountant knows the type — treat as high confidence
        classification_confidence: explicitDocumentTypeId ? 'high' : classification.confidence,
        source: 'manual',
        storage_backend: orgData.storage_backend ?? 'supabase',
        extracted_tax_year: classification.extractedTaxYear,
        extracted_employer: classification.extractedEmployer,
        extracted_paye_ref: classification.extractedPayeRef,
        extraction_source: classification.extractionSource,
        file_hash: integrity.sha256Hash,
        file_size_bytes: integrity.fileSizeBytes,
        page_count: integrity.pageCount,
        needs_review: false,
        validation_warnings: null,
      })
      .select('id')
      .single();

    // ── Audit log ──────────────────────────────────────────────────────────────
    await serviceSupabase.from('document_access_log').insert({
      org_id: orgId,
      document_id: docRow?.id,
      user_id: user.id,
      action: 'upload',
    });

    // ── Fetch document type label for response ─────────────────────────────────
    let documentTypeLabel: string | null = null;
    if (classification.documentTypeId) {
      const { data: dtRow } = await serviceSupabase
        .from('document_types')
        .select('label')
        .eq('id', classification.documentTypeId)
        .single();
      documentTypeLabel = dtRow?.label ?? null;
    }

    return NextResponse.json({
      success: true,
      documentId: docRow?.id,
      originalFilename: file.name,
      documentTypeCode: classification.documentTypeCode,
      documentTypeLabel,
      confidence: classification.confidence,
    });
  } catch (err) {
    console.error('[Accountant Upload] Storage or DB error:', err);
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 });
  }
}
