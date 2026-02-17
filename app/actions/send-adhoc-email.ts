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
  customSubject: z.string().optional(),
  customText: z.string().optional(),
  customHtml: z.string().optional(),
});

interface SendAdhocEmailParams {
  clientId: string;
  clientName: string;
  clientEmail: string;
  templateId: string;
  customSubject?: string;
  customText?: string;
  customHtml?: string;
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

    // Use custom subject/text if provided, otherwise fetch and render the template
    let finalSubject: string;
    let finalText: string;
    let finalHtml: string;

    if (validated.customSubject && validated.customText) {
      // Use the custom content directly (from template edit or scratch composition)
      finalSubject = validated.customSubject;
      finalText = validated.customText;
      // Use custom HTML if provided, otherwise convert plain text to simple HTML
      if (validated.customHtml) {
        finalHtml = validated.customHtml;
      } else {
        finalHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  ${validated.customText.split('\n\n').map(para => `<p style="margin: 0 0 16px 0;">${para.replace(/\n/g, '<br>')}</p>`).join('')}
  <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
  <p style="font-size: 12px; color: #666; margin: 0;">
    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/unsubscribe?client_id=${validated.clientId}" style="color: #666;">Unsubscribe from these emails</a>
  </p>
</body>
</html>`;
      }
    } else {
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
          accountant_name: 'PhaseTwo',
        },
        clientId: validated.clientId,
      });
      finalSubject = rendered.subject;
      finalText = rendered.text;
      finalHtml = rendered.html;
    }

    // Send via Postmark (HTML + plain text with List-Unsubscribe)
    const sendResult = await sendRichEmail({
      to: validated.clientEmail,
      subject: finalSubject,
      html: finalHtml,
      text: finalText,
      clientId: validated.clientId,
    });

    // Log to email_log
    const { error: logError } = await supabase
      .from('email_log')
      .insert({
        client_id: validated.clientId,
        recipient_email: validated.clientEmail,
        subject: finalSubject,
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
  clientId: string;
}): Promise<{ text: string; html: string; subject: string } | { error: string }> {
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
        accountant_name: 'PhaseTwo',
      },
      clientId: params.clientId,
    });

    return {
      text: rendered.text,
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
