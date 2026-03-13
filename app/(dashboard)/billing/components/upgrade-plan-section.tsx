"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowUp, ArrowDown } from "lucide-react";
import { ButtonBase } from "@/components/ui/button-base";
import {
  PLAN_TIERS,
  PAID_PLAN_TIERS,
  type PlanTier,
} from "@/lib/stripe/plans";

/** Tier ordering for upgrade/downgrade comparison (higher index = higher tier) */
const TIER_ORDER: PlanTier[] = ["free", "solo", "starter", "practice", "firm", "enterprise"];

/** Tiers shown in the plan picker (free + all paid tiers) */
const SELECTABLE_TIERS: PlanTier[] = ["free", ...PAID_PLAN_TIERS];

interface UpgradePlanSectionProps {
  orgId: string;
  currentTier: PlanTier;
  hasSubscription: boolean;
  clientCount: number;
}

function formatPrice(pence: number): string {
  return `£${(pence / 100).toFixed(0)}`;
}

function getTierIndex(tier: PlanTier): number {
  return TIER_ORDER.indexOf(tier);
}

export function UpgradePlanSection({ orgId, currentTier, hasSubscription, clientCount }: UpgradePlanSectionProps) {
  const router = useRouter();
  const [loadingTier, setLoadingTier] = useState<PlanTier | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentIndex = getTierIndex(currentTier);

  async function handlePlanAction(tier: PlanTier) {
    setLoadingTier(tier);
    setError(null);

    const tierIndex = getTierIndex(tier);
    const isDowngrade = tierIndex < currentIndex;

    // For downgrades, check if client count exceeds the target plan's limit
    if (isDowngrade) {
      const targetPlan = PLAN_TIERS[tier];
      const targetLimit = targetPlan.clientLimit;

      if (targetLimit !== null && clientCount > targetLimit) {
        // Redirect to client selection page
        router.push(`/settings/downgrade?plan=${tier}`);
        return;
      }
    }

    try {
      // Downgrading to free = cancel subscription via change-plan
      if (tier === "free") {
        const response = await fetch("/api/stripe/change-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planTier: "free", orgId }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Something went wrong. Please try again.");
          setLoadingTier(null);
          return;
        }

        window.location.reload();
        return;
      }

      // Existing subscribers: change plan via subscription update
      // New subscribers: create checkout session
      const endpoint = hasSubscription
        ? "/api/stripe/change-plan"
        : "/api/stripe/create-checkout-session";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planTier: tier, orgId }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setLoadingTier(null);
        return;
      }

      if (hasSubscription) {
        // Plan changed via API — reload to reflect the new plan
        window.location.reload();
      } else if (data.url) {
        // New subscription — redirect to Stripe Checkout
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Plan change error:", err);
      setError("Something went wrong. Please try again.");
      setLoadingTier(null);
    }
  }

  // Show all selectable plans except the current one
  const availablePlans = SELECTABLE_TIERS.filter((tier) => tier !== currentTier);

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className={`grid gap-3 ${availablePlans.length <= 3 ? "grid-cols-3" : "grid-cols-2 xl:grid-cols-4"}`}>
        {availablePlans.map((tier) => {
          const plan = PLAN_TIERS[tier];
          const isLoading = loadingTier === tier;
          const tierIndex = getTierIndex(tier);
          const isUpgrade = tierIndex > currentIndex;

          return (
            <div key={tier} className="flex flex-col relative">
              <div
                className="flex flex-col flex-1 p-4 rounded-xl border-2 transition-all duration-200 border-border/60 hover:border-border"
              >
                <p className="text-sm font-bold text-foreground mb-3">{plan.name}</p>

                <div className="mb-1">
                  <span className="text-2xl font-bold text-foreground tabular-nums">
                    {plan.monthlyPrice === 0 ? "Free" : formatPrice(plan.monthlyPrice)}
                  </span>
                  {plan.monthlyPrice > 0 && (
                    <span className="text-xs text-muted-foreground ml-1">/mo</span>
                  )}
                </div>

                <p className="text-xs font-semibold text-foreground/60 mb-4">
                  {plan.clientLimit === null ? "Unlimited clients" : `Up to ${plan.clientLimit} clients`}
                </p>

                <ButtonBase
                  variant={isUpgrade ? "violet" : "muted"}
                  buttonType="icon-text"
                  onClick={() => handlePlanAction(tier)}
                  disabled={loadingTier !== null}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {hasSubscription ? "Changing..." : "Redirecting..."}
                    </>
                  ) : isUpgrade ? (
                    <>
                      Upgrade
                      <ArrowUp className="size-4" />
                    </>
                  ) : (
                    <>
                      Downgrade
                      <ArrowDown className="size-4" />
                    </>
                  )}
                </ButtonBase>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground mt-1">
        {hasSubscription
          ? "Plan changes are prorated. You'll be charged or credited for the difference."
          : "All prices exclude VAT."}
      </p>
    </div>
  );
}
