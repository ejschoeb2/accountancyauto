"use client";

import { useState, useTransition } from "react";
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
import { ToggleGroup } from "@/components/ui/toggle-group";
import {
  updateUserSendHour,
  updateUserEmailSettings,
  updateInboundCheckerMode,
  type EmailSettings,
  type InboundCheckerMode,
} from "@/app/actions/settings";

const HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 6am to 9pm

function formatHour(hour: number): string {
  if (hour === 0) return "12:00 AM";
  if (hour < 12) return `${hour}:00 AM`;
  if (hour === 12) return "12:00 PM";
  return `${hour - 12}:00 PM`;
}

interface ConfigStepProps {
  defaultSendHour: number;
  defaultEmailSettings: EmailSettings;
  defaultInboundMode: InboundCheckerMode;
  onComplete: () => void;
  orgDomain?: string;
  orgInboundAddress?: string;
  isMember?: boolean;
}

export function ConfigStep({
  defaultSendHour,
  defaultEmailSettings,
  defaultInboundMode,
  onComplete,
  orgDomain,
  orgInboundAddress,
  isMember = false,
}: ConfigStepProps) {
  const [hour, setHour] = useState(String(defaultSendHour));
  const [inboundMode, setInboundMode] = useState<InboundCheckerMode>(defaultInboundMode);

  const [senderName, setSenderName] = useState(defaultEmailSettings.senderName);

  // Only store/edit the local part (before @)
  const defaultLocalPart = defaultEmailSettings.senderAddress.split("@")[0] ?? "reminders";
  const [senderLocalPart, setSenderLocalPart] = useState(defaultLocalPart);
  // Use org's configured domain if available, otherwise fall back to the stored default
  const senderDomain = orgDomain ?? defaultEmailSettings.senderAddress.split("@")[1] ?? "phasetwo.uk";

  const [replyTo, setReplyTo] = useState(orgInboundAddress ?? defaultEmailSettings.replyTo);

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const currentAddress = `${senderLocalPart}@${senderDomain}`;

  function handleSave() {
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

      // Save inbound checker mode
      const modeResult = await updateInboundCheckerMode(inboundMode);
      if (modeResult.error) {
        setError(modeResult.error);
        return;
      }

      // All saved — notify parent to advance the wizard
      onComplete();
    });
  }

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">
            {isMember ? "Set up your email identity" : "Configure Your Settings"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isMember
              ? `Choose the name and email address clients will see when you send reminders${orgDomain ? ` from @${orgDomain}` : ""}. These can be changed at any time in Settings.`
              : "Set your send hour, inbound email handling preference, and personal email identity. These can be changed at any time in Settings."}
          </p>
        </div>

        {/* Send Hour */}
        <div className="space-y-1.5">
          <label htmlFor="wizard-send-hour" className="text-sm font-medium">
            Send Hour (UK time)
          </label>
          <Select
            value={hour}
            onValueChange={(v) => {
              setHour(v);
              setError(null);
            }}
            disabled={isPending}
          >
            <SelectTrigger id="wizard-send-hour" className="w-[160px]">
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

        {/* Inbound Checker Mode */}
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Inbound Email Handling</p>
          <ToggleGroup<InboundCheckerMode>
            options={[
              { value: "auto", label: "Auto Archive" },
              { value: "recommend", label: "Review First" },
            ]}
            value={inboundMode}
            onChange={(v) => {
              setInboundMode(v);
              setError(null);
            }}
            variant="muted"
            disabled={isPending}
          />
          <p className="text-xs text-muted-foreground">
            {inboundMode === "auto"
              ? "Matched replies are automatically archived."
              : "Matched replies appear as recommendations to review."}
          </p>
        </div>

        {/* Email Identity */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="wizard-sender-name" className="text-sm font-medium">
              Sender Name
            </label>
            <Input
              id="wizard-sender-name"
              type="text"
              value={senderName}
              onChange={(e) => {
                setSenderName(e.target.value);
                setError(null);
              }}
              disabled={isPending}
              placeholder="John Smith"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="wizard-sender-local" className="text-sm font-medium">
              Sender Email
            </label>
            <div className="flex items-center gap-0">
              <Input
                id="wizard-sender-local"
                type="text"
                value={senderLocalPart}
                onChange={(e) => {
                  // Only allow valid local part characters
                  const value = e.target.value.replace(/[^a-zA-Z0-9._+-]/g, "");
                  setSenderLocalPart(value);
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
          <label htmlFor="wizard-reply-to" className="text-sm font-medium">
            Reply-To Address
          </label>
          <Input
            id="wizard-reply-to"
            type="email"
            value={replyTo}
            onChange={(e) => {
              setReplyTo(e.target.value);
              setError(null);
            }}
            disabled={isPending}
            placeholder="replies@yourdomain.co.uk"
          />
          <p className="text-xs text-muted-foreground">
            Where client replies are sent. Set this to your Postmark inbound address so replies
            are automatically processed.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <ButtonBase
            onClick={handleSave}
            disabled={isPending}
            buttonType="text-only"
          >
            {isPending ? "Saving..." : "Save & Continue"}
          </ButtonBase>
          {error && (
            <span className="text-sm text-status-danger font-medium">{error}</span>
          )}
        </div>
      </div>
    </Card>
  );
}
