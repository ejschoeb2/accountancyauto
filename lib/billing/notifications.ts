/**
 * Billing notification emails (NOTF-02).
 *
 * System-level notifications sent to org admins for billing events.
 * These use the platform's Postmark token (env var), not the org's
 * token, since these are system notifications -- not client reminders.
 *
 * Idempotency is guaranteed at the webhook level: the webhook route
 * checks processed_webhook_events before dispatching, so each Stripe
 * event triggers at most one call to these functions.
 */

import { ServerClient } from "postmark";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from '@/lib/logger';

/**
 * Send a payment-failed email (NOTF-02) to all admins of the given organisation.
 *
 * Queries user_organisations for admin users, resolves their email
 * addresses via supabase.auth.admin.getUserById(), and sends each
 * admin a notification with a link to update their payment method.
 *
 * Does not throw on individual email failures -- logs and continues
 * to the next admin.
 *
 * @param orgId - Organisation ID whose payment failed
 * @param supabase - Admin Supabase client (service_role)
 */
export async function sendPaymentFailedEmail(
  orgId: string,
  supabase: SupabaseClient
): Promise<void> {
  // Get organisation name
  const { data: org, error: orgError } = await supabase
    .from("organisations")
    .select("name")
    .eq("id", orgId)
    .single();

  if (orgError || !org) {
    logger.error(`sendPaymentFailedEmail: failed to fetch org ${orgId}:`, { error: (orgError as any)?.message ?? String(orgError) });
    return;
  }

  const orgName = org.name;

  // Get admin user IDs for this org.
  // Using direct query on user_organisations (not FK join to auth.users)
  // because PostgREST FK joins to auth.users may not resolve.
  const { data: adminMemberships, error: membersError } = await supabase
    .from("user_organisations")
    .select("user_id")
    .eq("org_id", orgId)
    .eq("role", "admin");

  if (membersError || !adminMemberships || adminMemberships.length === 0) {
    logger.warn(`sendPaymentFailedEmail: no admin users found for org ${orgId}:`, { error: (membersError as any)?.message ?? String(membersError) });
    return;
  }

  // Resolve email addresses via auth admin API
  const adminEmails: string[] = [];
  for (const membership of adminMemberships) {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.admin.getUserById(membership.user_id);

      if (userError || !user?.email) {
        logger.warn(`sendPaymentFailedEmail: could not resolve email for user ${membership.user_id}:`, { error: (userError as any)?.message ?? String(userError) });
        continue;
      }

      adminEmails.push(user.email);
    } catch (err) {
      logger.warn(`sendPaymentFailedEmail: error fetching user ${membership.user_id}:`, { error: (err as any)?.message ?? String(err) });
    }
  }

  if (adminEmails.length === 0) {
    logger.warn(
      `sendPaymentFailedEmail: no admin email addresses resolved for org ${orgId}`
    );
    return;
  }

  // Initialize Postmark client with platform token
  const postmarkToken = process.env.POSTMARK_SERVER_TOKEN;
  if (!postmarkToken) {
    logger.error(
      "sendPaymentFailedEmail: POSTMARK_SERVER_TOKEN not configured"
    );
    return;
  }

  const postmark = new ServerClient(postmarkToken);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const billingUrl = `${appUrl}/billing`;
  const senderDomain = process.env.POSTMARK_SENDER_DOMAIN || "phasetwo.uk";

  let sentCount = 0;

  for (const email of adminEmails) {
    try {
      await postmark.sendEmail({
        From: `Peninsula Accounting <noreply@${senderDomain}>`,
        To: email,
        Subject: `Payment failed for ${orgName}`,
        HtmlBody: buildPaymentFailedHtml(orgName, billingUrl),
        TextBody: buildPaymentFailedText(orgName, billingUrl),
        MessageStream: "outbound",
        TrackOpens: false,
        TrackLinks: "None" as never,
      });
      sentCount++;
    } catch (err) {
      logger.error(`sendPaymentFailedEmail: failed to send to ${email}:`, { error: (err as any)?.message ?? String(err) });
      // Continue to next admin -- don't fail the whole batch
    }
  }

  logger.info(
    `sendPaymentFailedEmail: sent ${sentCount}/${adminEmails.length} emails for org ${orgId} (${orgName})`
  );
}

// ── Trial ending soon email ──────────────────────────────────────────

/**
 * Send a trial-ending-soon email (NOTF-01) to all admins of the given org.
 *
 * Sends 3 days before trial expiry. Idempotency is enforced at the cron
 * level via the app_settings "trial_reminder_sent" key — this function
 * does not check idempotency itself.
 *
 * Uses the platform Postmark token (not org token) — system notification.
 *
 * @param orgId       - Organisation ID
 * @param orgName     - Organisation display name
 * @param trialEndsAt - ISO string of trial expiry date
 * @param supabase    - Admin Supabase client (service_role)
 */
