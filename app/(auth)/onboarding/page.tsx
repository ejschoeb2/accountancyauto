"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Loader2,
  CheckCircle,
  XCircle,
  ArrowRight,
  Settings,
  Users,
  Play,
  Plug,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { WizardStepper } from "@/components/wizard-stepper";
import { OnboardingClientTable } from "./components/onboarding-client-table";
import { EmailConfigForm } from "./components/email-config-form";
import {
  initiateQuickBooksOAuth,
} from "@/app/actions/quickbooks";
import { getClients, type Client } from "@/app/actions/clients";
import {
  getEmailSettings,
  updateSetupMode,
  type EmailSettings,
  type SetupMode,
} from "@/app/actions/settings";

type WizardStep = "mode" | "connect" | "metadata" | "email" | "complete";
type ConnectSubState = "idle" | "connecting";

const DEMO_STEPS = [
  { label: "Mode" },
  { label: "Clients" },
  { label: "Email" },
  { label: "Complete" },
];

const REAL_STEPS = [
  { label: "Mode" },
  { label: "Connect" },
  { label: "Clients" },
  { label: "Email" },
  { label: "Complete" },
];

function getWizardSteps(mode: SetupMode | null) {
  return mode === "real" ? REAL_STEPS : DEMO_STEPS;
}

function stepToIndex(step: WizardStep, mode: SetupMode | null): number {
  if (mode === "real") {
    switch (step) {
      case "mode": return 0;
      case "connect": return 1;
      case "metadata": return 2;
      case "email": return 3;
      case "complete": return 4;
    }
  }
  // demo or null (before mode is chosen)
  switch (step) {
    case "mode": return 0;
    case "connect": return 0; // shouldn't happen in demo
    case "metadata": return 1;
    case "email": return 2;
    case "complete": return 3;
  }
}

function getErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case "oauth_failed":
      return "Failed to authenticate with QuickBooks. Please try again.";
    case "sync_failed":
      return "Failed to sync clients from QuickBooks. Please try again.";
    default:
      return "An unexpected error occurred. Please try again.";
  }
}

function OnboardingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [wizardStep, setWizardStep] = useState<WizardStep>("mode");
  const [setupMode, setSetupMode] = useState<SetupMode | null>(null);
  const [connectSubState, setConnectSubState] =
    useState<ConnectSubState>("idle");
  const [error, setError] = useState<{
    visible: boolean;
    message: string;
  }>({ visible: false, message: "" });
  const [syncedCount, setSyncedCount] = useState<number>(0);
  const [clients, setClients] = useState<Client[]>([]);
  const [emailSettings, setEmailSettings] = useState<EmailSettings | null>(
    null
  );
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);

  // Handle OAuth callback params
  useEffect(() => {
    const syncing = searchParams.get("syncing");
    const count = searchParams.get("count");
    const errorParam = searchParams.get("error");

    if (errorParam) {
      setError({ visible: true, message: getErrorMessage(errorParam) });
      setSetupMode("real");
      setWizardStep("connect");
    } else if (syncing === "true" && count) {
      setSyncedCount(parseInt(count, 10));
      setSetupMode("real");
      setWizardStep("metadata");
    }
  }, [searchParams]);

  // Fetch clients when entering metadata step
  useEffect(() => {
    if (wizardStep === "metadata" && clients.length === 0 && !isLoadingClients) {
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
            senderName: "Peninsula Accounting",
            senderAddress: "reminders@peninsulaaccounting.co.uk",
            replyTo: "info@peninsulaaccounting.co.uk",
          });
        })
        .finally(() => setIsLoadingEmail(false));
    }
  }, [wizardStep, emailSettings, isLoadingEmail]);

  const handleConnect = async () => {
    setConnectSubState("connecting");
    setError({ visible: false, message: "" });

    try {
      const authUrl = await initiateQuickBooksOAuth();
      window.location.href = authUrl;
    } catch (err) {
      setError({
        visible: true,
        message:
          err instanceof Error ? err.message : "Failed to initiate OAuth",
      });
      setConnectSubState("idle");
    }
  };

  const handleDismissError = () => {
    router.replace("/onboarding");
    setError({ visible: false, message: "" });
    setConnectSubState("idle");
    setWizardStep("connect");
  };

  const handleModeSelect = async (mode: SetupMode) => {
    setSetupMode(mode);
    await updateSetupMode(mode);
    if (mode === "demo") {
      setWizardStep("metadata");
    } else {
      setWizardStep("connect");
    }
  };

  return (
    <div className="space-y-8">
      {/* Stepper */}
      <WizardStepper steps={getWizardSteps(setupMode)} currentStep={stepToIndex(wizardStep, setupMode)} />

      {/* Error overlay */}
      {error.visible && (
        <div className="rounded-xl border border-status-danger/30 bg-status-danger/5 p-6 text-center space-y-4">
          <div className="mx-auto w-14 h-14 bg-status-danger/10 rounded-full flex items-center justify-center">
            <XCircle className="size-7 text-status-danger" />
          </div>
          <h2 className="text-xl font-bold">Something went wrong</h2>
          <p className="text-muted-foreground">{error.message}</p>
          <Button
            onClick={handleDismissError}
            variant="outline"
            className="mt-2"
          >
            Try Again
          </Button>
        </div>
      )}

      {/* Step 1: Choose Mode */}
      {wizardStep === "mode" && !error.visible && (
        <div className="text-center space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">
              Welcome to Peninsula Accounting
            </h1>
            <p className="text-muted-foreground">
              How would you like to get started?
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 max-w-lg mx-auto">
            <button
              onClick={() => handleModeSelect("demo")}
              className="group rounded-xl border-2 border-muted-foreground/20 p-6 text-left transition-all hover:border-primary hover:bg-primary/5 active:scale-[0.97]"
            >
              <div className="mb-3 flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Play className="size-5" />
              </div>
              <h3 className="font-semibold">Demo Mode</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Explore with sample data. No accounts needed.
              </p>
            </button>

            <button
              onClick={() => handleModeSelect("real")}
              className="group rounded-xl border-2 border-muted-foreground/20 p-6 text-left transition-all hover:border-primary hover:bg-primary/5 active:scale-[0.97]"
            >
              <div className="mb-3 flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Plug className="size-5" />
              </div>
              <h3 className="font-semibold">Connect Your Data</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Sync clients from QuickBooks Online.
              </p>
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Connect QuickBooks (real mode only) */}
      {wizardStep === "connect" && !error.visible && (
        <div className="text-center space-y-6">
          {connectSubState === "idle" && (
            <>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold tracking-tight">
                  Connect QuickBooks Online
                </h1>
                <p className="text-muted-foreground">
                  Link your QuickBooks account to sync your client list.
                </p>
              </div>
              <Button
                onClick={handleConnect}
                className="w-full sm:w-auto px-8 py-6 text-lg active:scale-[0.97]"
                style={{ backgroundColor: "#0077C5" }}
              >
                Connect QuickBooks Online
              </Button>
            </>
          )}

          {connectSubState === "connecting" && (
            <div className="space-y-4">
              <Loader2 className="size-8 mx-auto animate-spin text-muted-foreground" />
              <h2 className="text-xl font-semibold">
                Connecting to QuickBooks...
              </h2>
              <p className="text-muted-foreground">
                Please complete the authorization in the QuickBooks window.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Configure Clients */}
      {wizardStep === "metadata" && (
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">
              Configure Your Clients
            </h1>
            <p className="text-muted-foreground">
              {syncedCount > 0 &&
                `${syncedCount} ${syncedCount === 1 ? "client" : "clients"} synced. `}
              Set client types, year end dates, and VAT details. You can also
              import this data from a CSV file.
            </p>
          </div>

          {isLoadingClients ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <OnboardingClientTable initialClients={clients} onClientsChange={setClients} />
          )}

          <div className="flex justify-between pt-2">
            <Button
              variant="ghost"
              onClick={() => setWizardStep("email")}
            >
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

      {/* Step 3: Configure Email */}
      {wizardStep === "email" && (
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">
              Configure Email Settings
            </h1>
            <p className="text-muted-foreground">
              Set the sender details for your reminder emails. The sender email
              must be verified in Postmark.
            </p>
          </div>

          {isLoadingEmail || !emailSettings ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <EmailConfigForm
              initialSettings={emailSettings}
              onSaved={() => setWizardStep("complete")}
              onSkip={() => setWizardStep("complete")}
            />
          )}
        </div>
      )}

      {/* Step 4: Complete */}
      {wizardStep === "complete" && (
        <div className="text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-status-success/10 rounded-full flex items-center justify-center">
            <CheckCircle className="size-8 text-status-success" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">All set!</h2>
            <p className="text-muted-foreground">
              Your system is configured and ready to send reminders.
              {syncedCount > 0 &&
                ` ${syncedCount} ${syncedCount === 1 ? "client" : "clients"} synced.`}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={() => router.push("/clients")}
              className="active:scale-[0.97]"
            >
              <Users className="size-4 mr-2" />
              Go to Clients
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/settings")}
            >
              <Settings className="size-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="text-center space-y-4">
          <Loader2 className="size-8 mx-auto animate-spin text-muted-foreground" />
          <h2 className="text-xl font-semibold">Loading...</h2>
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
