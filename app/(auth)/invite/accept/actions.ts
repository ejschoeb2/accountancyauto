"use server";

import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Validate an invite token and return invite details for the accept page.
 *
 * Uses the admin client (service-role) because the accepting user has no
 * org_id in their JWT yet — RLS on invitations would block the query.
 *
 * @param token - Raw invite token from the URL query parameter
 */
export async function validateInviteToken(token: string): Promise<{
  valid: boolean;
  orgName?: string;
  role?: string;
  error?: string;
}> {
  if (!token || token.length === 0) {
    return { valid: false, error: "This invite link is invalid or has expired." };
  }

  const tokenHash = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  const admin = createAdminClient();

  // Look up invitation by token hash — must be unaccepted and not expired
  const { data: invite, error: inviteError } = await admin
    .from("invitations")
    .select("id, org_id, email, role, expires_at")
    .eq("token_hash", tokenHash)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (inviteError) {
    console.error("validateInviteToken: database error:", inviteError);
    return { valid: false, error: "Failed to validate invite. Please try again." };
  }

  if (!invite) {
    return { valid: false, error: "This invite link is invalid or has expired." };
  }

  // Get org name
  const { data: org, error: orgError } = await admin
    .from("organisations")
    .select("name")
    .eq("id", invite.org_id)
    .single();

  if (orgError || !org) {
    console.error("validateInviteToken: failed to fetch org:", orgError);
    return { valid: false, error: "Failed to load organisation details." };
  }

  return {
    valid: true,
    orgName: org.name,
    role: invite.role,
  };
}

/**
 * Accept a team invite and add the current user to the organisation.
 *
 * Uses admin client for DB writes because the user has no org_id in their
 * JWT yet — RLS would block the INSERT into user_organisations.
 *
 * @param token - Raw invite token from the URL query parameter
 * @returns orgSlug on success, or error message on failure
 */
export async function acceptInvite(
  token: string
): Promise<{ orgSlug?: string; error?: string }> {
  if (!token || token.length === 0) {
    return { error: "Invalid invite token." };
  }

  const tokenHash = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  const admin = createAdminClient();

  // Look up invitation
  const { data: invite, error: inviteError } = await admin
    .from("invitations")
    .select("id, org_id, email, role, expires_at")
    .eq("token_hash", tokenHash)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (inviteError) {
    console.error("acceptInvite: database error:", inviteError);
    return { error: "Failed to process invite. Please try again." };
  }

  if (!invite) {
    return { error: "This invite link is invalid or has expired." };
  }

  // Get the current authenticated user
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "You must be signed in to accept this invite." };
  }

  // Check if user already belongs to any org
  const { data: existingMembership, error: membershipError } = await admin
    .from("user_organisations")
    .select("id, org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError) {
    console.error("acceptInvite: failed to check existing membership:", membershipError);
    return { error: "Failed to process invite. Please try again." };
  }

  if (existingMembership) {
    if (existingMembership.org_id === invite.org_id) {
      // Already in this org — return success so they can proceed to dashboard
      const { data: org } = await admin
        .from("organisations")
        .select("slug")
        .eq("id", invite.org_id)
        .single();
      return { orgSlug: org?.slug };
    }
    return {
      error:
        "You already belong to another organisation. You must leave your current organisation before joining a new one.",
    };
  }

  // Add user to the organisation
  const { error: insertError } = await admin.from("user_organisations").insert({
    user_id: user.id,
    org_id: invite.org_id,
    role: invite.role,
  });

  if (insertError) {
    console.error("acceptInvite: failed to insert user_organisations:", insertError);
    return { error: "Failed to join organisation. Please try again." };
  }

  // Mark the invitation as accepted (single-use enforcement)
  const { error: updateError } = await admin
    .from("invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  if (updateError) {
    // Non-fatal — user is already added. Log but don't fail.
    console.error("acceptInvite: failed to mark invite as accepted:", updateError);
  }

  // Get org slug for redirect
  const { data: org, error: orgError } = await admin
    .from("organisations")
    .select("slug")
    .eq("id", invite.org_id)
    .single();

  if (orgError || !org) {
    console.error("acceptInvite: failed to fetch org slug:", orgError);
    // User was added successfully — return a generic success
    return { orgSlug: undefined };
  }

  return { orgSlug: org.slug };
}
