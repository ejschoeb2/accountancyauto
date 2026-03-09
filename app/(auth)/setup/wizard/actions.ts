"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { seedOrgDefaults } from "@/lib/onboarding/seed-defaults";
import { type PlanTier, getPlanByTier } from "@/lib/stripe/plans";
import {
  createOrgServer,
  createOrgDomain,
  checkDomainVerification,
} from "@/lib/postmark/management";

// ─── Setup draft persistence ─────────────────────────────────────────────────

export interface SetupDraft {
  step: string;           // AdminStep value
  firmName?: string;
  firmSlug?: string;
  selectedTier?: string;  // PlanTier value
  importRows?: unknown[]; // EditableRow[] stored as JSON
  emailSubStep?: string;  // EmailSubStep value
  portalEnabled?: boolean;
  uploadCheckMode?: string;
  sendHour?: number;
  updatedAt: string;      // ISO timestamp
}

/**
 * Read the current setup draft from the organisation row.
 *
 * Returns null if no draft exists or the user has no organisation yet.
 * Follows the same auth pattern as markOrgSetupComplete.
 */
export async function getSetupDraft(): Promise<SetupDraft | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("user_organisations")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership?.org_id) return null;

  const { data } = await admin
    .from("organisations")
    .select("setup_draft")
    .eq("id", membership.org_id)
    .single();

  return (data?.setup_draft as SetupDraft) ?? null;
}

/**
 * Save (overwrite) the setup draft on the organisation row.
 *
 * Always stamps `updatedAt` before persisting.
 * Follows the same auth pattern as markOrgSetupComplete.
 */
export async function saveSetupDraft(
  draft: SetupDraft
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("user_organisations")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership?.org_id) return { error: "No organisation found." };

  draft.updatedAt = new Date().toISOString();

  const { error } = await admin
    .from("organisations")
    .update({ setup_draft: draft })
    .eq("id", membership.org_id);

  if (error) return { error: error.message };
  return {};
}

/**
 * Mark the current user's organisation as having completed the setup wizard.
 *
 * Called when the admin clicks "Go to Dashboard" on the final wizard step.
 * Until this is set, sign-in redirects the user back to the wizard.
 */
export async function markOrgSetupComplete(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("user_organisations")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership?.org_id) return { error: "No organisation found." };

  const { error } = await admin
    .from("organisations")
    .update({ setup_complete: true, setup_draft: null })
    .eq("id", membership.org_id);

  if (error) return { error: error.message };
  return {};
}

/**
 * Update the organisation's plan_tier and client_count_limit to match
 * the selected tier.
 *
 * Called during the wizard plan step so the import step sees the correct
 * client limit immediately — without waiting for the async Stripe webhook.
 * Idempotent: safe to call multiple times with the same or different tier.
 */
export async function updateOrgPlanTier(
  planTier: PlanTier
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("user_organisations")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership?.org_id) return { error: "No organisation found." };

  const plan = getPlanByTier(planTier);
  const { error } = await admin
    .from("organisations")
    .update({
      plan_tier: planTier,
      client_count_limit: plan.clientLimit,
    })
    .eq("id", membership.org_id);

  if (error) return { error: error.message };
  return {};
}

/**
 * Delete all clients belonging to the current user's organisation.
 *
 * Used during the wizard when the user switches to a plan with a lower
 * client limit after already importing clients. Uses the admin client
 * because the org may not have an active subscription yet (bypasses
 * requireWriteAccess billing check).
 */
export async function deleteAllWizardClients(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("user_organisations")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership?.org_id) return { error: "No organisation found." };

  const { error } = await admin
    .from("clients")
    .delete()
    .eq("org_id", membership.org_id);

  if (error) return { error: error.message };
  return {};
}

/**
 * Seeds default email templates and reminder schedules at the end of the
 * wizard, once the portal choice is known.
 *
 * Idempotent — safe to call multiple times (seedOrgDefaults checks for
 * existing templates before inserting).
 */
export async function seedOrgDefaultsForWizard(
  portalEnabled: boolean
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("user_organisations")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership?.org_id) return { error: "No organisation found." };

  await seedOrgDefaults(membership.org_id, user.id, admin, portalEnabled);
  return {};
}

/**
 * Force a server-side session refresh so the `.prompt.accountants` cross-subdomain
 * cookie is updated with a JWT that includes org_id in app_metadata.
 *
 * Problem: client-side refreshSession() (createBrowserClient) writes cookies
 * without a domain attribute, so they only apply to the root domain. The
 * middleware previously wrote `.prompt.accountants` cookies that are sent to
 * subdomains — but those may be stale (missing org_id) if the org was created
 * after the last middleware-triggered refresh. Calling refreshSession() here
 * goes through the server-side createClient(), whose setAll() writes with
 * domain=".prompt.accountants", updating the cross-subdomain cookie.
 */
