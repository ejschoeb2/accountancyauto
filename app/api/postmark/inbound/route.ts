import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { detectDocumentKeywords, detectFilingType } from '@/lib/email/keyword-detector';

/**
 * Postmark Inbound Webhook Handler
 *
 * Receives incoming emails from Postmark and:
 * 1. Matches sender email to client
 * 2. Detects if email contains document submissions
 * 3. Extracts filing type from subject/body
 * 4. Stores in inbound_emails table
 * 5. Auto-updates client status if documents detected
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

    // Step 1: Look up client by email
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, company_name, primary_email')
      .ilike('primary_email', senderEmail)
      .single();

    if (clientError) {
      console.warn('[Postmark Inbound] Client not found for email:', senderEmail);
      // Still store email, but with null client_id for manual review
    }

    // Step 2: Detect if documents are present
    const detection = detectDocumentKeywords(subject, body, hasAttachments);

    // Step 3: Extract filing type from email content
    const detectedFilingType = detectFilingType(subject, body);

    // Step 4: Store in inbound_emails table
    const { data: inboundEmail, error: insertError } = await supabase
      .from('inbound_emails')
      .insert({
        client_id: client?.id || null,
        filing_type_id: detectedFilingType,
        received_at: receivedAt,
        email_from: senderEmail,
        email_subject: subject,
        email_body: body,
        read: false,
        records_received_detected: detection.documentsDetected,
        raw_postmark_data: payload,
      })
      .select()
      .single();

    if (insertError) {
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
