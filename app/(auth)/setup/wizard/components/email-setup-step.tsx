"use client";

import { useState } from "react";
import {
  Loader2, Check, CheckCircle, AlertCircle, AlertTriangle,
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
  type EmailSettings,
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
    godaddy:    ["Log in to godaddy.com → go to My Products → find your domain and click the three-dot menu → Manage DNS. (If you have the new dashboard, click the domain name → DNS tab.)",
                 "Click Add New Record. Set Type to TXT. In the Host field, paste the Host value from the table below. In the TXT Value field, paste the Value / Answer. Set TTL to 1 Hour, then click Save.",
                 "Click Add New Record again. Set Type to CNAME. Paste the Host from the table into the Host field, and paste the Value / Answer into the Points to field. Set TTL to 1 Hour, then click Save.",
                 "After saving, allow 15–60 minutes for propagation (occasionally up to 48 hours). Come back and click Verify Records to check."],
    ionos:      ["Log in to ionos.co.uk → go to Domains & SSL. Click the gear icon next to your domain, then choose DNS.",
                 "Click Add Record → select TXT as the type. In the Subdomain field, paste the Host from the table below. In the Value field, paste the Value / Answer. Set TTL to 1 hour, then click Save.",
                 "Click Add Record again → select CNAME. Paste the Host into Subdomain and the Value / Answer into Alias. Set TTL to 1 hour, then click Save.",
                 "IONOS records usually propagate within 15 minutes. Click Verify Records to check."],
    "123reg":   ["Log in to 123-reg.co.uk → go to Control Panel → click Manage next to your domain → Manage DNS → Advanced DNS.",
                 "Click Add new entry → choose TXT as the type. Fill in Subdomain with the Host from the table below, and Destination with the Value / Answer, then click Add new entry.",
                 "Click Add new entry again → choose CNAME. Fill in Subdomain and Destination the same way, then click Add new entry → click Update DNS to apply.",
                 "Changes usually take 15–30 minutes to go live."],
    namecheap:  ["Log in to namecheap.com → Domain List → click Manage next to your domain → go to the Advanced DNS tab.",
                 "Click Add New Record. Choose TXT Record as the type. Paste the Host from the table below into the Host field, and the Value / Answer into the Value field. Click the green tick to save.",
                 "Click Add New Record again. Choose CNAME Record. Paste the Host into Host and the Value / Answer into Value, then save with the green tick.",
                 "Namecheap records typically propagate within 30 minutes."],
    cloudflare: ["Log in to cloudflare.com → click your domain from the dashboard → go to DNS → Records.",
                 "Click Add record. Set Type to TXT. Paste the Host from the table below into the Name field and the Value / Answer into the Content field. Leave TTL on Auto, then click Save.",
                 "Click Add record again. Set Type to CNAME. Paste the Host into Name and the Value / Answer into Target. Important: set Proxy status to DNS only (click the orange cloud so it turns grey) — this must not be proxied. Then click Save.",
                 "Cloudflare records usually propagate within a few minutes."],
    fasthosts:  ["Log in to fasthosts.co.uk → Manage Domains → click your domain → DNS Management.",
                 "Add a TXT record. Fill in the Host field with the Host from the table below and the Value field with the Value / Answer, then Save.",
                 "Add a CNAME record. Fill in Host and Target from the table below, then Save."],
    squarespace:["Log in to domains.squarespace.com → click your domain → DNS → DNS Records.",
                 "Click Add Record → choose TXT. Fill in Host and Data from the table below, then click Add.",
                 "Click Add Record → choose CNAME. Fill in Host and Data the same way, then click Add.",
                 "Squarespace records may take up to 72 hours to propagate, though most go live within a few hours."],
    porkbun:    ["Log in to porkbun.com → click Manage next to your domain → DNS records.",
                 "Click Add record. Set Type to TXT. Paste the Host from the table below into the Subdomain field and the Value / Answer into the Answer field, then click Add. (Porkbun appends your domain automatically — do not paste the full domain.)",
                 "Add another record. Set Type to CNAME. Paste the Host into Subdomain and the Value / Answer into Answer, then click Add.",
                 "Porkbun records usually propagate within 15 minutes."],
    other:      ["Log in to your domain registrar or hosting provider and find the DNS Management page for your domain. This is sometimes called DNS Settings, DNS Zone Editor, or Advanced DNS.",
                 "Add a TXT record. Use the Host and Value from the table below. If your provider asks for a TTL, set it to 1 hour (3600 seconds).",
                 "Add a CNAME record using the Host and Value from the table below, with the same TTL.",
                 "DNS changes typically take 15 minutes to 48 hours to propagate. You can continue with setup and verify later in Settings."],
  };
  return steps[id] ?? steps.other;
}

