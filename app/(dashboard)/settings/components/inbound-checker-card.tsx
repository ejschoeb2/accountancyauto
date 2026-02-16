"use client";

import { useState, useTransition } from "react";
import { Mail } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ToggleGroup } from "@/components/ui/toggle-group";
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
            <h2 className="text-lg font-semibold">Inbound Email Checker Configuration</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configure how the system responds to inbound emails with client documents
            </p>
          </div>

          <div className="space-y-3">
            <ToggleGroup
              options={[
                { value: "auto", label: "Make changes automatically" },
                { value: "recommend", label: "Provide recommendation only" },
              ]}
              value={mode}
              onChange={(value) => handleChange(value as InboundCheckerMode)}
              variant="muted"
              disabled={isPending}
            />

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
