"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PLAN_TIERS, type PlanTier } from "@/lib/stripe/plans";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const TIER_ORDER: PlanTier[] = ["lite", "sole_trader", "practice", "firm"];
const RECOMMENDED_TIER: PlanTier = "practice";

/**
 * Format pence as a GBP currency string (e.g. 8900 -> "89").
 * We show just the pounds value since all prices are round numbers.
 */
function formatPrice(pence: number): string {
  return (pence / 100).toFixed(0);
}

function formatLimit(limit: number | null, noun: string): string {
  if (limit === null) return `Unlimited ${noun}`;
  return `Up to ${limit} ${noun}`;
}

export default function PricingPage() {
  const [loadingTier, setLoadingTier] = useState<PlanTier | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleChoosePlan(tier: PlanTier) {
    setLoadingTier(tier);
    setError(null);

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // If not authenticated, redirect to login with return URL
      if (!session) {
        window.location.href = `/login?redirect=/pricing`;
        return;
      }

      // Get org_id from session claims
      const orgId =
        session.user.app_metadata?.org_id;

      if (!orgId) {
        setError(
          "No organisation found. Please complete onboarding first."
        );
        setLoadingTier(null);
        return;
      }

      // Create checkout session
      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planTier: tier, orgId }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to start checkout");
        setLoadingTier(null);
        return;
      }

      // Redirect to Stripe Checkout
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
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          Simple, transparent pricing
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Choose the plan that fits your practice. All plans include automated
          client reminders, deadline tracking, and email management.
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="mx-auto max-w-md mb-8 rounded-md bg-destructive/10 px-4 py-3 text-center text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Plan cards grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {TIER_ORDER.map((tier) => {
          const plan = PLAN_TIERS[tier];
          const isRecommended = tier === RECOMMENDED_TIER;
          const isLoading = loadingTier === tier;

          return (
            <Card
              key={tier}
              className={`relative flex flex-col ${
                isRecommended
                  ? "border-primary ring-2 ring-primary/20"
                  : ""
              }`}
            >
              {isRecommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                    Popular
                  </span>
                </div>
              )}

              <CardHeader>
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                <CardDescription>
                  {formatLimit(plan.clientLimit, "clients")}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-1">
                {/* Price */}
                <div className="mb-6">
                  <span className="text-4xl font-bold">
                    &pound;{formatPrice(plan.monthlyPrice)}
                  </span>
                  <span className="text-muted-foreground">/mo</span>
                </div>

                {/* Feature list */}
                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter>
                <Button
                  className="w-full"
                  variant={isRecommended ? "default" : "outline"}
                  onClick={() => handleChoosePlan(tier)}
                  disabled={loadingTier !== null}
                >
                  {isLoading ? "Redirecting..." : "Get Started"}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* VAT note */}
      <p className="mt-8 text-center text-sm text-muted-foreground">
        All prices exclude VAT where applicable.
      </p>
    </div>
  );
}
