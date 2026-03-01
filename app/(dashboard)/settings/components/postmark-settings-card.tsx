"use client";

import { useState, useTransition } from "react";
import { Server, ShieldCheck, CheckCircle, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ButtonBase } from "@/components/ui/button-base";
import { updatePostmarkSettings } from "@/app/actions/settings";

interface PostmarkSettingsCardProps {
  defaultToken: string;
  defaultSenderDomain: string;
}

export function PostmarkSettingsCard({
  defaultToken,
  defaultSenderDomain,
}: PostmarkSettingsCardProps) {
  const [token, setToken] = useState(defaultToken);
  const [senderDomain, setSenderDomain] = useState(defaultSenderDomain);

  const [isValidating, setIsValidating] = useState(false);
  const [isSaving, startSaveTransition] = useTransition();

  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    serverName?: string;
    error?: string;
  } | null>(null);
  const [saveResult, setSaveResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);

  async function handleValidate() {
    if (!token.trim()) {
      setValidationResult({ valid: false, error: "Please enter a Postmark server token first." });
      return;
    }

    setIsValidating(true);
    setValidationResult(null);

    try {
      const response = await fetch("/api/settings/validate-postmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });

      const data = await response.json();

      if (data.valid) {
        setValidationResult({ valid: true, serverName: data.serverName });
      } else {
        setValidationResult({ valid: false, error: data.error || "Invalid Postmark token" });
      }
    } catch {
      setValidationResult({ valid: false, error: "Failed to connect to validation service." });
    } finally {
      setIsValidating(false);
    }
  }

  function handleSave() {
    setSaveResult(null);
    startSaveTransition(async () => {
      const result = await updatePostmarkSettings(token, senderDomain);
      if (result.error) {
        setSaveResult({ success: false, error: result.error });
      } else {
        setSaveResult({ success: true });
        setTimeout(() => setSaveResult(null), 3000);
      }
    });
  }

  return (
    <Card className="p-6">
      <div className="flex items-start gap-4">
        <div className="flex items-center justify-center size-12 rounded-lg bg-violet-500/10 shrink-0">
          <Server className="size-6 text-violet-500" />
        </div>
        <div className="flex-1 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Email Configuration</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configure your Postmark email delivery settings
            </p>
          </div>

          {!token && (
            <div className="px-3 py-2 rounded-md bg-amber-500/10">
              <span className="text-sm font-medium text-amber-600">
                Email sending is disabled until you configure a Postmark server token.
              </span>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="postmark-token" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Postmark Server Token
            </label>
            <Input
              id="postmark-token"
              type="password"
              value={token}
              onChange={(e) => {
                setToken(e.target.value);
                setValidationResult(null);
                setSaveResult(null);
              }}
              disabled={isValidating || isSaving}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
            <p className="text-xs text-muted-foreground">
              Enter your Postmark server API token. Find it in your Postmark server&apos;s API Tokens tab.
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="postmark-sender-domain" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Sender Domain
            </label>
            <Input
              id="postmark-sender-domain"
              type="text"
              value={senderDomain}
              onChange={(e) => {
                setSenderDomain(e.target.value);
                setSaveResult(null);
              }}
              disabled={isValidating || isSaving}
              placeholder="notifications.yourdomain.com"
            />
            <p className="text-xs text-muted-foreground">
              The verified domain in Postmark for sending emails.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <ButtonBase
              variant="green"
              onClick={handleValidate}
              disabled={isValidating || isSaving || !token.trim()}
              buttonType="icon-text"
            >
              {isValidating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ShieldCheck className="size-4" />
              )}
              {isValidating ? "Validating..." : "Validate Token"}
            </ButtonBase>

            <ButtonBase
              variant="blue"
              onClick={handleSave}
              disabled={isValidating || isSaving}
              buttonType="icon-text"
            >
              {isSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle className="size-4" />
              )}
              {isSaving ? "Saving..." : "Save"}
            </ButtonBase>

            {validationResult && (
              <span
                className={`text-sm font-medium ${
                  validationResult.valid ? "text-green-600" : "text-status-danger"
                }`}
              >
                {validationResult.valid
                  ? `Valid — server: ${validationResult.serverName}`
                  : validationResult.error}
              </span>
            )}

            {saveResult && (
              <span
                className={`text-sm font-medium ${
                  saveResult.success ? "text-green-600" : "text-status-danger"
                }`}
              >
                {saveResult.success ? "Settings saved" : saveResult.error}
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
