"use client";

import { useState, useTransition } from "react";
import { Mail } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  updateInboundCheckerMode,
  type InboundCheckerMode,
} from "@/app/actions/settings";

interface InboundCheckerCardProps {
  defaultMode: InboundCheckerMode;
}

export function InboundCheckerCard({ defaultMode }: InboundCheckerCardProps) {
  const [mode, setMode] = useState<InboundCheckerMode>(defaultMode);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleChange(newMode: InboundCheckerMode) {
    setMode(newMode);
    setSaved(false);
    setError(null);

    startTransition(async () => {
      const result = await updateInboundCheckerMode(newMode);

      if (result.error) {
        setError(result.error);
        setMode(defaultMode);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  }

  return (
    <Card className="p-6">
      <div className="flex items-start gap-4">
        <div className="flex items-center justify-center size-12 rounded-lg bg-violet-500/10 shrink-0">
          <Mail className="size-6 text-violet-500" />
        </div>
        <div className="flex-1 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Inbound Email Checker</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configure how the system responds to inbound emails with client documents
            </p>
          </div>

          <div className="space-y-3">
            <Select
              value={mode}
              onValueChange={(value) => handleChange(value as InboundCheckerMode)}
              disabled={isPending}
            >
              <SelectTrigger className="h-9 min-w-[280px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Make changes automatically</SelectItem>
                <SelectItem value="recommend">Provide recommendation only</SelectItem>
                <SelectItem value="off">Disabled — don&apos;t track replies</SelectItem>
              </SelectContent>
            </Select>

            <div className="space-y-2 text-xs text-muted-foreground">
              <p className={mode === "auto" ? "text-foreground font-medium" : ""}>
                <strong>Automatic:</strong> When a client emails you documents, the system automatically marks their records as received, updates their filing status to &ldquo;Records Received&rdquo;, and logs the change. No manual action needed.
              </p>
              <p className={mode === "recommend" ? "text-foreground font-medium" : ""}>
                <strong>Recommendation only:</strong> When a client emails you documents, the system logs the inbound email and notifies you, but won&apos;t update any client records. You review each email and decide whether to mark records as received yourself.
              </p>
              <p className={mode === "off" ? "text-foreground font-medium" : ""}>
                <strong>Disabled:</strong> Client replies are not tracked. Inbound emails received at your Postmark address are ignored.
              </p>
            </div>
          </div>

          {saved && (
            <span className="text-sm text-green-600 font-medium">
              Saved
            </span>
          )}
          {error && (
            <span className="text-sm text-status-danger font-medium">
              {error}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
