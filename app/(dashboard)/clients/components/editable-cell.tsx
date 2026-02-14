"use client";

import { useState, useRef, useCallback, useEffect } from "react";
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
import { CheckButton } from "@/components/ui/check-button";
import { Badge } from "@/components/ui/badge";
import { ButtonBase } from "@/components/ui/button-base";
import { cn } from "@/lib/utils";

interface EditableCellProps {
  value: unknown;
  onSave: (value: unknown) => Promise<void>;
  type: "text" | "date" | "select" | "boolean";
  options?: { value: string; label: string }[];
  disabled?: boolean;
  isEditMode?: boolean;
}

export function EditableCell({
  value,
  onSave,
  type,
  options = [],
  disabled = false,
  isEditMode = false,
}: EditableCellProps) {
  const [editValue, setEditValue] = useState<unknown>(value);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync editValue with value when entering/exiting edit mode
  useEffect(() => {
    setEditValue(value);
  }, [value, isEditMode]);

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

  // Save the value
  const handleSave = useCallback(async () => {
    if (editValue === value) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave(editValue);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save";
      toast.error(message);
      setEditValue(value); // Revert on error
    } finally {
      setIsSaving(false);
    }
  }, [editValue, value, onSave]);


  // Display mode (when not in edit mode)
  if (!isEditMode) {
    const displayValue = (() => {
      if (value === null || value === undefined || value === "") {
        return <span className="text-muted-foreground">—</span>;
      }

      switch (type) {
        case "date":
          return formatDateDisplay(value);
        case "boolean":
          return value ? (
            <div className="px-3 py-2 rounded-md bg-green-500/10 inline-flex items-center gap-2">
              <span className="text-green-600">
                <Check className="h-4 w-4" />
              </span>
              <span className="text-sm font-medium text-green-600">
                Yes
              </span>
            </div>
          ) : (
            <div className="px-3 py-2 rounded-md bg-status-danger/10 inline-flex items-center gap-2">
              <span className="text-status-danger">
                <X className="h-4 w-4" />
              </span>
              <span className="text-sm font-medium text-status-danger">
                No
              </span>
            </div>
          );
        case "select":
          const option = options.find((opt) => opt.value === value);
          return option?.label || String(value);
        default:
          return String(value);
      }
    })();

    return <div>{displayValue}</div>;
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
          onChange={(e) => {
            setEditValue(e.target.value);
          }}
          onBlur={() => handleSave()}
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
          onBlur={() => handleSave()}
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
        Boolean(editValue) ? (
          <button
            type="button"
            onClick={() => {
              setEditValue(false);
              setTimeout(() => {
                onSave(false).catch((error) => {
                  const message = error instanceof Error ? error.message : "Failed to save";
                  toast.error(message);
                  setEditValue(value);
                });
              }, 100);
            }}
            disabled={isSaving}
            className="px-3 py-2 rounded-md bg-green-500/10 hover:bg-green-500/20 inline-flex items-center gap-2 transition-colors"
          >
            <span className="text-green-600 hover:text-green-700">
              <Check className="h-4 w-4" />
            </span>
            <span className="text-sm font-medium text-green-600 hover:text-green-700">
              Yes
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setEditValue(true);
              setTimeout(() => {
                onSave(true).catch((error) => {
                  const message = error instanceof Error ? error.message : "Failed to save";
                  toast.error(message);
                  setEditValue(value);
                });
              }, 100);
            }}
            disabled={isSaving}
            className="px-3 py-2 rounded-md bg-status-danger/10 hover:bg-status-danger/20 inline-flex items-center gap-2 transition-colors"
          >
            <span className="text-status-danger">
              <X className="h-4 w-4" />
            </span>
            <span className="text-sm font-medium text-status-danger">
              No
            </span>
          </button>
        )
      )}
    </div>
  );
}
