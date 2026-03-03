"use client";

import { useState } from "react";
import {
  Loader2, Globe, CheckCircle, AlertCircle, AlertTriangle, RefreshCw, ArrowRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ButtonBase } from "@/components/ui/button-base";
import {
  setupPostmarkForOrg,
  checkOrgDomainVerification,
} from "@/app/(auth)/setup/wizard/actions";
import type { OrgDomainDnsData } from "@/app/actions/settings";

const PROVIDERS = [
  { id: "godaddy",     label: "GoDaddy" },
  { id: "ionos",       label: "IONOS / 1&1" },
  { id: "123reg",      label: "123-reg" },
  { id: "namecheap",   label: "Namecheap" },
  { id: "cloudflare",  label: "Cloudflare" },
  { id: "fasthosts",   label: "Fasthosts" },
  { id: "squarespace", label: "Squarespace" },
  { id: "porkbun",     label: "Porkbun" },
  { id: "other",       label: "Other" },
];

function getProviderSteps(id: string): string[] {
  const steps: Record<string, string[]> = {
    godaddy:     ["Find your domain under My Products on godaddy.com and open its DNS settings.",
                  "Click Add New Record → Type: TXT, fill in Host and TXT Value from the table below, TTL: 1 Hour → Save.",
                  "Click Add New Record → Type: CNAME, fill in Host and Points to from the table below, TTL: 1 Hour → Save."],
    ionos:       ["Go to Domains & SSL on ionos.co.uk, click the gear icon next to your domain → DNS.",
                  "Click Add Record → Type: TXT, fill in Subdomain and Value from the table below, TTL: 1 hour → Save.",
                  "Click Add Record → Type: CNAME, fill in Subdomain and Alias from the table below, TTL: 1 hour → Save."],
    "123reg":    ["Go to Control Panel on 123-reg.co.uk → Manage next to your domain → Manage DNS → Advanced DNS.",
                  "Click Add new entry → Type: TXT, fill in Subdomain and Destination from the table below → Add new entry.",
                  "Click Add new entry → Type: CNAME, fill in Subdomain and Destination from the table below → Add new entry → Update DNS."],
    namecheap:   ["Go to Domain List on namecheap.com → Manage next to your domain → Advanced DNS tab.",
                  "Click Add New Record → Type: TXT Record, fill in Host and Value from the table below → save (green tick).",
                  "Click Add New Record → Type: CNAME Record, fill in Host and Value from the table below → save (green tick)."],
    cloudflare:  ["Click your domain on cloudflare.com → DNS → Records.",
                  "Click Add record → Type: TXT, fill in Name and Content from the table below, TTL: Auto → Save.",
                  "Click Add record → Type: CNAME, fill in Name and Target from the table below, set Proxy status to DNS only (grey cloud, not orange) → Save."],
    fasthosts:   ["Go to Manage Domains on fasthosts.co.uk → click your domain → DNS Management.",
                  "Add a TXT record, fill in Host and Value from the table below → Save.",
                  "Add a CNAME record, fill in Host and Target from the table below → Save."],
    squarespace: ["Click your domain on domains.squarespace.com → DNS → DNS Records.",
                  "Click Add Record → Type: TXT, fill in Host and Data from the table below → Add.",
                  "Click Add Record → Type: CNAME, fill in Host and Data from the table below → Add."],
    porkbun:     ["Click Manage next to your domain on porkbun.com → DNS records.",
                  "Add a TXT record → set Type to TXT, paste the Host into the Subdomain field, paste the Value / Answer into the Answer field → click Add. (Porkbun appends your domain automatically — do not add it again.)",
                  "Add a CNAME record → set Type to CNAME, paste the Host into Subdomain, paste the Value / Answer into the Answer field → click Add."],
    other:       ["Log in to your domain registrar and find DNS Management for your domain.",
                  "Add a TXT record using the Host and Value from the table below → Save.",
                  "Add a CNAME record using the Host and Value from the table below → Save."],
  };
  return steps[id] ?? steps.other;
}

interface DomainSetupCardProps {
  initialDnsData: OrgDomainDnsData | null;
}

type CardState = "input" | "setting-up" | "dns-records" | "verifying";

