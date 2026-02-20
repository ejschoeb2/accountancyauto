"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";

interface ManageBillingButtonProps {
  orgId: string;
  hasSubscription: boolean;
}

export function ManageBillingButton({
  orgId,
  hasSubscription,
}: ManageBillingButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleManageBilling() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/stripe/create-portal-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to open billing portal");
        setLoading(false);
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Portal session error:", err);
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  if (!hasSubscription) {
    return (
      <Button asChild>
        <Link href="/pricing">Choose a plan</Link>
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <Button onClick={handleManageBilling} disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="animate-spin" />
            Opening portal...
          </>
        ) : (
          <>
            <ExternalLink />
            Manage billing
          </>
        )}
      </Button>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
