'use server';

import { getOrgId } from '@/lib/auth/org-context';
import { requireWriteAccess } from '@/lib/billing/read-only-mode';
import { renderTipTapEmail } from '@/lib/email/render-tiptap';
import { sendRichEmail } from '@/lib/email/sender';
import { createAdminClient } from '@/lib/supabase/admin';

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

    // Get org's Postmark token for sending
    const admin = createAdminClient();
    const { data: orgData } = await admin
      .from('organisations')
      .select('postmark_server_token')
      .eq('id', orgId)
      .single();

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
      orgPostmarkToken: orgData?.postmark_server_token || undefined,
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
