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
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Inbound Email Checker</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Configure how the system responds to inbound emails with client documents
              </p>
            </div>
            <div className="px-3 py-2 rounded-md inline-flex items-center bg-violet-500/10 shrink-0">
              <span className="text-sm font-medium text-violet-500">Beta Feature</span>
            </div>
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
              </SelectContent>
            </Select>

            <p className="text-xs text-muted-foreground">
              {mode === "auto" ? (
                <>
                  <strong>Automatic mode:</strong> When a client sends documents, the system will automatically mark records as received and update their status to "Records Received".
                </>
              ) : (
                <>
                  <strong>Recommendation mode:</strong> When a client sends documents, the system will notify you but won&apos;t make any changes. You&apos;ll need to manually update client records.
                </>
              )}
            </p>
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
