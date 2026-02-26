"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { seedOrgDefaults } from "@/lib/onboarding/seed-defaults";
import type { PlanTier } from "@/lib/stripe/plans";
import {
  createOrgServer,
  createOrgDomain,
  checkDomainVerification,
} from "@/lib/postmark/management";

/** Reserved slugs that cannot be used as org slugs */
const RESERVED_SLUGS = [
  "www",
  "app",
  "api",
  "admin",
  "billing",
  "onboarding",
  "invite",
  "pricing",
  "login",
  "dashboard",
  "clients",
  "settings",
  "templates",
  "schedules",
  "email-logs",
  "rollover",
];

/**
 * Check whether an org slug is available and valid.
 *
 * Returns { available: true } or { available: false, reason: "..." }
 */
export async function checkSlugAvailable(
  slug: string
): Promise<{ available: boolean; reason?: string }> {
  // Validate format: lowercase letters, numbers, and hyphens only.
  // Must be at least 3 characters (or 1 character if single alphanumeric).
  const multiCharPattern = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
  const singleCharPattern = /^[a-z0-9]$/;

  if (slug.length === 0) {
    return { available: false, reason: "Slug cannot be empty." };
  }

  if (slug.length === 1) {
    if (!singleCharPattern.test(slug)) {
      return {
        available: false,
        reason:
          "Slug must contain only lowercase letters and numbers.",
      };
    }
  } else if (slug.length === 2) {
    return {
      available: false,
      reason: "Slug must be at least 3 characters long.",
    };
  } else {
    if (!multiCharPattern.test(slug)) {
      return {
        available: false,
        reason:
          "Slug must start and end with a letter or number, and may only contain lowercase letters, numbers, and hyphens.",
      };
    }
  }

  // Check reserved slugs
  if (RESERVED_SLUGS.includes(slug)) {
    return {
      available: false,
      reason: "This slug is reserved. Please choose a different one.",
    };
  }

  // Check existing slugs in the database
  const admin = createAdminClient();
  const { data } = await admin
    .from("organisations")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (data) {
    return {
      available: false,
      reason: "This slug is already taken. Please choose a different one.",
    };
  }

  return { available: true };
}

/**
 * Create an organisation and join it as an admin.
 *
 * Uses the admin (service-role) client for all DB writes because the user
 * has no org_id in their JWT yet — RLS would block any INSERT that requires
 * org_id = auth_org_id(). After this action succeeds, the client must call
 * supabase.auth.refreshSession() to get a new JWT with org_id in app_metadata.
 */
export async function createOrgAndJoinAsAdmin(
  firmName: string,
  slug: string,
  planTier: PlanTier
): Promise<{ orgId: string; slug: string }> {
  // Verify the user is authenticated
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated. Please sign in and try again.");
  }

  const admin = createAdminClient();

  // Prevent double-create: check if user already has a user_organisations row
  const { data: existingMembership } = await admin
    .from("user_organisations")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingMembership?.org_id) {
    // User already has an org — resolve and return existing
    const { data: existingOrg } = await admin
      .from("organisations")
      .select("id, slug")
      .eq("id", existingMembership.org_id)
      .single();

    if (existingOrg) {
      return { orgId: existingOrg.id, slug: existingOrg.slug };
    }
    throw new Error("You already belong to an organisation.");
  }

  // 1. Insert the organisation row (always starts on free — Stripe webhook upgrades paid plans).
  // Seed platform Postmark defaults so reminders send immediately even if the admin skips
  // the Email Setup wizard step. The Email Setup step upgrades these to a custom domain.
  const { data: org, error: orgError } = await admin
    .from("organisations")
    .insert({
      name: firmName,
      slug,
      plan_tier: "free",
      subscription_status: "active",
      client_count_limit: 25,
      postmark_server_token: process.env.POSTMARK_SERVER_TOKEN ?? null,
      postmark_sender_domain: process.env.POSTMARK_SENDER_DOMAIN ?? null,
    })
    .select()
    .single();

  if (orgError) {
    if (orgError.code === "23505") {
      throw new Error(
        "This slug is already taken. Please go back and choose a different one."
      );
    }
    throw new Error(`Failed to create organisation: ${orgError.message}`);
  }

  // 2. Insert user_organisations row (admin role)
  const { error: memberError } = await admin.from("user_organisations").insert({
    user_id: user.id,
    org_id: org.id,
    role: "admin",
  });

  if (memberError) {
    throw new Error(`Failed to join organisation: ${memberError.message}`);
  }

  // 3. Mark onboarding complete in app_settings
  await admin.from("app_settings").upsert(
    { org_id: org.id, key: "onboarding_complete", value: "true" },
    { onConflict: "org_id,key" }
  );

  // 4. Seed default email templates and reminder schedules
  await seedOrgDefaults(org.id, user.id, admin);

  return { orgId: org.id, slug: org.slug };
}

// ─── Postmark email setup actions ─────────────────────────────────────────────

export interface SetupPostmarkResult {
  success: boolean;
  error?: string;
  dkimPendingHost?: string;
  dkimPendingValue?: string;
  returnPathHost?: string;
  returnPathCnameValue?: string;
  inboundAddress?: string;
}

