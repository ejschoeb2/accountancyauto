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

const PROVIDERS = [
  { id: "godaddy",    label: "GoDaddy" },
  { id: "ionos",     label: "IONOS / 1&1" },
  { id: "123reg",    label: "123-reg" },
  { id: "namecheap", label: "Namecheap" },
  { id: "cloudflare",label: "Cloudflare" },
  { id: "fasthosts", label: "Fasthosts" },
  { id: "squarespace",label: "Squarespace" },
  { id: "porkbun",   label: "Porkbun" },
  { id: "other",     label: "Other" },
];

function getProviderSteps(id: string): string[] {
  const steps: Record<string, string[]> = {
    godaddy:    ["Find your domain under My Products on godaddy.com and open its DNS settings.",
                 "Click Add New Record → Type: TXT, fill in Host and TXT Value from the table below, TTL: 1 Hour → Save.",
                 "Click Add New Record → Type: CNAME, fill in Host and Points to from the table below, TTL: 1 Hour → Save."],
    ionos:      ["Go to Domains & SSL on ionos.co.uk, click the gear icon next to your domain → DNS.",
                 "Click Add Record → Type: TXT, fill in Subdomain and Value from the table below, TTL: 1 hour → Save.",
                 "Click Add Record → Type: CNAME, fill in Subdomain and Alias from the table below, TTL: 1 hour → Save."],
    "123reg":   ["Go to Control Panel on 123-reg.co.uk → Manage next to your domain → Manage DNS → Advanced DNS.",
                 "Click Add new entry → Type: TXT, fill in Subdomain and Destination from the table below → Add new entry.",
                 "Click Add new entry → Type: CNAME, fill in Subdomain and Destination from the table below → Add new entry → Update DNS."],
    namecheap:  ["Go to Domain List on namecheap.com → Manage next to your domain → Advanced DNS tab.",
                 "Click Add New Record → Type: TXT Record, fill in Host and Value from the table below → save (green tick).",
                 "Click Add New Record → Type: CNAME Record, fill in Host and Value from the table below → save (green tick)."],
    cloudflare: ["Click your domain on cloudflare.com → DNS → Records.",
                 "Click Add record → Type: TXT, fill in Name and Content from the table below, TTL: Auto → Save.",
                 "Click Add record → Type: CNAME, fill in Name and Target from the table below, set Proxy status to DNS only (grey cloud, not orange) → Save."],
    fasthosts:  ["Go to Manage Domains on fasthosts.co.uk → click your domain → DNS Management.",
                 "Add a TXT record, fill in Host and Value from the table below → Save.",
                 "Add a CNAME record, fill in Host and Target from the table below → Save."],
    squarespace:["Click your domain on domains.squarespace.com → DNS → DNS Records.",
                 "Click Add Record → Type: TXT, fill in Host and Data from the table below → Add.",
                 "Click Add Record → Type: CNAME, fill in Host and Data from the table below → Add."],
    porkbun:    ["Click Manage next to your domain on porkbun.com → DNS records.",
                 "Add a TXT record → fill in Subdomain and Answer from the table below → Add.",
                 "Add a CNAME record → fill in Subdomain and Answer from the table below → Add."],
    other:      ["Log in to your domain registrar and find DNS Management for your domain.",
                 "Add a TXT record using the Host and Value from the table below → Save.",
                 "Add a CNAME record using the Host and Value from the table below → Save."],
  };
  return steps[id] ?? steps.other;
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
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // The sender domain: use the domain just configured in Postmark if available,
  // otherwise fall back to the org domain or the stored default.
  const senderDomain = dnsData
    ? domain
    : (orgDomain ?? defaultEmailSettings.senderAddress.split("@")[1] ?? "prompt.accountants");

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
      <div className="max-w-2xl mx-auto space-y-4 min-h-[520px]">
        <div className="rounded-2xl border bg-card shadow-sm p-8 space-y-6">
          <div className="space-y-1.5">
            <h2 className="text-2xl font-bold tracking-tight">Set up email sending from your domain</h2>
            <p className="text-sm text-muted-foreground">
              This lets Prompt send reminder emails that appear to come from your own firm — for example,{" "}
              <span className="font-mono text-foreground">reminders@yourfirm.co.uk</span>. Your clients will
              recognise the sender and be more likely to open the email.
            </p>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-3 p-4 bg-amber-500/10 rounded-xl">
            <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-amber-600">Strongly recommended — takes under 5 minutes</p>
              <p className="text-sm text-amber-600/80">
                If you skip, reminders will send from <span className="font-mono">noreply@prompt.accountants</span>.
                Clients who don&apos;t recognise the sender are more likely to ignore the email or mark it as spam.
                You can set up your own domain at any time in Settings.
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
              Enter just the domain — no <span className="font-mono">https://</span> or <span className="font-mono">www</span>.
              For example: <span className="font-mono">peninsula-accounting.co.uk</span>
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <ButtonBase variant="destructive" buttonType="icon-text" onClick={handleSkipDomain}>
            <SkipForward className="size-4" />
            Skip step
          </ButtonBase>
          <div className="flex items-center gap-2">
            {onBack && (
              <ButtonBase variant="amber" buttonType="icon-text" onClick={onBack}>
                <ArrowLeft className="size-4" />
                Back
              </ButtonBase>
            )}
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
      { type: "TXT",   host: dnsData.dkimPendingHost, value: dnsData.dkimPendingValue,    field: "dkim" },
      { type: "CNAME", host: dnsData.returnPathHost,  value: dnsData.returnPathCnameValue, field: "cname" },
    ];

    const providerSteps = selectedProvider ? getProviderSteps(selectedProvider) : null;
    const providerLabel = PROVIDERS.find((p) => p.id === selectedProvider)?.label;

    return (
      <div className="max-w-4xl mx-auto space-y-4 min-h-[520px]">
        <div className="rounded-2xl border bg-card shadow-sm p-8 space-y-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight">Add Domain Name System (DNS) Records</h2>
            <p className="text-sm text-muted-foreground">
              Who hosts your domain? Select your provider for step-by-step guidance.
            </p>
          </div>

          {/* Provider picker */}
          <div className="flex flex-wrap gap-2">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedProvider(p.id)}
                className={`inline-flex items-center justify-center rounded-lg transition-all duration-200 active:scale-[0.97] shrink-0 px-4 py-2 h-10 text-sm font-medium ${
                  selectedProvider === p.id
                    ? "bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 hover:text-blue-500"
                    : "bg-status-neutral/10 hover:bg-status-neutral/20 text-status-neutral hover:text-status-neutral"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Step-by-step instructions */}
          {providerSteps && (
            <Card className="p-4 space-y-0">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">How to add records in {providerLabel}</p>
              <ol className="space-y-2">
                {providerSteps.map((step, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="font-semibold shrink-0">{i + 1}.</span>
                    <span className="leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </Card>
          )}

          {/* DNS Records Table */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Your two DNS records
            </p>
            <div className="rounded-xl border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-16">Type</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Host</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Value</th>
                      <th className="w-10 px-4 py-2.5" />
                      <th className="w-20 px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const isCopied = copiedField === row.field;
                      const isVerifiedField =
                        row.field === "dkim" ? verifyState.dkimVerified : verifyState.returnPathVerified;

                      return (
                        <tr key={row.field} className="border-b last:border-0">
                          <td className="px-4 py-3 font-mono text-xs">
                            <span className="bg-muted px-1.5 py-0.5 rounded">{row.type}</span>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs break-all">{row.host}</td>
                          <td className="px-4 py-3 font-mono text-xs max-w-[120px]">
                            <span className="block truncate" title={row.value}>{row.value}</span>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleCopy(row.field, row.value)}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                              title="Copy value"
                            >
                              {isCopied ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            {isVerifiedField === true && (
                              <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                                <Check className="size-3.5" /> Verified
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
          </div>

          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              Records can take up to 48 hours to propagate. You can re-check at any time in Settings.
            </p>
            <ButtonBase
              onClick={handleCheckDns}
              disabled={isVerifying}
              buttonType="icon-text"
              variant="green"
            >
              {isVerifying ? (
                <><Loader2 className="size-4 animate-spin" /> Checking...</>
              ) : (
                <><RefreshCw className="size-4" /> Verify Records</>
              )}
            </ButtonBase>
          </div>
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
