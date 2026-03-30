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
  initialPart?: 1 | 2 | 3;
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
  initialPart,
  initialUploadCheckMode,
  initialAutoReceive,
  initialRejectMismatched,
  storageConnected,
  storageError,
  onBeforeStorageConnect,
}: PortalSetupStepProps) {
  // Determine starting part: use initialPart from draft, fall back to storageConnected detection
  const returningFromOAuth = !!(storageConnected || storageError);
  const startPart = initialPart ?? (returningFromOAuth ? 2 : 1);
  const [part, setPart] = useState<1 | 2 | 3>(startPart);
  const [portalEnabled, setPortalEnabled] = useState(startPart >= 2);

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
