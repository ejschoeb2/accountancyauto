"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Loader2, Trash2, X as XIcon, CircleMinus } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IconButtonWithText } from "@/components/ui/icon-button-with-text";
import { CheckButton } from "@/components/ui/check-button";
import { UpgradeModal } from "@/components/upgrade-modal";
import { SendEmailModal } from "./send-email-modal";
import type { Client } from "@/app/actions/clients";
import { deleteClients } from "@/app/actions/clients";
import type { PlanTier } from "@/lib/stripe/plans";

// Lazy load dialogs to avoid hydration issues
const CsvImportDialog = dynamic(
  () => import("./csv-import-dialog").then((m) => ({ default: m.CsvImportDialog })),
  { ssr: false }
);
const CreateClientDialog = dynamic(
  () => import("./create-client-dialog").then((m) => ({ default: m.CreateClientDialog })),
  { ssr: false }
);

// ---------- Tier helpers ----------
function getNextTierInfo(currentLimit: number): {
  tier: PlanTier;
  name: string;
  price: string;
  limitLabel: string;
} | null {
  if (currentLimit <= 10) return { tier: "solo", name: "Solo", price: "\u00a319", limitLabel: "40 clients" };
  if (currentLimit <= 40) return { tier: "starter", name: "Starter", price: "\u00a339", limitLabel: "80 clients" };
  if (currentLimit <= 80) return { tier: "practice", name: "Practice", price: "\u00a369", limitLabel: "200 clients" };
  if (currentLimit <= 200) return { tier: "firm", name: "Firm", price: "\u00a3109", limitLabel: "400 clients" };
  return null;
}

function getCurrentTierName(currentLimit: number): string {
  if (currentLimit <= 10) return "Free";
  if (currentLimit <= 40) return "Solo";
  if (currentLimit <= 80) return "Starter";
  if (currentLimit <= 200) return "Practice";
  if (currentLimit <= 400) return "Firm";
  return "Enterprise";
}

// ---------- Modal state hook ----------
export function useClientTableModals(
  setData: React.Dispatch<React.SetStateAction<Client[]>>,
  setRowSelection: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
  selectedClients: Client[],
) {
  const router = useRouter();
  const [isSendEmailModalOpen, setIsSendEmailModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isCsvDialogOpen, setIsCsvDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [upgradeLimitData, setUpgradeLimitData] = useState<{
    currentCount: number;
    limit: number;
  } | null>(null);
  const [deactivateConfirm, setDeactivateConfirm] = useState<{ clientId: string; filingTypeId: string } | null>(null);
  const [deactivateDontShowAgain, setDeactivateDontShowAgain] = useState(false);

  const handleClientCreated = (newClient: Client) => {
    setData((prev) => [...prev, newClient]);
    router.refresh();
  };

  const handleLimitReached = (data: { currentCount: number; limit: number }) => {
    setUpgradeLimitData(data);
    setIsUpgradeModalOpen(true);
  };

  const handleDeleteClients = async () => {
    setIsDeleting(true);
    try {
      const selectedClientIds = selectedClients.map((c) => c.id);
      await deleteClients(selectedClientIds);

      // Remove deleted clients from local state
      setData((prev) => prev.filter((c) => !selectedClientIds.includes(c.id)));
      setRowSelection({});
      setIsDeleteDialogOpen(false);

      toast.success(
        `Successfully deleted ${selectedClientIds.length} client${selectedClientIds.length !== 1 ? "s" : ""}`
      );
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete clients");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpgradeClick = async () => {
    if (!upgradeLimitData) return;
    const nextTier = getNextTierInfo(upgradeLimitData.limit);
    if (!nextTier) return;

    const response = await fetch("/api/stripe/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: nextTier.tier }),
    });

    if (response.ok) {
      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      }
    }
  };

  return {
    isSendEmailModalOpen,
    setIsSendEmailModalOpen,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    isCsvDialogOpen,
    setIsCsvDialogOpen,
    isCreateDialogOpen,
    setIsCreateDialogOpen,
    isDeleting,
    isUpgradeModalOpen,
    setIsUpgradeModalOpen,
    upgradeLimitData,
    deactivateConfirm,
    setDeactivateConfirm,
    deactivateDontShowAgain,
    setDeactivateDontShowAgain,
    handleClientCreated,
    handleLimitReached,
    handleDeleteClients,
    handleUpgradeClick,
  };
}

