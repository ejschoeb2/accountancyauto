"use client";

import { useState, useEffect, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { WizardStepper } from "@/components/wizard-stepper";
import { CsvImportStep } from "./components/csv-import-step";
import { ConfigStep } from "./components/config-step";
import {
  markMemberSetupComplete,
  getUserSendHour,
  getUserEmailSettings,
  getInboundCheckerMode,
  type EmailSettings,
  type InboundCheckerMode,
} from "@/app/actions/settings";

const STEPS = [
  { label: "Import Clients" },
  { label: "Configuration" },
];

export default function WizardPage() {
  const [step, setStep] = useState(0);

  // Prefetched defaults for Step 2
  const [sendHour, setSendHour] = useState<number | null>(null);
  const [emailSettings, setEmailSettings] = useState<EmailSettings | null>(null);
  const [inboundMode, setInboundMode] = useState<InboundCheckerMode | null>(null);

  const [isCompleting, setIsCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_, startTransition] = useTransition();

  // Prefetch Step 2 defaults on mount so they're ready when the user advances
  useEffect(() => {
    Promise.all([
      getUserSendHour(),
      getUserEmailSettings(),
      getInboundCheckerMode(),
    ]).then(([hour, settings, mode]) => {
      setSendHour(hour);
      setEmailSettings(settings);
      setInboundMode(mode);
    });
  }, []);

  function handleStep1Complete() {
    setStep(1);
  }

  async function handleStep2Complete() {
    setIsCompleting(true);
    setCompleteError(null);

    const result = await markMemberSetupComplete();

    if (result.error) {
      setCompleteError(result.error);
      setIsCompleting(false);
      return;
    }

    // Force a full page navigation so the session reloads with updated flags.
    // The middleware handles subdomain resolution and will redirect to the
    // correct org dashboard from the root path.
    window.location.href = "/";
  }

  return (
    <div className="space-y-8">
      <WizardStepper steps={STEPS} currentStep={step} />

      {step === 0 && (
        <CsvImportStep onComplete={handleStep1Complete} />
      )}

      {step === 1 && sendHour !== null && emailSettings !== null && inboundMode !== null && (
        <div className="space-y-4">
          <ConfigStep
            defaultSendHour={sendHour}
            defaultEmailSettings={emailSettings}
            defaultInboundMode={inboundMode}
            onComplete={handleStep2Complete}
          />
          {isCompleting && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Completing setup...
            </div>
          )}
          {completeError && (
            <p className="text-sm text-destructive">{completeError}</p>
          )}
        </div>
      )}

      {step === 1 && (sendHour === null || emailSettings === null || inboundMode === null) && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
