"use client";

import { useState } from "react";
import { Loader2, Copy, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ButtonBase } from "@/components/ui/button-base";
import {
  setupPostmarkForOrg,
  checkOrgDomainVerification,
} from "../actions";

interface EmailSetupStepProps {
  onComplete: () => void;
}

type StepState = "input" | "setting-up" | "dns-records" | "verifying";

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

export function EmailSetupStep({ onComplete }: EmailSetupStepProps) {
  const [state, setState] = useState<StepState>("input");
  const [domain, setDomain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dnsData, setDnsData] = useState<DnsData | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [verifyState, setVerifyState] = useState<VerifyState>({
    dkimVerified: null,
    returnPathVerified: null,
  });

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

  // ── "input" state ──────────────────────────────────────────────────────────
  if (state === "input") {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Set up email sending</h2>
          <p className="text-sm text-muted-foreground">
            Prompt will configure Postmark to send emails from your domain.
            You&apos;ll need to add two DNS records.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email-domain">Your domain</Label>
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

            <Button
              className="w-full active:scale-[0.97]"
              onClick={handleSetup}
              disabled={!domain.trim()}
            >
              Set Up Email
            </Button>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <ButtonBase variant="muted" buttonType="text-only" onClick={onComplete}>
            Skip for now
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
      <div className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Add DNS records</h2>
          <p className="text-sm text-muted-foreground">
            Add these two records to your DNS provider for <span className="font-medium">{domain}</span>.
          </p>
        </div>

        {/* DNS Records Table */}
        <Card>
          <CardContent className="pt-6 p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-16">Type</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Host</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Value</th>
                    <th className="w-10 px-4 py-2.5" />
                    <th className="w-24 px-4 py-2.5" />
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
                        <td className="px-4 py-3 font-mono text-xs max-w-xs">
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
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          DNS changes can take up to 48 hours to propagate. You can check
          verification status in Settings at any time.
        </p>

        <div className="flex items-center gap-3">
          <ButtonBase
            onClick={handleCheckDns}
            disabled={isVerifying}
            buttonType="text-only"
            variant="muted"
          >
            {isVerifying ? (
              <>
                <Loader2 className="size-4 animate-spin mr-1.5" />
                Checking...
              </>
            ) : (
              "Check DNS"
            )}
          </ButtonBase>

          <ButtonBase onClick={onComplete} buttonType="text-only">
            Continue
          </ButtonBase>
        </div>
      </div>
    );
  }

  return null;
}
