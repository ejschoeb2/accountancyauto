"use client";

import { useState } from "react";
import { Loader2, ArrowUpRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentCount: number;
  currentLimit: number;
  currentTierName: string;
  nextTierName: string;
  nextTierPrice: string; // e.g. "£39" or "£89"
  nextTierLimit: string; // e.g. "100 clients" or "Unlimited clients"
  onUpgrade: () => void | Promise<void>;
}

export function UpgradeModal({
  open,
  onOpenChange,
  currentCount,
  currentLimit,
  currentTierName,
  nextTierName,
  nextTierPrice,
  nextTierLimit,
  onUpgrade,
}: UpgradeModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleUpgrade = async () => {
    setIsLoading(true);
    try {
      await onUpgrade();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Client limit reached</DialogTitle>
          <DialogDescription>
            You&apos;ve used {currentCount} of {currentLimit} clients on your{" "}
            {currentTierName} plan. Upgrade to {nextTierName} for more capacity.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-3">
          {/* Current usage bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Current usage</span>
              <span className="font-medium">
                {currentCount}/{currentLimit} clients
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-violet-600"
                style={{
                  width: `${Math.min(100, (currentCount / currentLimit) * 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Next tier card */}
          <div className="rounded-lg border p-4 space-y-1">
            <p className="font-semibold">{nextTierName}</p>
            <p className="text-sm text-muted-foreground">
              {nextTierPrice}/mo &mdash; {nextTierLimit}
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
          <Button onClick={handleUpgrade} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Redirecting...
              </>
            ) : (
              <>
                Upgrade to {nextTierName}
                <ArrowUpRight className="size-4 ml-1" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
