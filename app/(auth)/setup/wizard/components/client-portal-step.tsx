"use client";

import { useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Users, HardDrive, Mail } from "lucide-react";
import { ButtonBase } from "@/components/ui/button-base";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setClientPortalEnabled } from "@/app/actions/settings";

interface ClientPortalStepProps {
  onComplete: (enabled: boolean) => void;
  onBack: () => void;
}

export function ClientPortalStep({ onComplete, onBack }: ClientPortalStepProps) {
  const [selection, setSelection] = useState<"yes" | "no" | "">("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleContinue() {
    if (!selection) return;
    const enabled = selection === "yes";
    setError(null);
    startTransition(async () => {
      const result = await setClientPortalEnabled(enabled);
      if (result.error) {
        setError(result.error);
        return;
      }
      onComplete(enabled);
    });
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4 min-h-[520px]">
      <div className="rounded-2xl border bg-card shadow-sm p-8 space-y-6">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Client Portal</h2>
          <p className="text-sm text-muted-foreground">
            The client portal lets your clients upload documents directly to Prompt — such as tax
            returns, bank statements, or any files you request. Prompt tracks received documents per
            client and updates statuses automatically.
          </p>
        </div>

        {/* Feature highlights */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card className="group py-5">
            <CardContent className="px-5 py-0 space-y-3">
              <div className="size-10 rounded-lg bg-violet-500/10 flex items-center justify-center transition-all duration-200 group-hover:bg-violet-500/20">
                <Users className="size-5 text-violet-500" />
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-semibold">Client self-service</p>
                <p className="text-sm text-muted-foreground">
                  Clients upload documents themselves via a secure link
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="group py-5">
            <CardContent className="px-5 py-0 space-y-3">
              <div className="size-10 rounded-lg bg-violet-500/10 flex items-center justify-center transition-all duration-200 group-hover:bg-violet-500/20">
                <Mail className="size-5 text-violet-500" />
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-semibold">Email integration</p>
                <p className="text-sm text-muted-foreground">
                  Include a portal link in reminder emails so clients can respond directly
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="group py-5">
            <CardContent className="px-5 py-0 space-y-3">
              <div className="size-10 rounded-lg bg-violet-500/10 flex items-center justify-center transition-all duration-200 group-hover:bg-violet-500/20">
                <HardDrive className="size-5 text-violet-500" />
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-semibold">Your storage</p>
                <p className="text-sm text-muted-foreground">
                  In the next step, connect Google Drive, OneDrive, or Dropbox so uploaded files
                  go straight there
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Selection */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Would you like to enable the client portal?</p>
          <Select
            value={selection}
            onValueChange={(v) => setSelection(v as "yes" | "no")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select an option…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">Yes, enable the client portal</SelectItem>
              <SelectItem value="no">No, we&apos;ll handle documents manually</SelectItem>
            </SelectContent>
          </Select>

          {selection === "no" && (
            <p className="text-xs text-muted-foreground">
              You can still track document receipt manually per client, and any documents received
              via your inbound email address will still update client document statuses. You can
              enable the portal at any time from Settings.
            </p>
          )}
          {selection === "yes" && (
            <p className="text-xs text-muted-foreground">
              In the next step you can optionally link your file management system — uploaded
              documents will be organised automatically into subfolders by client and filing type.
            </p>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <div className="flex justify-end gap-2">
        <ButtonBase variant="amber" buttonType="icon-text" onClick={onBack} disabled={isPending}>
          <ArrowLeft className="size-4" />
          Back
        </ButtonBase>
        <ButtonBase
          variant="green"
          buttonType="icon-text"
          onClick={handleContinue}
          disabled={!selection || isPending}
        >
          {isPending ? "Saving…" : selection === "no" ? "Skip Storage" : "Next Step"}
          <ArrowRight className="size-4" />
        </ButtonBase>
      </div>
    </div>
  );
}
