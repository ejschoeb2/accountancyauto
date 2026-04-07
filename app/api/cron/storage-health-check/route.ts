import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptToken } from "@/lib/crypto/tokens";
import { ServerClient } from "postmark";
import { logger } from '@/lib/logger';

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// 7 days in milliseconds — threshold for escalation alert (AUDIT-026)
const ESCALATION_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * GET /api/cron/storage-health-check
 *
 * Daily cron job (6am UTC) that proactively checks all orgs with active
 * non-Supabase storage backends. For each org, it makes a lightweight API
 * call to the configured provider to confirm the OAuth connection is still valid.
 *
 * On failure:
 *   - Sets organisations.storage_backend_status = 'error'
 *   - Sends one notification email to the org admin (idempotent via app_settings)
 *   - AUDIT-026: If error has persisted for 7+ days, sends an escalation email
 *
 * On recovery (was 'error', now healthy):
 *   - Resets organisations.storage_backend_status = 'active'
 *   - Clears the idempotency flag so the admin is notified if it fails again
 *
 * Orgs with storage_backend_status = 'reauth_required' are SKIPPED — that is
 * a stronger signal (expired/revoked token) and must not be overwritten with 'error'.
 *
 * Secured via CRON_SECRET bearer token.
 */
export async function GET(request: NextRequest) {
  // AUDIT-025: Execution metadata
  const executionId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const startTime = Date.now();

  // AUDIT-007: Timing-safe auth
  const authHeader = request.headers.get("authorization") || "";
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
  const isAuthorized =
    authHeader.length === expectedAuth.length &&
    timingSafeEqual(Buffer.from(authHeader), Buffer.from(expectedAuth));
  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // 2. Fetch orgs with active non-Supabase backends
  //    Skip reauth_required — already flagged for admin action; overwriting with 'error' would
  //    lose the stronger signal and send a duplicate (less actionable) notification.
  const { data: orgs, error: fetchError } = await admin
    .from("organisations")
    .select(
      "id, name, storage_backend, storage_backend_status, google_access_token_enc, google_refresh_token_enc, ms_token_cache_enc, ms_home_account_id, dropbox_access_token_enc, dropbox_refresh_token_enc, dropbox_token_expires_at"
    )
    .neq("storage_backend", "supabase")
    .neq("storage_backend_status", "reauth_required")
    .in("subscription_status", ["active", "trialing"]);

  if (fetchError) {
    logger.error("[Cron:storage-health-check] Failed to fetch orgs:", { error: fetchError.message });
    return NextResponse.json({
      execution_id: executionId,
      started_at: startedAt,
      ended_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      error: fetchError.message,
    }, { status: 500 });
  }

  if (!orgs || orgs.length === 0) {
    return NextResponse.json({
      execution_id: executionId,
      started_at: startedAt,
      ended_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      success: true,
      checked: 0,
      errors: 0,
      skipped: 0,
    });
  }

  let checked = 0;
  let errors = 0;
  let skipped = 0;

  for (const org of orgs) {
    let healthy = false;

    try {
      if (org.storage_backend === "google_drive") {
        healthy = await checkGoogleDriveHealth(org);
      } else if (org.storage_backend === "onedrive") {
        healthy = await checkOneDriveHealth(org);
      } else if (org.storage_backend === "dropbox") {
        healthy = await checkDropboxHealth(org);
      } else {
        // Unknown backend type — skip silently
        skipped++;
        continue;
      }
    } catch {
      // Any thrown error (network, auth, etc.) is treated as unhealthy
      healthy = false;
    }

    if (healthy) {
      // Recovery: org was in error state but is now healthy again
      if (org.storage_backend_status === "error") {
        await admin
          .from("organisations")
          .update({ storage_backend_status: "active" })
          .eq("id", org.id);

        // Clear idempotency flag so admin is notified if it fails again in the future
        await admin
          .from("app_settings")
          .delete()
          .eq("org_id", org.id)
          .is("user_id", null)
          .eq("key", "storage_health_error_notified");

        logger.info(
          `[Cron:storage-health-check] Org ${org.id} ("${org.name}") recovered — status reset to active`
        );
      }
    } else {
      errors++;

      // Set storage status to 'error'
      await admin
        .from("organisations")
        .update({ storage_backend_status: "error" })
        .eq("id", org.id);

      // Read existing idempotency flag — value stores the ISO timestamp of first notification
      const { data: existingFlag } = await admin
        .from("app_settings")
        .select("id, value")
        .eq("org_id", org.id)
        .is("user_id", null)
        .eq("key", "storage_health_error_notified")
        .single();

      const providerName =
        org.storage_backend === "google_drive"
          ? "Google Drive"
          : org.storage_backend === "onedrive"
            ? "Microsoft OneDrive"
            : "Dropbox";

      if (!existingFlag) {
        // First failure — send initial alert and record timestamp
        const { data: adminMemberships } = await admin
          .from("user_organisations")
          .select("user_id")
          .eq("org_id", org.id)
          .eq("role", "admin")
          .limit(1);

        const adminUserId = adminMemberships?.[0]?.user_id;
        if (adminUserId) {
          try {
            const {
              data: { user: adminUser },
            } = await admin.auth.admin.getUserById(adminUserId);

            if (adminUser?.email) {
              const mailer = new ServerClient(process.env.POSTMARK_SERVER_TOKEN!);
              await mailer.sendEmail({
                From: `Prompt <noreply@${process.env.POSTMARK_SENDER_DOMAIN ?? "phasetwo.uk"}>`,
                To: adminUser.email,
                Subject: `Action required: ${providerName} storage connection issue`,
                TextBody: [
                  "Hi,",
                  "",
                  `Your ${providerName} storage connection for ${org.name} on Prompt is experiencing issues. New documents may not be uploaded to your provider.`,
                  "",
                  "Please visit Settings > Storage to check your connection and reconnect if needed.",
                  "",
                  "https://app.phasetwo.uk/settings?tab=storage",
                  "",
                  "The Prompt Team",
                ].join("\n"),
              });

              // Mark as notified — store ISO timestamp so escalation can check duration (AUDIT-026)
              await admin.from("app_settings").upsert(
                {
                  org_id: org.id,
                  user_id: null,
                  key: "storage_health_error_notified",
                  value: new Date().toISOString(),
                },
                { onConflict: "org_id,user_id,key" }
              );

              logger.info(
                `[Cron:storage-health-check] Sent error notification for org ${org.id} ("${org.name}") — backend: ${org.storage_backend}`
              );
            }
          } catch (emailErr) {
            // Non-fatal: log but continue processing remaining orgs
            logger.error(`[Cron:storage-health-check] Failed to send notification for org ${org.id}:`, { error: (emailErr as any)?.message ?? String(emailErr) });
          }
        }
      } else {
        // AUDIT-026: Check if error has persisted for 7+ days — escalate if so
        const firstNotifiedAt = new Date(existingFlag.value as string).getTime();
        const elapsedMs = Date.now() - firstNotifiedAt;

        if (!isNaN(firstNotifiedAt) && elapsedMs >= ESCALATION_THRESHOLD_MS) {
          const daysPersisted = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
          logger.warn(
            `[Cron:storage-health-check] Org ${org.id} ("${org.name}") storage error has persisted for ${daysPersisted} days — sending escalation`
          );

          const { data: adminMemberships } = await admin
            .from("user_organisations")
            .select("user_id")
            .eq("org_id", org.id)
            .eq("role", "admin")
            .limit(1);

          const adminUserId = adminMemberships?.[0]?.user_id;
          if (adminUserId) {
            try {
              const {
                data: { user: adminUser },
              } = await admin.auth.admin.getUserById(adminUserId);

              if (adminUser?.email) {
                const mailer = new ServerClient(process.env.POSTMARK_SERVER_TOKEN!);
                await mailer.sendEmail({
                  From: `Prompt <noreply@${process.env.POSTMARK_SENDER_DOMAIN ?? "phasetwo.uk"}>`,
                  To: adminUser.email,
                  Subject: `Urgent: ${providerName} storage connection still broken (${daysPersisted} days)`,
                  TextBody: [
                    "Hi,",
                    "",
                    `Your ${providerName} storage connection for ${org.name} on Prompt has been broken for ${daysPersisted} days.`,
                    "",
                    "Documents uploaded during this period may not have been saved to your storage provider. Please reconnect as soon as possible to prevent further data loss.",
                    "",
                    "Please visit Settings > Storage to reconnect:",
                    "https://app.phasetwo.uk/settings?tab=storage",
                    "",
                    "The Prompt Team",
                  ].join("\n"),
                });

                // Update the flag timestamp so the next escalation starts from now
                await admin.from("app_settings").upsert(
                  {
                    org_id: org.id,
                    user_id: null,
                    key: "storage_health_error_notified",
                    value: new Date().toISOString(),
                  },
                  { onConflict: "org_id,user_id,key" }
                );

                logger.info(
                  `[Cron:storage-health-check] Sent escalation for org ${org.id} ("${org.name}") after ${daysPersisted} days`
                );
              }
            } catch (escalationErr) {
              logger.error(`[Cron:storage-health-check] Failed to send escalation for org ${org.id}:`, { error: (escalationErr as any)?.message ?? String(escalationErr) });
            }
          }
        } else {
          logger.info(
            `[Cron:storage-health-check] Org ${org.id} ("${org.name}") still unhealthy — notification already sent, skipping email`
          );
        }
      }
    }

    checked++;
  }

  return NextResponse.json({
    execution_id: executionId,
    started_at: startedAt,
    ended_at: new Date().toISOString(),
    duration_ms: Date.now() - startTime,
    success: true,
    checked,
    errors,
    skipped,
  });
}