export async function sendTrialEndingSoonEmail(
  orgId: string,
  orgName: string,
  trialEndsAt: string,
  supabase: SupabaseClient
): Promise<void> {
  // Get admin user IDs for this org
  const { data: adminMemberships, error: membersError } = await supabase
    .from("user_organisations")
    .select("user_id")
    .eq("org_id", orgId)
    .eq("role", "admin");

  if (membersError || !adminMemberships || adminMemberships.length === 0) {
    logger.warn(`sendTrialEndingSoonEmail: no admin users found for org ${orgId}:`, { error: (membersError as any)?.message ?? String(membersError) });
    return;
  }

  // Resolve email addresses via auth admin API
  const adminEmails: string[] = [];
  for (const membership of adminMemberships) {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.admin.getUserById(membership.user_id);

      if (userError || !user?.email) {
        logger.warn(`sendTrialEndingSoonEmail: could not resolve email for user ${membership.user_id}:`, { error: (userError as any)?.message ?? String(userError) });
        continue;
      }

      adminEmails.push(user.email);
    } catch (err) {
      logger.warn(`sendTrialEndingSoonEmail: error fetching user ${membership.user_id}:`, { error: (err as any)?.message ?? String(err) });
    }
  }

  if (adminEmails.length === 0) {
    logger.warn(
      `sendTrialEndingSoonEmail: no admin email addresses resolved for org ${orgId}`
    );
    return;
  }

  // Initialize Postmark client with platform token
  const postmarkToken = process.env.POSTMARK_SERVER_TOKEN;
  if (!postmarkToken) {
    logger.error(
      "sendTrialEndingSoonEmail: POSTMARK_SERVER_TOKEN not configured"
    );
    return;
  }

  const postmark = new ServerClient(postmarkToken);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const billingUrl = `${appUrl}/billing`;
  const senderDomain = process.env.POSTMARK_SENDER_DOMAIN || "phasetwo.uk";

  // Format the trial end date for human readability
  const trialEndDate = new Date(trialEndsAt);
  const formattedDate = trialEndDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  let sentCount = 0;

  for (const email of adminEmails) {
    try {
      await postmark.sendEmail({
        From: `Peninsula Accounting <noreply@${senderDomain}>`,
        To: email,
        Subject: `Your trial for ${orgName} ends in 3 days`,
        HtmlBody: buildTrialEndingSoonHtml(orgName, formattedDate, billingUrl),
        TextBody: buildTrialEndingSoonText(orgName, formattedDate, billingUrl),
        MessageStream: "outbound",
        TrackOpens: false,
        TrackLinks: "None" as never,
      });
      sentCount++;
    } catch (err) {
      logger.error(`sendTrialEndingSoonEmail: failed to send to ${email}:`, { error: (err as any)?.message ?? String(err) });
      // Continue to next admin — don't fail the whole batch
    }
  }

  logger.info(
    `sendTrialEndingSoonEmail: sent ${sentCount}/${adminEmails.length} emails for org ${orgId} (${orgName})`
  );
}

// ── Invite email ─────────────────────────────────────────────────────

/**
 * Send a team invite email to a new team member.
 *
 * Uses the platform Postmark token (not the org's token) because the invited
 * user hasn't set up their org yet and these are system notifications.
 *
 * @param recipientEmail - Email address of the person being invited
 * @param orgName        - Display name of the organisation
 * @param inviterEmail   - Email of the admin sending the invite
 * @param role           - Role being assigned ("admin" | "member")
 * @param acceptUrl      - Full URL with raw invite token for the accept page
 */
export async function sendInviteEmail(
  recipientEmail: string,
  orgName: string,
  inviterEmail: string,
  role: string,
  acceptUrl: string
): Promise<void> {
  const postmarkToken = process.env.POSTMARK_SERVER_TOKEN;
  if (!postmarkToken) {
    logger.error("sendInviteEmail: POSTMARK_SERVER_TOKEN not configured");
    throw new Error("Email service not configured.");
  }

  const postmark = new ServerClient(postmarkToken);
  const senderDomain = process.env.POSTMARK_SENDER_DOMAIN || "phasetwo.uk";

  await postmark.sendEmail({
    From: `Peninsula Accounting <noreply@${senderDomain}>`,
    To: recipientEmail,
    Subject: `You've been invited to join ${orgName} on Peninsula Accounting`,
    HtmlBody: buildInviteHtml(orgName, inviterEmail, role, acceptUrl),
    TextBody: buildInviteText(orgName, inviterEmail, role, acceptUrl),
    MessageStream: "outbound",
    TrackOpens: false,
    TrackLinks: "None" as never,
  });

  logger.info(
    `sendInviteEmail: invite sent to ${recipientEmail} for org ${orgName}`
  );
}

// ── Email templates ──────────────────────────────────────────────────

