import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { detectDocumentKeywords, detectFilingType } from '@/lib/email/keyword-detector';
import type { FilingTypeId } from '@/lib/types/database';
import crypto from 'crypto';

/**
 * Postmark Inbound Webhook Handler
 *
 * Receives incoming emails from Postmark and:
 * 1. Matches sender email to client
 * 2. Detects if email contains document submissions
 * 3. Extracts filing type from subject/body
 * 4. Stores in inbound_emails table
 * 5. Auto-updates client status if documents detected
 * 6. Non-blocking attachment extraction: classifies + stores each attachment
 *    as a client_documents row (PASS-01). Storage failures never affect the 200 response.
 *
 * @see .planning/research/postmark-inbound-webhooks.md
 */

// TypeScript interface for Postmark webhook payload
interface PostmarkInboundWebhook {
  FromName: string;
  From: string;
  FromFull: {
    Email: string;
    Name: string;
    MailboxHash: string;
  };
  To: string;
  ToFull: Array<{
    Email: string;
    Name: string;
    MailboxHash: string;
  }>;
  Cc?: string;
  CcFull?: Array<{
    Email: string;
    Name: string;
    MailboxHash: string;
  }>;
  Bcc?: string;
  BccFull?: Array<{
    Email: string;
    Name: string;
    MailboxHash: string;
  }>;
  OriginalRecipient: string;
  Subject: string;
  MessageID: string;
  MessageStream: string;
  ReplyTo?: string;
  MailboxHash?: string;
  Date: string;
  TextBody: string;
  HtmlBody: string;
  StrippedTextReply?: string;
  Tag?: string;
  Headers: Array<{
    Name: string;
    Value: string;
  }>;
  Attachments: Array<{
    Name: string;
    Content: string;
    ContentType: string;
    ContentLength: number;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    // Verify webhook authentication
    const token = request.nextUrl.searchParams.get('token');
    const expectedToken = process.env.POSTMARK_WEBHOOK_SECRET;

    if (expectedToken && token !== expectedToken) {
      console.error('[Postmark Inbound] Invalid webhook token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse webhook payload
    const payload: PostmarkInboundWebhook = await request.json();

    // Extract key fields
    const senderEmail = payload.From?.toLowerCase().trim();
    const subject = payload.Subject || '';
    const body = payload.TextBody || payload.StrippedTextReply || payload.HtmlBody || '';
    const receivedAt = payload.Date ? new Date(payload.Date) : new Date();
    const hasAttachments = payload.Attachments && payload.Attachments.length > 0;

    // Validate required fields
    if (!senderEmail) {
      console.error('[Postmark Inbound] Missing sender email');
      return NextResponse.json({ error: 'Missing sender email' }, { status: 400 });
    }

    // Create service client (bypasses RLS for webhook)
    const supabase = createServiceClient();

    // Step 1: Look up client by email (include org_id and year_end_date for attachment processing)
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, company_name, primary_email, org_id, year_end_date')
      .ilike('primary_email', senderEmail)
      .single();

    if (clientError) {
      console.warn('[Postmark Inbound] Client not found for email:', senderEmail);
      // Still store email, but with null client_id for manual review
    }

    // Resolve org_id: from matched client, or fall back to founding org
    // Phase 12 will resolve org from the inbound email address / Postmark server
    let orgId = client?.org_id;
    if (!orgId) {
      const { data: foundingOrg } = await supabase
        .from('organisations')
        .select('id')
        .eq('slug', 'prompt')
        .single();
      orgId = foundingOrg?.id;
    }

    // Step 2: Detect if documents are present
    const detection = detectDocumentKeywords(subject, body, hasAttachments);

    // Step 3: Extract filing type from email content
    const detectedFilingType = detectFilingType(subject, body);

    // Step 4: Store in inbound_emails table
    // Phase 29 HRDN-02: include postmark_message_id for idempotency on delivery retries
    const messageId = payload.MessageID || null;

    const { data: inboundEmail, error: insertError } = await supabase
      .from('inbound_emails')
      .insert({
        org_id: orgId,
        client_id: client?.id || null,
        filing_type_id: detectedFilingType,
        received_at: receivedAt,
        email_from: senderEmail,
        email_subject: subject,
        email_body: body,
        read: false,
        records_received_detected: detection.documentsDetected,
        raw_postmark_data: payload,
        postmark_message_id: messageId,
      })
      .select()
      .single();

    if (insertError) {
      // Phase 29 HRDN-02: unique constraint violation = duplicate delivery retry
      // Supabase returns code '23505' for unique_violation
      if (insertError.code === '23505') {
        console.warn('[Postmark Inbound] Duplicate delivery detected (idempotency), skipping:', messageId);
        // Return 200 to Postmark — we already processed this message
        return NextResponse.json({
          success: true,
          message: 'Email already processed (duplicate delivery)',
          duplicate: true,
        });
      }
      console.error('[Postmark Inbound] Failed to insert email:', insertError);
      return NextResponse.json({ error: 'Database insert failed' }, { status: 500 });
    }

    console.log('[Postmark Inbound] Email stored:', {
      id: inboundEmail.id,
      client: client?.company_name || 'Unknown',
      documentsDetected: detection.documentsDetected,
      score: detection.score,
      filingType: detectedFilingType,
    });

    // Step 5: Auto-update client status if documents detected
    if (detection.documentsDetected && client?.id && detectedFilingType) {
      // Import auto-update logic (will be created in task #10)
      try {
        const { autoUpdateRecordsReceived } = await import('@/lib/email/auto-update-records-received');
        await autoUpdateRecordsReceived(client.id, detectedFilingType, supabase);
        console.log('[Postmark Inbound] Auto-updated records_received status for:', client.company_name);
      } catch (autoUpdateError) {
        // Log but don't fail the webhook - auto-update is non-critical
        console.error('[Postmark Inbound] Auto-update failed:', autoUpdateError);
      }
    }

    // Step 6: Non-blocking attachment extraction (PASS-01)
    // Must run AFTER inbound_emails insert. Failures do NOT affect the 200 response.
    if (payload.Attachments && payload.Attachments.length > 0) {
      processAttachments(payload.Attachments, inboundEmail.id, client, orgId, supabase).catch(err =>
        console.error('[Postmark Inbound] Attachment processing error:', err)
      );
    }

    // Always return 200 to Postmark (even for partial failures)
    return NextResponse.json({
      success: true,
      message: 'Email processed',
      id: inboundEmail.id,
      documentsDetected: detection.documentsDetected,
    });

  } catch (error) {
    console.error('[Postmark Inbound] Webhook error:', error);

    // Return 200 even on error to prevent Postmark retries
    // (log error for debugging, but acknowledge receipt)
    return NextResponse.json({
      success: false,
      message: 'Error processing email (logged)',
    });
  }
}

/**
 * Asynchronously extract, classify, and store all attachments from an inbound email.
 *
 * This function is intentionally fire-and-forget (called with .catch() only).
 * It MUST NOT throw — all errors are caught and logged per-attachment so that
 * a single failing attachment does not prevent others from being processed.
 *
 * Phase 25: routes storage through resolveProvider() so Google Drive orgs write to Drive.
 * Fetches org storage config once (before the loop) — not per-attachment.
 * Falls back to Supabase if orgConfig is null (safe default).
 *
 * Each attachment produces one client_documents row with:
 *   - source = 'inbound_email'
 *   - storage_backend = org's current backend at time of upload (D-24-01-02)
 *   - classification_confidence derived from classifyDocument()
 *   - tax_period_end_date derived from client.year_end_date (best-effort; accountant can correct)
 *   - retain_until calculated by calculateRetainUntil()
 *
 * If the client is null (unmatched email), attachments are skipped — we cannot
 * construct a scoped Storage path without a client_id.
 */
async function processAttachments(
  attachments: PostmarkInboundWebhook['Attachments'],
  inboundEmailId: string,
  client: { id: string; org_id: string; company_name?: string | null; year_end_date?: string | null } | null,
  orgId: string | undefined,
  supabase: ReturnType<typeof createServiceClient>
): Promise<void> {
  const { resolveProvider } = await import('@/lib/documents/storage');
  const { classifyDocument } = await import('@/lib/documents/classify');
  const { calculateRetainUntil } = await import('@/lib/documents/metadata');

  // Phase 25: fetch org storage config once before the attachment loop
  // If orgConfig is null, fall back to Supabase (safe default)
  let orgStorageBackend: string | null = 'supabase';
  let orgGoogleDriveFolderId: string | null = null;
  let orgMsHomeAccountId: string | null = null;

  if (orgId) {
    const { data: orgConfig } = await supabase
      .from('organisations')
      .select('id, storage_backend, google_drive_folder_id, ms_home_account_id')
      .eq('id', orgId)
      .single();

    if (orgConfig) {
      orgStorageBackend = orgConfig.storage_backend ?? 'supabase';
      orgGoogleDriveFolderId = orgConfig.google_drive_folder_id ?? null;
      orgMsHomeAccountId = orgConfig.ms_home_account_id ?? null;
    }
  }

  for (const attachment of attachments) {
    try {
      const fileBuffer = Buffer.from(attachment.Content, 'base64');
      const classification = await classifyDocument(attachment.Name, attachment.ContentType, supabase, fileBuffer);

      // Phase 21: skip corrupt/password-protected PDFs — no storage write, no DB row
      if (classification.isCorruptPdf) {
        console.warn('[Postmark Inbound] Corrupt or password-protected attachment skipped:', attachment.Name);
        continue;
      }

      // Phase 21: compute SHA-256 hash for deduplication metadata
      const sha256Hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      // Phase 29 HRDN-02: Size guard — skip oversized attachments rather than failing silently
      const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024; // 25 MB (Postmark inbound limit)
      if (fileBuffer.length > MAX_ATTACHMENT_BYTES) {
        console.warn('[Postmark Inbound] Attachment exceeds size limit, skipping:', {
          filename: attachment.Name,
          sizeBytes: fileBuffer.length,
          maxBytes: MAX_ATTACHMENT_BYTES,
        });
        continue;
      }

      // Phase 29 HRDN-02: Idempotency guard — skip if this exact attachment was already stored
      // Keyed on (client_id, file_hash, source) — if a row exists, this is a Postmark retry
      if (client?.id) {
        const { data: existingDoc } = await supabase
          .from('client_documents')
          .select('id')
          .eq('client_id', client.id)
          .eq('file_hash', sha256Hash)
          .eq('source', 'inbound_email')
          .maybeSingle();

        if (existingDoc) {
          console.warn('[Postmark Inbound] Idempotency: duplicate attachment skipped', {
            filename: attachment.Name,
            existingDocumentId: existingDoc.id,
          });
          continue;
        }
      }

      // Derive tax period end from client year_end_date (best-effort; accountant can correct)
      // Use the most recently completed year end before today
      const now = new Date();
      let taxPeriodEndDate: Date;
      if (client?.year_end_date) {
        const yearEnd = new Date(client.year_end_date);
        // Use this year's year-end if it has passed, otherwise previous year
        taxPeriodEndDate = yearEnd <= now
          ? yearEnd
          : new Date(yearEnd.getFullYear() - 1, yearEnd.getMonth(), yearEnd.getDate());
      } else {
        // Fallback: use previous 5 April (UK tax year end)
        const apr5 = new Date(now.getFullYear(), 3, 5);
        taxPeriodEndDate = apr5 <= now ? apr5 : new Date(now.getFullYear() - 1, 3, 5);
      }

      const taxYear = `${taxPeriodEndDate.getFullYear()}`;
      const filingTypeId = (classification.filingTypeId ?? 'ct600_filing') as FilingTypeId;

      // For unmatched emails (no client), skip storage — cannot scope the path
      if (!client?.id || !orgId) {
        console.warn('[Postmark Inbound] No client match — skipping attachment storage for:', attachment.Name);
        continue;
      }

      // Phase 25: route through resolveProvider for Google Drive/OneDrive/Dropbox support
      const provider = resolveProvider({
        id: orgId,
        storage_backend: (orgStorageBackend ?? 'supabase') as import('@/lib/documents/storage').StorageBackend,
        google_drive_folder_id: orgGoogleDriveFolderId,
        ms_home_account_id: orgMsHomeAccountId,
      });

      const { storagePath } = await provider.upload({
        orgId,
        clientId: client.id,
        filingTypeId,
        taxYear,
        file: fileBuffer,
        originalFilename: attachment.Name,
        mimeType: attachment.ContentType,
        // Phase 25: clientName for Google Drive folder hierarchy
        clientName: client.company_name ?? client.id,
      });

      const retainUntil = calculateRetainUntil(filingTypeId, taxPeriodEndDate);

      await supabase.from('client_documents').insert({
        org_id: orgId,
        client_id: client.id,
        filing_type_id: filingTypeId,
        document_type_id: classification.documentTypeId,
        storage_path: storagePath,
        original_filename: attachment.Name,
        tax_period_end_date: taxPeriodEndDate.toISOString().split('T')[0],
        retain_until: retainUntil.toISOString().split('T')[0],
        classification_confidence: classification.confidence,
        source: 'inbound_email',
        // Phase 25: capture storage backend at insert time (D-24-01-02)
        storage_backend: orgStorageBackend ?? 'supabase',
        // Phase 21 fields
        extracted_tax_year: classification.extractedTaxYear,
        extracted_employer: classification.extractedEmployer,
        extracted_paye_ref: classification.extractedPayeRef,
        extraction_source: classification.extractionSource,
        file_hash: sha256Hash,
        file_size_bytes: fileBuffer.length,
        page_count: null, // integrity checks not run on inbound (no user-facing rejection path)
      });

      console.log('[Postmark Inbound] Attachment stored:', {
        filename: attachment.Name,
        confidence: classification.confidence,
        code: classification.documentTypeCode,
        inboundEmailId,
      });
    } catch (err) {
      console.error('[Postmark Inbound] Failed to process attachment:', attachment.Name, {
        backend: orgStorageBackend,
        error: err instanceof Error ? err.message : String(err),
      });
      // Continue to next attachment — never throw from this loop
    }
  }
}

// Allow GET requests for webhook verification
export async function GET(request: NextRequest) {
  // Verify webhook authentication for GET requests too
  const token = request.nextUrl.searchParams.get('token');
  const expectedToken = process.env.POSTMARK_WEBHOOK_SECRET;

  if (expectedToken && token !== expectedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    message: 'Postmark inbound webhook endpoint',
    status: 'ready'
  });
}
