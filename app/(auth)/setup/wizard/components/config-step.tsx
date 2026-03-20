"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ButtonBase } from "@/components/ui/button-base";
import { Loader2, ArrowLeft, ArrowRight, AlertTriangle } from "lucide-react";
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

interface ConfigStepProps {
  defaultSendHour: number;
  defaultEmailSettings: EmailSettings;
  onComplete: () => void;
  onBack?: () => void;
  orgDomain?: string;
  isMember?: boolean;
  isCompleting?: boolean;
  completeError?: string | null;
}

export function ConfigStep({
  defaultSendHour,
  defaultEmailSettings,
  onComplete,
  onBack,
  orgDomain,
  isMember = false,
  isCompleting = false,
  completeError,
}: ConfigStepProps) {
  const [hour, setHour] = useState(String(defaultSendHour));

  const [senderName, setSenderName] = useState(defaultEmailSettings.senderName);

  // Only store/edit the local part (before @)
  const defaultLocalPart = defaultEmailSettings.senderAddress.split("@")[0] ?? "reminders";
  const [senderLocalPart, setSenderLocalPart] = useState(defaultLocalPart);
  // Use org's configured domain if available, otherwise fall back to the stored default
  const senderDomain = orgDomain ?? defaultEmailSettings.senderAddress.split("@")[1] ?? "prompt.accountants";

  const [replyTo, setReplyTo] = useState(defaultEmailSettings.replyTo);

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

      // All saved — notify parent to advance the wizard
      onComplete();
    });
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
    <Card className="p-6">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {isMember ? "Set up your email identity" : "Configure Your Settings"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isMember
              ? `Choose the name and email address clients will see when you send reminders${orgDomain ? ` from @${orgDomain}` : ""}. These can be changed at any time in Settings.`
              : "Set your send hour and personal email identity. These can be changed at any time in Settings."}
          </p>
        </div>

        {/* Send Hour */}
        <div className="space-y-1.5">
          <label htmlFor="wizard-send-hour" className="text-sm font-medium">
            Send Hour (UK time)
          </label>
          <p className="text-xs text-muted-foreground">
            When your daily reminder emails are sent.
          </p>
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
          <p className="text-xs text-muted-foreground">
            When a client replies to a reminder email, their reply goes to this address.
          </p>
          <Input
            id="wizard-reply-to"
            type="email"
            value={replyTo}
            onChange={(e) => {
              setReplyTo(e.target.value);
              setError(null);
            }}
            placeholder="you@yourfirm.co.uk"
            disabled={isPending}
          />
          <div className="flex items-start gap-3 p-4 bg-amber-500/10 rounded-xl">
            <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-amber-600">Make sure this is your email address</p>
              <p className="text-sm text-amber-600/80">Prompt sends reminders on your behalf. When a client hits reply, their response goes to whatever address you enter here. If you leave this as a Prompt address, you won&apos;t receive their replies.</p>
            </div>
          </div>
        </div>

      </div>
    </Card>

    {/* Buttons and status below the card */}
    <div className="space-y-2">
      {(error || completeError) && (
        <p className="text-sm text-status-danger font-medium text-right">
          {error ?? completeError}
        </p>
      )}
      {isCompleting && (
        <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Completing setup...
        </div>
      )}
      <div className="flex justify-end gap-2">
        {onBack && (
          <ButtonBase
            variant="amber"
            buttonType="icon-text"
            onClick={onBack}
            disabled={isPending || isCompleting}
          >
            <ArrowLeft className="size-4" />
            Back
          </ButtonBase>
        )}
        <ButtonBase
          variant="green"
          buttonType="icon-text"
          onClick={handleSave}
          disabled={isPending || isCompleting}
        >
          {isPending ? (
            <><Loader2 className="size-4 animate-spin" /> Saving...</>
          ) : (
            <>Next Step <ArrowRight className="size-4" /></>
          )}
        </ButtonBase>
      </div>
    </div>
    </div>
  );
}
