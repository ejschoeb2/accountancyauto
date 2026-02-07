"use client";

import { useState, useCallback } from "react";
import { format, parseISO } from "date-fns";
import { enGB } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { Client, BulkUpdateFields } from "@/app/actions/clients";

interface BulkEditModalProps {
  open: boolean;
  onClose: () => void;
  selectedClients: Client[];
  onSave: (updates: BulkUpdateFields) => Promise<void>;
}

interface FieldState {
  enabled: boolean;
  value: unknown;
}

export function BulkEditModal({
  open,
  onClose,
  selectedClients,
  onSave,
}: BulkEditModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Field states
  const [yearEndDate, setYearEndDate] = useState<FieldState>({
    enabled: false,
    value: null,
  });
  const [vatRegistered, setVatRegistered] = useState<FieldState>({
    enabled: false,
    value: false,
  });
  const [vatQuarter, setVatQuarter] = useState<FieldState>({
    enabled: false,
    value: null,
  });

  const handleClose = useCallback(() => {
    if (isSaving) return;
    setShowConfirmation(false);
    // Reset fields
    setYearEndDate({ enabled: false, value: null });
    setVatRegistered({ enabled: false, value: false });
    setVatQuarter({ enabled: false, value: null });
    onClose();
  }, [isSaving, onClose]);

  const handleSubmit = useCallback(async () => {
    const updates: BulkUpdateFields = {};

    if (yearEndDate.enabled) {
      updates.year_end_date = yearEndDate.value as string | null;
    }
    if (vatRegistered.enabled) {
      updates.vat_registered = vatRegistered.value as boolean;
    }
    if (vatQuarter.enabled) {
      updates.vat_quarter = vatQuarter.value as
        | "Jan-Mar"
        | "Apr-Jun"
        | "Jul-Sep"
        | "Oct-Dec"
        | null;
    }

    // Show confirmation if not already shown
    if (!showConfirmation && Object.keys(updates).length > 0) {
      setShowConfirmation(true);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(updates);
      handleClose();
    } catch {
      // Error is handled by parent (shows toast)
    } finally {
      setIsSaving(false);
    }
  }, [yearEndDate, vatRegistered, vatQuarter, showConfirmation, onSave, handleClose]);

  // Build preview text for confirmation
  const getPreviewText = useCallback(() => {
    const changes: string[] = [];

    if (yearEndDate.enabled && yearEndDate.value) {
      const formatted = format(
        parseISO(yearEndDate.value as string),
        "d MMM yyyy",
        { locale: enGB }
      );
      changes.push(`Year End Date → ${formatted}`);
    }
    if (vatRegistered.enabled) {
      changes.push(`VAT Registered → ${vatRegistered.value ? "Yes" : "No"}`);
    }
    if (vatQuarter.enabled && vatQuarter.value) {
      changes.push(`VAT Quarter → ${vatQuarter.value}`);
    }

    return changes;
  }, [yearEndDate, vatRegistered, vatQuarter]);

  const previewChanges = getPreviewText();
  const hasChanges =
    (yearEndDate.enabled && yearEndDate.value) ||
    vatRegistered.enabled ||
    (vatQuarter.enabled && vatQuarter.value);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Bulk Edit {selectedClients.length} Client
            {selectedClients.length !== 1 ? "s" : ""}
          </DialogTitle>
          <DialogDescription>
            Select which fields to update. Only checked fields will be applied.
          </DialogDescription>
        </DialogHeader>

        {!showConfirmation ? (
          <div className="space-y-4 py-4">
            {/* Year End Date */}
            <div className="flex items-start gap-4">
              <Checkbox
                id="year-end-date"
                checked={yearEndDate.enabled}
                onCheckedChange={(checked) =>
                  setYearEndDate((prev) => ({
                    ...prev,
                    enabled: checked === true,
                  }))
                }
              />
              <div className="flex-1 space-y-2">
                <Label htmlFor="year-end-date">Year End Date</Label>
                <Input
                  type="date"
                  disabled={!yearEndDate.enabled}
                  value={(yearEndDate.value as string) || ""}
                  onChange={(e) =>
                    setYearEndDate((prev) => ({
                      ...prev,
                      value: e.target.value || null,
                    }))
                  }
                />
              </div>
            </div>

            {/* VAT Registered */}
            <div className="flex items-start gap-4">
              <Checkbox
                id="vat-registered"
                checked={vatRegistered.enabled}
                onCheckedChange={(checked) =>
                  setVatRegistered((prev) => ({
                    ...prev,
                    enabled: checked === true,
                  }))
                }
              />
              <div className="flex-1 space-y-2">
                <Label htmlFor="vat-registered">VAT Registered</Label>
                <div className="flex items-center gap-2">
                  <Checkbox
                    disabled={!vatRegistered.enabled}
                    checked={vatRegistered.value as boolean}
                    onCheckedChange={(checked) =>
                      setVatRegistered((prev) => ({
                        ...prev,
                        value: checked === true,
                      }))
                    }
                  />
                  <span className="text-sm text-muted-foreground">
                    {vatRegistered.value ? "Yes" : "No"}
                  </span>
                </div>
              </div>
            </div>

            {/* VAT Quarter */}
            <div className="flex items-start gap-4">
              <Checkbox
                id="vat-quarter"
                checked={vatQuarter.enabled}
                onCheckedChange={(checked) =>
                  setVatQuarter((prev) => ({
                    ...prev,
                    enabled: checked === true,
                  }))
                }
              />
              <div className="flex-1 space-y-2">
                <Label htmlFor="vat-quarter">VAT Quarter</Label>
                <Select
                  disabled={!vatQuarter.enabled}
                  value={(vatQuarter.value as string) || ""}
                  onValueChange={(value) =>
                    setVatQuarter((prev) => ({
                      ...prev,
                      value: value || null,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select quarter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Jan-Mar">Jan-Mar</SelectItem>
                    <SelectItem value="Apr-Jun">Apr-Jun</SelectItem>
                    <SelectItem value="Jul-Sep">Jul-Sep</SelectItem>
                    <SelectItem value="Oct-Dec">Oct-Dec</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-4">
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm font-medium mb-2">Confirm bulk update:</p>
              <p className="text-sm text-muted-foreground mb-3">
                This will update <strong>{selectedClients.length}</strong> client
                {selectedClients.length !== 1 ? "s" : ""} with the following
                changes:
              </p>
              <ul className="text-sm space-y-1">
                {previewChanges.map((change, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <span className="text-primary">•</span>
                    {change}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <DialogFooter>
          {showConfirmation ? (
            <>
              <Button
                variant="outline"
                onClick={() => setShowConfirmation(false)}
                disabled={isSaving}
              >
                Back
              </Button>
              <Button onClick={handleSubmit} disabled={isSaving}>
                {isSaving ? "Applying..." : "Apply Changes"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={!hasChanges || isSaving}>
                Continue
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
