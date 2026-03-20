"use client";

import { useState, useTransition } from "react";
import { User, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ButtonBase } from "@/components/ui/button-base";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  updateUserSendHour,
  updateUserEmailSettings,
  type EmailSettings,
} from "@/app/actions/settings";

const HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 6am to 9pm

function formatHour(hour: number): string {
  if (hour === 0) return "12:00 AM";
  if (hour < 12) return `${hour}:00 AM`;
  if (hour === 12) return "12:00 PM";
  return `${hour - 12}:00 PM`;
}

interface MemberSettingsCardProps {
  defaultSendHour: number;
  defaultEmailSettings: EmailSettings;
}

export function MemberSettingsCard({
  defaultSendHour,
  defaultEmailSettings,
}: MemberSettingsCardProps) {
  const [hour, setHour] = useState(String(defaultSendHour));
  const [senderName, setSenderName] = useState(defaultEmailSettings.senderName);

  // Only store/edit the local part (before @)
  const defaultLocalPart = defaultEmailSettings.senderAddress.split("@")[0] ?? "reminders";
  const [senderLocalPart, setSenderLocalPart] = useState(defaultLocalPart);
  const senderDomain = defaultEmailSettings.senderAddress.split("@")[1] ?? "phasetwo.uk";

  const [replyTo, setReplyTo] = useState(defaultEmailSettings.replyTo);

  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const currentAddress = `${senderLocalPart}@${senderDomain}`;

  const isDirty =
    hour !== String(defaultSendHour) ||
    senderName !== defaultEmailSettings.senderName ||
    currentAddress !== defaultEmailSettings.senderAddress ||
    replyTo !== defaultEmailSettings.replyTo;

  function handleSave() {
    setSaved(false);
    setError(null);

    startTransition(async () => {
      // Save send hour
      const hourResult = await updateUserSendHour(parseInt(hour, 10));
      if (hourResult.error) {
        setError(hourResult.error);
        return;
      }

      // Save email settings
      const emailResult = await updateUserEmailSettings({
        senderName: senderName.trim(),
        senderAddress: currentAddress,
        replyTo: replyTo.trim(),
      });

      if (emailResult.error) {
        setError(emailResult.error);
        return;
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <Card className="p-6">
      <div className="flex items-start gap-4">
        <div className="flex items-center justify-center size-12 rounded-lg bg-violet-500/10 shrink-0">
          <User className="size-6 text-violet-500" />
        </div>
        <div className="flex-1 space-y-6">
          <div>
            <h2 className="text-lg font-semibold">My Email Settings</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configure your personal reminder send hour and email identity. These override
              the organisation defaults.
            </p>
          </div>

          {/* Send Hour */}
          <div className="space-y-1.5">
            <label htmlFor="member-send-hour" className="text-sm font-medium">
              Send Hour (UK time)
            </label>
            <Select
              value={hour}
              onValueChange={(v) => {
                setHour(v);
                setSaved(false);
                setError(null);
              }}
              disabled={isPending}
            >
              <SelectTrigger id="member-send-hour" className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOURS.map((h) => (
                  <SelectItem key={h} value={String(h)}>
                    {formatHour(h)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              When your daily reminder emails are sent.
            </p>
          </div>

          {/* Email Identity */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="member-sender-name" className="text-sm font-medium">
                Sender Name
              </label>
              <Input
                id="member-sender-name"
                type="text"
                value={senderName}
                onChange={(e) => {
                  setSenderName(e.target.value);
                  setSaved(false);
                  setError(null);
                }}
                disabled={isPending}
                placeholder="John Smith"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="member-sender-local" className="text-sm font-medium">
                Sender Email
              </label>
              <div className="flex items-center gap-0">
                <Input
                  id="member-sender-local"
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
                  placeholder="john"
                  className="rounded-r-none"
                />
                <div className="flex items-center h-9 px-3 border border-l-0 rounded-r-md bg-muted text-muted-foreground text-sm whitespace-nowrap">
                  @{senderDomain}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="member-reply-to" className="text-sm font-medium">
              Reply-To Address
            </label>
            <Input
              id="member-reply-to"
              type="email"
              value={replyTo}
              onChange={(e) => {
                setReplyTo(e.target.value);
                setSaved(false);
                setError(null);
              }}
              disabled={isPending}
              placeholder="you@yourfirm.co.uk"
            />
            <div className="flex items-start gap-3 p-4 bg-amber-500/10 rounded-xl mt-2">
              <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-amber-600">Make sure this is your email address</p>
                <p className="text-sm text-amber-600/80">Prompt sends reminders on your behalf. When a client hits reply, their response goes to whatever address you enter here. If you leave this as a Prompt address, you won&apos;t receive their replies.</p>
              </div>
            </div>
          </div>

          {/* Actions */}
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
              <span className="text-sm text-green-600 font-medium">Saved</span>
            )}
            {error && (
              <span className="text-sm text-status-danger font-medium">{error}</span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
