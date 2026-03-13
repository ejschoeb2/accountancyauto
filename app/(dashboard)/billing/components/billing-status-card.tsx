"use client";

import { useState } from "react";
import { CreditCard, ExternalLink, Loader2, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ButtonBase } from "@/components/ui/button-base";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { UsageBars } from "./usage-bars";
import { UpgradePlanSection } from "./upgrade-plan-section";
import type { PlanTier } from "@/lib/stripe/plans";

type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "cancelled"
  | "unpaid";

interface BillingStatusCardProps {
  planName: string;
  planTier: PlanTier;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: string | null;
  monthlyPrice: number;
  orgId: string;
  hasSubscription: boolean;
  clientCount: number;
  clientLimit: number | null;
}

const STATUS_CONFIG: Record<
  SubscriptionStatus,
  { label: string; bgClass: string; textClass: string }
> = {
  active: {
    label: "Active",
    bgClass: "bg-green-500/10",
    textClass: "text-green-600",
  },
  trialing: {
    label: "Trial",
    bgClass: "bg-blue-500/10",
    textClass: "text-blue-500",
  },
  past_due: {
    label: "Payment overdue",
    bgClass: "bg-amber-500/10",
    textClass: "text-amber-600",
  },
  cancelled: {
    label: "Cancelled",
    bgClass: "bg-destructive/10",
    textClass: "text-destructive",
  },
  unpaid: {
    label: "Unpaid",
    bgClass: "bg-destructive/10",
    textClass: "text-destructive",
  },
};

/**
 * Format pence as a GBP string (e.g. 8900 -> "89").
 */
function formatPrice(pence: number): string {
  return (pence / 100).toFixed(0);
}

/**
 * Format a date string as "DD MMM YYYY" (e.g. "15 Mar 2026").
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Calculate days remaining from now to a target date.
 */
function daysRemaining(dateString: string): number {
  const now = new Date();
  const target = new Date(dateString);
  const diffMs = target.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

export function BillingStatusCard({
  planName,
  planTier,
  subscriptionStatus,
  trialEndsAt,
  monthlyPrice,
  orgId,
  hasSubscription,
  clientCount,
  clientLimit,
}: BillingStatusCardProps) {
  const statusConfig = STATUS_CONFIG[subscriptionStatus];
  const isTrialing = subscriptionStatus === "trialing" && trialEndsAt;
  const isPaidPlan = planTier !== "free";
  const canCancel = isPaidPlan && subscriptionStatus !== "cancelled";

  const [loading, setLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancelPlan() {
    setCancelLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/stripe/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, planTier: "free" }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to cancel plan");
        setCancelLoading(false);
        setCancelDialogOpen(false);
        return;
      }

      // Reload to reflect the updated plan
      window.location.reload();
    } catch (err) {
      console.error("Cancel plan error:", err);
      setError("Something went wrong. Please try again.");
      setCancelLoading(false);
      setCancelDialogOpen(false);
    }
  }

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

  return (
    <Card className="gap-1.5">
      {/* Header */}
      <div className="px-8">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold">Your Subscription</h2>
            <p className="text-sm text-muted-foreground">
              Your current plan and billing status
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            {hasSubscription && (
              <ButtonBase
                variant="violet"
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
            )}

            {canCancel && (
              <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
                <AlertDialogTrigger asChild>
                  <ButtonBase
                    variant="destructive"
                    buttonType="icon-text"
                  >
                    <XCircle className="size-4" />
                    Cancel plan
                  </ButtonBase>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure you want to cancel?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Your subscription will be cancelled immediately and your
                      organisation will be downgraded to the Free plan (10 clients).
                      You can resubscribe at any time.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={cancelLoading}>
                      Keep my plan
                    </AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={(e) => {
                        e.preventDefault();
                        handleCancelPlan();
                      }}
                      disabled={cancelLoading}
                    >
                      {cancelLoading ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Cancelling...
                        </>
                      ) : (
                        "Yes, cancel my plan"
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <CardContent className="space-y-6">
        {error && (
          <p className="text-sm font-medium text-status-danger">{error}</p>
        )}

        <div className={`grid gap-6 ${monthlyPrice > 0 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          {/* Plan name */}
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Plan
            </p>
            <p className="text-sm font-medium">{planName}</p>
          </div>

          {/* Status */}
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Status
            </p>
            <div className="flex items-center gap-2">
              <div
                className={`px-3 py-2 rounded-md inline-flex items-center ${statusConfig.bgClass}`}
              >
                <span className={`text-sm font-medium ${statusConfig.textClass}`}>
                  {statusConfig.label}
                </span>
              </div>
            </div>
            {isTrialing && (
              <p className="text-sm text-muted-foreground">
                Trial ends {formatDate(trialEndsAt)} ({daysRemaining(trialEndsAt)}{" "}
                {daysRemaining(trialEndsAt) === 1 ? "day" : "days"} remaining)
              </p>
            )}
          </div>

          {/* Price — hidden on free plan */}
          {monthlyPrice > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Price
              </p>
              <p className="text-sm font-medium">
                &pound;{formatPrice(monthlyPrice)}
                <span className="text-xs font-normal text-muted-foreground">
                  /mo
                </span>
              </p>
              <p className="text-xs text-muted-foreground">Excluding VAT</p>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Client Usage
          </p>
          <UsageBars clientCount={clientCount} clientLimit={clientLimit} />
        </div>

        {/* Change plan section */}
        <div className="space-y-4 pt-2">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Change your plan</h3>
            <p className="text-sm text-muted-foreground">
              Choose a plan that fits your needs.
            </p>
          </div>
          <UpgradePlanSection orgId={orgId} currentTier={planTier} hasSubscription={hasSubscription} clientCount={clientCount} />
        </div>
      </CardContent>
    </Card>
  );
}
