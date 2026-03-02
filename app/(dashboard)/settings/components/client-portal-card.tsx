"use client";

import { useState, useTransition } from "react";
import { Cloud, CheckCircle, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setClientPortalEnabled } from "@/app/actions/settings";
import { useRouter } from "next/navigation";

interface ClientPortalCardProps {
  clientPortalEnabled: boolean;
}

export function ClientPortalCard({ clientPortalEnabled: initial }: ClientPortalCardProps) {
  const router = useRouter();
  const [value, setValue] = useState<"yes" | "no">(initial ? "yes" : "no");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleChange(v: "yes" | "no") {
    setValue(v);
    setSaved(false);
    setError(null);
    const enabled = v === "yes";
    startTransition(async () => {
      const result = await setClientPortalEnabled(enabled);
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
        <div className="flex items-center justify-center size-12 rounded-lg bg-sky-500/10 shrink-0">
          <Cloud className="size-6 text-sky-500" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Client Portal</h2>
          <p className="text-sm text-muted-foreground mt-1">
            When enabled, clients can upload documents directly to Prompt via a secure link. Prompt
            tracks received documents per client and updates statuses automatically. You can include
            a portal link in reminder emails so clients can respond and upload documents directly.
            Disable this if you prefer to manage all document collection manually or via inbound
            email only.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Select value={value} onValueChange={(v) => handleChange(v as "yes" | "no")} disabled={isPending}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="yes">Enabled</SelectItem>
            <SelectItem value="no">Disabled</SelectItem>
          </SelectContent>
        </Select>

        {isPending && (
          <span className="text-sm text-muted-foreground">Saving…</span>
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

      {value === "no" && (
        <p className="text-xs text-muted-foreground mt-3">
          With the client portal disabled, the document storage section is hidden. Accountants can
          still tick document receipt manually per client, and any documents received via your
          inbound email address will continue to update client document statuses.
        </p>
      )}
    </Card>
  );
}
