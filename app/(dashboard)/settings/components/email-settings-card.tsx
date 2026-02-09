"use client";

import { useState, useTransition } from "react";
import { Mail } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ButtonBase } from "@/components/ui/button-base";
import {
  updateEmailSettings,
  type EmailSettings,
} from "@/app/actions/settings";

interface EmailSettingsCardProps {
  defaultSettings: EmailSettings;
}

export function EmailSettingsCard({ defaultSettings }: EmailSettingsCardProps) {
  const [senderName, setSenderName] = useState(defaultSettings.senderName);
  const [senderAddress, setSenderAddress] = useState(
    defaultSettings.senderAddress
  );
  const [replyTo, setReplyTo] = useState(defaultSettings.replyTo);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isDirty =
    senderName !== defaultSettings.senderName ||
    senderAddress !== defaultSettings.senderAddress ||
    replyTo !== defaultSettings.replyTo;

  function handleSave() {
    setSaved(false);
    setError(null);

    startTransition(async () => {
      const result = await updateEmailSettings({
        senderName: senderName.trim(),
        senderAddress: senderAddress.trim(),
        replyTo: replyTo.trim(),
      });

      if (result.error) {
        setError(result.error);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  }

  return (
    <Card className="p-6">
      <div className="flex items-start gap-4">
        <div className="flex items-center justify-center size-12 rounded-lg bg-primary/10">
          <Mail className="size-6 text-primary" />
        </div>
        <div className="flex-1 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Email Settings</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configure the sender details for reminder emails
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label
                htmlFor="settings-sender-name"
                className="text-sm font-medium"
              >
                Sender Name
              </label>
              <Input
                id="settings-sender-name"
                type="text"
                value={senderName}
                onChange={(e) => {
                  setSenderName(e.target.value);
                  setSaved(false);
                  setError(null);
                }}
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="settings-sender-address"
                className="text-sm font-medium"
              >
                Sender Email
              </label>
              <Input
                id="settings-sender-address"
                type="email"
                value={senderAddress}
                onChange={(e) => {
                  setSenderAddress(e.target.value);
                  setSaved(false);
                  setError(null);
                }}
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="settings-reply-to"
                className="text-sm font-medium"
              >
                Reply-to Email
              </label>
              <Input
                id="settings-reply-to"
                type="email"
                value={replyTo}
                onChange={(e) => {
                  setReplyTo(e.target.value);
                  setSaved(false);
                  setError(null);
                }}
                disabled={isPending}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isDirty && (
              <ButtonBase
                onClick={handleSave}
                disabled={isPending}
                buttonType="text-only"
              >
                Save Changes
              </ButtonBase>
            )}
            {saved && (
              <span className="text-sm text-status-success font-medium">
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
      </div>
    </Card>
  );
}