export function DomainSetupCard({ initialDnsData }: DomainSetupCardProps) {
  const [state, setState] = useState<CardState>(
    initialDnsData ? "dns-records" : "input"
  );
  const [inputDomain, setInputDomain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dnsData, setDnsData] = useState<OrgDomainDnsData | null>(initialDnsData);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [verifyState, setVerifyState] = useState<{
    dkimVerified: boolean | null;
    returnPathVerified: boolean | null;
  }>({
    dkimVerified: initialDnsData?.dkimVerified ?? null,
    returnPathVerified: initialDnsData?.returnPathVerified ?? null,
  });
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  async function handleSetup() {
    if (!inputDomain.trim()) {
      setError("Please enter your domain.");
      return;
    }
    setError(null);
    setState("setting-up");

    const result = await setupPostmarkForOrg(inputDomain.trim());
    if (!result.success) {
      setError(result.error ?? "Failed to configure email.");
      setState("input");
      return;
    }

    setDnsData({
      domain: inputDomain.trim(),
      dkimPendingHost: result.dkimPendingHost ?? "",
      dkimPendingValue: result.dkimPendingValue ?? "",
      returnPathHost: result.returnPathHost ?? "",
      returnPathCnameValue: result.returnPathCnameValue ?? "pm.mtasv.net",
      dkimVerified: false,
      returnPathVerified: false,
    });
    setVerifyState({ dkimVerified: null, returnPathVerified: null });
    setState("dns-records");
  }

  async function handleVerify() {
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

  // ── "input" state ────────────────────────────────────────────────────────────
  if (state === "input") {
    return (
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center size-12 rounded-lg bg-violet-500/10 shrink-0">
            <Globe className="size-6 text-violet-500" />
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Custom Sending Domain</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Send reminder emails from your own domain so clients recognise the sender.
              </p>
            </div>

            <div className="flex items-start gap-3 p-3 bg-amber-500/10 rounded-lg">
              <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-600/90">
                No custom domain configured. Reminders currently send from{" "}
                <span className="font-mono">noreply@prompt.accountants</span>.
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="setup-domain" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Your domain
              </label>
              <div className="flex items-center gap-2">
                <Input
                  id="setup-domain"
                  type="text"
                  placeholder="yourfirm.co.uk"
                  value={inputDomain}
                  onChange={(e) => {
                    setInputDomain(e.target.value);
                    setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSetup();
                  }}
                  className="max-w-sm"
                />
                <ButtonBase
                  variant="blue"
                  buttonType="icon-text"
                  onClick={handleSetup}
                  disabled={!inputDomain.trim()}
                >
                  Set Up Domain
                  <ArrowRight className="size-4" />
                </ButtonBase>
              </div>
              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="size-4 shrink-0" />
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // ── "setting-up" state ───────────────────────────────────────────────────────
  if (state === "setting-up") {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center size-12 rounded-lg bg-violet-500/10 shrink-0">
            <Loader2 className="size-6 text-violet-500 animate-spin" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Configuring your email server...</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Creating a Postmark server and domain for {inputDomain}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  // ── "dns-records" / "verifying" state ────────────────────────────────────────
  if ((state === "dns-records" || state === "verifying") && dnsData) {
    const isVerifying = state === "verifying";

    const stripDomain = (host: string) => {
      const suffix = `.${dnsData.domain}`;
      return host.endsWith(suffix) ? host.slice(0, -suffix.length) : host;
    };

    const rows: { type: string; host: string; value: string; ttl: string; field: string }[] = [
      { type: "TXT",   host: stripDomain(dnsData.dkimPendingHost), value: dnsData.dkimPendingValue,    ttl: "60", field: "dkim" },
      { type: "CNAME", host: stripDomain(dnsData.returnPathHost),  value: dnsData.returnPathCnameValue, ttl: "60", field: "cname" },
    ];

    const providerSteps = selectedProvider ? getProviderSteps(selectedProvider) : null;
    const providerLabel = PROVIDERS.find((p) => p.id === selectedProvider)?.label;

    return (
      <Card className="p-6">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center size-12 rounded-lg bg-violet-500/10 shrink-0">
              <Globe className="size-6 text-violet-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Custom Sending Domain</h2>
              <p className="text-sm text-muted-foreground mt-0.5 font-mono">{dnsData.domain}</p>
            </div>
          </div>

          {/* Provider picker */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Who hosts your domain?
            </p>
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
          </div>

          {/* Provider instructions */}
          {providerSteps && (
            <Card className="p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                How to add records in {providerLabel}
              </p>
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

          {/* Verification status */}
          {(() => {
            const { dkimVerified, returnPathVerified } = verifyState;
            if (dkimVerified === null && returnPathVerified === null) {
              return (
                <div className="flex items-start gap-3 p-4 bg-blue-500/10 rounded-xl">
                  <AlertCircle className="size-5 text-blue-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-blue-500">Ready to verify</p>
                    <p className="text-sm text-blue-500/80">
                      Once you&apos;ve added both records, click Verify Records to check they&apos;re live. DNS changes can take up to 48 hours to propagate.
                    </p>
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
                    <p className="text-sm text-green-600/80">
                      Your domain is fully authenticated and ready to send email.
                    </p>
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
                  <p className="text-sm text-amber-600/80">
                    {parts.join(" ")} DNS changes can take up to 48 hours to propagate.
                  </p>
                </div>
              </div>
            );
          })()}

          {/* Verify button */}
          <div className="flex justify-end">
            <ButtonBase
              onClick={handleVerify}
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
      </Card>
    );
  }

  return null;
}
