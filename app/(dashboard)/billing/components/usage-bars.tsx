import Link from "next/link";

interface UsageBarsProps {
  clientCount: number;
  clientLimit: number | null;
}

interface UsageBarItemProps {
  label: string;
  current: number;
  limit: number | null;
  showUpgradeWarning?: boolean;
}

function getBarColor(percent: number | null): string {
  if (percent === null) return "bg-primary";
  if (percent >= 100) return "bg-destructive";
  if (percent >= 80) return "bg-amber-500";
  return "bg-primary";
}

function UsageBarItem({
  label,
  current,
  limit,
  showUpgradeWarning = false,
}: UsageBarItemProps) {
  const percent = limit !== null ? Math.min(Math.round((current / limit) * 100), 100) : null;
  const barWidth = percent !== null ? percent : current > 0 ? 15 : 0;
  const barColor = getBarColor(percent);
  const isAtLimit = percent !== null && percent >= 100;
  const isNearLimit = percent !== null && percent >= 80 && percent < 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm text-muted-foreground">
          {current} / {limit !== null ? limit : "Unlimited"}
          {percent !== null && (
            <span className="ml-2 font-medium">({percent}%)</span>
          )}
        </span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-secondary">
        <div
          className={`h-2.5 rounded-full transition-all ${barColor}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      {showUpgradeWarning && isNearLimit && (
        <p className="text-sm text-amber-600">
          You&apos;re approaching your client limit. Consider upgrading your plan.
        </p>
      )}
      {showUpgradeWarning && isAtLimit && (
        <p className="text-sm text-destructive">
          You&apos;ve reached your client limit.{" "}
          <Link href="/pricing" className="underline underline-offset-4 hover:text-destructive/80">
            Upgrade your plan
          </Link>{" "}
          to add more clients.
        </p>
      )}
    </div>
  );
}

export function UsageBars({
  clientCount,
  clientLimit,
}: UsageBarsProps) {
  return (
    <div className="space-y-6">
      <UsageBarItem
        label="Clients"
        current={clientCount}
        limit={clientLimit}
        showUpgradeWarning
      />
    </div>
  );
}
