import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "cancelled"
  | "unpaid";

interface BillingStatusCardProps {
  planName: string;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: string | null;
  monthlyPrice: number;
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
  subscriptionStatus,
  trialEndsAt,
  monthlyPrice,
}: BillingStatusCardProps) {
  const statusConfig = STATUS_CONFIG[subscriptionStatus];
  const isTrialing = subscriptionStatus === "trialing" && trialEndsAt;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subscription</CardTitle>
        <CardDescription>Your current plan and billing status</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 sm:grid-cols-3">
          {/* Plan name */}
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Plan</p>
            <p className="text-2xl font-bold">{planName}</p>
          </div>

          {/* Status */}
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Status</p>
            <div className="flex items-center gap-2">
              <div
                className={`px-3 py-1 rounded-md inline-flex items-center ${statusConfig.bgClass}`}
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

          {/* Price */}
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Price</p>
            <p className="text-2xl font-bold">
              &pound;{formatPrice(monthlyPrice)}
              <span className="text-sm font-normal text-muted-foreground">
                /mo
              </span>
            </p>
            <p className="text-xs text-muted-foreground">Excluding VAT</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
