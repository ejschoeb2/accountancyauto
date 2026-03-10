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
  Unplug,
  HelpCircle,
  X,
} from "lucide-react";
import { ButtonBase } from "@/components/ui/button-base";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { updateGoogleDriveFolderId } from "@/app/actions/settings";
import { getStorageInfoForWizard, resetStorageForWizard } from "../actions";

type TroubleshootProvider = "google_drive" | "onedrive" | "dropbox" | null;

function TroubleshootModal({
  provider,
  onClose,
}: {
  provider: TroubleshootProvider;
  onClose: () => void;
}) {
  const content: Record<
    Exclude<TroubleshootProvider, null>,
    { title: string; steps: string[]; tips: string[] }
  > = {
    google_drive: {
      title: "Google Drive Troubleshooting",
      steps: [
        "Go to myaccount.google.com and sign in.",
        "Navigate to Security \u2192 Third-party apps & services (or visit myaccount.google.com/connections directly).",
        "Find \u201cPrompt\u201d in the list of connected apps.",
        "Click it, then click Remove access to revoke the connection.",
        "Come back here and click Connect to re-link with a fresh token.",
      ],
      tips: [
        "If you previously connected with a different Google account, make sure you\u2019re signed into the correct account before clicking Connect.",
        "Google may show a \u201cThis app isn\u2019t verified\u201d warning \u2014 click Advanced \u2192 Go to Prompt to proceed.",
        "If the connection keeps failing, try using an incognito/private window to avoid cached sessions.",
      ],
    },
    onedrive: {
      title: "OneDrive Troubleshooting",
      steps: [
        "Go to account.live.com/consent/Manage and sign in with your Microsoft account.",
        "Find \u201cPrompt\u201d in the list of apps with permissions.",
        "Click Remove these permissions to revoke the connection.",
        "Come back here and click Connect to re-link with a fresh token.",
      ],
      tips: [
        "If your organisation uses Microsoft 365, your IT admin may need to grant consent for Prompt in Azure Active Directory.",
        "A \u201cConditional Access\u201d error means your admin has blocked third-party apps \u2014 contact your IT team.",
        "Make sure you\u2019re signed into the correct Microsoft account before clicking Connect.",
      ],
    },
    dropbox: {
      title: "Dropbox Troubleshooting",
      steps: [
        "Go to dropbox.com/account/connected_apps and sign in.",
        "Find \u201cPrompt Automation\u201d in the list of connected apps.",
        "Click Disconnect next to it to revoke the connection.",
        "Come back here and click Connect to re-link with a fresh token.",
      ],
      tips: [
        "Dropbox stores files in a fixed app folder (Apps / Prompt Automation /) \u2014 this cannot be changed.",
        "If you see a \u201cToken has been revoked\u201d error, the app was already disconnected from the Dropbox side \u2014 use the Reset connection button below, then reconnect.",
        "Make sure you\u2019re signed into the correct Dropbox account before clicking Connect.",
      ],
    },
  };

  if (!provider) return null;
  const { title, steps, tips } = content[provider];

  return (
    <Dialog open={!!provider} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-xl" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            If the connection isn&apos;t working, you may need to revoke Prompt&apos;s access from your
            account first, then reconnect.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <p className="text-sm font-medium">How to unlink</p>
            <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground">
              {steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">Common issues</p>
            <ul className="list-disc list-inside space-y-1.5 text-sm text-muted-foreground">
              {tips.map((tip, i) => (
                <li key={i}>{tip}</li>
              ))}
            </ul>
          </div>

          <div className="flex items-start gap-3 p-4 bg-blue-500/10 rounded-xl">
            <Info className="size-5 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-sm text-blue-500">
              You can also manage storage connections later from the{" "}
              <strong className="font-medium">Settings</strong> page, where you can
              disconnect, reconnect, or switch providers at any time.
            </p>
          </div>
        </div>

        <DialogFooter>
          <ButtonBase variant="amber" buttonType="icon-text" onClick={onClose}>
            <X className="size-4" />
            Close
          </ButtonBase>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface StorageSetupStepProps {
  storageConnected?: string | null;
  storageError?: string | null;
  onComplete: () => void;
  onBack: () => void;
  onBeforeProviderConnect: () => Promise<void>;
}

export function StorageSetupStep({
  storageConnected,
  storageError,
  onComplete,
  onBack,
  onBeforeProviderConnect,
}: StorageSetupStepProps) {
  const [info, setInfo] = useState<Awaited<ReturnType<typeof getStorageInfoForWizard>> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [folderInput, setFolderInput] = useState("");
  const [isFolderPending, startFolderTransition] = useTransition();
  const [folderError, setFolderError] = useState<string | null>(null);
  const [folderSaved, setFolderSaved] = useState(false);
  const [isResetting, startResetTransition] = useTransition();
  const [troubleshootProvider, setTroubleshootProvider] = useState<TroubleshootProvider>(null);

  useEffect(() => {
    setIsLoading(true);
    getStorageInfoForWizard().then((data) => {
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
        const updated = await getStorageInfoForWizard();
        setInfo(updated);
      }
    });
  }

  function handleReset() {
    startResetTransition(async () => {
      await resetStorageForWizard();
      const updated = await getStorageInfoForWizard();
      setInfo(updated);
    });
  }

  async function connectProvider(url: string) {
    await onBeforeProviderConnect();
    window.location.href = url;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[520px]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Use token-validated fields from getStorageInfoForWizard
  const isGoogleConnected = info?.googleConnected === true;
  const isOneDriveConnected = info?.onedriveConnected === true;
  const isDropboxConnected = info?.dropboxConnected === true;
  const isSupabaseActive = !isGoogleConnected && !isOneDriveConnected && !isDropboxConnected;
  const anyProviderConnected = isGoogleConnected || isOneDriveConnected || isDropboxConnected;

  // Detect stale connection: storage_backend is set to a provider but tokens are missing
  const hasStaleConnection =
    info?.storageBackend &&
    info.storageBackend !== "supabase" &&
    !anyProviderConnected;

  return (
    <div className="max-w-2xl mx-auto space-y-4 min-h-[520px]">
      <div className="rounded-2xl border bg-card shadow-sm p-8 space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Document Storage</h2>
          <p className="text-sm text-muted-foreground">
            Connect Google Drive, OneDrive, or Dropbox and uploaded documents go straight into your
            own account. Prompt acts as a bridge only &mdash;{" "}
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
            This step is optional &mdash; if you skip it, documents are held in Prompt&apos;s encrypted
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
            <div className="space-y-1">
              <p className="text-sm text-red-500">Connection failed. Please try again.</p>
              <p className="text-xs text-red-400 font-mono">Error: {storageError}</p>
            </div>
          </div>
        )}
        {hasStaleConnection && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10">
            <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <p className="text-sm text-amber-600">
                A previous {info?.storageBackend === "google_drive" ? "Google Drive" : info?.storageBackend === "onedrive" ? "OneDrive" : "Dropbox"} connection
                was found but is no longer valid. Reset it to connect a fresh account.
              </p>
              <ButtonBase
                variant="amber"
                buttonType="icon-text"
                onClick={handleReset}
                disabled={isResetting}
              >
                <Unplug className="size-4" />
                {isResetting ? "Resetting..." : "Reset connection"}
              </ButtonBase>
            </div>
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
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setTroubleshootProvider("google_drive")}
                  className="group size-8 inline-flex items-center justify-center rounded-md cursor-pointer"
                  title="Connection help"
                >
                  <HelpCircle className="size-4 text-muted-foreground transition-colors group-hover:text-foreground" />
                </button>
                {isGoogleConnected ? (
                  <div className="px-3 py-2 rounded-md inline-flex items-center bg-green-500/10">
                    <span className="text-sm font-medium text-green-600">Connected</span>
                  </div>
                ) : (
                  <ButtonBase
                    variant="violet"
                    buttonType="icon-text"
                    disabled={anyProviderConnected || !!hasStaleConnection}
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
                    {isFolderPending ? "Saving\u2026" : "Save"}
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
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setTroubleshootProvider("onedrive")}
                  className="group size-8 inline-flex items-center justify-center rounded-md cursor-pointer"
                  title="Connection help"
                >
                  <HelpCircle className="size-4 text-muted-foreground transition-colors group-hover:text-foreground" />
                </button>
                {isOneDriveConnected ? (
                  <div className="px-3 py-2 rounded-md inline-flex items-center bg-green-500/10">
                    <span className="text-sm font-medium text-green-600">Connected</span>
                  </div>
                ) : (
                  <ButtonBase
                    variant="violet"
                    buttonType="icon-text"
                    disabled={anyProviderConnected || !!hasStaleConnection}
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
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setTroubleshootProvider("dropbox")}
                  className="group size-8 inline-flex items-center justify-center rounded-md cursor-pointer"
                  title="Connection help"
                >
                  <HelpCircle className="size-4 text-muted-foreground transition-colors group-hover:text-foreground" />
                </button>
                {isDropboxConnected ? (
                  <div className="px-3 py-2 rounded-md inline-flex items-center bg-green-500/10">
                    <span className="text-sm font-medium text-green-600">Connected</span>
                  </div>
                ) : (
                  <ButtonBase
                    variant="violet"
                    buttonType="icon-text"
                    disabled={anyProviderConnected || !!hasStaleConnection}
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
                  in your Dropbox. The location is fixed &mdash; no configuration needed.
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

      <TroubleshootModal
        provider={troubleshootProvider}
        onClose={() => setTroubleshootProvider(null)}
      />
    </div>
  );
}
