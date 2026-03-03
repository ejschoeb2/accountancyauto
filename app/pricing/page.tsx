"use client";

import { useState } from "react";
import { Loader2, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { PlanTier } from "@/lib/stripe/plans";
import { PAID_PLAN_TIERS } from "@/lib/stripe/plans";
import { ButtonBase } from "@/components/ui/button-base";

const PLAN_TIERS = [
  {
    key: "free",
    name: "Free",
    price: 0 as number | null,
    range: "Up to 20 clients",
    tagline: "Get started at no cost. Upgrade naturally when your practice grows.",
    featured: false,
  },
  {
    key: "solo",
    name: "Solo",
    price: 19 as number | null,
    range: "21 – 50 clients",
    tagline: "For sole traders and bookkeepers managing a small client list.",
    featured: false,
  },
  {
    key: "starter",
    name: "Starter",
    price: 39 as number | null,
    range: "51 – 100 clients",
    tagline: "For independent accountants and small practices.",
    featured: false,
  },
  {
    key: "practice",
    name: "Practice",
    price: 69 as number | null,
    range: "101 – 200 clients",
    tagline: "For growing practices managing a wide range of deadlines.",
    featured: true,
  },
  {
    key: "firm",
    name: "Firm",
    price: 109 as number | null,
    range: "201 – 400 clients",
    tagline: "For established firms with a broad portfolio of clients.",
    featured: false,
  },
];

export default function PricingPage() {
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSelectTier(tierKey: string) {
    if (tierKey === "free") {
      window.location.href = "/signup";
      return;
    }

    if (!PAID_PLAN_TIERS.includes(tierKey as PlanTier)) return;

    setLoadingTier(tierKey);
    setError(null);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = `/login?redirect=/pricing`;
        return;
      }

      const orgId = user.app_metadata?.org_id;
      if (!orgId) {
        setError("No organisation found. Please complete onboarding first.");
        setLoadingTier(null);
        return;
      }

      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planTier: tierKey, orgId }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to start checkout");
        setLoadingTier(null);
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch {
      setError("Something went wrong. Please try again.");
      setLoadingTier(null);
    }
  }

  return (
    <div className="py-16">
      <div className="max-w-5xl mx-auto px-4 space-y-6">
        <div className="rounded-2xl border bg-card shadow-sm p-8 space-y-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">Choose your plan</h1>
            <p className="text-sm text-muted-foreground">
              Select the plan that fits your practice. You can upgrade or change any time from Settings.
            </p>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {/* 5 cards — single row */}
          <div className="grid grid-cols-5 gap-2">
            {PLAN_TIERS.map((plan) => {
              const isSelected = selectedTier === plan.key;
              const isThisLoading = loadingTier === plan.key;
              return (
                <div key={plan.key} className="flex flex-col">
                  <div
                    className={[
                      "flex flex-col flex-1 p-4 rounded-xl border-2 transition-all duration-200",
                      isSelected
                        ? "border-violet-500"
                        : "border-border/60 hover:border-border",
                    ].join(" ")}
                  >
                    <p className="text-sm font-bold text-foreground mb-3">{plan.name}</p>
                    <div className="mb-1">
                      {plan.price === 0 ? (
                        <>
                          <span className="text-2xl font-bold text-foreground tabular-nums">£0</span>
                          <span className="text-xs text-muted-foreground ml-1">free</span>
                        </>
                      ) : (
                        <>
                          <span className="text-2xl font-bold text-foreground tabular-nums">£{plan.price}</span>
                          <span className="text-xs text-muted-foreground ml-1">/mo</span>
                        </>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-foreground/60 mb-2">{plan.range}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed flex-1 mb-4">{plan.tagline}</p>
                    <ButtonBase
                      variant={isSelected ? "violet" : "muted"}
                      isSelected={isSelected}
                      buttonType="icon-text"
                      disabled={!!loadingTier}
                      onClick={() => {
                        setSelectedTier(plan.key);
                        handleSelectTier(plan.key);
                      }}
                    >
                      {isThisLoading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : isSelected ? (
                        <><Check className="size-4" /> Selected</>
                      ) : (
                        "Select"
                      )}
                    </ButtonBase>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-muted-foreground/60 text-center">All prices exclude VAT.</p>
        </div>
      </div>
    </div>
  );
}
