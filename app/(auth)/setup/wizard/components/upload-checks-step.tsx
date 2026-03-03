"use client";

import { useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, ShieldCheck, Eye, FileSearch, Zap } from "lucide-react";
import { ButtonBase } from "@/components/ui/button-base";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setUploadCheckMode, type UploadCheckMode } from "@/app/actions/settings";

interface UploadChecksStepProps {
  onComplete: () => void;
  onBack: () => void;
}

export function UploadChecksStep({ onComplete, onBack }: UploadChecksStepProps) {
  const [selection, setSelection] = useState<UploadCheckMode | "">("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleContinue() {
    if (!selection) return;
    setError(null);
    startTransition(async () => {
      const result = await setUploadCheckMode(selection);
      if (result.error) {
        setError(result.error);
        return;
      }
      onComplete();
    });
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4 min-h-[520px]">
      <div className="rounded-2xl border bg-card shadow-sm p-8 space-y-6">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Upload Checks</h2>
          <p className="text-sm text-muted-foreground">
            Choose what processing Prompt runs when clients upload documents through the portal.
            You can change this at any time from Settings.
          </p>
        </div>

        {/* Mode highlights */}
        <div className="rounded-xl border divide-y divide-border">
          <div className="flex items-start gap-4 p-4">
            <div className="size-9 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
              <ShieldCheck className="size-5 text-violet-500" />
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-semibold">Verify uploads</p>
              <p className="text-sm text-muted-foreground">
                Checks uploaded documents for mismatches (e.g. wrong tax year, unexpected document
                type) and flags them with an amber warning so you can review before processing.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4 p-4">
            <div className="size-9 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
              <FileSearch className="size-5 text-violet-500" />
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-semibold">Extract metadata</p>
              <p className="text-sm text-muted-foreground">
                Reads tax year, employer name, and PAYE reference from uploaded documents using OCR
                and shows a confirmation card to the client after upload.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4 p-4">
            <div className="size-9 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
              <Zap className="size-5 text-violet-500" />
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-semibold">No processing</p>
              <p className="text-sm text-muted-foreground">
                Uploads are accepted and categorised by filename keywords only. No OCR or validation
                runs &mdash; fastest option for high-volume practices.
              </p>
            </div>
          </div>
        </div>

        {/* Selection */}
        <div className="space-y-2">
          <p className="text-sm font-medium">How should Prompt process client uploads?</p>
          <Select
            value={selection}
            onValueChange={(v) => setSelection(v as UploadCheckMode)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a mode..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="both">Verify & extract metadata (Recommended)</SelectItem>
              <SelectItem value="verify">Verify uploads only</SelectItem>
              <SelectItem value="extract">Extract metadata only</SelectItem>
              <SelectItem value="none">No processing</SelectItem>
            </SelectContent>
          </Select>

          {selection === "both" && (
            <p className="text-xs text-muted-foreground">
              Uploads are verified for mismatches and metadata is extracted &mdash; clients see a
              confirmation card with extracted details plus any warnings.
            </p>
          )}
          {selection === "verify" && (
            <p className="text-xs text-muted-foreground">
              Uploads are checked for mismatches and flagged with warnings. No metadata extraction
              or confirmation card is shown.
            </p>
          )}
          {selection === "extract" && (
            <p className="text-xs text-muted-foreground">
              Metadata is extracted and shown to the client. No mismatch validation runs.
            </p>
          )}
          {selection === "none" && (
            <p className="text-xs text-muted-foreground">
              Documents are categorised by filename only. No OCR or validation &mdash; fastest for
              high-volume practices.
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
          {isPending ? "Saving..." : "Next Step"}
          <ArrowRight className="size-4" />
        </ButtonBase>
      </div>
    </div>
  );
}
