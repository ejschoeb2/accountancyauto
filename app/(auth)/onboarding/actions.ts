"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createTrialForOrg } from "@/lib/billing/trial";
import type { PlanTier } from "@/lib/stripe/plans";

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

  // 1. Insert the organisation row
  const { data: org, error: orgError } = await admin
    .from("organisations")
    .insert({
      name: firmName,
      slug,
      plan_tier: planTier,
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

  // 3. Set up 14-day trial
  await createTrialForOrg(org.id, admin);

  // 4. Mark onboarding complete in app_settings
  await admin.from("app_settings").upsert(
    { org_id: org.id, key: "onboarding_complete", value: "true" },
    { onConflict: "org_id,key" }
  );

  return { orgId: org.id, slug: org.slug };
}

/**
 * Send an onboarding magic link to the provided email.
 *
 * The emailRedirectTo goes through the existing /auth/callback route.
 * After code exchange, if the user has no org (new signup), the middleware
 * redirects them to /onboarding automatically.
 */
export async function sendOnboardingMagicLink(
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
    console.error("Onboarding magic link error:", error);
    return { error: "Failed to send login link. Please try again." };
  }

  return {};
}
