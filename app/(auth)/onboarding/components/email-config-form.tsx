"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  updateEmailSettings,
  type EmailSettings,
} from "@/app/actions/settings";

interface EmailConfigFormProps {
  initialSettings: EmailSettings;
  onSaved: () => void;
  onSkip: () => void;
}

export function EmailConfigForm({
  initialSettings,
  onSaved,
  onSkip,
}: EmailConfigFormProps) {
  const [senderName, setSenderName] = useState(initialSettings.senderName);
  const [senderAddress, setSenderAddress] = useState(
    initialSettings.senderAddress
  );
  const [replyTo, setReplyTo] = useState(initialSettings.replyTo);
  const [isSaving, setIsSaving] = useState(false);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isValid =
    senderName.trim().length > 0 &&
    emailRegex.test(senderAddress) &&
    emailRegex.test(replyTo);

  const handleSave = async () => {
    if (!isValid) return;

    setIsSaving(true);
    try {
      const result = await updateEmailSettings({
        senderName: senderName.trim(),
        senderAddress: senderAddress.trim(),
        replyTo: replyTo.trim(),
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Email settings saved");
        onSaved();
      }
    } catch {
      toast.error("Failed to save email settings");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <label
            htmlFor="senderName"
            className="text-sm font-medium text-foreground"
          >
            Sender Name
          </label>
          <Input
            id="senderName"
            type="text"
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            placeholder="Peninsula Accounting"
          />
          <p className="text-xs text-muted-foreground">
            The name that appears in the &quot;From&quot; field
          </p>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="senderAddress"
            className="text-sm font-medium text-foreground"
          >
            Sender Email
          </label>
          <Input
            id="senderAddress"
            type="email"
            value={senderAddress}
            onChange={(e) => setSenderAddress(e.target.value)}
            placeholder="reminders@peninsulaaccounting.co.uk"
          />
          <p className="text-xs text-muted-foreground">
            Must be verified in Postmark before sending
          </p>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="replyTo"
            className="text-sm font-medium text-foreground"
          >
            Reply-to Email
          </label>
          <Input
            id="replyTo"
            type="email"
            value={replyTo}
            onChange={(e) => setReplyTo(e.target.value)}
            placeholder="info@peninsulaaccounting.co.uk"
          />
          <p className="text-xs text-muted-foreground">
            Where client replies will be directed
          </p>
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onSkip} disabled={isSaving}>
          Skip
        </Button>
        <Button
          onClick={handleSave}
          disabled={!isValid || isSaving}
          className="active:scale-[0.97]"
        >
          {isSaving && <Loader2 className="size-4 mr-2 animate-spin" />}
          Save & Continue
        </Button>
      </div>
    </div>
  );
}
