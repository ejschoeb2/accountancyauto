"use client";

import { useState } from "react";
import {
  Loader2, Copy, Check, AlertCircle, AlertTriangle,
  ArrowLeft, ArrowRight, SkipForward, RefreshCw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ButtonBase } from "@/components/ui/button-base";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  setupPostmarkForOrg,
  checkOrgDomainVerification,
} from "../actions";
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

interface EmailSetupStepProps {
  onComplete: () => void;
  onBack?: () => void;
  defaultSendHour: number;
  defaultEmailSettings: EmailSettings;
  defaultInboundMode: InboundCheckerMode;
  orgDomain?: string;
  orgInboundAddress?: string;
  isCompleting?: boolean;
  completeError?: string | null;
}

type StepState =
  | "input"
  | "setting-up"
  | "dns-records"
  | "verifying"
  | "email-identity"
  | "send-settings";

interface DnsData {
  dkimPendingHost: string;
  dkimPendingValue: string;
  returnPathHost: string;
  returnPathCnameValue: string;
  inboundAddress: string;
}

interface VerifyState {
  dkimVerified: boolean | null;
  returnPathVerified: boolean | null;
}

export function EmailSetupStep({
  onComplete,
  onBack,
  defaultSendHour,
  defaultEmailSettings,
  defaultInboundMode,
  orgDomain,
  orgInboundAddress,
  isCompleting = false,
  completeError,
}: EmailSetupStepProps) {
  const [state, setState] = useState<StepState>("input");
  const [domain, setDomain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dnsData, setDnsData] = useState<DnsData | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [verifyState, setVerifyState] = useState<VerifyState>({
    dkimVerified: null,
    returnPathVerified: null,
  });

  // ── Email identity state ────────────────────────────────────────────────
  const [senderName, setSenderName] = useState(defaultEmailSettings.senderName);
  const defaultLocalPart = defaultEmailSettings.senderAddress.split("@")[0] ?? "reminders";
  const [senderLocalPart, setSenderLocalPart] = useState(defaultLocalPart);
  const [replyTo, setReplyTo] = useState(orgInboundAddress ?? defaultEmailSettings.replyTo);
  const [identityError, setIdentityError] = useState<string | null>(null);

  // ── Send settings state ─────────────────────────────────────────────────
  const [sendHour, setSendHour] = useState(String(defaultSendHour));
  const [inboundMode, setInboundMode] = useState<InboundCheckerMode>(defaultInboundMode);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // The sender domain: use the domain just configured in Postmark if available,
  // otherwise fall back to the org domain or the stored default.
  const senderDomain = dnsData
    ? domain
    : (orgDomain ?? defaultEmailSettings.senderAddress.split("@")[1] ?? "phasetwo.uk");

  // ── Handlers ────────────────────────────────────────────────────────────

  async function handleSetup() {
    if (!domain.trim()) {
      setError("Please enter your domain.");
      return;
    }
    setError(null);
    setState("setting-up");

    const result = await setupPostmarkForOrg(domain.trim());

    if (!result.success) {
      setError(result.error ?? "Failed to configure email.");
      setState("input");
      return;
    }

    setDnsData({
      dkimPendingHost: result.dkimPendingHost ?? "",
      dkimPendingValue: result.dkimPendingValue ?? "",
      returnPathHost: result.returnPathHost ?? "",
      returnPathCnameValue: result.returnPathCnameValue ?? "pm.mtasv.net",
      inboundAddress: result.inboundAddress ?? "",
    });
    setState("dns-records");
  }

  async function handleCheckDns() {
    setState("verifying");
    const result = await checkOrgDomainVerification();
    setVerifyState({
      dkimVerified: result.dkimVerified,
      returnPathVerified: result.returnPathVerified,
    });
    setState("dns-records");
  }

  function handleCopy(field: string, value: string) {
    navigator.clipboard.writeText(value).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    });
  }

  function handleDnsContinue() {
    // Pre-fill reply-to with the Postmark inbound address from the setup result
    if (dnsData?.inboundAddress) {
      setReplyTo(dnsData.inboundAddress);
    }
    setState("email-identity");
  }

  function handleSkipDomain() {
    // Skip only the domain setup — identity + send settings still collected
    setState("email-identity");
  }

  function handleIdentityNext() {
    setIdentityError(null);
    setState("send-settings");
  }

  async function handleSettingsSave() {
    setSaveError(null);
    setIsSaving(true);

    const currentAddress = `${senderLocalPart}@${senderDomain}`;

    const hourResult = await updateUserSendHour(parseInt(sendHour, 10));
    if (hourResult.error) {
      setSaveError(hourResult.error);
      setIsSaving(false);
      return;
    }

    const emailResult = await updateUserEmailSettings({
      senderName: senderName.trim(),
      senderAddress: currentAddress,
      replyTo: replyTo.trim(),
    });
    if (emailResult.error) {
      setSaveError(emailResult.error);
      setIsSaving(false);
      return;
    }

    const modeResult = await updateInboundCheckerMode(inboundMode);
    if (modeResult.error) {
      setSaveError(modeResult.error);
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    onComplete();
  }

  // ── "input" state ──────────────────────────────────────────────────────────
  if (state === "input") {
    return (
      <div className="max-w-lg mx-auto space-y-4 min-h-[520px]">
        <div className="rounded-2xl border bg-card shadow-sm p-8 space-y-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight">Set up email sending</h2>
            <p className="text-sm text-muted-foreground">
              Prompt will configure Postmark to send emails from your domain.
              You&apos;ll need to add two DNS records.
            </p>
          </div>

          {/* Warning above the input */}
          <div className="flex items-start gap-3 p-4 bg-amber-500/10 rounded-xl">
            <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-amber-600">Not recommended to skip this step.</p>
              <p className="text-sm text-amber-600/80">
                Reminders will send from the Prompt platform domain, which clients may not recognise.
                You can configure your own domain later in Settings.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email-domain" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Your domain
            </Label>
            <Input
              id="email-domain"
              type="text"
              placeholder="yourfirm.co.uk"
              value={domain}
              onChange={(e) => {
                setDomain(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSetup();
              }}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Enter your full domain (e.g. <span className="font-mono">peninsula-accounting.co.uk</span>).
              Reminder emails will be sent from this domain.
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2">
          {onBack && (
            <ButtonBase variant="amber" buttonType="icon-text" onClick={onBack}>
              <ArrowLeft className="size-4" />
              Back
            </ButtonBase>
          )}
          <ButtonBase variant="destructive" buttonType="icon-text" onClick={handleSkipDomain}>
            <SkipForward className="size-4" />
            Skip
          </ButtonBase>
          <ButtonBase
            variant="blue"
            buttonType="icon-text"
            onClick={handleSetup}
            disabled={!domain.trim()}
          >
            Set Up Email
            <ArrowRight className="size-4" />
          </ButtonBase>
        </div>
      </div>
    );
  }

  // ── "setting-up" state ─────────────────────────────────────────────────────
  if (state === "setting-up") {
    return (
      <div className="py-16 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="size-8 animate-spin text-primary" />
        <div className="text-center space-y-1">
          <p className="font-medium text-lg">Configuring your email server...</p>
          <p className="text-sm text-muted-foreground">
            Creating a Postmark server and domain for {domain}
          </p>
        </div>
      </div>
    );
  }

  // ── "dns-records" / "verifying" state ─────────────────────────────────────
  if ((state === "dns-records" || state === "verifying") && dnsData) {
    const isVerifying = state === "verifying";
    const allVerified =
      verifyState.dkimVerified === true && verifyState.returnPathVerified === true;

    const rows: { type: string; host: string; value: string; field: string }[] = [
      {
        type: "TXT",
        host: dnsData.dkimPendingHost,
        value: dnsData.dkimPendingValue,
        field: "dkim",
      },
      {
        type: "CNAME",
        host: dnsData.returnPathHost,
        value: dnsData.returnPathCnameValue,
        field: "cname",
      },
    ];

    return (
      <div className="max-w-lg mx-auto space-y-4 min-h-[520px]">
        <div className="rounded-2xl border bg-card shadow-sm p-8 space-y-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight">Add DNS records</h2>
            <p className="text-sm text-muted-foreground">
              Add these two records to your DNS provider for{" "}
              <span className="font-medium">{domain}</span>.
            </p>
          </div>

          {/* DNS Records Table */}
          <div className="rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-16">Type</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Host</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Value</th>
                    <th className="w-10 px-4 py-2.5" />
                    <th className="w-20 px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const isCopied = copiedField === row.field;
                    const isVerifiedField =
                      row.field === "dkim"
                        ? verifyState.dkimVerified
                        : verifyState.returnPathVerified;

                    return (
                      <tr key={row.field} className="border-b last:border-0">
                        <td className="px-4 py-3 font-mono text-xs">
                          <span className="bg-muted px-1.5 py-0.5 rounded">{row.type}</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs break-all">
                          {row.host}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs max-w-[120px]">
                          <span className="block truncate" title={row.value}>
                            {row.value}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleCopy(row.field, row.value)}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            title="Copy value"
                          >
                            {isCopied ? (
                              <Check className="size-4 text-green-600" />
                            ) : (
                              <Copy className="size-4" />
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          {isVerifiedField === true && (
                            <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                              <Check className="size-3.5" />
                              Verified
                            </span>
                          )}
                          {isVerifiedField === false && (
                            <span className="text-xs text-muted-foreground">Pending</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            DNS changes can take up to 48 hours to propagate. You can check
            verification status in Settings at any time.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2">
          <ButtonBase
            variant="amber"
            buttonType="icon-text"
            onClick={() => setState("input")}
            disabled={isVerifying}
          >
            <ArrowLeft className="size-4" />
            Back
          </ButtonBase>
          <ButtonBase
            onClick={handleCheckDns}
            disabled={isVerifying}
            buttonType="icon-text"
            variant="green"
          >
            {isVerifying ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <RefreshCw className="size-4" />
                Check DNS
              </>
            )}
          </ButtonBase>
          <ButtonBase
            variant="blue"
            buttonType="icon-text"
            onClick={handleDnsContinue}
            disabled={isVerifying || !allVerified}
          >
            Continue
            <ArrowRight className="size-4" />
          </ButtonBase>
        </div>
      </div>
    );
  }

  // ── "email-identity" state ─────────────────────────────────────────────────
  if (state === "email-identity") {
    return (
      <div className="max-w-lg mx-auto space-y-4 min-h-[520px]">
        <Card className="p-6">
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold">Email identity</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Choose the name and email address clients will see when you send reminders
                {senderDomain ? ` from @${senderDomain}` : ""}. These can be changed at any time in Settings.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="identity-sender-name" className="text-sm font-medium">
                  Sender Name
                </label>
                <Input
                  id="identity-sender-name"
                  type="text"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="John Smith"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="identity-sender-local" className="text-sm font-medium">
                  Sender Email
                </label>
                <div className="flex items-center gap-0">
                  <Input
                    id="identity-sender-local"
                    type="text"
                    value={senderLocalPart}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^a-zA-Z0-9._+-]/g, "");
                      setSenderLocalPart(value);
                    }}
                    placeholder="hello"
                    className="rounded-r-none"
                  />
                  <div className="flex items-center h-9 px-3 border border-l-0 rounded-r-md bg-muted text-muted-foreground text-sm whitespace-nowrap">
                    @{senderDomain}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="identity-reply-to" className="text-sm font-medium">
                Reply-To Address
              </label>
              <Input
                id="identity-reply-to"
                type="email"
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)}
                placeholder="replies@yourdomain.co.uk"
              />
              <p className="text-xs text-muted-foreground">
                Where client replies are sent. Set this to your Postmark inbound address so replies
                are automatically processed.
              </p>
            </div>

            {identityError && (
              <p className="text-sm text-status-danger font-medium">{identityError}</p>
            )}
          </div>
        </Card>

        <div className="flex justify-end gap-2">
          <ButtonBase
            variant="amber"
            buttonType="icon-text"
            onClick={() => setState(dnsData ? "dns-records" : "input")}
          >
            <ArrowLeft className="size-4" />
            Back
          </ButtonBase>
          <ButtonBase variant="blue" buttonType="icon-text" onClick={handleIdentityNext}>
            Next
            <ArrowRight className="size-4" />
          </ButtonBase>
        </div>
      </div>
    );
  }

  // ── "send-settings" state ─────────────────────────────────────────────────
  if (state === "send-settings") {
    return (
      <div className="max-w-lg mx-auto space-y-4 min-h-[520px]">
        <Card className="p-6">
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold">Reminder settings</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Configure when reminders send and how incoming replies are handled.
                These can be changed at any time in Settings.
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="settings-send-hour" className="text-sm font-medium">
                Send Hour (UK time)
              </label>
              <Select
                value={sendHour}
                onValueChange={setSendHour}
                disabled={isSaving || isCompleting}
              >
                <SelectTrigger id="settings-send-hour" className="w-[160px]">
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

            <div className="space-y-3">
              <p className="text-sm font-medium">Inbound Email Handling</p>
              <Select
                value={inboundMode}
                onValueChange={(v) => setInboundMode(v as InboundCheckerMode)}
                disabled={isSaving || isCompleting}
              >
                <SelectTrigger className="h-9 min-w-[280px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Make changes automatically</SelectItem>
                  <SelectItem value="recommend">Provide recommendation only</SelectItem>
                </SelectContent>
              </Select>
              <div className="space-y-2 text-xs text-muted-foreground">
                <p className={inboundMode === "auto" ? "text-foreground font-medium" : ""}>
                  <strong>Automatic:</strong> When a client emails you documents, the system automatically marks their records as received, updates their filing status, and logs the change. No manual action needed.
                </p>
                <p className={inboundMode === "recommend" ? "text-foreground font-medium" : ""}>
                  <strong>Recommendation only:</strong> When a client emails you documents, the system logs the inbound email and notifies you, but won&apos;t update any client records. You review each email and decide whether to mark records as received yourself.
                </p>
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-2">
          {(saveError || completeError) && (
            <p className="text-sm text-status-danger font-medium text-right">
              {saveError ?? completeError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <ButtonBase
              variant="amber"
              buttonType="icon-text"
              onClick={() => setState("email-identity")}
              disabled={isSaving || isCompleting}
            >
              <ArrowLeft className="size-4" />
              Back
            </ButtonBase>
            <ButtonBase
              variant="green"
              buttonType="icon-text"
              onClick={handleSettingsSave}
              disabled={isSaving || isCompleting}
            >
              {isSaving ? (
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

  return null;
}
