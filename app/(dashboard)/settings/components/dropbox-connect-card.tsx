"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HardDrive, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ButtonBase } from "@/components/ui/button-base";
import { disconnectDropbox } from "@/app/actions/settings";

interface DropboxConnectCardProps {
  /** true when the org's storage_backend === 'dropbox' */
  isConnected: boolean;
  /** 'active' | 'error' | 'reauth_required' | null */
  storageBackendStatus: string | null;
}

export function DropboxConnectCard({
  isConnected,
  storageBackendStatus,
}: DropboxConnectCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [disconnectError, setDisconnectError] = useState<string | null>(null);

  function handleDisconnect() {
    setDisconnectError(null);
    startTransition(async () => {
      const result = await disconnectDropbox();
      if (result.error) {
        setDisconnectError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <Card className="p-6">
      <div className="flex items-start gap-4">
        <div className="flex items-center justify-center size-12 rounded-lg bg-blue-500/10 shrink-0">
          <HardDrive className="size-6 text-blue-500" />
        </div>
        <div className="flex-1 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Dropbox</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Store client documents in your Dropbox App folder instead of Prompt&apos;s built-in storage
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
                {storageBackendStatus === "error" && (
                  <div className="px-3 py-2 rounded-md inline-flex items-center bg-amber-500/10">
                    <span className="text-sm font-medium text-amber-600">Connection error — checking automatically</span>
                  </div>
                )}
              </div>

              <p className="text-sm text-muted-foreground">
                Files are stored in the Prompt folder in your Dropbox.
              </p>

              {storageBackendStatus === "reauth_required" && (
                <p className="text-sm text-amber-600 font-medium">
                  Your Dropbox connection has expired. Please reconnect.
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3">
                {storageBackendStatus === "reauth_required" && (
                  <ButtonBase
                    variant="blue"
                    buttonType="icon-text"
                    onClick={() => window.location.href = "/api/auth/dropbox/connect"}
                  >
                    <CheckCircle className="size-4" />
                    Reconnect Dropbox
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
                {disconnectError && (
                  <span className="text-sm font-medium text-status-danger">
                    {disconnectError}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="px-3 py-2 rounded-md inline-flex items-center bg-status-neutral/10">
                <span className="text-sm font-medium text-status-neutral">Not connected</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Documents are stored in Prompt&apos;s built-in secure storage. Connect Dropbox to use your own storage instead.
              </p>
              <ButtonBase
                variant="blue"
                buttonType="icon-text"
                onClick={() => window.location.href = "/api/auth/dropbox/connect"}
              >
                <HardDrive className="size-4" />
                Connect Dropbox
              </ButtonBase>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
