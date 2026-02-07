"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
  initiateQuickBooksOAuth,
  syncClientsAction,
} from "@/app/actions/quickbooks";

type Step = "welcome" | "connecting" | "syncing" | "complete" | "error";

function OnboardingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [syncedCount, setSyncedCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const syncing = searchParams.get("syncing");
    const count = searchParams.get("count");
    const error = searchParams.get("error");

    if (error) {
      setStep("error");
      setErrorMessage(getErrorMessage(error));
    } else if (syncing === "true" && count) {
      setStep("complete");
      setSyncedCount(parseInt(count, 10));
    }
  }, [searchParams]);

  const getErrorMessage = (errorCode: string): string => {
    switch (errorCode) {
      case "oauth_failed":
        return "Failed to authenticate with QuickBooks. Please try again.";
      case "sync_failed":
        return "Failed to sync clients from QuickBooks. Please try again.";
      default:
        return "An unexpected error occurred. Please try again.";
    }
  };

  const handleConnect = async () => {
    setIsLoading(true);
    setStep("connecting");

    try {
      const authUrl = await initiateQuickBooksOAuth();
      window.location.href = authUrl;
    } catch (error) {
      setStep("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to initiate OAuth"
      );
      setIsLoading(false);
    }
  };

  const handleTryAgain = () => {
    // Clear query params and reset to welcome step
    router.replace("/onboarding");
    setStep("welcome");
    setErrorMessage("");
  };

  const handleGoToClients = () => {
    router.push("/clients");
  };

  return (
    <div className="text-center space-y-6">
      {step === "welcome" && (
        <>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">
              Welcome to Peninsula Accounting
            </h1>
            <p className="text-muted-foreground">
              Connect your QuickBooks Online account to get started.
            </p>
          </div>
          <Button
            onClick={handleConnect}
            disabled={isLoading}
            className="w-full sm:w-auto px-8 py-6 text-lg active:scale-[0.97]"
            style={{ backgroundColor: "#0077C5" }} /* QuickBooks brand color - intentional override */
          >
            {isLoading ? (
              <Icon name="progress_activity" size="md" className="mr-2 animate-spin" />
            ) : null}
            Connect QuickBooks Online
          </Button>
        </>
      )}

      {step === "connecting" && (
        <div className="space-y-4">
          <Icon name="progress_activity" size="xl" className="mx-auto animate-spin text-muted-foreground" />
          <h2 className="text-xl font-semibold">Connecting to QuickBooks...</h2>
          <p className="text-muted-foreground">
            Please complete the authorization in the QuickBooks window.
          </p>
        </div>
      )}

      {step === "syncing" && (
        <div className="space-y-4">
          <Icon name="progress_activity" size="xl" className="mx-auto animate-spin text-muted-foreground" />
          <h2 className="text-xl font-semibold">Syncing your clients...</h2>
          <p className="text-muted-foreground">
            This may take a moment depending on the number of clients.
          </p>
        </div>
      )}

      {step === "complete" && (
        <div className="space-y-4">
          <div className="mx-auto w-16 h-16 bg-status-success/10 rounded-full flex items-center justify-center">
            <Icon name="check_circle" size="xl" className="text-status-success" />
          </div>
          <h2 className="text-2xl font-bold">All set!</h2>
          <p className="text-muted-foreground">
            {syncedCount} {syncedCount === 1 ? "client" : "clients"} synced.
          </p>
          <Button onClick={handleGoToClients} className="mt-4 active:scale-[0.97]">
            Go to Clients
          </Button>
        </div>
      )}

      {step === "error" && (
        <div className="space-y-4">
          <div className="mx-auto w-16 h-16 bg-status-danger/10 rounded-full flex items-center justify-center">
            <Icon name="cancel" size="xl" className="text-status-danger" />
          </div>
          <h2 className="text-2xl font-bold">Something went wrong</h2>
          <p className="text-muted-foreground">{errorMessage}</p>
          <Button onClick={handleTryAgain} variant="outline" className="mt-4">
            Try Again
          </Button>
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
          <Icon name="progress_activity" size="xl" className="mx-auto animate-spin text-muted-foreground" />
          <h2 className="text-xl font-semibold">Loading...</h2>
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
