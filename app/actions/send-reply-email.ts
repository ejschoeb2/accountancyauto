'use server';

import { getOrgId } from '@/lib/auth/org-context';
import { requireWriteAccess } from '@/lib/billing/read-only-mode';
import { renderTipTapEmail } from '@/lib/email/render-tiptap';
import { sendRichEmail } from '@/lib/email/sender';

interface SendReplyEmailParams {
  to: string;
  subject: string;
  bodyJson: Record<string, any>;
}

interface SendReplyEmailResult {
  success: boolean;
  error?: string;
}

export async function sendReplyEmail(params: SendReplyEmailParams): Promise<SendReplyEmailResult> {
  try {
    // Enforce billing: block reply emails when subscription is inactive
    const orgId = await getOrgId();
    await requireWriteAccess(orgId);

    const { html, text } = await renderTipTapEmail({
      bodyJson: params.bodyJson,
      subject: params.subject,
      context: {},
    });

    await sendRichEmail({
      to: params.to,
      subject: params.subject,
      html,
      text,
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to send reply email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