// ---------- Rendered modal components ----------
interface ClientTableModalsProps {
  isSendEmailModalOpen: boolean;
  setIsSendEmailModalOpen: (open: boolean) => void;
  selectedClients: Client[];
  isDeleteDialogOpen: boolean;
  setIsDeleteDialogOpen: (open: boolean) => void;
  isDeleting: boolean;
  handleDeleteClients: () => void;
  deactivateConfirm: { clientId: string; filingTypeId: string } | null;
  setDeactivateConfirm: (value: { clientId: string; filingTypeId: string } | null) => void;
  deactivateDontShowAgain: boolean;
  setDeactivateDontShowAgain: (value: boolean) => void;
  handleFilingAssignmentToggle: (clientId: string, filingTypeId: string, isActive: boolean) => void;
  isCsvDialogOpen: boolean;
  setIsCsvDialogOpen: (open: boolean) => void;
  isCreateDialogOpen: boolean;
  setIsCreateDialogOpen: (open: boolean) => void;
  handleClientCreated: (client: Client) => void;
  handleLimitReached: (data: { currentCount: number; limit: number }) => void;
  isUpgradeModalOpen: boolean;
  setIsUpgradeModalOpen: (open: boolean) => void;
  upgradeLimitData: { currentCount: number; limit: number } | null;
  handleUpgradeClick: () => void;
}

export function ClientTableModals({
  isSendEmailModalOpen,
  setIsSendEmailModalOpen,
  selectedClients,
  isDeleteDialogOpen,
  setIsDeleteDialogOpen,
  isDeleting,
  handleDeleteClients,
  deactivateConfirm,
  setDeactivateConfirm,
  deactivateDontShowAgain,
  setDeactivateDontShowAgain,
  handleFilingAssignmentToggle,
  isCsvDialogOpen,
  setIsCsvDialogOpen,
  isCreateDialogOpen,
  setIsCreateDialogOpen,
  handleClientCreated,
  handleLimitReached,
  isUpgradeModalOpen,
  setIsUpgradeModalOpen,
  upgradeLimitData,
  handleUpgradeClick,
}: ClientTableModalsProps) {
  return (
    <>
      {/* Send Email Modal */}
      <SendEmailModal
        open={isSendEmailModalOpen}
        onClose={() => setIsSendEmailModalOpen(false)}
        selectedClients={selectedClients}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={() => {}}>
        <DialogContent className="[&>button]:hidden">
          <DialogHeader>
            <DialogTitle>Delete Clients</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedClients.length} client
              {selectedClients.length !== 1 ? "s" : ""}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <IconButtonWithText
              variant="blue"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              <XIcon className="h-5 w-5" />
              Cancel
            </IconButtonWithText>
            <IconButtonWithText
              variant="destructive"
              onClick={handleDeleteClients}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-5 w-5" />
                  Delete
                </>
              )}
            </IconButtonWithText>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Filing Confirmation Dialog */}
      <Dialog
        open={!!deactivateConfirm}
        onOpenChange={(open) => {
          if (!open) {
            setDeactivateConfirm(null);
            setDeactivateDontShowAgain(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-[460px]" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Deactivate Deadline</DialogTitle>
            <DialogDescription>
              This will deactivate the deadline for this client. Any scheduled reminder emails for
              this deadline will be removed from the queue. Documents and deadline overrides will be
              preserved.
            </DialogDescription>
          </DialogHeader>
          <label className="flex items-center gap-2 cursor-pointer py-2">
            <CheckButton
              checked={deactivateDontShowAgain}
              onCheckedChange={(checked) => setDeactivateDontShowAgain(!!checked)}
            />
            <span className="text-sm text-muted-foreground">Don&apos;t show this again</span>
          </label>
          <DialogFooter>
            <IconButtonWithText
              variant="violet"
              onClick={() => {
                setDeactivateConfirm(null);
                setDeactivateDontShowAgain(false);
              }}
            >
              <XIcon className="h-5 w-5" />
              Cancel
            </IconButtonWithText>
            <IconButtonWithText
              variant="destructive"
              onClick={() => {
                if (deactivateConfirm) {
                  if (deactivateDontShowAgain) {
                    localStorage.setItem("skip-deactivate-filing-confirm", "true");
                  }
                  handleFilingAssignmentToggle(
                    deactivateConfirm.clientId,
                    deactivateConfirm.filingTypeId,
                    false
                  );
                  setDeactivateConfirm(null);
                  setDeactivateDontShowAgain(false);
                }
              }}
            >
              <CircleMinus className="h-5 w-5" />
              Deactivate
            </IconButtonWithText>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import Dialog */}
      <CsvImportDialog open={isCsvDialogOpen} onOpenChange={setIsCsvDialogOpen} />

      {/* Create Client Dialog */}
      <CreateClientDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreated={handleClientCreated}
        onLimitReached={handleLimitReached}
      />

      {/* Upgrade Modal */}
      {upgradeLimitData &&
        (() => {
          const nextTier = getNextTierInfo(upgradeLimitData.limit);
          if (!nextTier) return null;
          return (
            <UpgradeModal
              open={isUpgradeModalOpen}
              onOpenChange={setIsUpgradeModalOpen}
              currentCount={upgradeLimitData.currentCount}
              currentLimit={upgradeLimitData.limit}
              currentTierName={getCurrentTierName(upgradeLimitData.limit)}
              nextTierName={nextTier.name}
              nextTierPrice={nextTier.price}
              nextTierLimit={nextTier.limitLabel}
              onUpgrade={handleUpgradeClick}
            />
          );
        })()}
    </>
  );
}
