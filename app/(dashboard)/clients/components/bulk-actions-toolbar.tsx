"use client";

import { X, Mail, Trash2 } from "lucide-react";
import { ButtonBase } from "@/components/ui/button-base";
import { cn } from "@/lib/utils";

interface BulkActionsToolbarProps {
  selectedCount: number;
  onSendEmail: () => void;
  onDeleteClients: () => void;
  onClearSelection: () => void;
}

export function BulkActionsToolbar({
  selectedCount,
  onSendEmail,
  onDeleteClients,
  onClearSelection,
}: BulkActionsToolbarProps) {
  const isVisible = selectedCount > 0;

  return (
    <div
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ease-in-out",
        isVisible
          ? "translate-y-0 opacity-100"
          : "translate-y-20 opacity-0 pointer-events-none"
      )}
    >
      <div className="bg-background border shadow-lg rounded-lg px-4 py-3 flex items-center gap-4">
        <span className="text-sm font-medium whitespace-nowrap">
          {selectedCount} client{selectedCount !== 1 ? "s" : ""} selected
        </span>

        <div className="flex items-center gap-2">
          <ButtonBase
            variant="green"
            buttonType="icon-text"
            onClick={onSendEmail}
          >
            <Mail className="size-4" />
            Send Bulk Email
          </ButtonBase>

          <ButtonBase
            variant="destructive"
            buttonType="icon-text"
            onClick={onDeleteClients}
          >
            <Trash2 className="size-4" />
            Delete Clients
          </ButtonBase>

          <ButtonBase
            variant="destructive"
            buttonType="icon-text"
            onClick={onClearSelection}
          >
            <X className="size-4" />
            Clear
          </ButtonBase>
        </div>
      </div>
    </div>
  );
}
