import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/auth/org-context";
import { getUsageStats } from "@/lib/billing/usage-limits";
import { getPlanByTier, type PlanTier } from "@/lib/stripe/plans";
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
import Link from "next/link";

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
  const planConfig = getPlanByTier(org.plan_tier as PlanTier);
  const usageStats = await getUsageStats(orgId);

  const hasSubscription = !!org.stripe_customer_id;

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

      {/* Manage billing / Choose a plan */}
      <Card>
        <CardHeader>
          <CardTitle>Manage subscription</CardTitle>
          <CardDescription>
            {hasSubscription
              ? "Update your payment method, change plan, or view invoices through the Stripe Customer Portal"
              : "Get started by choosing a plan for your practice"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ManageBillingButton orgId={orgId} hasSubscription={hasSubscription} />
        </CardContent>
      </Card>

      {/* No subscription state - additional guidance */}
      {!hasSubscription && (
        <Card>
          <CardContent className="py-8">
            <div className="text-center space-y-3">
              <p className="text-muted-foreground">
                No active subscription found. Choose a plan to get started.
              </p>
              <Link
                href="/pricing"
                className="text-primary underline underline-offset-4 hover:text-primary/80"
              >
                View pricing plans
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
