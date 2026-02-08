"use client";

import { useState, useRef, useCallback } from "react";
import { format, parseISO } from "date-fns";
import { enGB } from "date-fns/locale";
import { Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface EditableCellProps {
  value: unknown;
  onSave: (value: unknown) => Promise<void>;
  type: "text" | "date" | "select" | "boolean";
  options?: { value: string; label: string }[];
  disabled?: boolean;
}

export function EditableCell({
  value,
  onSave,
  type,
  options = [],
  disabled = false,
}: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<unknown>(value);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Format date for display (UK format: DD MMM YYYY)
  const formatDateDisplay = (dateValue: unknown): string => {
    if (!dateValue || typeof dateValue !== "string") return "—";
    try {
      return format(parseISO(dateValue), "d MMM yyyy", { locale: enGB });
    } catch {
      return String(dateValue);
    }
  };

  // Format date for input (YYYY-MM-DD)
  const formatDateInput = (dateValue: unknown): string => {
    if (!dateValue || typeof dateValue !== "string") return "";
    try {
      return dateValue; // Already in ISO format (YYYY-MM-DD)
    } catch {
      return "";
    }
  };

  // Start editing
  const handleStartEdit = useCallback(() => {
    if (disabled) return;
    setIsEditing(true);
    setEditValue(value);
  }, [disabled, value]);

  // Save the value
  const handleSave = useCallback(async () => {
    if (editValue === value) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(editValue);
      setIsEditing(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save";
      toast.error(message);
      setEditValue(value); // Revert on error
    } finally {
      setIsSaving(false);
    }
  }, [editValue, value, onSave]);

  // Cancel editing
  const handleCancel = useCallback(() => {
    setEditValue(value);
    setIsEditing(false);
  }, [value]);

  // Handle key press
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSave();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      }
    },
    [handleSave, handleCancel]
  );

  // Handle blur for text/date inputs
  const handleBlur = useCallback(() => {
    // Small delay to allow click events on selects to fire first
    setTimeout(() => {
      handleSave();
    }, 150);
  }, [handleSave]);

  // Display mode
  if (!isEditing) {
    const displayValue = (() => {
      if (value === null || value === undefined || value === "") {
        return <span className="text-muted-foreground">—</span>;
      }

      switch (type) {
        case "date":
          return formatDateDisplay(value);
        case "boolean":
          return value ? (
            <div className="size-8 rounded-lg bg-status-success/10 flex items-center justify-center">
              <Check className="size-5 text-status-success" />
            </div>
          ) : (
            <div className="size-8 rounded-lg bg-status-neutral/10 flex items-center justify-center">
              <X className="size-5 text-status-neutral" />
            </div>
          );
        case "select":
          const option = options.find((opt) => opt.value === value);
          return option?.label || String(value);
        default:
          return String(value);
      }
    })();

    return (
      <div
        onClick={(e) => {
          e.stopPropagation();
          handleStartEdit();
        }}
        className={cn(
          "cursor-pointer rounded px-2 py-1 -mx-2 -my-1 transition-colors font-semibold",
          !disabled && "hover:bg-muted/50",
          disabled && "cursor-default"
        )}
      >
        {displayValue}
      </div>
    );
  }

  // Edit mode
  return (
    <div className="relative flex items-center">
      {isSaving && (
        <div className="absolute -right-6 z-10">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {type === "text" && (
        <Input
          ref={inputRef}
          type="text"
          value={String(editValue || "")}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          disabled={isSaving}
          className="h-8 min-w-[120px]"
          autoFocus
        />
      )}

      {type === "date" && (
        <Input
          ref={inputRef}
          type="date"
          value={formatDateInput(editValue)}
          onChange={(e) => setEditValue(e.target.value || null)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          disabled={isSaving}
          className="h-8 min-w-[140px]"
          autoFocus
        />
      )}

      {type === "select" && (
        <Select
          value={String(editValue || "")}
          onValueChange={(newValue) => {
            setEditValue(newValue);
            // Auto-save for select (after small delay to show selection)
            setTimeout(() => {
              onSave(newValue).catch((error) => {
                const message = error instanceof Error ? error.message : "Failed to save";
                toast.error(message);
                setEditValue(value);
              });
              setIsEditing(false);
            }, 100);
          }}
          disabled={isSaving}
        >
          <SelectTrigger className="h-8 min-w-[140px]" autoFocus>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {type === "boolean" && (
        <div className="flex items-center gap-2">
          <Checkbox
            checked={Boolean(editValue)}
            onCheckedChange={(checked) => {
              const newValue = checked === true;
              setEditValue(newValue);
              // Auto-save for checkbox
              setTimeout(() => {
                onSave(newValue).catch((error) => {
                  const message = error instanceof Error ? error.message : "Failed to save";
                  toast.error(message);
                  setEditValue(value);
                });
                setIsEditing(false);
              }, 100);
            }}
            disabled={isSaving}
          />
          <span className="text-sm text-muted-foreground">
            {editValue ? "Yes" : "No"}
          </span>
        </div>
      )}
    </div>
  );
}