// ── Provider health-check helpers ───────────────────────────────────────────

/**
 * Google Drive health-check: calls drive.about.get({ fields: 'user' }).
 * Uses the stored encrypted access token. If expired, the OAuth2 client will
 * attempt to refresh automatically when credentials include a refresh token.
 */
async function checkGoogleDriveHealth(org: {
  google_access_token_enc: string | null;
  google_refresh_token_enc: string | null;
}): Promise<boolean> {
  if (!org.google_access_token_enc) return false;

  const { auth: googleAuth } = await import("@googleapis/drive");
  const { drive: createDrive } = await import("@googleapis/drive");

  const accessToken = await decryptToken(org.google_access_token_enc);
  const refreshToken = org.google_refresh_token_enc
    ? await decryptToken(org.google_refresh_token_enc)
    : undefined;

  const oauth2Client = new googleAuth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({
    access_token: accessToken,
    ...(refreshToken ? { refresh_token: refreshToken } : {}),
  });

  const drive = createDrive({ version: "v3", auth: oauth2Client });
  const res = await drive.about.get({ fields: "user" });
  return res.status === 200;
}

/**
 * OneDrive health-check: acquires a token silently via MSAL, then makes a
 * lightweight GET /me/drive call to verify end-to-end Graph API access.
 */
