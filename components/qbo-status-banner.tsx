"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/badge";

interface QboStatusBannerProps {
  connected: boolean;
}

export function QboStatusBanner({ connected }: QboStatusBannerProps) {
  // Only show banner when disconnected
  if (connected) {
    return null;
  }

  return (
    <div className="w-full bg-status-warning/10 border-b border-status-warning/20 px-6 py-3">
      <div className="max-w-7xl mx-auto flex items-center gap-3">
        <Icon name="warning" size="md" className="text-status-warning shrink-0" />
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
