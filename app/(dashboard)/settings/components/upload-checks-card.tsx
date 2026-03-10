"use client";

import { useState, useTransition } from "react";
import { ShieldCheck, CheckCircle, XCircle, Info, FlaskConical } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setUploadCheckMode, setAutoReceiveVerified, setRejectMismatchedUploads, type UploadCheckMode } from "@/app/actions/settings";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface UploadChecksCardProps {
  uploadCheckMode: UploadCheckMode;
  autoReceiveVerified: boolean;
  rejectMismatchedUploads: boolean;
}

export function UploadChecksCard({ uploadCheckMode: initialMode, autoReceiveVerified: initialAutoReceive, rejectMismatchedUploads: initialRejectMismatched }: UploadChecksCardProps) {
  const router = useRouter();
  const [value, setValue] = useState<UploadCheckMode>(initialMode);
  const [autoReceive, setAutoReceive] = useState<"yes" | "no">(initialAutoReceive ? "yes" : "no");
  const [rejectMismatched, setRejectMismatched] = useState<"yes" | "no">(initialRejectMismatched ? "yes" : "no");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const showVerifyOptions = value === "both" || value === "verify";

  function handleModeChange(v: UploadCheckMode) {
    setValue(v);
    setSaved(false);
    setError(null);
    startTransition(async () => {
      const result = await setUploadCheckMode(v);
      if (result.error) {
        setError(result.error);
        return;
      }
      // If switching away from verify modes, turn off dependent settings
      if (v !== "both" && v !== "verify") {
        if (autoReceive === "yes") {
          setAutoReceive("no");
          await setAutoReceiveVerified(false);
        }
        if (rejectMismatched === "yes") {
          setRejectMismatched("no");
          await setRejectMismatchedUploads(false);
        }
      }
      setSaved(true);
      router.refresh();
    });
  }

  function handleAutoReceiveChange(v: "yes" | "no") {
    setAutoReceive(v);
    setSaved(false);
    setError(null);
    startTransition(async () => {
      const result = await setAutoReceiveVerified(v === "yes");
      if (result.error) {
        setError(result.error);
        setAutoReceive(v === "yes" ? "no" : "yes");
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  function handleRejectMismatchedChange(v: "yes" | "no") {
    setRejectMismatched(v);
    setSaved(false);
    setError(null);
    startTransition(async () => {
      const result = await setRejectMismatchedUploads(v === "yes");
      if (result.error) {
        setError(result.error);
        setRejectMismatched(v === "yes" ? "no" : "yes");
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <Card className="p-6">
      <div className="flex items-start gap-4 mb-6">
        <div className="flex items-center justify-center size-12 rounded-lg bg-violet-500/10 shrink-0">
          <ShieldCheck className="size-6 text-violet-500" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Upload Checks</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Control what processing runs when clients upload documents through the portal.
            Verification flags mismatched or unexpected documents. Metadata extraction reads tax year,
            employer, and PAYE reference via OCR.
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/10 mb-6">
        <Info className="size-5 text-blue-600 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-600">
          <strong className="font-medium">Your data stays private.</strong> Upload checks run
          entirely in memory &mdash; Prompt scans each file briefly to extract metadata or flag
          mismatches, then discards the content. No document text, images, or sensitive data is
          stored by Prompt. Only lightweight metadata (e.g. tax year, employer name) is saved.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Select value={value} onValueChange={(v) => handleModeChange(v as UploadCheckMode)} disabled={isPending}>
            <SelectTrigger className="w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="both">Verify & extract metadata</SelectItem>
              <SelectItem value="verify">Verify uploads only</SelectItem>
              <SelectItem value="extract">Extract metadata only</SelectItem>
              <SelectItem value="none">No processing</SelectItem>
            </SelectContent>
          </Select>

          {isPending && (
            <span className="text-sm text-muted-foreground">Saving...</span>
          )}
          {saved && !isPending && (
            <div className="flex items-center gap-1.5 text-green-600">
              <CheckCircle className="size-4" />
              <span className="text-sm">Saved</span>
            </div>
          )}
          {error && (
            <div className="flex items-center gap-1.5 text-destructive">
              <XCircle className="size-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}
        </div>

        {value === "none" && (
          <p className="text-xs text-muted-foreground">
            Documents will be categorised by filename keywords only. No OCR or validation will run on
            uploads.
          </p>
        )}

        {showVerifyOptions && (
          <div className="pt-2 border-t space-y-2">
            <div className="space-y-1">
              <p className="text-sm font-medium">Reject mismatched HMRC documents</p>
              <p className="text-sm text-muted-foreground">
                When enabled, portal uploads of HMRC documents (P60, P45, SA302) that
                clearly have the wrong tax year are rejected and the client is told to
                upload the correct document. Other document types are unaffected.
              </p>
            </div>
            <Select
              value={rejectMismatched}
              onValueChange={(v) => handleRejectMismatchedChange(v as "yes" | "no")}
              disabled={isPending}
            >
              <SelectTrigger className="w-56">
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
              <p className="text-sm text-muted-foreground">
                When enabled, portal uploads with a &ldquo;Verified&rdquo; verdict are automatically
                marked as received. Uploads that need review or have low confidence remain
                pending for manual confirmation.
              </p>
            </div>
            <Select
              value={autoReceive}
              onValueChange={(v) => handleAutoReceiveChange(v as "yes" | "no")}
              disabled={isPending}
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no">Disabled (manual confirmation)</SelectItem>
                <SelectItem value="yes">Enabled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {value !== "none" && (
          <div className="pt-2 border-t">
            <Link
              href="/settings/upload-test"
              className="inline-flex items-center gap-2 text-sm font-medium text-violet-600 hover:text-violet-700 hover:underline"
            >
              <FlaskConical className="size-4" />
              Test upload checks
            </Link>
          </div>
        )}
      </div>
    </Card>
  );
}
