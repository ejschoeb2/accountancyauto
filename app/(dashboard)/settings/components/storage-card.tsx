"use client";

import { useState, useTransition, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { CheckCircle, XCircle, HardDrive, AlertTriangle, ExternalLink, FolderOpen, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ButtonBase } from "@/components/ui/button-base";
import { Input } from "@/components/ui/input";
import {
  disconnectGoogleDrive,
  disconnectOneDrive,
  disconnectDropbox,
  getDocumentCountByBackend,
  updateGoogleDriveFolderId,
} from "@/app/actions/settings";
import { DisconnectConfirmModal } from "./disconnect-confirm-modal";

interface StorageCardProps {
  storageBackend: string | null;
  googleDriveFolderId: string | null;
  storageBackendStatus: string | null;
  oneDriveConnected: boolean;
  dropboxConnected: boolean;
}

function StorageCardInner({
  storageBackend,
  googleDriveFolderId,
  storageBackendStatus,
  dropboxConnected,
}: StorageCardProps) {
  const router = useRouter();

  const [isGooglePending, startGoogleTransition] = useTransition();
  const [isOneDrivePending, startOneDriveTransition] = useTransition();
  const [isDropboxPending, startDropboxTransition] = useTransition();

  const [folderInput, setFolderInput] = useState("");
  const [isFolderPending, startFolderTransition] = useTransition();
  const [folderError, setFolderError] = useState<string | null>(null);
  const [folderSaved, setFolderSaved] = useState(false);

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
  const isSupabaseActive = !storageBackend || storageBackend === "supabase";
  const anyProviderConnected = isGoogleConnected || isOneDriveConnected || isDropboxConnected;

  function handleFolderSave() {
    setFolderError(null);
    setFolderSaved(false);
    startFolderTransition(async () => {
      const result = await updateGoogleDriveFolderId(folderInput);
      if (result.error) {
        setFolderError(result.error);
      } else {
        setFolderInput("");
        setFolderSaved(true);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Error / success banners */}
      {error === "conditional_access_blocked" && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10">
          <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-600">
            Your IT admin has blocked this app with a Conditional Access policy. Ask your IT admin
            to grant consent for Prompt in Azure Active Directory.
          </p>
        </div>
      )}
      {error === "invalid_state" && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10">
          <AlertTriangle className="size-5 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-500">Connection failed: security state mismatch. Please try again.</p>
        </div>
      )}
      {error === "auth_failed" && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10">
          <AlertTriangle className="size-5 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-500">Connection failed. Please try again.</p>
        </div>
      )}
      {connected === "onedrive" && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-green-500/10">
          <CheckCircle className="size-5 text-green-600 shrink-0 mt-0.5" />
          <p className="text-sm text-green-600">OneDrive connected successfully.</p>
        </div>
      )}
      {connected === "google_drive" && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-green-500/10">
          <CheckCircle className="size-5 text-green-600 shrink-0 mt-0.5" />
          <p className="text-sm text-green-600">Google Drive connected successfully.</p>
        </div>
      )}
      {connected === "dropbox" && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-green-500/10">
          <CheckCircle className="size-5 text-green-600 shrink-0 mt-0.5" />
          <p className="text-sm text-green-600">Dropbox connected successfully.</p>
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
              Connect a cloud storage provider to keep client documents in your own storage. When connected, files are automatically organised into subfolders by client name, filing type, and tax year — for example{" "}
              <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                Prompt / Smith Ltd / Corp Tax / 2024 /
              </span>
              . Only one provider can be active at a time. Documents uploaded before connecting are not migrated.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/10">
          <Info className="size-5 text-blue-600 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-600">
            <strong className="font-medium">Prompt cannot access your other files.</strong> When you
            connect a storage provider, Prompt can only access the folder it creates &mdash; it has
            no visibility into your other documents, folders, or files. Your cloud storage provider
            enforces this restriction at the permission level.
          </p>
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
                <ButtonBase
                  variant="blue"
                  buttonType="icon-text"
                  disabled
                >
                  <HardDrive className="size-4" />
                  {isSupabaseActive ? "Active" : "Connect"}
                </ButtonBase>
              </div>
            </div>
          </div>

          {/* Google Drive */}
          <div className="py-4 first:pt-0 last:pb-0 space-y-3">
            <div className="flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Google Drive</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Store documents in your Google Drive
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isGoogleConnected ? (
                  <>
                    {storageBackendStatus === "reauth_required" && (
                      <div className="px-3 py-2 rounded-md inline-flex items-center bg-red-500/10">
                        <span className="text-sm font-medium text-red-500">Re-auth required</span>
                      </div>
                    )}
                    {storageBackendStatus === "error" && (
                      <div className="px-3 py-2 rounded-md inline-flex items-center bg-amber-500/10">
                        <span className="text-sm font-medium text-amber-600">Connection error</span>
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
                    disabled={anyProviderConnected}
                  >
                    <HardDrive className="size-4" />
                    Connect
                  </ButtonBase>
                )}
              </div>
            </div>

            {/* Root folder config — shown only when Google Drive is connected */}
            {isGoogleConnected && (
              <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
                <div className="flex items-center gap-1.5">
                  <FolderOpen className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs font-medium">Root folder</span>
                  {googleDriveFolderId && (
                    <a
                      href={`https://drive.google.com/drive/folders/${googleDriveFolderId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-1 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      Open in Drive
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Client files are stored inside this folder. Paste a Google Drive folder URL or ID to change it.
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    value={folderInput}
                    onChange={(e) => {
                      setFolderInput(e.target.value);
                      setFolderError(null);
                      setFolderSaved(false);
                    }}
                    placeholder="https://drive.google.com/drive/folders/..."
                    className="h-9 text-xs max-w-sm"
                    disabled={isFolderPending}
                  />
                  <ButtonBase
                    variant="blue"
                    buttonType="icon-text"
                    onClick={handleFolderSave}
                    disabled={isFolderPending || !folderInput.trim()}
                  >
                    <CheckCircle className="size-4" />
                    {isFolderPending ? "Saving…" : "Save"}
                  </ButtonBase>
                </div>
                {folderError && (
                  <p className="text-xs text-destructive">{folderError}</p>
                )}
                {folderSaved && (
                  <p className="text-xs text-green-600">Root folder updated.</p>
                )}
              </div>
            )}
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
                    {storageBackendStatus === "reauth_required" && (
                      <div className="px-3 py-2 rounded-md inline-flex items-center bg-red-500/10">
                        <span className="text-sm font-medium text-red-500">Re-auth required</span>
                      </div>
                    )}
                    {storageBackendStatus === "error" && (
                      <div className="px-3 py-2 rounded-md inline-flex items-center bg-amber-500/10">
                        <span className="text-sm font-medium text-amber-600">Connection error</span>
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
                    disabled={anyProviderConnected}
                  >
                    <HardDrive className="size-4" />
                    Connect
                  </ButtonBase>
                )}
              </div>
            </div>
          </div>

          {/* Dropbox */}
          <div className="py-4 first:pt-0 last:pb-0 space-y-3">
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
                    {storageBackendStatus === "reauth_required" && (
                      <div className="px-3 py-2 rounded-md inline-flex items-center bg-red-500/10">
                        <span className="text-sm font-medium text-red-500">Re-auth required</span>
                      </div>
                    )}
                    {storageBackendStatus === "error" && (
                      <div className="px-3 py-2 rounded-md inline-flex items-center bg-amber-500/10">
                        <span className="text-sm font-medium text-amber-600">Connection error</span>
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
                    disabled={anyProviderConnected}
                  >
                    <HardDrive className="size-4" />
                    Connect
                  </ButtonBase>
                )}
              </div>
            </div>

            {/* App folder info — shown only when Dropbox is connected */}
            {isDropboxConnected && (
              <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-2">
                <div className="flex items-center gap-1.5">
                  <FolderOpen className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs font-medium">App folder</span>
                  <a
                    href="https://www.dropbox.com/home/Apps/Prompt%20Automation"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                  >
                    Open in Dropbox
                    <ExternalLink className="size-3" />
                  </a>
                </div>
                <p className="text-xs text-muted-foreground">
                  Files are stored in{" "}
                  <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                    Apps / Prompt Automation /
                  </span>{" "}
                  in your Dropbox. The location is fixed and managed by Dropbox — no configuration needed.
                </p>
              </div>
            )}
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
