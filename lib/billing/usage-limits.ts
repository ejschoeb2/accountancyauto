import { createClient } from "@/lib/supabase/server";

export interface OrgBillingInfo {
  planTier: string;
  clientCount: number;
  clientLimit: number | null;
}

interface ClientLimitResult {
  allowed: boolean;
  currentCount: number;
  limit: number | null;
  message?: string;
}

interface UsageStats {
  clientCount: number;
  clientLimit: number | null;
  /** Percentage of client limit used (0-100), null if unlimited */
  clientUsagePercent: number | null;
}

/**
 * Check whether an organisation is allowed to add another client.
 *
 * Compares the current client count against the org's client_count_limit.
 * Returns allowed: true if the org has capacity (or unlimited).
 */
export async function checkClientLimit(
  orgId: string
): Promise<ClientLimitResult> {
  const supabase = await createClient();

  // Get the org's client count limit
  const { data: org, error: orgError } = await supabase
    .from("organisations")
    .select("client_count_limit")
    .eq("id", orgId)
    .single();

  if (orgError || !org) {
    return {
      allowed: false,
      currentCount: 0,
      limit: 0,
      message: "Unable to verify your plan. Please try again.",
    };
  }

  const limit = org.client_count_limit;

  // Unlimited plan — always allowed
  if (limit === null) {
    return { allowed: true, currentCount: 0, limit: null };
  }

  // Count clients for this org
  const { count, error: countError } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId);

  if (countError) {
    return {
      allowed: false,
      currentCount: 0,
      limit,
      message: "Unable to check your client count. Please try again.",
    };
  }

  const currentCount = count ?? 0;

  if (currentCount >= limit) {
    return {
      allowed: false,
      currentCount,
      limit,
      message: `You've reached your plan's client limit (${limit}). Upgrade your plan to add more clients.`,
    };
  }

  return { allowed: true, currentCount, limit };
}

/**
 * Get billing info for an organisation — tier, client count, and limit.
 *
 * Used by the upgrade modal to display current usage and next tier info.
 */
export async function getOrgBillingInfo(
  orgId: string
): Promise<OrgBillingInfo | null> {
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organisations")
    .select("plan_tier, client_count_limit")
    .eq("id", orgId)
    .single();

  if (!org) return null;

  const { count } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId);

  return {
    planTier: org.plan_tier,
    clientCount: count ?? 0,
    clientLimit: org.client_count_limit,
  };
}

/**
 * Get usage statistics for an organisation.
 *
 * Returns client count, limit, and usage percentage for billing page
 * usage bars and warnings.
 */
export async function getUsageStats(orgId: string): Promise<UsageStats> {
  const supabase = await createClient();

  // Get limit from org
  const { data: org } = await supabase
    .from("organisations")
    .select("client_count_limit")
    .eq("id", orgId)
    .single();

  const clientLimit = org?.client_count_limit ?? null;

  // Count clients for this org
  const { count } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId);

  const clientCount = count ?? 0;

  const clientUsagePercent =
    clientLimit !== null
      ? Math.round((clientCount / clientLimit) * 100)
      : null;

  return { clientCount, clientLimit, clientUsagePercent };
}
