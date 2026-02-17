"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { WizardStepper } from "@/components/wizard-stepper";
import { OnboardingClientTable } from "./components/onboarding-client-table";
import { EmailConfigForm } from "./components/email-config-form";
import { getClients, type Client } from "@/app/actions/clients";
import {
  getEmailSettings,
  markOnboardingComplete,
  type EmailSettings,
} from "@/app/actions/settings";

type WizardStep = "clients" | "email" | "complete";

const STEPS = [
  { label: "Clients" },
  { label: "Email" },
  { label: "Complete" },
];

function stepToIndex(step: WizardStep): number {
  switch (step) {
    case "clients":
      return 0;
    case "email":
      return 1;
    case "complete":
      return 2;
  }
}

export default function OnboardingPage() {
  const router = useRouter();

  const [wizardStep, setWizardStep] = useState<WizardStep>("clients");
  const [clients, setClients] = useState<Client[]>([]);
  const [emailSettings, setEmailSettings] = useState<EmailSettings | null>(
    null
  );
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);
  const [isCompletingOnboarding, setIsCompletingOnboarding] = useState(false);

  // Fetch clients when entering clients step
  useEffect(() => {
    if (wizardStep === "clients" && clients.length === 0 && !isLoadingClients) {
      setIsLoadingClients(true);
      getClients()
        .then((data) => {
          setClients(data);
        })
        .catch(() => {
          // Clients will show empty table
        })
        .finally(() => setIsLoadingClients(false));
    }
  }, [wizardStep, clients.length, isLoadingClients]);

  // Fetch email settings when entering email step
  useEffect(() => {
    if (wizardStep === "email" && !emailSettings && !isLoadingEmail) {
      setIsLoadingEmail(true);
      getEmailSettings()
        .then((data) => setEmailSettings(data))
        .catch(() => {
          // Will show defaults
          setEmailSettings({
            senderName: "PhaseTwo",
            senderAddress: "hello@phasetwo.uk",
            replyTo: "hello@phasetwo.uk",
          });
        })
        .finally(() => setIsLoadingEmail(false));
    }
  }, [wizardStep, emailSettings, isLoadingEmail]);

  const handleComplete = async () => {
    setIsCompletingOnboarding(true);
    try {
      await markOnboardingComplete();
      router.push("/dashboard");
    } catch (error) {
      console.error("Failed to mark onboarding complete:", error);
      // Still redirect to dashboard even if marking fails
      router.push("/dashboard");
    }
  };

  return (
    <div className="space-y-8">
      {/* Stepper */}
      <WizardStepper steps={STEPS} currentStep={stepToIndex(wizardStep)} />

      {/* Step 1: Configure Clients */}
      {wizardStep === "clients" && (
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">
              Configure Your Clients
            </h1>
            <p className="text-muted-foreground">
              Set client types, year-end dates, and VAT details. You can also
              import from a CSV file.
            </p>
          </div>

          {isLoadingClients ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <OnboardingClientTable
                  initialClients={clients}
                  onClientsChange={setClients}
                />
              </CardContent>
            </Card>
          )}

          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={() => setWizardStep("email")}>
              Skip
            </Button>
            <Button
              onClick={() => setWizardStep("email")}
              className="active:scale-[0.97]"
            >
              Continue
              <ArrowRight className="size-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Configure Email */}
      {wizardStep === "email" && (
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">
              Email Settings
            </h1>
            <p className="text-muted-foreground">
              Configure the sender details for your reminder emails.
            </p>
          </div>

          {isLoadingEmail || !emailSettings ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <EmailConfigForm
                  initialSettings={emailSettings}
                  onSaved={() => setWizardStep("complete")}
                  onSkip={() => setWizardStep("complete")}
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Step 3: Complete */}
      {wizardStep === "complete" && (
        <div className="text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center">
            <CheckCircle className="size-8 text-green-600" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">
              You&apos;re all set!
            </h2>
            <p className="text-muted-foreground">
              Your system is configured and ready to send reminders.
            </p>
          </div>
          <Button
            onClick={handleComplete}
            disabled={isCompletingOnboarding}
            className="active:scale-[0.97]"
            size="lg"
          >
            {isCompletingOnboarding ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Loading dashboard...
              </>
            ) : (
              "Go to Dashboard"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
