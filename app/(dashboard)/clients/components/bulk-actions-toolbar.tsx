"use client";

import { Pencil, X, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BulkActionsToolbarProps {
  selectedCount: number;
  onBulkEdit: () => void;
  onSendEmail: () => void;
  onClearSelection: () => void;
}

export function BulkActionsToolbar({
  selectedCount,
  onBulkEdit,
  onSendEmail,
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
          <Button
            size="sm"
            onClick={onBulkEdit}
            className="gap-2 active:scale-[0.97]"
          >
            <Pencil className="size-4" />
            Bulk Edit
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onSendEmail}
            className="gap-2 active:scale-[0.97]"
          >
            <Mail className="size-4" />
            Send Email
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onClearSelection}
            className="gap-2"
          >
            <X className="size-4" />
            Clear
          </Button>
        </div>
      </div>
    </div>
  );
}
