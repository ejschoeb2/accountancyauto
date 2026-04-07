/**
 * Email sender for reminder emails via Postmark
 *
 * Supports both v1.0 (plain text) and v1.1 (rich HTML) email sending.
 * v3.0 adds org-aware sending for multi-tenant cron jobs.
 */

import { render } from '@react-email/render';
import { ServerClient } from 'postmark';
import { createHmac } from 'crypto';
import { postmarkClient } from './client';
import ReminderEmail from './templates/reminder';
import { getUserEmailSettings, type EmailSettings } from '@/app/actions/settings';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Generate an HMAC-SHA256 token for unsubscribe URL authentication.
 * Prevents IDOR: anyone with only client_id cannot forge a valid unsubscribe link.
 */
function buildUnsubscribeUrl(baseUrl: string, clientId: string): string {
  const token = createHmac('sha256', process.env.CRON_SECRET!).update(clientId).digest('hex');
  return `${baseUrl}/api/unsubscribe?client_id=${clientId}&token=${token}`;
}

// Module-level cache for email settings (used by single-tenant server actions)
// Multi-tenant cron jobs use getEmailFromForOrg() instead
let cachedSettings: { data: EmailSettings; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 60_000; // 1 minute

async function getEmailFrom(): Promise<{ from: string; replyTo: string }> {
  const now = Date.now();
  if (!cachedSettings || now - cachedSettings.fetchedAt > CACHE_TTL_MS) {
    cachedSettings = { data: await getUserEmailSettings(), fetchedAt: now };
  }
  const s = cachedSettings.data;
  return {
    from: `${s.senderName} <${s.senderAddress}>`,
    replyTo: s.replyTo,
  };
}

/**
 * Get the org's verified custom domain for default email addresses.
 * Falls back to 'prompt.accountants' if no custom domain is configured.
 */
async function getOrgDefaultDomain(
  supabase: SupabaseClient,
  orgId: string
): Promise<string> {
  const { data } = await supabase
    .from('organisations')
    .select('postmark_sender_domain, email_domain_verified')
    .eq('id', orgId)
    .single();
  if (data?.postmark_sender_domain && data?.email_domain_verified) {
    return data.postmark_sender_domain;
  }
  return 'prompt.accountants';
}

/**
 * Get email from/replyTo settings for a specific org (for cron jobs)
 * Reads directly from app_settings using admin client — no session needed
 */
async function getEmailFromForOrg(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ from: string; replyTo: string }> {
  const [{ data }, defaultDomain] = await Promise.all([
    supabase
      .from('app_settings')
      .select('key, value')
      .eq('org_id', orgId)
      .in('key', ['email_sender_name', 'email_sender_address', 'email_reply_to']),
    getOrgDefaultDomain(supabase, orgId),
  ]);

  const defaultAddress = `hello@${defaultDomain}`;
  const map = new Map(data?.map(r => [r.key, r.value]) ?? []);
  return {
    from: `${map.get('email_sender_name') || 'Prompt'} <${map.get('email_sender_address') || defaultAddress}>`,
    replyTo: map.get('email_reply_to') || map.get('email_sender_address') || defaultAddress,
  };
}

/**
 * Get email from/replyTo settings for a specific user within an org (for cron jobs)
 * Reads user-specific app_settings rows first, falls back to org-level defaults.
 * Uses admin client — no session needed.
 */
async function getEmailFromForUser(
  supabase: SupabaseClient,
  orgId: string,
  userId: string
): Promise<{ from: string; replyTo: string }> {
  const keys = ['email_sender_name', 'email_sender_address', 'email_reply_to'];

  // Fetch user-specific rows, org-level defaults, and custom domain in parallel
  const [{ data: userRows }, { data: orgRows }, defaultDomain] = await Promise.all([
    supabase
      .from('app_settings')
      .select('key, value')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .in('key', keys),
    supabase
      .from('app_settings')
      .select('key, value')
      .eq('org_id', orgId)
      .is('user_id', null)
      .in('key', keys),
    getOrgDefaultDomain(supabase, orgId),
  ]);

  const defaultAddress = `hello@${defaultDomain}`;

  // User rows win over org rows
  const map = new Map(orgRows?.map(r => [r.key, r.value]) ?? []);
  (userRows ?? []).forEach(r => map.set(r.key, r.value));

  return {
    from: `${map.get('email_sender_name') || 'Prompt'} <${map.get('email_sender_address') || defaultAddress}>`,
    replyTo: map.get('email_reply_to') || map.get('email_sender_address') || defaultAddress,
  };
}

/**
 * Create a Postmark ServerClient for a specific org's token
 */
function getOrgPostmarkClient(token: string): ServerClient {
  return new ServerClient(token);
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
  html?: string;  // Pre-rendered HTML from renderTipTapEmail (omit for plain text only)
  text: string;  // Plain text body
  clientId?: string;  // Optional: for List-Unsubscribe header
  orgPostmarkToken?: string | null;  // Optional: use org's Postmark token instead of env var
}

interface SendRichEmailForOrgParams extends SendRichEmailParams {
  orgPostmarkToken: string | null;
  supabase: SupabaseClient;
  orgId: string;
  userId?: string;  // Optional: use per-user sender settings instead of org-level defaults
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
 * Includes List-Unsubscribe headers for better deliverability.
 *
 * Uses the default env var Postmark client (for server actions / ad-hoc sends).
 * For cron jobs, use sendRichEmailForOrg() instead.
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

    // Use org-specific client if token provided, otherwise fall back to module-level env var client
    const client = params.orgPostmarkToken
      ? getOrgPostmarkClient(params.orgPostmarkToken)
      : postmarkClient;

    // Build List-Unsubscribe headers if clientId provided
    const headers: Record<string, string> = {};
    if (params.clientId) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const unsubscribeUrl = buildUnsubscribeUrl(baseUrl, params.clientId);

      // List-Unsubscribe header (supports both mailto and https)
      headers['List-Unsubscribe'] = `<${unsubscribeUrl}>`;

      // List-Unsubscribe-Post for one-click unsubscribe (Gmail button)
      headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
    }

    // Send via Postmark (no React Email rendering needed - already done)
    const result = await client.sendEmail({
      From: emailFrom.from,
      To: params.to,
      ReplyTo: emailFrom.replyTo,
      Subject: params.subject,
      ...(params.html ? { HtmlBody: params.html } : {}),
      TextBody: params.text,
      MessageStream: 'outbound',
      TrackOpens: false,
      TrackLinks: 'None' as any,
      Headers: Object.keys(headers).length > 0
        ? Object.entries(headers).map(([Name, Value]) => ({ Name, Value }))
        : undefined,
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

/**
 * Send a rich HTML email using org-specific Postmark credentials (v3.0 multi-tenant)
 *
 * Used by cron jobs that iterate over organisations. Each org may have its own
 * Postmark server token. Falls back to the env var token if the org has no token set.
 *
 * Email from/replyTo settings are read from the org's app_settings rows.
 *
 * @param params - Pre-rendered email content + org context
 * @returns Postmark message details
 * @throws Error if no Postmark token available or email send fails
 */
export async function sendRichEmailForOrg(
  params: SendRichEmailForOrgParams
): Promise<SendReminderEmailResult> {
  try {
    // Use org token only — no fallback to env var (prevents cross-org email leakage)
    const token = params.orgPostmarkToken;
    if (!token) {
      throw new Error('No Postmark token configured for this organisation');
    }

    const client = getOrgPostmarkClient(token);

    // Get email settings — user-specific if userId provided, otherwise org-level
    const emailFrom = params.userId
      ? await getEmailFromForUser(params.supabase, params.orgId, params.userId)
      : await getEmailFromForOrg(params.supabase, params.orgId);

    // Build List-Unsubscribe headers if clientId provided
    const headers: Record<string, string> = {};
    if (params.clientId) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const unsubscribeUrl = buildUnsubscribeUrl(baseUrl, params.clientId);

      headers['List-Unsubscribe'] = `<${unsubscribeUrl}>`;
      headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
    }

    // Send via org-specific Postmark client
    const result = await client.sendEmail({
      From: emailFrom.from,
      To: params.to,
      ReplyTo: emailFrom.replyTo,
      Subject: params.subject,
      HtmlBody: params.html,
      TextBody: params.text,
      MessageStream: 'outbound',
      TrackOpens: false,
      TrackLinks: 'None' as any,
      Headers: Object.keys(headers).length > 0
        ? Object.entries(headers).map(([Name, Value]) => ({ Name, Value }))
        : undefined,
    });

    return {
      messageId: result.MessageID,
      submittedAt: result.SubmittedAt,
      to: result.To || params.to,
    };
  } catch (error) {
    console.error('Failed to send rich email for org:', error);
    throw new Error(
      `Failed to send rich email to ${params.to}: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}
