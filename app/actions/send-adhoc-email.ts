'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { renderTipTapEmail } from '@/lib/email/render-tiptap';
import { sendRichEmail } from '@/lib/email/sender';

const SendAdhocEmailParamsSchema = z.object({
  clientId: z.string().uuid(),
  clientName: z.string().min(1),
  clientEmail: z.string().email(),
  templateId: z.string().uuid(),
});

interface SendAdhocEmailParams {
  clientId: string;
  clientName: string;
  clientEmail: string;
  templateId: string;
}

interface SendAdhocEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send an ad-hoc email to a client using a template
 *
 * Renders the template with placeholder values, sends via Postmark,
 * and logs to email_log with send_type='ad-hoc'.
 *
 * @param params - Client and template information
 * @returns Success result with message ID or error message
 */
export async function sendAdhocEmail(
  params: SendAdhocEmailParams
): Promise<SendAdhocEmailResult> {
  try {
    // Validate input
    const validated = SendAdhocEmailParamsSchema.parse(params);

    const supabase = await createClient();

    // Fetch the email template
    const { data: template, error: templateError } = await supabase
      .from('email_templates')
      .select('id, subject, body_json')
      .eq('id', validated.templateId)
      .single();

    if (templateError || !template) {
      return {
        success: false,
        error: `Template not found: ${templateError?.message || 'Unknown error'}`,
      };
    }

    // Render the template
    // Ad-hoc sends don't have a filing type or deadline, so use defaults
    const rendered = await renderTipTapEmail({
      bodyJson: template.body_json,
      subject: template.subject,
      context: {
        client_name: validated.clientName,
        filing_type: 'Ad-hoc',
        deadline: new Date(),
        accountant_name: 'Peninsula Accounting',
      },
    });

    // Send via Postmark
    const sendResult = await sendRichEmail({
      to: validated.clientEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });

    // Log to email_log
    const { error: logError } = await supabase
      .from('email_log')
      .insert({
        client_id: validated.clientId,
        recipient_email: validated.clientEmail,
        subject: rendered.subject,
        delivery_status: 'sent',
        send_type: 'ad-hoc',
        reminder_queue_id: null,
        filing_type_id: null,
        postmark_message_id: sendResult.messageId,
      });

    if (logError) {
      console.error('Failed to log ad-hoc email send:', logError);
      // Don't fail the operation - email was sent successfully
    }

    return {
      success: true,
      messageId: sendResult.messageId,
    };
  } catch (error) {
    console.error('sendAdhocEmail error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Preview an ad-hoc email with template rendering
 *
 * Renders the template with sample data to show what the email will look like.
 *
 * @param params - Template ID and client name for preview
 * @returns Rendered HTML and subject, or error message
 */
export async function previewAdhocEmail(params: {
  templateId: string;
  clientName: string;
}): Promise<{ html: string; subject: string } | { error: string }> {
  try {
    const supabase = await createClient();

    // Fetch the email template
    const { data: template, error: templateError } = await supabase
      .from('email_templates')
      .select('id, subject, body_json')
      .eq('id', params.templateId)
      .single();

    if (templateError || !template) {
      return {
        error: `Template not found: ${templateError?.message || 'Unknown error'}`,
      };
    }

    // Render the template with sample data
    const rendered = await renderTipTapEmail({
      bodyJson: template.body_json,
      subject: template.subject,
      context: {
        client_name: params.clientName,
        filing_type: 'Ad-hoc',
        deadline: new Date(),
        accountant_name: 'Peninsula Accounting',
      },
    });

    return {
      html: rendered.html,
      subject: rendered.subject,
    };
  } catch (error) {
    console.error('previewAdhocEmail error:', error);
    return {
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
