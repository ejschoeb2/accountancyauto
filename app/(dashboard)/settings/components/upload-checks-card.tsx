"use client";

import { useState, useTransition } from "react";
import { ShieldCheck, CheckCircle, XCircle, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setUploadCheckMode, type UploadCheckMode } from "@/app/actions/settings";
import { useRouter } from "next/navigation";

interface UploadChecksCardProps {
  uploadCheckMode: UploadCheckMode;
}

export function UploadChecksCard({ uploadCheckMode: initial }: UploadChecksCardProps) {
  const router = useRouter();
  const [value, setValue] = useState<UploadCheckMode>(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleChange(v: UploadCheckMode) {
    setValue(v);
    setSaved(false);
    setError(null);
    startTransition(async () => {
      const result = await setUploadCheckMode(v);
      if (result.error) {
        setError(result.error);
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

      <div className="flex items-center gap-3">
        <Select value={value} onValueChange={(v) => handleChange(v as UploadCheckMode)} disabled={isPending}>
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
        <p className="text-xs text-muted-foreground mt-3">
          Documents will be categorised by filename keywords only. No OCR or validation will run on
          uploads.
        </p>
      )}
    </Card>
  );
}
