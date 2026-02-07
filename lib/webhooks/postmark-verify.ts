import crypto from 'crypto';

/**
 * Verify Postmark webhook signature using HMAC-SHA256
 *
 * CRITICAL: Must be called on raw body string (from request.text()),
 * NEVER on re-stringified JSON.
 *
 * @param rawBody - Raw request body as string
 * @param signature - x-postmark-signature header value
 * @param secret - POSTMARK_WEBHOOK_SECRET environment variable
 * @returns true if signature is valid, false otherwise
 */
export function verifyPostmarkWebhook(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  try {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(rawBody);
    const computed = hmac.digest('base64');

    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(computed)
    );
  } catch (error) {
    // timingSafeEqual throws if Buffer lengths don't match
    return false;
  }
}
