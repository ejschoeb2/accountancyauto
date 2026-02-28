"use client";

import { useTransition } from "react";
import { Cloud, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ButtonBase } from "@/components/ui/button-base";
import { disconnectGoogleDrive } from "@/app/actions/settings";

interface StorageCardProps {
  storageBackend: string | null;
  googleDriveFolderExists: boolean;
  storageBackendStatus: string | null;
}

export function StorageCard({
  storageBackend,
  googleDriveFolderExists,
  storageBackendStatus,
}: StorageCardProps) {
  const [isPending, startTransition] = useTransition();

  function handleDisconnect() {
    startTransition(async () => {
      await disconnectGoogleDrive();
    });
  }

  const isConnected = storageBackend === "google_drive";

  return (
    <Card className="p-6">
      <div className="flex items-start gap-4">
        <div className="flex items-center justify-center size-12 rounded-lg bg-sky-500/10 shrink-0">
          <Cloud className="size-6 text-sky-500" />
        </div>
        <div className="flex-1 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Google Drive</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Store client documents in your Google Drive instead of Prompt&apos;s built-in storage
            </p>
          </div>

          {isConnected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="px-3 py-2 rounded-md inline-flex items-center bg-green-500/10">
                  <span className="text-sm font-medium text-green-600">Connected</span>
                </div>
                {storageBackendStatus === "reauth_required" && (
                  <div className="px-3 py-2 rounded-md inline-flex items-center bg-red-500/10">
                    <span className="text-sm font-medium text-red-500">Re-authentication required</span>
                  </div>
                )}
              </div>

              {googleDriveFolderExists && (
                <p className="text-sm text-muted-foreground">
                  Files are stored in the Prompt/ folder in your Google Drive.
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3">
                {storageBackendStatus === "reauth_required" && (
                  <ButtonBase
                    variant="blue"
                    buttonType="icon-text"
                    onClick={() => window.location.href = "/api/auth/google-drive/connect"}
                  >
                    <CheckCircle className="size-4" />
                    Reconnect Google Drive
                  </ButtonBase>
                )}
                <ButtonBase
                  variant="destructive"
                  buttonType="icon-text"
                  onClick={handleDisconnect}
                  disabled={isPending}
                >
                  {isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <XCircle className="size-4" />
                  )}
                  {isPending ? "Disconnecting..." : "Disconnect"}
                </ButtonBase>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="px-3 py-2 rounded-md inline-flex items-center bg-status-neutral/10">
                <span className="text-sm font-medium text-status-neutral">Not connected</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Documents are stored in Prompt&apos;s built-in secure storage. Connect Google Drive to use your own storage instead.
              </p>
              <ButtonBase
                variant="sky"
                buttonType="icon-text"
                onClick={() => window.location.href = "/api/auth/google-drive/connect"}
              >
                <Cloud className="size-4" />
                Connect Google Drive
              </ButtonBase>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
