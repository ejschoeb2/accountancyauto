"use client";

import { useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, ShieldCheck, FileSearch, Info } from "lucide-react";
import { ButtonBase } from "@/components/ui/button-base";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setUploadCheckMode, setAutoReceiveVerified, setRejectMismatchedUploads, type UploadCheckMode } from "@/app/actions/settings";

interface UploadChecksStepProps {
  onComplete: (mode: UploadCheckMode, autoReceive: boolean, rejectMismatched: boolean) => void;
  onBack: () => void;
  initialSelection?: UploadCheckMode;
  initialAutoReceive?: boolean;
  initialRejectMismatched?: boolean;
}

export function UploadChecksStep({ onComplete, onBack, initialSelection, initialAutoReceive, initialRejectMismatched }: UploadChecksStepProps) {
  const [selection, setSelection] = useState<UploadCheckMode | "">(initialSelection ?? "");
  const [autoReceive, setAutoReceive] = useState<"yes" | "no">(initialAutoReceive ? "yes" : "no");
  const [rejectMismatched, setRejectMismatched] = useState<"yes" | "no">(initialRejectMismatched ? "yes" : "no");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const showVerifyOptions = selection === "both" || selection === "verify";

  function handleContinue() {
    if (!selection) return;
    setError(null);
    startTransition(async () => {
      const result = await setUploadCheckMode(selection);
      if (result.error) {
        setError(result.error);
        return;
      }
      const autoReceiveEnabled = showVerifyOptions && autoReceive === "yes";
      const rejectMismatchedEnabled = showVerifyOptions && rejectMismatched === "yes";
      const arResult = await setAutoReceiveVerified(autoReceiveEnabled);
      if (arResult.error) {
        setError(arResult.error);
        return;
      }
      const rmResult = await setRejectMismatchedUploads(rejectMismatchedEnabled);
      if (rmResult.error) {
        setError(rmResult.error);
        return;
      }
      onComplete(selection, autoReceiveEnabled, rejectMismatchedEnabled);
    });
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4 min-h-[520px]">
      <div className="rounded-2xl border bg-card shadow-sm p-8 space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Upload Checks</h2>
          <p className="text-sm text-muted-foreground">
            When a client uploads a document through the portal, Prompt can automatically check it
            for you &mdash; for example, catching a P60 with the wrong tax year or reading key
            details like a PAYE reference. Choose below how much processing you&apos;d like. You can
            try it out with a test upload in the sandbox (a safe testing area where nothing
            is sent to real clients) and change this at any time from Settings.
          </p>
        </div>

        <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/10">
          <Info className="size-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-600 space-y-1">
            <p>
              <strong className="font-medium">Your clients&apos; data stays private.</strong> When
              Prompt checks a document, it reads the file briefly in memory, pulls out the details
              it needs (like a tax year or reference number), and then immediately discards the
              original content.
            </p>
            <p>
              No document text, images, or sensitive information is ever stored by Prompt &mdash;
              only the small pieces of metadata it extracted are saved alongside the upload record.
            </p>
          </div>
        </div>

        {/* Mode highlights */}
        <p className="text-sm font-semibold">What each mode does</p>
        <Card className="p-6 space-y-3">
          <div className="flex items-start gap-4">
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
          <div className="flex items-start gap-4">
            <div className="size-9 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
              <FileSearch className="size-5 text-violet-500" />
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-semibold">Extract metadata</p>
              <p className="text-sm text-muted-foreground">
                Uses text recognition (OCR) to read key details — such as tax year and PAYE
                reference — from uploaded documents and shows a confirmation card to the client
                after upload.
              </p>
            </div>
          </div>
        </Card>

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

        {/* Verify-dependent options — only visible when verification is enabled */}
        {showVerifyOptions && (
          <div className="pt-2 border-t space-y-2">
            <div className="space-y-1">
              <p className="text-sm font-medium">Reject mismatched HMRC documents</p>
              <p className="text-xs text-muted-foreground">
                When enabled, portal uploads of HMRC documents (P60, P45, SA302) that
                clearly have the wrong tax year are rejected and the client is told to
                upload the correct document. Other document types are unaffected.
              </p>
            </div>
            <Select
              value={rejectMismatched}
              onValueChange={(v) => setRejectMismatched(v as "yes" | "no")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no">Disabled (warn only)</SelectItem>
                <SelectItem value="yes">Enabled (reject wrong documents)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {showVerifyOptions && (
          <div className="pt-2 border-t space-y-2">
            <div className="space-y-1">
              <p className="text-sm font-medium">Auto-confirm verified uploads</p>
              <p className="text-xs text-muted-foreground">
                When enabled, portal uploads with a &ldquo;Verified&rdquo; verdict are automatically
                marked as received. Uploads that need review or have low confidence remain
                pending for manual confirmation.
              </p>
            </div>
            <Select
              value={autoReceive}
              onValueChange={(v) => setAutoReceive(v as "yes" | "no")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no">Disabled (manual confirmation)</SelectItem>
                <SelectItem value="yes">Enabled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

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
