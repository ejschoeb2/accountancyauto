/**
 * Email sender for reminder emails via Postmark
 *
 * Renders React Email template and sends via Postmark SDK
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

interface SendReminderEmailResult {
  messageId: string;
  submittedAt: string;
  to: string;
}

/**
 * Send a reminder email to a client
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
