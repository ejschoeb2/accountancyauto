"use client";

import { useState, useEffect, useTransition } from "react";
import {
  CheckCircle,
  HardDrive,
  AlertTriangle,
  FolderOpen,
  ExternalLink,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Info,
} from "lucide-react";
import { ButtonBase } from "@/components/ui/button-base";
import { Input } from "@/components/ui/input";
import {
  getStorageInfo,
  updateGoogleDriveFolderId,
  type StorageInfo,
} from "@/app/actions/settings";

interface StorageSetupStepProps {
  storageConnected?: string | null;
  storageError?: string | null;
  onComplete: () => void;
  onBack: () => void;
  onBeforeProviderConnect: () => void;
}

export function StorageSetupStep({
  storageConnected,
  storageError,
  onComplete,
  onBack,
  onBeforeProviderConnect,
}: StorageSetupStepProps) {
  const [info, setInfo] = useState<StorageInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [folderInput, setFolderInput] = useState("");
  const [isFolderPending, startFolderTransition] = useTransition();
  const [folderError, setFolderError] = useState<string | null>(null);
  const [folderSaved, setFolderSaved] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    getStorageInfo().then((data) => {
      setInfo(data);
      setIsLoading(false);
    });
  }, [storageConnected]);

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
        const updated = await getStorageInfo();
        setInfo(updated);
      }
    });
  }

  function connectProvider(url: string) {
    onBeforeProviderConnect();
    window.location.href = url;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[520px]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isGoogleConnected = info?.storageBackend === "google_drive";
  const isOneDriveConnected = info?.storageBackend === "onedrive";
  const isDropboxConnected = info?.dropboxConnected ?? false;
  const isSupabaseActive = !info?.storageBackend || info.storageBackend === "supabase";
  const anyProviderConnected = isGoogleConnected || isOneDriveConnected || isDropboxConnected;

  return (
    <div className="max-w-2xl mx-auto space-y-4 min-h-[520px]">
      <div className="rounded-2xl border bg-card shadow-sm p-8 space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Document Storage</h2>
          <p className="text-sm text-muted-foreground">
            Connect Google Drive, OneDrive, or Dropbox and uploaded documents go straight into your
            own account. Prompt acts as a bridge only —{" "}
            <strong className="font-medium text-foreground">
              no client files are stored on Prompt&apos;s servers
            </strong>
            . Files are organised automatically (e.g.{" "}
            <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
              Prompt / Smith Ltd / Corp Tax / 2024 /
            </span>
            ) with no manual filing needed.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            This step is optional — if you skip it, documents are held in Prompt&apos;s encrypted
            built-in storage until you connect a provider in Settings.
          </p>
        </div>

        {/* Banners */}
        {storageError === "conditional_access_blocked" && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10">
            <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-600">
              Your IT admin has blocked this app with a Conditional Access policy. Ask your IT admin
              to grant consent in Azure Active Directory.
            </p>
          </div>
        )}
        {storageError && storageError !== "conditional_access_blocked" && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10">
            <AlertTriangle className="size-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-500">Connection failed. Please try again.</p>
          </div>
        )}
        {storageConnected === "google_drive" && (
          <div className="flex items-center gap-3 p-3 bg-green-500/10 rounded-xl">
            <CheckCircle className="size-5 text-green-600 shrink-0" />
            <p className="text-sm text-green-600">Google Drive connected successfully.</p>
          </div>
        )}
        {storageConnected === "onedrive" && (
          <div className="flex items-center gap-3 p-3 bg-green-500/10 rounded-xl">
            <CheckCircle className="size-5 text-green-600 shrink-0" />
            <p className="text-sm text-green-600">OneDrive connected successfully.</p>
          </div>
        )}
        {storageConnected === "dropbox" && (
          <div className="flex items-center gap-3 p-3 bg-green-500/10 rounded-xl">
            <CheckCircle className="size-5 text-green-600 shrink-0" />
            <p className="text-sm text-green-600">Dropbox connected successfully.</p>
          </div>
        )}

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
                    ? "Documents are stored in Prompt's built-in encrypted database, hosted in the EU and fully GDPR compliant. No external account needed."
                    : "Prompt's built-in encrypted EU-hosted storage — used if you disconnect your provider later."}
                </p>
              </div>
              <ButtonBase variant="blue" buttonType="icon-text" disabled>
                <HardDrive className="size-4" />
                {isSupabaseActive ? "Active" : "Connect"}
              </ButtonBase>
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
              <div className="shrink-0">
                {isGoogleConnected ? (
                  <div className="px-3 py-2 rounded-md inline-flex items-center bg-green-500/10">
                    <span className="text-sm font-medium text-green-600">Connected</span>
                  </div>
                ) : (
                  <ButtonBase
                    variant="violet"
                    buttonType="icon-text"
                    disabled={anyProviderConnected}
                    onClick={() => connectProvider("/api/auth/google-drive/connect?from=wizard")}
                  >
                    <HardDrive className="size-4" />
                    Connect
                  </ButtonBase>
                )}
              </div>
            </div>
            {isGoogleConnected && (
              <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
                <div className="flex items-center gap-1.5">
                  <FolderOpen className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs font-medium">Root folder</span>
                  {info?.googleDriveFolderId && (
                    <a
                      href={`https://drive.google.com/drive/folders/${info.googleDriveFolderId}`}
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
                  Client files are stored inside this folder. Paste a Google Drive folder URL or ID
                  to change it.
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
                {folderError && <p className="text-xs text-destructive">{folderError}</p>}
                {folderSaved && <p className="text-xs text-green-600">Root folder updated.</p>}
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
              <div className="shrink-0">
                {isOneDriveConnected ? (
                  <div className="px-3 py-2 rounded-md inline-flex items-center bg-green-500/10">
                    <span className="text-sm font-medium text-green-600">Connected</span>
                  </div>
                ) : (
                  <ButtonBase
                    variant="violet"
                    buttonType="icon-text"
                    disabled={anyProviderConnected}
                    onClick={() => connectProvider("/api/auth/onedrive/connect?from=wizard")}
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
              <div className="shrink-0">
                {isDropboxConnected ? (
                  <div className="px-3 py-2 rounded-md inline-flex items-center bg-green-500/10">
                    <span className="text-sm font-medium text-green-600">Connected</span>
                  </div>
                ) : (
                  <ButtonBase
                    variant="violet"
                    buttonType="icon-text"
                    disabled={anyProviderConnected}
                    onClick={() => connectProvider("/api/auth/dropbox/connect?from=wizard")}
                  >
                    <HardDrive className="size-4" />
                    Connect
                  </ButtonBase>
                )}
              </div>
            </div>
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
                  in your Dropbox. The location is fixed — no configuration needed.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <ButtonBase variant="amber" buttonType="icon-text" onClick={onBack}>
          <ArrowLeft className="size-4" />
          Back
        </ButtonBase>
        <ButtonBase variant="green" buttonType="icon-text" onClick={onComplete}>
          Continue
          <ArrowRight className="size-4" />
        </ButtonBase>
      </div>
    </div>
  );
}
