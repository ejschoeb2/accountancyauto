"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PricingSlider } from "@/components/pricing-slider";
import type { PlanTier } from "@/lib/stripe/plans";
import { PAID_PLAN_TIERS } from "@/lib/stripe/plans";

export default function PricingPage() {
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSelectTier(tierKey: string) {
    // Free → redirect to signup
    if (tierKey === "free") {
      window.location.href = "/signup";
      return;
    }
    // Enterprise → mailto (handled by default href)
    if (tierKey === "enterprise") {
      window.location.href = "mailto:hello@phasetwo.uk";
      return;
    }
    // Paid tiers → Stripe Checkout
    if (!PAID_PLAN_TIERS.includes(tierKey as PlanTier)) return;

    setLoadingTier(tierKey);
    setError(null);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        window.location.href = `/login?redirect=/pricing`;
        return;
      }

      const orgId = session.user.app_metadata?.org_id;
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
      {error && (
        <div className="mx-auto max-w-md mb-8 rounded-md bg-destructive/10 px-4 py-3 text-center text-sm text-destructive">
          {error}
        </div>
      )}
      <PricingSlider
        defaultClients={1}
        onSelectTier={(tier) => handleSelectTier(tier)}
        isLoading={!!loadingTier}
        loadingTier={loadingTier}
      />
    </div>
  );
}
