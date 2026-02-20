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
    console.error(
      `sendPaymentFailedEmail: failed to fetch org ${orgId}:`,
      orgError
    );
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
    console.warn(
      `sendPaymentFailedEmail: no admin users found for org ${orgId}:`,
      membersError
    );
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
        console.warn(
          `sendPaymentFailedEmail: could not resolve email for user ${membership.user_id}:`,
          userError
        );
        continue;
      }

      adminEmails.push(user.email);
    } catch (err) {
      console.warn(
        `sendPaymentFailedEmail: error fetching user ${membership.user_id}:`,
        err
      );
    }
  }

  if (adminEmails.length === 0) {
    console.warn(
      `sendPaymentFailedEmail: no admin email addresses resolved for org ${orgId}`
    );
    return;
  }

  // Initialize Postmark client with platform token
  const postmarkToken = process.env.POSTMARK_SERVER_TOKEN;
  if (!postmarkToken) {
    console.error(
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
      console.error(
        `sendPaymentFailedEmail: failed to send to ${email}:`,
        err
      );
      // Continue to next admin -- don't fail the whole batch
    }
  }

  console.log(
    `sendPaymentFailedEmail: sent ${sentCount}/${adminEmails.length} emails for org ${orgId} (${orgName})`
  );
}

// ── Email templates ──────────────────────────────────────────────────

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