function buildTrialEndingSoonHtml(
  orgName: string,
  formattedDate: string,
  billingUrl: string
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your trial ends in 3 days</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;">
          <!-- Header (amber — reminder, not error) -->
          <tr>
            <td style="background-color:#d97706;padding:24px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">Your trial is ending soon</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;color:#18181b;font-size:15px;line-height:1.6;">Hi,</p>
              <p style="margin:0 0 16px;color:#18181b;font-size:15px;line-height:1.6;">
                Your free trial for <strong>${escapeHtml(orgName)}</strong> ends on
                <strong>${escapeHtml(formattedDate)}</strong>.
              </p>
              <p style="margin:0 0 24px;color:#18181b;font-size:15px;line-height:1.6;">
                To continue using the platform without interruption, please set up a subscription before your trial expires.
              </p>
              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
                <tr>
                  <td style="background-color:#18181b;border-radius:6px;">
                    <a href="${escapeHtml(billingUrl)}" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">
                      Upgrade Now
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;color:#71717a;font-size:13px;line-height:1.5;">
                If you have any questions, reply to this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #e4e4e7;">
              <p style="margin:0;color:#a1a1aa;font-size:12px;text-align:center;">
                Peninsula Accounting
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildTrialEndingSoonText(
  orgName: string,
  formattedDate: string,
  billingUrl: string
): string {
  return `Your trial is ending soon

Hi,

Your free trial for ${orgName} ends on ${formattedDate}.

To continue using the platform without interruption, please set up a subscription before your trial expires.

Upgrade Now: ${billingUrl}

If you have any questions, reply to this email.

--
Peninsula Accounting`;
}

function buildInviteHtml(
  orgName: string,
  inviterEmail: string,
  role: string,
  acceptUrl: string
): string {
  const roleLabel = role === "admin" ? "Admin" : "Member";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You've been invited to join ${escapeHtml(orgName)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background-color:#18181b;padding:24px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">You've been invited</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;color:#18181b;font-size:15px;line-height:1.6;">Hi,</p>
              <p style="margin:0 0 16px;color:#18181b;font-size:15px;line-height:1.6;">
                <strong>${escapeHtml(inviterEmail)}</strong> has invited you to join
                <strong>${escapeHtml(orgName)}</strong> on Peninsula Accounting as a <strong>${escapeHtml(roleLabel)}</strong>.
              </p>
              <p style="margin:0 0 24px;color:#18181b;font-size:15px;line-height:1.6;">
                Click the button below to accept the invitation and get started.
              </p>
              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
                <tr>
                  <td style="background-color:#18181b;border-radius:6px;">
                    <a href="${escapeHtml(acceptUrl)}" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;color:#71717a;font-size:13px;line-height:1.5;">
                Or copy this link into your browser:
              </p>
              <p style="margin:0 0 16px;color:#71717a;font-size:12px;line-height:1.5;word-break:break-all;">
                ${escapeHtml(acceptUrl)}
              </p>
              <p style="margin:0;color:#71717a;font-size:13px;line-height:1.5;">
                This link expires in 7 days. If you weren't expecting this invitation, you can ignore this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #e4e4e7;">
              <p style="margin:0;color:#a1a1aa;font-size:12px;text-align:center;">
                Peninsula Accounting
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildInviteText(
  orgName: string,
  inviterEmail: string,
  role: string,
  acceptUrl: string
): string {
  const roleLabel = role === "admin" ? "Admin" : "Member";
  return `You've been invited to join ${orgName} on Peninsula Accounting

Hi,

${inviterEmail} has invited you to join ${orgName} on Peninsula Accounting as a ${roleLabel}.

Click the link below to accept the invitation:

${acceptUrl}

This link expires in 7 days. If you weren't expecting this invitation, you can ignore this email.

--
Peninsula Accounting`;
}

function buildPaymentFailedHtml(
  orgName: string,
  billingUrl: string
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Failed</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background-color:#dc2626;padding:24px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">Payment Failed</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;color:#18181b;font-size:15px;line-height:1.6;">Hi,</p>
              <p style="margin:0 0 16px;color:#18181b;font-size:15px;line-height:1.6;">
                We were unable to process your latest payment for <strong>${escapeHtml(orgName)}</strong>.
              </p>
              <p style="margin:0 0 24px;color:#18181b;font-size:15px;line-height:1.6;">
                Your account access may be restricted until payment is resolved. Please update your payment method to continue using the service.
              </p>
              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
                <tr>
                  <td style="background-color:#18181b;border-radius:6px;">
                    <a href="${escapeHtml(billingUrl)}" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">
                      Update Payment Method
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;color:#71717a;font-size:13px;line-height:1.5;">
                If you have any questions, reply to this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #e4e4e7;">
              <p style="margin:0;color:#a1a1aa;font-size:12px;text-align:center;">
                Peninsula Accounting
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildPaymentFailedText(
  orgName: string,
  billingUrl: string
): string {
  return `Payment Failed

Hi,

We were unable to process your latest payment for ${orgName}.

Your account access may be restricted until payment is resolved. Please update your payment method to continue using the service.

Update Payment Method: ${billingUrl}

If you have any questions, reply to this email.

--
Peninsula Accounting`;
}

/** Escape HTML special characters to prevent XSS in email templates. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
