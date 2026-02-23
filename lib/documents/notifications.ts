/**
 * Document retention notification emails (COMP-02).
 *
 * System-level notifications sent to org admins when documents are flagged
 * for retention review. Uses the platform's Postmark token (env var), not
 * the org's token — same pattern as lib/billing/notifications.ts.
 *
 * These are system notifications — accountants need to take action on flagged documents.
 */

import { ServerClient } from 'postmark';
import type { SupabaseClient } from '@supabase/supabase-js';

interface FlaggedDocument {
  id: string;
  original_filename: string;
  filing_type_id: string;
  retain_until: string;
  clients: { company_name: string | null; display_name: string | null } | null;
}

/**
 * Send a retention-flagged notification email to all admins of the given org.
 * Lists documents that were flagged in this cron run.
 *
 * @param orgId - Organisation ID
 * @param flaggedDocs - Documents flagged in this run
 * @param supabase - Admin Supabase client (service_role)
 */
export async function sendRetentionFlaggedEmail(
  orgId: string,
  flaggedDocs: FlaggedDocument[],
  supabase: SupabaseClient
): Promise<void> {
  if (flaggedDocs.length === 0) return;

  const { data: org } = await supabase.from('organisations').select('name').eq('id', orgId).single();
  if (!org) return;

  // Resolve admin emails (same pattern as billing notifications — avoids FK join issues)
  const { data: adminMemberships } = await supabase
    .from('user_organisations')
    .select('user_id')
    .eq('org_id', orgId)
    .eq('role', 'admin');

  if (!adminMemberships || adminMemberships.length === 0) return;

  const adminEmails: string[] = [];
  for (const membership of adminMemberships) {
    const { data: { user } } = await supabase.auth.admin.getUserById(membership.user_id);
    if (user?.email) adminEmails.push(user.email);
  }
  if (adminEmails.length === 0) return;

  const postmarkToken = process.env.POSTMARK_SERVER_TOKEN;
  if (!postmarkToken) {
    console.error('sendRetentionFlaggedEmail: POSTMARK_SERVER_TOKEN not configured');
    return;
  }

  const postmark = new ServerClient(postmarkToken);
  const senderDomain = process.env.POSTMARK_SENDER_DOMAIN ?? 'phasetwo.uk';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  for (const email of adminEmails) {
    try {
      await postmark.sendEmail({
        From: `Prompt <noreply@${senderDomain}>`,
        To: email,
        Subject: `${flaggedDocs.length} document${flaggedDocs.length > 1 ? 's' : ''} flagged for retention review — ${org.name}`,
        HtmlBody: buildRetentionHtml(org.name, flaggedDocs, appUrl),
        TextBody: buildRetentionText(org.name, flaggedDocs, appUrl),
        MessageStream: 'outbound',
        TrackOpens: false,
        TrackLinks: 'None' as never,
      });
    } catch (err) {
      console.error(`sendRetentionFlaggedEmail: failed to send to ${email}:`, err);
    }
  }
  console.log(`sendRetentionFlaggedEmail: ${flaggedDocs.length} docs flagged, emailed ${adminEmails.length} admin(s) for org ${orgId}`);
}

function buildRetentionHtml(orgName: string, docs: FlaggedDocument[], appUrl: string): string {
  const docRows = docs.map(d => {
    const clientName = d.clients?.display_name || d.clients?.company_name || 'Unknown client';
    const retainUntil = new Date(d.retain_until).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e4e4e7;">${escapeHtml(clientName)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e4e4e7;">${escapeHtml(d.original_filename)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e4e4e7;">${escapeHtml(retainUntil)}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Documents flagged for retention review</title></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="background-color:#d97706;padding:24px 32px;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">Retention Review Required</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;color:#18181b;font-size:15px;line-height:1.6;">Hi,</p>
          <p style="margin:0 0 16px;color:#18181b;font-size:15px;line-height:1.6;">
            The following ${docs.length} document${docs.length > 1 ? 's' : ''} stored in
            <strong>${escapeHtml(orgName)}</strong> have passed their statutory retention period.
            Please review these documents and take appropriate action (deletion or documented extension).
          </p>
          <p style="margin:0 0 16px;color:#71717a;font-size:13px;">
            <strong>Important:</strong> Prompt never auto-deletes documents. This email is a notification only.
            Documents remain accessible in the platform until you delete them.
          </p>
          <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
            <thead>
              <tr style="background-color:#f4f4f5;">
                <th style="padding:8px 12px;text-align:left;font-size:13px;color:#71717a;">Client</th>
                <th style="padding:8px 12px;text-align:left;font-size:13px;color:#71717a;">Document</th>
                <th style="padding:8px 12px;text-align:left;font-size:13px;color:#71717a;">Retention Deadline</th>
              </tr>
            </thead>
            <tbody>${docRows}</tbody>
          </table>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
            <tr><td style="background-color:#18181b;border-radius:6px;">
              <a href="${escapeHtml(appUrl)}/clients" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">
                Review in Prompt
              </a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #e4e4e7;">
          <p style="margin:0;color:#a1a1aa;font-size:12px;text-align:center;">Prompt — UK Accounting Compliance</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildRetentionText(orgName: string, docs: FlaggedDocument[], appUrl: string): string {
  const docList = docs.map(d => {
    const clientName = d.clients?.display_name || d.clients?.company_name || 'Unknown client';
    const retainUntil = new Date(d.retain_until).toLocaleDateString('en-GB');
    return `- ${clientName}: ${d.original_filename} (retention deadline: ${retainUntil})`;
  }).join('\n');

  return `Retention Review Required

Hi,

The following ${docs.length} document${docs.length > 1 ? 's' : ''} in ${orgName} have passed their statutory retention period:

${docList}

Prompt does NOT auto-delete documents. Please review and take appropriate action.

Review in Prompt: ${appUrl}/clients

--
Prompt`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