export async function refreshWizardSession(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.refreshSession();
}

/**
 * Resolve the dashboard URL for the current user after wizard completion.
 *
 * Uses the admin client to bypass RLS — safe because we verify the user's
 * identity via supabase.auth.getUser() first, then only expose their own org.
 */
export async function getWizardDashboardUrl(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return "/dashboard";

  const admin = createAdminClient();

  const { data: userOrg } = await admin
    .from("user_organisations")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!userOrg?.org_id) return "/dashboard";

  const { data: org } = await admin
    .from("organisations")
    .select("slug")
    .eq("id", userOrg.org_id)
    .single();

  if (!org?.slug) return "/dashboard";

  const isDev = process.env.NODE_ENV === "development";
  if (isDev) {
    return `/dashboard?org=${org.slug}`;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://prompt.accountants";
  const baseDomain = appUrl.replace(/^https?:\/\/(www\.)?/, "");
  return `https://${org.slug}.app.${baseDomain}/dashboard`;
}

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
  "activity",
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
      client_count_limit: 10,
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
    { org_id: org.id, user_id: null, key: "onboarding_complete", value: "true" },
    { onConflict: "org_id,user_id,key" }
  );

  // Note: default email templates and schedules are seeded at wizard
  // completion (seedOrgDefaultsForWizard) so the portal choice is known.

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
      "name, slug, postmark_server_id, postmark_domain_id, postmark_server_token, postmark_sender_domain"
    )
    .eq("id", orgId)
    .single();

  if (!org) {
    return { success: false, error: "Organisation not found." };
  }

  try {
    // ── Step 1: Create Server (if not yet created) ──────────────────────────
    let serverToken: string;

    if (!org.postmark_server_id) {
      const serverResult = await createOrgServer(org.name, org.slug);
      serverToken = serverResult.serverToken;

      await admin
        .from("organisations")
        .update({
          postmark_server_token: serverToken,
          postmark_server_id: serverResult.serverId,
        })
        .eq("id", orgId);
    } else {
      serverToken = org.postmark_server_token ?? "";
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
      dkimPendingHost = domainData.DKIMPendingHost || domainData.DKIMTextHost || "";
      dkimPendingValue = domainData.DKIMPendingTextValue || domainData.DKIMPendingValue || domainData.DKIMTextValue || "";
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
    };
  } catch (err) {
    console.error("setupPostmarkForOrg error:", err);
    const raw = err instanceof Error ? err.message : "";
    let friendly = "Failed to configure email. Please try again.";
    if (raw.includes("createDomain failed")) {
      friendly = "We couldn't register that domain. Please check it's spelled correctly and try again.";
    } else if (raw.includes("createServer failed")) {
      friendly = "Something went wrong setting up your email server. Please try again or contact support.";
    } else if (raw.includes("getDomain failed")) {
      friendly = "We couldn't verify your domain right now. Please try again in a few moments.";
    } else if (raw.includes("POSTMARK_ACCOUNT_TOKEN")) {
      friendly = "Email service is not configured. Please contact support.";
    }
    return {
      success: false,
      error: friendly,
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

// ─── In-wizard signup / OTP verification ──────────────────────────────────────

/**
 * Create an unconfirmed account and trigger a 6-digit OTP verification email.
 *
 * IMPORTANT: The Supabase "Confirm signup" email template must use {{ .Token }}
 * (the 6-digit code) instead of {{ .ConfirmationURL }} for this flow to work.
 * Update it in the Supabase Dashboard → Authentication → Email Templates.
 *
 * Returns { alreadyConfirmed: true } when email confirmation is disabled (dev/test
 * environments), allowing the wizard to skip straight to the firm step.
 */
export async function startSignup(
  email: string,
  password: string
): Promise<{ error?: string; alreadyConfirmed?: boolean }> {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("already registered") || msg.includes("already exists")) {
      return { error: "An account with this email already exists. Please sign in." };
    }
    if (msg.includes("rate limit") || error.status === 429) {
      return { error: "Too many attempts. Please wait a few minutes and try again." };
    }
    return { error: "Failed to create account. Please try again." };
  }

  // Email confirmation disabled — user is immediately signed in (dev/test)
  if (data.session) {
    return { alreadyConfirmed: true };
  }

  return {};
}

/**
 * Verify the 6-digit OTP code sent to the user's email during signup.
 * On success the session is established and the user is signed in.
 */
export async function verifyEmailOtp(
  email: string,
  token: string
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "signup",
  });

  if (error) {
    return { error: "Invalid or expired code. Please check your email and try again." };
  }

  return {};
}

/**
 * Resend the signup OTP verification email.
 */
export async function resendEmailOtp(
  email: string
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
  });

  if (error) {
    return { error: "Failed to resend. Please try again in a moment." };
  }

  return {};
}