interface EmailSetupStepProps {
  onComplete: () => void;
  onBack?: () => void;
  defaultSendHour: number;
  defaultEmailSettings: EmailSettings;
  orgDomain?: string;
  isCompleting?: boolean;
  completeError?: string | null;
  initialState?: StepState;
}

export type StepState =
  | "input"
  | "setting-up"
  | "dns-records"
  | "verifying"
  | "settings";

interface DnsData {
  dkimPendingHost: string;
  dkimPendingValue: string;
  returnPathHost: string;
  returnPathCnameValue: string;
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
  orgDomain,
  isCompleting = false,
  completeError,
  initialState,
}: EmailSetupStepProps) {
  const [state, setState] = useState<StepState>(initialState ?? "input");
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
  const [replyTo, setReplyTo] = useState(defaultEmailSettings.replyTo);

  // ── Send settings state ─────────────────────────────────────────────────
  const [sendHour, setSendHour] = useState(String(defaultSendHour));
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // The sender domain: only use the just-configured domain once DNS is verified.
  // If the user continues without verifying, fall back to the stored org domain or default.
  const domainVerified = verifyState.dkimVerified === true && verifyState.returnPathVerified === true;
  const senderDomain = (dnsData && domainVerified)
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
    setState("settings");
  }

  function handleSkipDomain() {
    // Skip only the domain setup — identity + send settings still collected
    setState("settings");
  }

  async function handleSettingsSave() {
    setSaveError(null);
    setIsSaving(true);

    try {
      const currentAddress = `${senderLocalPart}@${senderDomain}`;

      const hourResult = await updateUserSendHour(parseInt(sendHour, 10), { skipBillingCheck: true });
      if (hourResult.error) {
        setSaveError(hourResult.error);
        setIsSaving(false);
        return;
      }

      const emailResult = await updateUserEmailSettings({
        senderName: senderName.trim(),
        senderAddress: currentAddress,
        replyTo: replyTo.trim(),
      }, { skipBillingCheck: true });
      if (emailResult.error) {
        setSaveError(emailResult.error);
        setIsSaving(false);
        return;
      }

      setIsSaving(false);
      onComplete();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save settings");
      setIsSaving(false);
    }
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
              <p className="text-sm font-medium text-amber-600">Recommended</p>
              <p className="text-sm text-amber-600/80">
                If you skip, reminders will send from the default @prompt.accountants domain.
                You can set up your own domain at any time in Settings. Clients who don&apos;t recognise the sender are more likely to ignore the email or mark it as spam.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email-domain" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Your domain
            </Label>
            <p className="text-xs text-muted-foreground">
              Enter just the domain — no <span className="font-mono">https://</span> or <span className="font-mono">www</span>.
              For example: <span className="font-mono">peninsula-accounting.co.uk</span>
            </p>
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

    // Strip the domain suffix from host values — most registrars (Porkbun, GoDaddy,
    // Namecheap, Cloudflare etc.) auto-append the domain to the subdomain you enter,
    // so showing the full FQDN would result in a doubled domain like foo.domain.com.domain.com.
    const stripDomain = (host: string) => {
      const suffix = `.${domain}`;
      return host.endsWith(suffix) ? host.slice(0, -suffix.length) : host;
    };

    const rows: { type: string; host: string; value: string; ttl: string; field: string }[] = [
      { type: "TXT",   host: stripDomain(dnsData.dkimPendingHost), value: dnsData.dkimPendingValue,    ttl: "60", field: "dkim" },
      { type: "CNAME", host: stripDomain(dnsData.returnPathHost),  value: dnsData.returnPathCnameValue, ttl: "60", field: "cname" },
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
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Your two DNS records
              </p>
              <p className="text-xs text-muted-foreground">Host shown without domain · click any cell to copy</p>
            </div>
            <div className="rounded-xl border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-16">Type</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Host</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Value / Answer</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-20">TTL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.field} className="border-b last:border-0">
                        <td className="px-4 py-3 font-mono text-xs">
                          <span className="bg-muted px-1.5 py-0.5 rounded">{row.type}</span>
                        </td>
                        <td
                          className={[
                            "px-4 py-3 font-mono text-xs break-all cursor-pointer transition-colors select-none",
                            copiedField === row.field + "-host" ? "bg-green-500/10" : "hover:bg-muted/50",
                          ].join(" ")}
                          onClick={() => handleCopy(row.field + "-host", row.host)}
                          title="Click to copy"
                        >
                          {row.host}
                        </td>
                        <td
                          className={[
                            "px-4 py-3 font-mono text-xs cursor-pointer transition-colors select-none",
                            copiedField === row.field ? "bg-green-500/10" : "hover:bg-muted/50",
                          ].join(" ")}
                          onClick={() => handleCopy(row.field, row.value)}
                          title="Click to copy"
                        >
                          <span className="block break-all">{row.value}</span>
                        </td>
                        <td
                          className={[
                            "px-4 py-3 font-mono text-xs cursor-pointer transition-colors select-none",
                            copiedField === row.field + "-ttl" ? "bg-green-500/10" : "hover:bg-muted/50",
                          ].join(" ")}
                          onClick={() => handleCopy(row.field + "-ttl", row.ttl)}
                          title="Click to copy"
                        >
                          {row.ttl}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Verification status alert */}
          {(() => {
            const { dkimVerified, returnPathVerified } = verifyState;
            if (dkimVerified === null && returnPathVerified === null) {
              return (
                <div className="flex items-start gap-3 p-4 bg-blue-500/10 rounded-xl">
                  <AlertCircle className="size-5 text-blue-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-blue-500">Ready to verify</p>
                    <p className="text-sm text-blue-500/80">Once you&apos;ve added both records, click Verify Records to check they&apos;re live. If propagation is taking a while, you can continue with the rest of setup now and verify your domain later in Settings → Email.</p>
                  </div>
                </div>
              );
            }
            if (dkimVerified === true && returnPathVerified === true) {
              return (
                <div className="flex items-start gap-3 p-4 bg-green-500/10 rounded-xl">
                  <CheckCircle className="size-5 text-green-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-green-600">Both records verified</p>
                    <p className="text-sm text-green-600/80">Your domain is fully authenticated and ready to send email. You can now continue to the next step.</p>
                  </div>
                </div>
              );
            }
            const parts: string[] = [];
            if (dkimVerified === true) parts.push("DKIM (TXT) record verified.");
            else parts.push("DKIM (TXT) record not yet detected.");
            if (returnPathVerified === true) parts.push("Return-Path (CNAME) record verified.");
            else parts.push("Return-Path (CNAME) record not yet detected.");
            return (
              <div className="flex items-start gap-3 p-4 bg-amber-500/10 rounded-xl">
                <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-amber-600">Records not yet propagated</p>
                  <p className="text-sm text-amber-600/80">{parts.join(" ")} DNS changes can take up to 48 hours to propagate. Feel free to continue with setup now and check back in Settings → Email once they&apos;re live.</p>
                </div>
              </div>
            );
          })()}

          <div className="flex justify-end">
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
            disabled={isVerifying}
          >
            Continue
            <ArrowRight className="size-4" />
          </ButtonBase>
        </div>
      </div>
    );
  }

  // ── "settings" state (email identity + reminder settings merged) ────────────
  if (state === "settings") {
    return (
      <div className="max-w-2xl mx-auto space-y-4 min-h-[520px]">
        <Card className="p-6">
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Email identity &amp; reminder settings</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Configure how reminders appear to clients and how replies are handled. These can be changed at any time in Settings.
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
                  disabled={isSaving || isCompleting}
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
                    disabled={isSaving || isCompleting}
                  />
                  <div className="flex items-center h-9 px-3 border border-l-0 rounded-r-md bg-muted text-muted-foreground text-sm whitespace-nowrap">
                    @{senderDomain}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="settings-reply-to" className="text-sm font-medium">
                Reply-To Address
              </label>
              <p className="text-xs text-muted-foreground">
                When a client replies to a reminder email, their reply is sent to this address.
              </p>
              <Input
                id="settings-reply-to"
                type="email"
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)}
                placeholder="you@yourfirm.co.uk"
                disabled={isSaving || isCompleting}
              />
              <div className="flex items-start gap-3 p-4 bg-amber-500/10 rounded-xl mt-2">
                <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-amber-600">Make sure this is your email address</p>
                  <p className="text-sm text-amber-600/80">Prompt sends reminders on your behalf. When a client hits reply, their response goes to whatever address you enter here. If you leave this as a Prompt address, you won&apos;t receive their replies.</p>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="settings-send-hour" className="text-sm font-medium">
                Send Hour (UK time)
              </label>
              <p className="text-xs text-muted-foreground">
                When your daily reminder emails are sent.
              </p>
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
              onClick={() => setState(dnsData ? "dns-records" : "input")}
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
