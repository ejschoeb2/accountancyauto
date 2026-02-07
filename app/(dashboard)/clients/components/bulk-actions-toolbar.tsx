"use client";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

interface BulkActionsToolbarProps {
  selectedCount: number;
  onBulkEdit: () => void;
  onClearSelection: () => void;
}

export function BulkActionsToolbar({
  selectedCount,
  onBulkEdit,
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
            className="gap-2"
          >
            <Icon name="edit" size="sm" />
            Bulk Edit
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={onClearSelection}
            className="gap-2"
          >
            <Icon name="close" size="sm" />
            Clear
          </Button>
        </div>
      </div>
    </div>
  );
}
