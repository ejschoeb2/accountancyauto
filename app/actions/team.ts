"use server";

import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { sendInviteEmail } from "@/lib/billing/notifications";
import { logger } from '@/lib/logger';

export interface TeamMember {
  id: string;
  userId?: string;
  email: string;
  role: "admin" | "member";
  status: "active" | "pending";
  joinedAt?: string;
  expiresAt?: string;
}

/**
 * Get all team members (active + pending) for the current user's org.
 *
 * Active members: rows from user_organisations.
 * Pending members: rows from invitations where accepted_at IS NULL and expires_at > now().
 *
 * Email resolution uses auth admin API (PostgREST FK joins to auth.users don't work).
 */
export async function getTeamMembers(): Promise<TeamMember[]> {
  const { orgId } = await getOrgContext();
  const admin = createAdminClient();

  // --- Active members ---
  const { data: memberships, error: membersError } = await admin
    .from("user_organisations")
    .select("id, user_id, role, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });

  if (membersError) {
    logger.error("getTeamMembers: failed to fetch memberships:", { error: (membersError as any)?.message ?? String(membersError) });
    throw new Error("Failed to load team members.");
  }

  const activeMembers: TeamMember[] = [];
  for (const m of memberships ?? []) {
    try {
      const {
        data: { user },
        error: userError,
      } = await admin.auth.admin.getUserById(m.user_id);

      if (userError || !user?.email) {
        logger.warn(`getTeamMembers: could not resolve email for user ${m.user_id}:`, { error: (userError as any)?.message ?? String(userError) });
        continue;
      }

      activeMembers.push({
        id: m.id,
        userId: m.user_id,
        email: user.email,
        role: m.role as "admin" | "member",
        status: "active",
        joinedAt: m.created_at,
      });
    } catch (err) {
      logger.warn(`getTeamMembers: error fetching user ${m.user_id}:`, { error: (err as any)?.message ?? String(err) });
    }
  }

  // --- Pending invitations (not expired, not accepted) ---
  const { data: invitations, error: invitesError } = await admin
    .from("invitations")
    .select("id, email, role, expires_at, created_at")
    .eq("org_id", orgId)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true });

  if (invitesError) {
    logger.error("getTeamMembers: failed to fetch invitations:", { error: (invitesError as any)?.message ?? String(invitesError) });
    // Non-fatal — return active members only
    return activeMembers;
  }

  const pendingMembers: TeamMember[] = (invitations ?? []).map((inv) => ({
    id: inv.id,
    email: inv.email,
    role: inv.role as "admin" | "member",
    status: "pending" as const,
    expiresAt: inv.expires_at,
  }));

  return [...activeMembers, ...pendingMembers];
}

/**
 * Send an invite email to a new team member.
 *
 * Enforces:
 * - Caller must be an admin
 * - No duplicate active invite for same email+org
 * - No already-active member with the same email
 *
 * No seat limits — user count is not part of the billing model.
 */
