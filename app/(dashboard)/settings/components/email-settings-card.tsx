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
  senderDomain: string;
}

export function EmailSettingsCard({ defaultSettings, senderDomain }: EmailSettingsCardProps) {
  const [senderName, setSenderName] = useState(defaultSettings.senderName);

  // Only store/edit the local part (before @)
  const defaultLocalPart = defaultSettings.senderAddress.split("@")[0] ?? "reminders";
  const [senderLocalPart, setSenderLocalPart] = useState(defaultLocalPart);
  const [replyTo, setReplyTo] = useState(defaultSettings.replyTo);

  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const currentAddress = `${senderLocalPart}@${senderDomain}`;

  const isDirty =
    senderName !== defaultSettings.senderName ||
    currentAddress !== defaultSettings.senderAddress ||
    replyTo !== defaultSettings.replyTo;

  function handleSave() {
    setSaved(false);
    setError(null);

    startTransition(async () => {
      const result = await updateEmailSettings({
        senderName: senderName.trim(),
        senderAddress: currentAddress,
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
        <div className="flex items-center justify-center size-12 rounded-lg bg-status-info/10 shrink-0">
          <Mail className="size-6 text-status-info" />
        </div>
        <div className="flex-1 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Email Settings</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configure the sender details for reminder emails
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
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
                placeholder="Peninsula Accounting"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="settings-sender-local"
                className="text-sm font-medium"
              >
                Sender Email
              </label>
              <div className="flex items-center gap-0">
                <Input
                  id="settings-sender-local"
                  type="text"
                  value={senderLocalPart}
                  onChange={(e) => {
                    // Only allow valid local part characters
                    const value = e.target.value.replace(/[^a-zA-Z0-9._+-]/g, "");
                    setSenderLocalPart(value);
                    setSaved(false);
                    setError(null);
                  }}
                  disabled={isPending}
                  placeholder="reminders"
                  className="rounded-r-none"
                />
                <div className="flex items-center h-9 px-3 border border-l-0 rounded-r-md bg-muted text-muted-foreground text-sm whitespace-nowrap">
                  @{senderDomain}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="settings-reply-to"
              className="text-sm font-medium"
            >
              Reply-To Address
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
              placeholder="replies@reply.yourdomain.co.uk"
            />
            <p className="text-xs text-muted-foreground">
              Where client replies are sent. Set this to your Postmark inbound address so replies are automatically processed.
            </p>
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
      </div>
    </Card>
  );
}
