import { verifyPostmarkWebhook } from '@/lib/webhooks/postmark-verify';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * Postmark webhook handler for delivery and bounce events
 *
 * Webhook types handled:
 * - Delivery: Email successfully delivered to recipient
 * - Bounce: Email bounced (hard or soft)
 *
 * Security: Verifies HMAC-SHA256 signature before processing
 */
export async function POST(request: Request) {
  // CRITICAL: Read raw body FIRST before any JSON parsing
  // Signature verification MUST happen on raw bytes
  const rawBody = await request.text();

  // Verify webhook signature
  const signature = request.headers.get('x-postmark-signature');

  if (!signature) {
    return Response.json({ error: 'Missing signature' }, { status: 401 });
  }

  const isValid = verifyPostmarkWebhook(
    rawBody,
    signature,
    process.env.POSTMARK_WEBHOOK_SECRET!
  );

  if (!isValid) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // Safe to parse JSON after signature verification
  const event = JSON.parse(rawBody);

  // Use admin client since webhooks have no user session
  const supabase = createAdminClient();

  try {
    switch (event.RecordType) {
      case 'Delivery': {
        // Update email_log with delivered status
        const { error } = await supabase
          .from('email_log')
          .update({
            delivery_status: 'delivered',
            delivered_at: event.DeliveredAt,
          })
          .eq('postmark_message_id', event.MessageID);

        if (error) {
          console.error('Failed to update delivery status:', error);
        }
        break;
      }

      case 'Bounce': {
        // Determine delivery status based on bounce type
        // Hard bounces are permanent failures (5xx SMTP codes)
        // Soft bounces are temporary failures (4xx SMTP codes)
        const isHardBounce = event.Type === 'HardBounce';
        const deliveryStatus = isHardBounce ? 'failed' : 'bounced';

        const { error } = await supabase
          .from('email_log')
          .update({
            delivery_status: deliveryStatus,
            bounce_type: event.Type,
            bounce_description: event.Description,
          })
          .eq('postmark_message_id', event.MessageID);

        if (error) {
          console.error('Failed to update bounce status:', error);
        }
        break;
      }

      default:
        // Log unhandled event types for monitoring
        console.warn(`Unhandled webhook event type: ${event.RecordType}`);
    }

    // Always return 200 to acknowledge receipt
    // Postmark will retry if we return non-200 status
    return Response.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('Error processing webhook:', error);
    // Still return 200 to prevent retries for processing errors
    return Response.json({ received: true }, { status: 200 });
  }
}