export async function sendInvite(
  email: string,
  role: "admin" | "member"
): Promise<{ error?: string }> {
  const { orgId, orgRole } = await getOrgContext();

  if (orgRole !== "admin") {
    return { error: "Only admins can send invites." };
  }

  const admin = createAdminClient();

  // Fetch org name for the invite email
  const { data: org, error: orgError } = await admin
    .from("organisations")
    .select("name")
    .eq("id", orgId)
    .single();

  if (orgError || !org) {
    return { error: "Failed to load organisation details." };
  }

  // --- Check if email is already an active member ---
  // The invitations table stores email directly. For user_organisations we
  // need user_id — we check this by scanning memberships and resolving
  // their emails via the auth admin API. This is only done for membership
  // checks (not a hot path). We use listUsers with a filter param — the
  // Supabase admin API supports ?email= filter on GET /admin/users.
  //
  // Simpler alternative: check if any active membership has this email by
  // looking up all members and comparing. Since orgs are small (< 100 users)
  // this is acceptable.
  const { data: allMemberships } = await admin
    .from("user_organisations")
    .select("user_id")
    .eq("org_id", orgId);

  for (const membership of allMemberships ?? []) {
    try {
      const {
        data: { user: memberUser },
      } = await admin.auth.admin.getUserById(membership.user_id);
      if (memberUser?.email?.toLowerCase() === email.toLowerCase()) {
        return { error: "This person is already a member of your team." };
      }
    } catch {
      // Ignore individual lookup errors
    }
  }

  // --- Check for existing pending invite ---
  const { data: existingInvite } = await admin
    .from("invitations")
    .select("id")
    .eq("org_id", orgId)
    .eq("email", email)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (existingInvite) {
    return {
      error: "An invite has already been sent to this email.",
    };
  }

  // --- Generate token ---
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");
  const expiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  // --- Insert invitation ---
  const { error: insertError } = await admin.from("invitations").insert({
    org_id: orgId,
    email,
    role,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  if (insertError) {
    logger.error("sendInvite: failed to insert invitation:", { error: (insertError as any)?.message ?? String(insertError) });
    return { error: "Failed to send invite. Please try again." };
  }

  // --- Resolve inviter email ---
  const supabase = await createClient();
  const {
    data: { user: inviterUser },
  } = await supabase.auth.getUser();

  const inviterEmail = inviterUser?.email ?? "your colleague";

  // --- Build accept URL ---
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const acceptUrl = `${appUrl}/invite/accept?token=${encodeURIComponent(rawToken)}`;

  // --- Send email ---
  try {
    await sendInviteEmail(email, org.name, inviterEmail, role, acceptUrl);
  } catch (err) {
    logger.error("sendInvite: failed to send invite email:", { error: (err as any)?.message ?? String(err) });
    // Invite row already created — the invite exists but email failed.
    // Return error so admin can retry (resendInvite).
    return {
      error:
        "Invite created but email failed to send. Use 'Resend' to try again.",
    };
  }

  return {};
}

/**
 * Remove a team member from the current org.
 *
 * Prevents removal of the last admin (TEAM-06).
 */
export async function removeTeamMember(
  targetUserId: string
): Promise<{ error?: string }> {
  const { orgId, orgRole } = await getOrgContext();

  if (orgRole !== "admin") {
    return { error: "Only admins can remove team members." };
  }

  const admin = createAdminClient();

  // Check target's current role
  const { data: targetMembership, error: targetError } = await admin
    .from("user_organisations")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (targetError || !targetMembership) {
    return { error: "Team member not found." };
  }

  // Prevent removing the last admin
  if (targetMembership.role === "admin") {
    const { count: adminCount, error: adminCountError } = await admin
      .from("user_organisations")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("role", "admin");

    if (adminCountError) {
      return { error: "Failed to verify admin count." };
    }

    if ((adminCount ?? 0) <= 1) {
      return {
        error:
          "Cannot remove the last admin. Promote another member to admin first.",
      };
    }
  }

  const { error: deleteError } = await admin
    .from("user_organisations")
    .delete()
    .eq("org_id", orgId)
    .eq("user_id", targetUserId);

  if (deleteError) {
    logger.error("removeTeamMember: failed to delete membership:", { error: (deleteError as any)?.message ?? String(deleteError) });
    return { error: "Failed to remove team member." };
  }

  return {};
}

/**
 * Change a team member's role.
 *
 * Prevents demoting the last admin (TEAM-06).
 */
export async function changeRole(
  targetUserId: string,
  newRole: "admin" | "member"
): Promise<{ error?: string }> {
  const { orgId, orgRole } = await getOrgContext();

  if (orgRole !== "admin") {
    return { error: "Only admins can change roles." };
  }

  const admin = createAdminClient();

  // If demoting from admin, check we're not removing the last admin
  if (newRole === "member") {
    const { data: targetMembership } = await admin
      .from("user_organisations")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (targetMembership?.role === "admin") {
      const { count: adminCount } = await admin
        .from("user_organisations")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("role", "admin");

      if ((adminCount ?? 0) <= 1) {
        return { error: "Cannot demote the last admin." };
      }
    }
  }

  const { error: updateError } = await admin
    .from("user_organisations")
    .update({ role: newRole })
    .eq("org_id", orgId)
    .eq("user_id", targetUserId);

  if (updateError) {
    logger.error("changeRole: failed to update role:", { error: (updateError as any)?.message ?? String(updateError) });
    return { error: "Failed to update role." };
  }

  return {};
}

/**
 * Cancel a pending invitation.
 */
export async function cancelInvite(
  inviteId: string
): Promise<{ error?: string }> {
  const { orgId, orgRole } = await getOrgContext();

  if (orgRole !== "admin") {
    return { error: "Only admins can cancel invites." };
  }

  const admin = createAdminClient();

  const { error: deleteError } = await admin
    .from("invitations")
    .delete()
    .eq("id", inviteId)
    .eq("org_id", orgId);

  if (deleteError) {
    logger.error("cancelInvite: failed to delete invitation:", { error: (deleteError as any)?.message ?? String(deleteError) });
    return { error: "Failed to cancel invite." };
  }

  return {};
}

/**
 * Resend a pending invitation with a fresh token and 7-day expiry.
 */
export async function resendInvite(
  inviteId: string
): Promise<{ error?: string }> {
  const { orgId, orgRole } = await getOrgContext();

  if (orgRole !== "admin") {
    return { error: "Only admins can resend invites." };
  }

  const admin = createAdminClient();

  // Look up the invitation
  const { data: invite, error: inviteError } = await admin
    .from("invitations")
    .select("id, email, role, org_id")
    .eq("id", inviteId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (inviteError || !invite) {
    return { error: "Invite not found." };
  }

  // Generate new token
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");
  const expiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  // Update the invitation
  const { error: updateError } = await admin
    .from("invitations")
    .update({ token_hash: tokenHash, expires_at: expiresAt })
    .eq("id", inviteId)
    .eq("org_id", orgId);

  if (updateError) {
    logger.error("resendInvite: failed to update invitation:", { error: (updateError as any)?.message ?? String(updateError) });
    return { error: "Failed to resend invite." };
  }

  // Get org name for email
  const { data: org } = await admin
    .from("organisations")
    .select("name")
    .eq("id", orgId)
    .single();

  // Resolve inviter email
  const supabase = await createClient();
  const {
    data: { user: inviterUser },
  } = await supabase.auth.getUser();

  const inviterEmail = inviterUser?.email ?? "your colleague";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const acceptUrl = `${appUrl}/invite/accept?token=${encodeURIComponent(rawToken)}`;

  try {
    await sendInviteEmail(
      invite.email,
      org?.name ?? "your organisation",
      inviterEmail,
      invite.role,
      acceptUrl
    );
  } catch (err) {
    logger.error("resendInvite: failed to send email:", { error: (err as any)?.message ?? String(err) });
    return {
      error:
        "Token refreshed but email failed to send. Please try resending again.",
    };
  }

  return {};
}