async function checkOneDriveHealth(org: {
  ms_token_cache_enc: string | null;
  ms_home_account_id: string | null;
  id: string;
}): Promise<boolean> {
  if (!org.ms_token_cache_enc || !org.ms_home_account_id) return false;

  const { ConfidentialClientApplication } = await import("@azure/msal-node");
  const { PostgresMsalCachePlugin } = await import(
    "@/lib/storage/msal-cache-plugin"
  );

  const cachePlugin = new PostgresMsalCachePlugin(org.id);
  const msalClient = new ConfidentialClientApplication({
    auth: {
      clientId: process.env.MS_CLIENT_ID!,
      clientSecret: process.env.MS_CLIENT_SECRET!,
      authority: "https://login.microsoftonline.com/common",
    },
    cache: { cachePlugin },
  });

  const tokenCache = msalClient.getTokenCache();
  const account = await tokenCache.getAccountByHomeId(org.ms_home_account_id);
  if (!account) return false;

  const tokenResponse = await msalClient.acquireTokenSilent({
    account,
    scopes: ["Files.ReadWrite", "offline_access"],
  });

  if (!tokenResponse?.accessToken) return false;

  // Make a real Graph call to confirm end-to-end access
  const resp = await fetch("https://graph.microsoft.com/v1.0/me/drive", {
    headers: { Authorization: `Bearer ${tokenResponse.accessToken}` },
  });

  return resp.ok;
}

/**
 * Dropbox health-check: rehydrates DropboxAuth with the stored refresh token,
 * calls checkAndRefreshAccessToken() to ensure the token is still valid, then
 * calls usersGetCurrentAccount() as the lightest possible authenticated call.
 */
async function checkDropboxHealth(org: {
  dropbox_refresh_token_enc: string | null;
  dropbox_access_token_enc: string | null;
  dropbox_token_expires_at: string | null;
}): Promise<boolean> {
  if (!org.dropbox_refresh_token_enc) return false;

  const { DropboxAuth, Dropbox } = await import("dropbox");

  const refreshToken = await decryptToken(org.dropbox_refresh_token_enc);

  const dbxAuth = new DropboxAuth({
    clientId: process.env.DROPBOX_APP_KEY,
    clientSecret: process.env.DROPBOX_APP_SECRET,
    refreshToken,
  });

  await dbxAuth.checkAndRefreshAccessToken();

  const dbx = new Dropbox({ auth: dbxAuth });
  const result = await dbx.usersGetCurrentAccount();
  return !!result?.result?.account_id;
}
