"use client";

import { useState, useTransition, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { CheckCircle, XCircle, HardDrive, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ButtonBase } from "@/components/ui/button-base";
import {
  disconnectGoogleDrive,
  disconnectOneDrive,
  disconnectDropbox,
  getDocumentCountByBackend,
} from "@/app/actions/settings";
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
  dropboxConnected,
}: StorageCardProps) {
  const router = useRouter();

  const [isGooglePending, startGoogleTransition] = useTransition();
  const [isOneDrivePending, startOneDriveTransition] = useTransition();
  const [isDropboxPending, startDropboxTransition] = useTransition();

  const [googleDisconnectError, setGoogleDisconnectError] = useState<string | null>(null);
  const [oneDriveDisconnectError, setOneDriveDisconnectError] = useState<string | null>(null);
  const [dropboxDisconnectError, setDropboxDisconnectError] = useState<string | null>(null);

  const [googleModalOpen, setGoogleModalOpen] = useState(false);
  const [googleDocCount, setGoogleDocCount] = useState<number | null>(null);
  const [oneDriveModalOpen, setOneDriveModalOpen] = useState(false);
  const [oneDriveDocCount, setOneDriveDocCount] = useState<number | null>(null);
  const [dropboxModalOpen, setDropboxModalOpen] = useState(false);
  const [dropboxDocCount, setDropboxDocCount] = useState<number | null>(null);

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

  function handleDropboxDisconnect() {
    setDropboxDisconnectError(null);
    startDropboxTransition(async () => {
      const result = await disconnectDropbox();
      if (result.error) {
        setDropboxDisconnectError(result.error);
        setDropboxModalOpen(false);
      } else {
        setDropboxModalOpen(false);
        router.refresh();
      }
    });
  }

  const isGoogleConnected = storageBackend === "google_drive";
  const isOneDriveConnected = storageBackend === "onedrive";
  const isDropboxConnected = dropboxConnected;
  const isSupabaseActive = !storageBackend;

  return (
    <div className="space-y-4">
      {/* Error / success banners */}
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
          <p className="text-sm text-green-700 dark:text-green-400">OneDrive connected successfully.</p>
        </div>
      )}
      {connected === "google_drive" && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-md bg-green-500/10 border border-green-500/20">
          <CheckCircle className="size-4 text-green-500 mt-0.5 shrink-0" />
          <p className="text-sm text-green-700 dark:text-green-400">Google Drive connected successfully.</p>
        </div>
      )}

      <Card className="p-6">
        <div className="flex items-start gap-4 mb-6">
          <div className="flex items-center justify-center size-12 rounded-lg bg-violet-500/10 shrink-0">
            <HardDrive className="size-6 text-violet-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Document Storage</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Connect a cloud storage provider to store client documents in your own storage. Only one provider can be active at a time.
            </p>
          </div>
        </div>

        <div className="divide-y divide-border">
          {/* Supabase (built-in default) */}
          <div className="py-4 first:pt-0 last:pb-0">
            <div className="flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Supabase Storage</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isSupabaseActive
                    ? "Documents are stored in Prompt's built-in secure database. No external account needed."
                    : "Prompt's built-in storage — used automatically if you disconnect your connected provider."}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isSupabaseActive && (
                  <div className="px-2.5 py-1 rounded-md inline-flex items-center bg-green-500/10">
                    <span className="text-xs font-medium text-green-600">Active</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Google Drive */}
          <div className="py-4 first:pt-0 last:pb-0">
            <div className="flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Google Drive</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isGoogleConnected
                    ? googleDriveFolderExists
                      ? "Stored in the Prompt/ folder in your Google Drive"
                      : "Connected"
                    : "Store documents in your Google Drive"}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isGoogleConnected ? (
                  <>
                    <div className="px-2.5 py-1 rounded-md inline-flex items-center bg-green-500/10">
                      <span className="text-xs font-medium text-green-600">Connected</span>
                    </div>
                    {storageBackendStatus === "reauth_required" && (
                      <div className="px-2.5 py-1 rounded-md inline-flex items-center bg-red-500/10">
                        <span className="text-xs font-medium text-red-500">Re-auth required</span>
                      </div>
                    )}
                    {storageBackendStatus === "error" && (
                      <div className="px-2.5 py-1 rounded-md inline-flex items-center bg-amber-500/10">
                        <span className="text-xs font-medium text-amber-600">Connection error</span>
                      </div>
                    )}
                    {storageBackendStatus === "reauth_required" && (
                      <ButtonBase
                        variant="violet"
                        buttonType="icon-text"
                        onClick={() => (window.location.href = "/api/auth/google-drive/connect")}
                      >
                        <HardDrive className="size-4" />
                        Reconnect
                      </ButtonBase>
                    )}
                    <ButtonBase
                      variant="destructive"
                      buttonType="icon-text"
                      onClick={async () => {
                        setGoogleDocCount(null);
                        setGoogleModalOpen(true);
                        const count = await getDocumentCountByBackend("google_drive");
                        setGoogleDocCount(count);
                      }}
                      disabled={isGooglePending}
                    >
                      <XCircle className="size-4" />
                      Disconnect
                    </ButtonBase>
                    {googleDisconnectError && (
                      <span className="text-sm font-medium text-status-danger">{googleDisconnectError}</span>
                    )}
                  </>
                ) : (
                  <ButtonBase
                    variant="violet"
                    buttonType="icon-text"
                    onClick={() => (window.location.href = "/api/auth/google-drive/connect")}
                  >
                    <HardDrive className="size-4" />
                    Connect
                  </ButtonBase>
                )}
              </div>
            </div>
          </div>

          {/* Microsoft OneDrive */}
          <div className="py-4 first:pt-0 last:pb-0">
            <div className="flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Microsoft OneDrive</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isOneDriveConnected
                    ? "Stored in Apps/Prompt/ in your OneDrive"
                    : "Store documents in your Microsoft OneDrive"}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isOneDriveConnected ? (
                  <>
                    <div className="px-2.5 py-1 rounded-md inline-flex items-center bg-green-500/10">
                      <span className="text-xs font-medium text-green-600">Connected</span>
                    </div>
                    {storageBackendStatus === "reauth_required" && (
                      <div className="px-2.5 py-1 rounded-md inline-flex items-center bg-red-500/10">
                        <span className="text-xs font-medium text-red-500">Re-auth required</span>
                      </div>
                    )}
                    {storageBackendStatus === "error" && (
                      <div className="px-2.5 py-1 rounded-md inline-flex items-center bg-amber-500/10">
                        <span className="text-xs font-medium text-amber-600">Connection error</span>
                      </div>
                    )}
                    {storageBackendStatus === "reauth_required" && (
                      <ButtonBase
                        variant="violet"
                        buttonType="icon-text"
                        onClick={() => (window.location.href = "/api/auth/onedrive/connect")}
                      >
                        <HardDrive className="size-4" />
                        Reconnect
                      </ButtonBase>
                    )}
                    <ButtonBase
                      variant="destructive"
                      buttonType="icon-text"
                      onClick={async () => {
                        setOneDriveDocCount(null);
                        setOneDriveModalOpen(true);
                        const count = await getDocumentCountByBackend("onedrive");
                        setOneDriveDocCount(count);
                      }}
                      disabled={isOneDrivePending}
                    >
                      <XCircle className="size-4" />
                      Disconnect
                    </ButtonBase>
                    {oneDriveDisconnectError && (
                      <span className="text-sm font-medium text-status-danger">{oneDriveDisconnectError}</span>
                    )}
                  </>
                ) : (
                  <ButtonBase
                    variant="violet"
                    buttonType="icon-text"
                    onClick={() => (window.location.href = "/api/auth/onedrive/connect")}
                  >
                    <HardDrive className="size-4" />
                    Connect
                  </ButtonBase>
                )}
              </div>
            </div>
          </div>

          {/* Dropbox */}
          <div className="py-4 first:pt-0 last:pb-0">
            <div className="flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Dropbox</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isDropboxConnected
                    ? "Stored in the Prompt folder in your Dropbox"
                    : "Store documents in your Dropbox App folder"}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isDropboxConnected ? (
                  <>
                    <div className="px-2.5 py-1 rounded-md inline-flex items-center bg-green-500/10">
                      <span className="text-xs font-medium text-green-600">Connected</span>
                    </div>
                    {storageBackendStatus === "reauth_required" && (
                      <div className="px-2.5 py-1 rounded-md inline-flex items-center bg-red-500/10">
                        <span className="text-xs font-medium text-red-500">Re-auth required</span>
                      </div>
                    )}
                    {storageBackendStatus === "error" && (
                      <div className="px-2.5 py-1 rounded-md inline-flex items-center bg-amber-500/10">
                        <span className="text-xs font-medium text-amber-600">Connection error</span>
                      </div>
                    )}
                    {storageBackendStatus === "reauth_required" && (
                      <ButtonBase
                        variant="violet"
                        buttonType="icon-text"
                        onClick={() => (window.location.href = "/api/auth/dropbox/connect")}
                      >
                        <HardDrive className="size-4" />
                        Reconnect
                      </ButtonBase>
                    )}
                    <ButtonBase
                      variant="destructive"
                      buttonType="icon-text"
                      onClick={async () => {
                        setDropboxDocCount(null);
                        setDropboxModalOpen(true);
                        const count = await getDocumentCountByBackend("dropbox");
                        setDropboxDocCount(count);
                      }}
                      disabled={isDropboxPending}
                    >
                      <XCircle className="size-4" />
                      Disconnect
                    </ButtonBase>
                    {dropboxDisconnectError && (
                      <span className="text-sm font-medium text-status-danger">{dropboxDisconnectError}</span>
                    )}
                  </>
                ) : (
                  <ButtonBase
                    variant="violet"
                    buttonType="icon-text"
                    onClick={() => (window.location.href = "/api/auth/dropbox/connect")}
                  >
                    <HardDrive className="size-4" />
                    Connect
                  </ButtonBase>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <DisconnectConfirmModal
        isOpen={googleModalOpen}
        onClose={() => setGoogleModalOpen(false)}
        providerName="Google Drive"
        documentCount={googleDocCount}
        isLoading={isGooglePending}
        onConfirm={handleGoogleDisconnect}
      />
      <DisconnectConfirmModal
        isOpen={oneDriveModalOpen}
        onClose={() => setOneDriveModalOpen(false)}
        providerName="Microsoft OneDrive"
        documentCount={oneDriveDocCount}
        isLoading={isOneDrivePending}
        onConfirm={handleOneDriveDisconnect}
      />
      <DisconnectConfirmModal
        isOpen={dropboxModalOpen}
        onClose={() => setDropboxModalOpen(false)}
        providerName="Dropbox"
        documentCount={dropboxDocCount}
        isLoading={isDropboxPending}
        onConfirm={handleDropboxDisconnect}
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
