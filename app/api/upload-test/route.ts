import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { classifyDocument } from '@/lib/documents/classify';
import { runValidation, REJECTABLE_WARNING_CODES, type ValidationResult } from '@/lib/documents/validate';
import { extractPdfText } from '@/lib/documents/ocr';
import crypto from 'crypto';

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

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const MAX_PAGE_COUNT = 50;

export async function POST(request: NextRequest) {
  // Auth — admin only
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId: string | null = user.app_metadata?.org_id ?? null;
  if (!orgId) return NextResponse.json({ error: 'No organisation found' }, { status: 400 });

  // Check admin role
  const serviceClient = createServiceClient();
  const { data: membership } = await serviceClient
    .from('user_organisations')
    .select('role')
    .eq('user_id', user.id)
    .eq('org_id', orgId)
    .single();

  if (membership?.role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can use the upload test' }, { status: 403 });
  }

  // Get org upload check settings
  const { data: org } = await serviceClient
    .from('organisations')
    .select('upload_check_mode, reject_mismatched_uploads')
    .eq('id', orgId)
    .single();
  const uploadCheckMode = org?.upload_check_mode ?? 'both';
  const rejectMismatchedUploads = org?.reject_mismatched_uploads ?? false;

  // Parse form data
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const portalTaxYear = (formData.get('taxYear') as string) || String(new Date().getFullYear());

  if (!file || file.size === 0) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json({
      error: 'File type not allowed. Supported: PDF, images, Word, Excel, CSV.',
    }, { status: 400 });
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer());

  // Integrity checks (inline — no DB duplicate check since this is a test)
  const fileSizeBytes = fileBuffer.length;
  const sha256Hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

  if (fileSizeBytes > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: 'File exceeds 20MB limit' }, { status: 400 });
  }

  let pageCount: number | null = null;
  if (file.type === 'application/pdf') {
    try {
      const ocr = await extractPdfText(fileBuffer);
      pageCount = ocr.numpages;
      if (pageCount > MAX_PAGE_COUNT) {
        return NextResponse.json({ error: 'Document exceeds 50 page limit' }, { status: 400 });
      }
    } catch {
      pageCount = null;
    }
  }

  // Classification
  const shouldOcr = uploadCheckMode !== 'none';
  const shouldValidate = uploadCheckMode === 'verify' || uploadCheckMode === 'both';
  const showExtraction = uploadCheckMode === 'extract' || uploadCheckMode === 'both';

  const classification = await classifyDocument(
    file.name,
    file.type,
    serviceClient,
    shouldOcr ? fileBuffer : undefined,
  );

  // Validation
  const validation: ValidationResult = shouldValidate
    ? await runValidation(
        classification.documentTypeCode,
        file.type,
        fileBuffer,
        portalTaxYear,
        classification.extractedTaxYear,
        'self_assessment', // default filing type for test
      )
    : { warnings: [] };

  // Fetch the document type label if we got a match
  let documentTypeLabel: string | null = null;
  if (classification.documentTypeId) {
    const { data: docType } = await serviceClient
      .from('document_types')
      .select('label')
      .eq('id', classification.documentTypeId)
      .single();
    documentTypeLabel = docType?.label ?? classification.documentTypeCode;
  }

  // Determine if this upload would be rejected by the reject_mismatched_uploads setting
  const rejectableWarning = validation.warnings.find(w => REJECTABLE_WARNING_CODES.has(w.code));
  const wouldReject = rejectMismatchedUploads && !!rejectableWarning;
  // Also flag when the warning exists but the setting is off — so the sandbox can show
  // "Would reject if enabled" vs "Would not reject"
  const hasRejectableWarning = !!rejectableWarning;

  return NextResponse.json({
    originalFilename: file.name,
    mimeType: file.type,
    fileSizeBytes,
    pageCount,
    sha256Hash,
    documentTypeCode: classification.documentTypeCode,
    documentTypeLabel,
    confidence: classification.confidence,
    extractedTaxYear: showExtraction ? classification.extractedTaxYear : null,
    extractedEmployer: showExtraction ? classification.extractedEmployer : null,
    extractedPayeRef: showExtraction ? classification.extractedPayeRef : null,
    extractionSource: classification.extractionSource,
    isImageOnly: classification.isImageOnly,
    isCorruptPdf: classification.isCorruptPdf,
    needsReview: validation.warnings.length > 0,
    validationWarnings: validation.warnings,
    wouldReject,
    hasRejectableWarning,
    rejectMismatchedEnabled: rejectMismatchedUploads,
  });
}
