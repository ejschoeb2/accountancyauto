"use client";

import { useState, useTransition, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { Cloud, CheckCircle, XCircle, Loader2, HardDrive, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ButtonBase } from "@/components/ui/button-base";
import { disconnectGoogleDrive, disconnectOneDrive, getDocumentCountByBackend } from "@/app/actions/settings";
import { DropboxConnectCard } from "./dropbox-connect-card";
import { DisconnectConfirmModal } from "./disconnect-confirm-modal";

interface StorageCardProps {
  storageBackend: string | null;
  googleDriveFolderExists: boolean;
  storageBackendStatus: string | null;
  oneDriveConnected: boolean;
  dropboxConnected: boolean;
}

function StorageCardInner({
  storageBackend,
  googleDriveFolderExists,
  storageBackendStatus,
  oneDriveConnected,
  dropboxConnected,
}: StorageCardProps) {
  const router = useRouter();
  const [isGooglePending, startGoogleTransition] = useTransition();
  const [isOneDrivePending, startOneDriveTransition] = useTransition();
  const [googleDisconnectError, setGoogleDisconnectError] = useState<string | null>(null);
  const [oneDriveDisconnectError, setOneDriveDisconnectError] = useState<string | null>(null);

  // Google Drive modal state
  const [googleModalOpen, setGoogleModalOpen] = useState(false);
  const [googleDocCount, setGoogleDocCount] = useState<number | null>(null);

  // OneDrive modal state
  const [oneDriveModalOpen, setOneDriveModalOpen] = useState(false);
  const [oneDriveDocCount, setOneDriveDocCount] = useState<number | null>(null);

  const searchParams = useSearchParams();

  const error = searchParams.get("error");
  const connected = searchParams.get("connected");

  async function handleGoogleDisconnect() {
    startGoogleTransition(async () => {
      const result = await disconnectGoogleDrive();
      if (result.error) {
        setGoogleDisconnectError(result.error);
        setGoogleModalOpen(false);
      } else {
        setGoogleModalOpen(false);
        router.refresh();
      }
    });
  }

  async function handleOneDriveDisconnect() {
    startOneDriveTransition(async () => {
      const result = await disconnectOneDrive();
      if (result.error) {
        setOneDriveDisconnectError(result.error);
        setOneDriveModalOpen(false);
      } else {
        setOneDriveModalOpen(false);
        router.refresh();
      }
    });
  }

  const isGoogleConnected = storageBackend === "google_drive";
  const isOneDriveConnected = storageBackend === "onedrive";

  return (
    <div className="space-y-4">
      {/* Error banners */}
      {error === "conditional_access_blocked" && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-md bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="size-4 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Your IT admin has blocked this app with a Conditional Access policy. Ask your IT admin
            to grant consent for Prompt in Azure Active Directory.
          </p>
        </div>
      )}

      {error === "invalid_state" && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-md bg-red-500/10 border border-red-500/20">
          <AlertTriangle className="size-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400">
            Connection failed: security state mismatch. Please try again.
          </p>
        </div>
      )}

      {error === "auth_failed" && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-md bg-red-500/10 border border-red-500/20">
          <AlertTriangle className="size-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400">
            Connection failed. Please try again.
          </p>
        </div>
      )}

      {connected === "onedrive" && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-md bg-green-500/10 border border-green-500/20">
          <CheckCircle className="size-4 text-green-500 mt-0.5 shrink-0" />
          <p className="text-sm text-green-700 dark:text-green-400">
            OneDrive connected successfully.
          </p>
        </div>
      )}

      {connected === "google_drive" && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-md bg-green-500/10 border border-green-500/20">
          <CheckCircle className="size-4 text-green-500 mt-0.5 shrink-0" />
          <p className="text-sm text-green-700 dark:text-green-400">
            Google Drive connected successfully.
          </p>
        </div>
      )}

      {/* Google Drive Card */}
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

            {isGoogleConnected ? (
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
                    onClick={async () => {
                      setGoogleDocCount(null);
                      setGoogleModalOpen(true);
                      const count = await getDocumentCountByBackend('google_drive');
                      setGoogleDocCount(count);
                    }}
                    disabled={isGooglePending}
                  >
                    <XCircle className="size-4" />
                    Disconnect
                  </ButtonBase>
                  {googleDisconnectError && (
                    <span className="text-sm font-medium text-status-danger">
                      {googleDisconnectError}
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

      {/* OneDrive Card */}
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center size-12 rounded-lg bg-blue-500/10 shrink-0">
            <HardDrive className="size-6 text-blue-500" />
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Microsoft OneDrive</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Store client documents in your Microsoft OneDrive instead of Prompt&apos;s built-in storage
              </p>
            </div>

            {isOneDriveConnected ? (
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
                  Files are stored in the Apps/Prompt/ folder in your OneDrive.
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  {storageBackendStatus === "reauth_required" && (
                    <ButtonBase
                      variant="blue"
                      buttonType="icon-text"
                      onClick={() => window.location.href = "/api/auth/onedrive/connect"}
                    >
                      <CheckCircle className="size-4" />
                      Reconnect OneDrive
                    </ButtonBase>
                  )}
                  <ButtonBase
                    variant="destructive"
                    buttonType="icon-text"
                    onClick={async () => {
                      setOneDriveDocCount(null);
                      setOneDriveModalOpen(true);
                      const count = await getDocumentCountByBackend('onedrive');
                      setOneDriveDocCount(count);
                    }}
                    disabled={isOneDrivePending}
                  >
                    <XCircle className="size-4" />
                    Disconnect
                  </ButtonBase>
                  {oneDriveDisconnectError && (
                    <span className="text-sm font-medium text-status-danger">
                      {oneDriveDisconnectError}
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
                  Documents are stored in Prompt&apos;s built-in secure storage. Connect OneDrive to use your own storage instead.
                </p>
                <ButtonBase
                  variant="blue"
                  buttonType="icon-text"
                  onClick={() => window.location.href = "/api/auth/onedrive/connect"}
                >
                  <HardDrive className="size-4" />
                  Connect OneDrive
                </ButtonBase>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Dropbox Card */}
      <DropboxConnectCard
        isConnected={dropboxConnected}
        storageBackendStatus={storageBackendStatus}
      />

      {/* Google Drive Disconnect Confirmation Modal */}
      <DisconnectConfirmModal
        isOpen={googleModalOpen}
        onClose={() => setGoogleModalOpen(false)}
        providerName="Google Drive"
        documentCount={googleDocCount}
        isLoading={isGooglePending}
        onConfirm={handleGoogleDisconnect}
      />

      {/* OneDrive Disconnect Confirmation Modal */}
      <DisconnectConfirmModal
        isOpen={oneDriveModalOpen}
        onClose={() => setOneDriveModalOpen(false)}
        providerName="Microsoft OneDrive"
        documentCount={oneDriveDocCount}
        isLoading={isOneDrivePending}
        onConfirm={handleOneDriveDisconnect}
      />
    </div>
  );
}

export function StorageCard(props: StorageCardProps) {
  return (
    <Suspense fallback={null}>
      <StorageCardInner {...props} />
    </Suspense>
  );
}
