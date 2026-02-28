"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ButtonBase } from "@/components/ui/button-base";
import { Loader2 } from "lucide-react";

interface DisconnectConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  providerName: string;          // e.g. "Google Drive", "Microsoft OneDrive", "Dropbox"
  documentCount: number | null;  // null = still loading
  isLoading: boolean;            // true while disconnect action is running
  onConfirm: () => void;
}

export function DisconnectConfirmModal({
  isOpen,
  onClose,
  providerName,
  documentCount,
  isLoading,
  onConfirm,
}: DisconnectConfirmModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Disconnect {providerName}?</DialogTitle>
          <DialogDescription>
            {documentCount === null ? (
              "Loading document count..."
            ) : documentCount === 0 ? (
              `You have no documents stored in ${providerName}. Disconnecting will switch your storage back to Prompt's built-in secure storage.`
            ) : (
              `You have ${documentCount} document${documentCount === 1 ? '' : 's'} stored in ${providerName}. These documents will remain in ${providerName} after disconnecting — they will not be deleted, but you will lose access to them through Prompt until you reconnect.`
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <ButtonBase
            variant="ghost"
            buttonType="text-only"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </ButtonBase>
          <ButtonBase
            variant="destructive"
            buttonType="icon-text"
            onClick={onConfirm}
            disabled={isLoading || documentCount === null}
          >
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            {isLoading ? "Disconnecting..." : "Disconnect"}
          </ButtonBase>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
