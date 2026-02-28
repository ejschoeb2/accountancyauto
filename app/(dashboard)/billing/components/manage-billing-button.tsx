"use client";

import { useState } from "react";
import { ButtonBase } from "@/components/ui/button-base";
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
      <Link href="/pricing">
        <ButtonBase variant="green" buttonType="icon-text">
          <ExternalLink className="size-4" />
          Choose a plan
        </ButtonBase>
      </Link>
    );
  }

  return (
    <div className="space-y-2">
      <ButtonBase
        variant="blue"
        buttonType="icon-text"
        onClick={handleManageBilling}
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Opening portal...
          </>
        ) : (
          <>
            <ExternalLink className="size-4" />
            Manage billing
          </>
        )}
      </ButtonBase>
      {error && (
        <p className="text-sm font-medium text-status-danger">{error}</p>
      )}
    </div>
  );
}
