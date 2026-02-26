"use client";

import { useState } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PLAN_TIERS, PAID_PLAN_TIERS, type PlanTier } from "@/lib/stripe/plans";

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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {PAID_PLAN_TIERS.map((tier) => {
          const plan = PLAN_TIERS[tier];
          const isPopular = tier === "practice";
          const isLoading = loadingTier === tier;

          return (
            <Card
              key={tier}
              className={isPopular ? "ring-2 ring-primary relative" : "relative"}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                    <Sparkles className="size-3" />
                    Popular
                  </span>
                </div>
              )}
              <CardContent className="pt-6 flex flex-col h-full space-y-4">
                <div className="space-y-1">
                  <h3 className="font-semibold text-lg">{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">
                      {formatPrice(plan.monthlyPrice)}
                    </span>
                    <span className="text-muted-foreground text-sm">/mo</span>
                  </div>
                </div>

                <div className="space-y-1.5 flex-1">
                  <p className="text-sm text-muted-foreground">
                    {plan.clientLimit === null
                      ? "Unlimited clients"
                      : `Up to ${plan.clientLimit} clients`}
                  </p>
                  <ul className="space-y-1 pt-2">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm">
                        <Check className="size-3.5 text-green-600 shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                <Button
                  className="w-full active:scale-[0.97]"
                  variant={isPopular ? "default" : "outline"}
                  onClick={() => handleUpgrade(tier)}
                  disabled={loadingTier !== null}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="size-4 mr-2 animate-spin" />
                      Redirecting...
                    </>
                  ) : (
                    "Get Started"
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">All prices exclude VAT.</p>
    </div>
  );
}
