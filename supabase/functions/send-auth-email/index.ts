import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const POSTMARK_API_URL = "https://api.postmarkapp.com/email";
const FROM_EMAIL = "Prompt <noreply@prompt.accountants>";

interface EmailData {
  token: string;
  token_hash: string;
  redirect_to: string;
  email_action_type: string;
  site_url: string;
  token_new: string;
  token_hash_new: string;
}

interface HookPayload {
  user: { email: string; [key: string]: unknown };
  email_data: EmailData;
}

function buildVerificationUrl(emailData: EmailData): string {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const params = new URLSearchParams({
    token: emailData.token_hash,
    type: emailData.email_action_type,
    redirect_to: emailData.redirect_to || Deno.env.get("APP_URL") || "https://app.prompt.accountants",
  });
  return `${supabaseUrl}/auth/v1/verify?${params}`;
}

interface EmailContent {
  subject: string;
  heading: string;
  body: string;
  buttonText: string;
}

function getEmailContent(actionType: string): EmailContent {
  const map: Record<string, EmailContent> = {
    signup: {
      subject: "Confirm your Prompt account",
      heading: "Confirm your email address",
      body: "Thanks for signing up to Prompt. Click the button below to confirm your email address and activate your account.",
      buttonText: "Confirm Email",
    },
    recovery: {
      subject: "Reset your Prompt password",
      heading: "Reset your password",
      body: "You requested a password reset for your Prompt account. Click the button below to choose a new password. This link expires in 1 hour.",
      buttonText: "Reset Password",
    },
    invite: {
      subject: "You've been invited to Prompt",
      heading: "You've been invited",
      body: "You've been invited to join a Prompt workspace. Click the button below to accept the invitation and set up your account.",
      buttonText: "Accept Invite",
    },
    email_change: {
      subject: "Confirm your new email address",
      heading: "Confirm your new email",
      body: "You requested to change your email address on Prompt. Click the button below to confirm this change.",
      buttonText: "Confirm New Email",
    },
    magiclink: {
      subject: "Your Prompt sign-in link",
      heading: "Sign in to Prompt",
      body: "Click the button below to sign in to your Prompt account. This link expires in 1 hour and can only be used once.",
      buttonText: "Sign In to Prompt",
    },
    reauthentication: {
      subject: "Confirm your Prompt identity",
      heading: "Confirm your identity",
      body: "A verification was requested for your Prompt account. Click the button below to confirm.",
      buttonText: "Confirm",
    },
  };
  return map[actionType] ?? map.signup;
}

function buildHtml(content: EmailContent, verificationUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${content.subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f4f4f5;padding:48px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:520px;">

          <!-- Wordmark -->
          <tr>
            <td style="padding-bottom:28px;text-align:center;">
              <span style="font-size:20px;font-weight:700;color:#09090b;letter-spacing:-0.5px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Prompt</span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:12px;border:1px solid #e4e4e7;padding:40px 40px 36px;">

              <h1 style="margin:0 0 10px;font-size:20px;font-weight:600;color:#09090b;line-height:1.3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${content.heading}</h1>

              <p style="margin:0 0 28px;font-size:15px;color:#52525b;line-height:1.65;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${content.body}</p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td>
                    <a href="${verificationUrl}"
                       style="display:inline-block;background-color:#09090b;color:#fafafa;font-size:14px;font-weight:500;text-decoration:none;padding:11px 22px;border-radius:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                      ${content.buttonText} &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Fallback link -->
              <p style="margin:24px 0 0;font-size:12px;color:#a1a1aa;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${verificationUrl}" style="color:#52525b;word-break:break-all;">${verificationUrl}</a>
              </p>

              <hr style="border:none;border-top:1px solid #f4f4f5;margin:24px 0 0;">

              <p style="margin:16px 0 0;font-size:12px;color:#a1a1aa;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                If you didn't request this, you can safely ignore this email. This link will expire after 24 hours.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:20px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                Prompt &middot; Automated deadline reminders for UK accountants<br>
                <a href="https://prompt.accountants" style="color:#a1a1aa;text-decoration:none;">prompt.accountants</a>
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

function buildText(content: EmailContent, verificationUrl: string): string {
  return [
    content.heading,
    "",
    content.body,
    "",
    `${content.buttonText}: ${verificationUrl}`,
    "",
    "If you didn't request this, ignore this email. The link expires after 24 hours.",
    "",
    "—",
    "Prompt · Automated deadline reminders for UK accountants",
    "https://prompt.accountants",
  ].join("\n");
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET");
  if (!hookSecret) {
    console.error("SEND_EMAIL_HOOK_SECRET not set");
    return new Response("Hook secret not configured", { status: 500 });
  }

  const postmarkToken = Deno.env.get("POSTMARK_SERVER_TOKEN");
  if (!postmarkToken) {
    console.error("POSTMARK_SERVER_TOKEN not set");
    return new Response("Postmark token not configured", { status: 500 });
  }

  // Read body and verify webhook signature
  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);

  let data: HookPayload;
  try {
    const wh = new Webhook(hookSecret);
    data = wh.verify(payload, headers) as HookPayload;
  } catch (err) {
    console.error("Webhook verification failed:", err);
    return new Response("Unauthorized", { status: 401 });
  }

  const { user, email_data } = data;
  const actionType = email_data.email_action_type;

  const verificationUrl = buildVerificationUrl(email_data);
  const content = getEmailContent(actionType);

  try {
    const res = await fetch(POSTMARK_API_URL, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": postmarkToken,
      },
      body: JSON.stringify({
        From: FROM_EMAIL,
        To: user.email,
        Subject: content.subject,
        HtmlBody: buildHtml(content, verificationUrl),
        TextBody: buildText(content, verificationUrl),
        MessageStream: "outbound",
        TrackOpens: false,
        TrackLinks: "None",
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`Postmark error ${res.status}:`, text);
      return new Response("Failed to send email", { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Email send failed:", err);
    return new Response("Failed to send email", { status: 500 });
  }
});
