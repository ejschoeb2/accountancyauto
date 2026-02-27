import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/auth/org-context";
import { getUsageStats } from "@/lib/billing/usage-limits";
import { getPlanByTier, type PlanTier } from "@/lib/stripe/plans";

/**
 * Maps legacy tier values to current valid tiers for display purposes.
 * The 'firm' tier was removed in Phase 23 — existing orgs on 'firm' are
 * displayed as 'practice' until their subscription is migrated.
 */
function getEffectivePlanTier(rawTier: string): PlanTier {
  if (rawTier === "firm") return "practice"; // Legacy migration
  return rawTier as PlanTier;
}
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { BillingStatusCard } from "./components/billing-status-card";
import { UsageBars } from "./components/usage-bars";
import { ManageBillingButton } from "./components/manage-billing-button";
import { UpgradePlanSection } from "./components/upgrade-plan-section";

export default async function BillingPage() {
  // Admin-only access: members cannot see billing page at all
  const { orgId, orgRole } = await getOrgContext();
  if (orgRole !== "admin") {
    redirect("/dashboard");
  }

  const supabase = await createClient();

  // Fetch org billing data (RLS scoped)
  const { data: org, error: orgError } = await supabase
    .from("organisations")
    .select(
      "plan_tier, subscription_status, trial_ends_at, stripe_customer_id, stripe_subscription_id, client_count_limit"
    )
    .eq("id", orgId)
    .single();

  if (orgError || !org) {
    return (
      <div className="space-y-8 max-w-7xl mx-auto">
        <div className="space-y-2">
          <h1>Billing</h1>
          <p className="text-muted-foreground">
            Manage your subscription and usage
          </p>
        </div>
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              Unable to load billing information. Please try again later.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get plan config and usage stats
  // getEffectivePlanTier maps legacy 'firm' -> 'practice' for display
  const planConfig = getPlanByTier(getEffectivePlanTier(org.plan_tier));
  const usageStats = await getUsageStats(orgId);

  const isFree = org.plan_tier === "free";
  const hasActiveSubscription = !!org.stripe_subscription_id;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="space-y-2">
        <h1>Billing</h1>
        <p className="text-muted-foreground">
          Manage your subscription and usage
        </p>
      </div>

      {/* Subscription status */}
      <BillingStatusCard
        planName={planConfig.name}
        subscriptionStatus={
          org.subscription_status as
            | "trialing"
            | "active"
            | "past_due"
            | "cancelled"
            | "unpaid"
        }
        trialEndsAt={org.trial_ends_at}
        monthlyPrice={planConfig.monthlyPrice}
      />

      {/* Usage metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Usage</CardTitle>
          <CardDescription>
            Current usage against your plan limits
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UsageBars
            clientCount={usageStats.clientCount}
            clientLimit={usageStats.clientLimit}
          />
        </CardContent>
      </Card>

      {/* Billing management */}
      {hasActiveSubscription ? (
        <Card>
          <CardHeader>
            <CardTitle>Manage subscription</CardTitle>
            <CardDescription>
              Update your payment method, change plan, or view invoices through
              the Stripe Customer Portal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ManageBillingButton orgId={orgId} hasSubscription={true} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Upgrade your plan</CardTitle>
            <CardDescription>
              {isFree
                ? "You're on the Free plan. Upgrade to unlock more clients and features."
                : "Choose a plan to unlock more clients and features."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UpgradePlanSection orgId={orgId} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
