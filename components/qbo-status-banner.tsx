import Link from "next/link";
import { CheckCircle, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

interface QboStatusBannerProps {
  connected: boolean;
  lastSyncTime?: string;
}

export function QboStatusBanner({ connected, lastSyncTime }: QboStatusBannerProps) {
  if (connected) {
    const syncLabel = lastSyncTime
      ? `Last synced: ${formatDistanceToNow(new Date(lastSyncTime), { addSuffix: true })}`
      : "Last synced: never";

    return (
      <div className="w-full bg-status-success/5 border-b border-status-success/20 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <CheckCircle className="size-5 text-status-success shrink-0" />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-status-success">
              QuickBooks connected
            </span>
            <span className="text-sm text-muted-foreground">
              {syncLabel}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-status-warning/10 border-b border-status-warning/20 px-6 py-3">
      <div className="max-w-7xl mx-auto flex items-center gap-3">
        <AlertTriangle className="size-5 text-status-warning shrink-0" />
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-status-warning">
            QuickBooks disconnected
          </span>
          <Badge variant="outline" className="border-status-warning/30 bg-status-warning/10 text-status-warning hover:bg-status-warning/20">
            <Link href="/onboarding" className="hover:underline">
              Reconnect
            </Link>
          </Badge>
        </div>
      </div>
    </div>
  );
}
