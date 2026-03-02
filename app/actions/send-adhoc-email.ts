'use server';

import { z } from 'zod';
import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrgId } from '@/lib/auth/org-context';
import { requireWriteAccess } from '@/lib/billing/read-only-mode';
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
  // Filing context — when provided, enables per-client rendering + portal link generation
  filingTypeId: z.string().optional(),
  filingTypeName: z.string().optional(),
  deadlineDate: z.string().optional(),  // 'YYYY-MM-DD'
  bodyJson: z.record(z.string(), z.any()).optional(),
  rawSubject: z.string().optional(),    // subject with {{placeholders}} unresolved
});

interface SendAdhocEmailParams {
  clientId: string;
  clientName: string;
  clientEmail: string;
  templateId: string;
  customSubject?: string;
  customText?: string;
  customHtml?: string;
  // Filing context
  filingTypeId?: string;
  filingTypeName?: string;
  deadlineDate?: string;
  bodyJson?: Record<string, any>;
  rawSubject?: string;
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

    // Enforce billing: block email sending when subscription is inactive
    const orgId = await getOrgId();
    await requireWriteAccess(orgId);

    const supabase = await createClient();

    // Get org's Postmark token for sending
    const admin = createAdminClient();
    const { data: orgData } = await admin
      .from('organisations')
      .select('postmark_server_token, name')
      .eq('id', orgId)
      .single();

    // Determine rendering path
    let finalSubject: string;
    let finalText: string;
    let finalHtml: string | undefined;

    const hasFilingContext =
      validated.filingTypeId &&
      validated.filingTypeName &&
      validated.deadlineDate &&
      validated.bodyJson &&
      validated.rawSubject;

    if (hasFilingContext) {
      // Per-client render path: generate a fresh portal token, then render with full context
      const deadline = new Date(validated.deadlineDate!);
      const taxYear = deadline.getFullYear().toString();

      let portalLink = '';
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const { error: tokenError } = await supabase
        .from('upload_portal_tokens')
        .insert({
          org_id: orgId,
          client_id: validated.clientId,
          filing_type_id: validated.filingTypeId!,
          tax_year: taxYear,
          token_hash: tokenHash,
          expires_at: expiresAt.toISOString(),
        });

      if (!tokenError) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
        portalLink = `${appUrl}/portal/${rawToken}`;
      }

      const rendered = await renderTipTapEmail({
        bodyJson: validated.bodyJson!,
        subject: validated.rawSubject!,
        context: {
          client_name: validated.clientName,
          filing_type: validated.filingTypeName!,
          deadline,
          accountant_name: orgData?.name || 'Prompt',
          portal_link: portalLink,
        },
        clientId: validated.clientId,
      });
      finalSubject = rendered.subject;
      finalText = rendered.text;
      finalHtml = rendered.html;

    } else if (validated.customSubject && validated.customText) {
      // Pre-rendered custom content (no filing context)
      finalSubject = validated.customSubject;
      finalText = validated.customText;
      finalHtml = validated.customHtml;

    } else {
      // Fetch and render a named template (no filing context)
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

      const rendered = await renderTipTapEmail({
        bodyJson: template.body_json,
        subject: template.subject,
        context: {
          client_name: validated.clientName,
          filing_type: 'Ad-hoc',
          deadline: new Date(),
          accountant_name: orgData?.name || 'Prompt',
        },
        clientId: validated.clientId,
      });
      finalSubject = rendered.subject;
      finalText = rendered.text;
      finalHtml = rendered.html;
    }

    // Send via Postmark — simple HTML preserving bold/italic, with plain text fallback
    const sendResult = await sendRichEmail({
      to: validated.clientEmail,
      subject: finalSubject,
      html: finalHtml,
      text: finalText,
      clientId: validated.clientId,
      orgPostmarkToken: orgData?.postmark_server_token || undefined,
    });

    // Log to email_log (org_id required for INSERT — RLS validates but doesn't auto-set)
    const { error: logError } = await supabase
      .from('email_log')
      .insert({
        org_id: orgId,
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
        accountant_name: 'Prompt',
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
