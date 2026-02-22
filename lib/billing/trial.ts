import { SupabaseClient } from "@supabase/supabase-js";

/** Trial duration in days */
const TRIAL_DURATION_DAYS = 14;

/** Trial orgs get Practice tier access (mid-range, not full unlock) */
const TRIAL_PLAN_TIER = "practice";
const TRIAL_CLIENT_LIMIT = 150;

/**
 * Set up a trial for an organisation.
 *
 * Gives the org Practice-tier access for 14 days. The daily
 * trial-expiry cron job will transition orgs to 'unpaid' when
 * their trial period ends.
 *
 * @param orgId - The organisation to set up trial for
 * @param supabase - A Supabase client (typically admin/service-role
 *                   since this is called during onboarding)
 * @returns The updated organisation row
 */
export async function createTrialForOrg(
  orgId: string,
  supabase: SupabaseClient
) {
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DURATION_DAYS);

  const { data, error } = await supabase
    .from("organisations")
    .update({
      plan_tier: TRIAL_PLAN_TIER,
      subscription_status: "trialing",
      trial_ends_at: trialEndsAt.toISOString(),
      client_count_limit: TRIAL_CLIENT_LIMIT,
    })
    .eq("id", orgId)
    .select()
    .single();

  if (error) {
    throw new Error(
      `Failed to create trial for org ${orgId}: ${error.message}`
    );
  }

  return data;
}
