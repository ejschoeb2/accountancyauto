"use client";

import { useState } from "react";
import { ClientPortalStep } from "./client-portal-step";
import { StorageSetupStep } from "./storage-setup-step";
import { UploadChecksStep } from "./upload-checks-step";
import type { UploadCheckMode } from "@/app/actions/settings";

interface PortalSetupStepProps {
  onComplete: (portalEnabled: boolean) => void;
  onBack: () => void;
  initialPortalSelection?: "yes" | "no";
  initialUploadCheckMode?: UploadCheckMode;
  initialAutoReceive?: boolean;
  initialRejectMismatched?: boolean;
  storageConnected?: string | null;
  storageError?: string | null;
  onBeforeStorageConnect: () => Promise<void>;
}

export function PortalSetupStep({
  onComplete,
  onBack,
  initialPortalSelection,
  initialUploadCheckMode,
  initialAutoReceive,
  initialRejectMismatched,
  storageConnected,
  storageError,
  onBeforeStorageConnect,
}: PortalSetupStepProps) {
  // If returning from a storage OAuth redirect, skip straight to the storage step (part 2)
  const returningFromOAuth = !!(storageConnected || storageError);
  const [part, setPart] = useState<1 | 2 | 3>(returningFromOAuth ? 2 : 1);
  const [portalEnabled, setPortalEnabled] = useState(returningFromOAuth ? true : false);

  if (part === 1) {
    return (
      <ClientPortalStep
        onComplete={(enabled) => {
          setPortalEnabled(enabled);
          if (enabled) {
            setPart(2);
          } else {
            onComplete(false);
          }
        }}
        onBack={onBack}
        initialSelection={initialPortalSelection}
      />
    );
  }

  if (part === 2) {
    return (
      <StorageSetupStep
        storageConnected={storageConnected}
        storageError={storageError}
        onComplete={() => setPart(3)}
        onBack={() => setPart(1)}
        onBeforeProviderConnect={onBeforeStorageConnect}
      />
    );
  }

  return (
    <UploadChecksStep
      onComplete={() => onComplete(true)}
      onBack={() => setPart(2)}
      initialSelection={initialUploadCheckMode}
      initialAutoReceive={initialAutoReceive}
      initialRejectMismatched={initialRejectMismatched}
    />
  );
}
