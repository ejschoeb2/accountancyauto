/**
 * Email sender for reminder emails via Postmark
 *
 * Supports both v1.0 (plain text) and v1.1 (rich HTML) email sending
 */

import { render } from '@react-email/render';
import { postmarkClient } from './client';
import ReminderEmail from './templates/reminder';

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
      From: 'Peninsula Accounting <reminders@peninsulaaccounting.co.uk>',
      To: params.to,
      ReplyTo: process.env.ACCOUNTANT_EMAIL || 'info@peninsulaaccounting.co.uk',
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
    // Send via Postmark (no React Email rendering needed - already done)
    const result = await postmarkClient.sendEmail({
      From: 'Peninsula Accounting <reminders@peninsulaaccounting.co.uk>',
      To: params.to,
      ReplyTo: process.env.ACCOUNTANT_EMAIL || 'info@peninsulaaccounting.co.uk',
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
