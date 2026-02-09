/**
 * Email sender for reminder emails via Postmark
 *
 * Supports both v1.0 (plain text) and v1.1 (rich HTML) email sending
 */

import { render } from '@react-email/render';
import { postmarkClient } from './client';
import ReminderEmail from './templates/reminder';
import { getEmailSettings, type EmailSettings } from '@/app/actions/settings';

// Module-level cache for email settings (avoids repeated DB queries in batch sends)
let cachedSettings: { data: EmailSettings; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 60_000; // 1 minute

async function getEmailFrom(): Promise<{ from: string; replyTo: string }> {
  const now = Date.now();
  if (!cachedSettings || now - cachedSettings.fetchedAt > CACHE_TTL_MS) {
    cachedSettings = { data: await getEmailSettings(), fetchedAt: now };
  }
  const s = cachedSettings.data;
  return {
    from: `${s.senderName} <${s.senderAddress}>`,
    replyTo: s.replyTo,
  };
}

interface SendReminderEmailParams {
  to: string;
  subject: string;
  body: string;
  clientName: string;
  filingType: string;
}

interface SendRichEmailParams {
  to: string;
  subject: string;
  html: string;  // Pre-rendered HTML from renderTipTapEmail
  text: string;  // Plain text fallback from renderTipTapEmail
}

interface SendReminderEmailResult {
  messageId: string;
  submittedAt: string;
  to: string;
}

/**
 * Send a reminder email to a client (v1.0 - plain text)
 *
 * IMPORTANT: This function is used by the existing cron queue.
 * DO NOT modify - it must remain backwards compatible until Phase 9.
 *
 * @param params - Email parameters
 * @returns Postmark message details
 * @throws Error if email send fails
 */
export async function sendReminderEmail(
  params: SendReminderEmailParams
): Promise<SendReminderEmailResult> {
  try {
    const emailFrom = await getEmailFrom();

    // Render React Email template to HTML string
    const htmlBody = await render(
      ReminderEmail({
        clientName: params.clientName,
        subject: params.subject,
        body: params.body,
        filingType: params.filingType,
      })
    );

    // Send via Postmark
    const result = await postmarkClient.sendEmail({
      From: emailFrom.from,
      To: params.to,
      ReplyTo: emailFrom.replyTo,
      Subject: params.subject,
      HtmlBody: htmlBody,
      TextBody: params.body, // Plain text fallback
      MessageStream: 'outbound',
      TrackOpens: false,
      TrackLinks: 'None' as any,
    });

    return {
      messageId: result.MessageID,
      submittedAt: result.SubmittedAt,
      to: result.To || params.to,
    };
  } catch (error) {
    console.error('Failed to send reminder email:', error);
    throw new Error(
      `Failed to send reminder email to ${params.to}: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

/**
 * Send a rich HTML email to a client (v1.1 - TipTap rendered)
 *
 * Accepts pre-rendered HTML and text from renderTipTapEmail().
 * No additional rendering needed - content is already inline-styled.
 *
 * @param params - Pre-rendered email content
 * @returns Postmark message details
 * @throws Error if email send fails
 */
export async function sendRichEmail(
  params: SendRichEmailParams
): Promise<SendReminderEmailResult> {
  try {
    const emailFrom = await getEmailFrom();

    // Send via Postmark (no React Email rendering needed - already done)
    const result = await postmarkClient.sendEmail({
      From: emailFrom.from,
      To: params.to,
      ReplyTo: emailFrom.replyTo,
      Subject: params.subject,
      HtmlBody: params.html,
      TextBody: params.text,
      MessageStream: 'outbound',
      TrackOpens: false,
      TrackLinks: 'None' as any,
    });

    return {
      messageId: result.MessageID,
      submittedAt: result.SubmittedAt,
      to: result.To || params.to,
    };
  } catch (error) {
    console.error('Failed to send rich email:', error);
    throw new Error(
      `Failed to send rich email to ${params.to}: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}
