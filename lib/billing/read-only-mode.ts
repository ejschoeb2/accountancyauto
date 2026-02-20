import { createClient } from "@/lib/supabase/server";

/**
 * Determine whether an organisation is in read-only mode.
 *
 * Read-only mode means the org can view data but cannot send emails,
 * add clients, or modify data. This applies to:
 * - Cancelled subscriptions
 * - Past-due / unpaid subscriptions
 * - Expired trials (trial_ends_at has passed)
 *
 * Active subscriptions and valid trials are NOT read-only.
 */
export async function isOrgReadOnly(orgId: string): Promise<boolean> {
  const supabase = await createClient();

  const { data: org, error } = await supabase
    .from("organisations")
    .select("subscription_status, trial_ends_at")
    .eq("id", orgId)
    .single();

  // If org not found or query fails, default to read-only (safe default)
  if (error || !org) {
    return true;
  }

  const { subscription_status, trial_ends_at } = org;

  // Active subscription — not read-only
  if (subscription_status === "active") {
    return false;
  }

  // Valid trial — not read-only if trial hasn't expired
  if (subscription_status === "trialing" && trial_ends_at) {
    const trialEnd = new Date(trial_ends_at);
    if (trialEnd > new Date()) {
      return false;
    }
  }

  // All other cases: cancelled, past_due, unpaid, expired trial, null status
  return true;
}

/**
 * Convenience wrapper for server actions.
 *
 * Call at the top of any server action that modifies data. Throws an
 * error with a user-facing message if the org is in read-only mode.
 *
 * Usage:
 *   await requireWriteAccess(orgId);
 *   // ... proceed with mutation
 */
export async function requireWriteAccess(orgId: string): Promise<void> {
  const readOnly = await isOrgReadOnly(orgId);
  if (readOnly) {
    throw new Error(
      "Your subscription is inactive. Please update your billing to make changes."
    );
  }
}