/**
 * Provision a Postmark Server and Domain for the current org.
 *
 * Idempotent: if server/domain already created (non-null IDs), skips creation
 * and returns stored DNS record values from the DB.
 */
export async function setupPostmarkForOrg(
  domain: string
): Promise<SetupPostmarkResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated." };
  }

  const admin = createAdminClient();

  // Get the org for this user
  const { data: membership } = await admin
    .from("user_organisations")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership?.org_id) {
    return { success: false, error: "No organisation found for this user." };
  }

  const orgId = membership.org_id;

  // Fetch current org state to check idempotency
  const { data: org } = await admin
    .from("organisations")
    .select(
      "name, slug, postmark_server_id, postmark_domain_id, postmark_server_token, postmark_sender_domain, inbound_address"
    )
    .eq("id", orgId)
    .single();

  if (!org) {
    return { success: false, error: "Organisation not found." };
  }

  try {
    // ── Step 1: Create Server (if not yet created) ──────────────────────────
    let serverToken: string;
    let inboundAddress: string;

    if (!org.postmark_server_id) {
      const serverResult = await createOrgServer(org.name, org.slug);
      serverToken = serverResult.serverToken;
      inboundAddress = serverResult.inboundAddress;

      await admin
        .from("organisations")
        .update({
          postmark_server_token: serverToken,
          postmark_server_id: serverResult.serverId,
          inbound_address: inboundAddress,
        })
        .eq("id", orgId);
    } else {
      serverToken = org.postmark_server_token ?? "";
      inboundAddress = org.inbound_address ?? "";
    }

    // ── Step 2: Create Domain (if not yet created) ──────────────────────────
    let dkimPendingHost: string;
    let dkimPendingValue: string;
    let returnPathHost: string;
    let returnPathCnameValue: string;

    if (!org.postmark_domain_id) {
      const domainResult = await createOrgDomain(domain);
      dkimPendingHost = domainResult.dkimPendingHost;
      dkimPendingValue = domainResult.dkimPendingValue;
      returnPathHost = domainResult.returnPathHost;
      returnPathCnameValue = domainResult.returnPathCnameValue;

      await admin
        .from("organisations")
        .update({
          postmark_sender_domain: domain,
          postmark_domain_id: domainResult.domainId,
        })
        .eq("id", orgId);
    } else {
      // Domain already created — re-fetch DNS details from Postmark
      const verifyResult = await checkDomainVerification(org.postmark_domain_id);
      // We don't have the original pending values stored, so we re-fetch the domain details
      const res = await fetch(
        `https://api.postmarkapp.com/domains/${org.postmark_domain_id}`,
        {
          headers: {
            Accept: "application/json",
            "X-Postmark-Account-Token": process.env.POSTMARK_ACCOUNT_TOKEN ?? "",
          },
        }
      );
      const domainData = await res.json();
      dkimPendingHost = domainData.DKIMPendingHost ?? domainData.DKIMTextHost ?? "";
      dkimPendingValue = domainData.DKIMPendingValue ?? domainData.DKIMTextValue ?? "";
      returnPathHost = `pm-bounces.${org.postmark_sender_domain ?? domain}`;
      returnPathCnameValue = domainData.ReturnPathDomainCNAMEValue ?? "pm.mtasv.net";

      // Update verification status if both verified
      if (verifyResult.dkimVerified && verifyResult.returnPathVerified) {
        await admin
          .from("organisations")
          .update({ email_domain_verified: true })
          .eq("id", orgId);
      }
    }

    return {
      success: true,
      dkimPendingHost,
      dkimPendingValue,
      returnPathHost,
      returnPathCnameValue,
      inboundAddress,
    };
  } catch (err) {
    console.error("setupPostmarkForOrg error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to configure email. Please try again.",
    };
  }
}

/**
 * Check DNS verification status for the org's Postmark domain.
 *
 * If both DKIM and Return-Path are verified, marks the org as verified in DB.
 */
export async function checkOrgDomainVerification(): Promise<{
  dkimVerified: boolean;
  returnPathVerified: boolean;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { dkimVerified: false, returnPathVerified: false };
  }

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("user_organisations")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership?.org_id) {
    return { dkimVerified: false, returnPathVerified: false };
  }

  const orgId = membership.org_id;

  const { data: org } = await admin
    .from("organisations")
    .select("postmark_domain_id")
    .eq("id", orgId)
    .single();

  if (!org?.postmark_domain_id) {
    return { dkimVerified: false, returnPathVerified: false };
  }

  const result = await checkDomainVerification(org.postmark_domain_id);

  if (result.dkimVerified && result.returnPathVerified) {
    await admin
      .from("organisations")
      .update({ email_domain_verified: true })
      .eq("id", orgId);
  }

  return result;
}

/**
 * Send a setup magic link to the provided email.
 *
 * The emailRedirectTo goes through the existing /auth/callback route.
 * After code exchange, if the user has no org (new signup), the callback
 * redirects them to /setup/wizard automatically.
 */
export async function sendSetupMagicLink(
  email: string
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: callbackUrl,
    },
  });

  if (error) {
    console.error("Setup magic link error:", error);
    return { error: "Failed to send login link. Please try again." };
  }

  return {};
}
