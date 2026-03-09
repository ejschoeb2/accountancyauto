"use client";

import { useState } from "react";
import { Loader2, ArrowRight } from "lucide-react";
import { ButtonBase } from "@/components/ui/button-base";
import {
  PLAN_TIERS,
  PAID_PLAN_TIERS,
  type PlanTier,
} from "@/lib/stripe/plans";

interface UpgradePlanSectionProps {
  orgId: string;
}

function formatPrice(pence: number): string {
  return `£${(pence / 100).toFixed(0)}`;
}

export function UpgradePlanSection({ orgId }: UpgradePlanSectionProps) {
  const [loadingTier, setLoadingTier] = useState<PlanTier | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleUpgrade(tier: PlanTier) {
    setLoadingTier(tier);
    setError(null);

    try {
      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planTier: tier, orgId }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to start checkout. Please try again.");
        setLoadingTier(null);
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Checkout error:", err);
      setError("Something went wrong. Please try again.");
      setLoadingTier(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {PAID_PLAN_TIERS.map((tier) => {
          const plan = PLAN_TIERS[tier];
          const isLoading = loadingTier === tier;

          return (
            <div key={tier} className="flex flex-col relative">
              <div
                className="flex flex-col flex-1 p-4 rounded-xl border-2 transition-all duration-200 border-border/60 hover:border-border"
              >
                <p className="text-sm font-bold text-foreground mb-3">{plan.name}</p>

                <div className="mb-1">
                  <span className="text-2xl font-bold text-foreground tabular-nums">
                    {formatPrice(plan.monthlyPrice)}
                  </span>
                  <span className="text-xs text-muted-foreground ml-1">/mo</span>
                </div>

                <p className="text-xs font-semibold text-foreground/60 mb-4">
                  {plan.clientLimit === null ? "Unlimited clients" : `Up to ${plan.clientLimit} clients`}
                </p>

                <ButtonBase
                  variant="violet"
                  buttonType="icon-text"
                  onClick={() => handleUpgrade(tier)}
                  disabled={loadingTier !== null}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Redirecting...
                    </>
                  ) : (
                    <>
                      Get Started
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </ButtonBase>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground mt-1">All prices exclude VAT.</p>
    </div>
  );
}
