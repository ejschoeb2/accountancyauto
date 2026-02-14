"use client";

import { useState } from "react";
import { X, Save } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { CheckButton } from "@/components/ui/check-button";
import { IconButtonWithText } from "@/components/ui/icon-button-with-text";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Client } from "@/app/actions/clients";
import type { TrafficLightStatus } from "@/lib/dashboard/traffic-light";

interface BulkEditStatusModalProps {
  open: boolean;
  onClose: () => void;
  selectedClients: Client[];
  onComplete: () => void;
}

interface FilingTypeState {
  enabled: boolean;
  status: TrafficLightStatus | null;
}

const FILING_TYPES = [
  { id: 'corporation_tax_payment', label: 'Corp Tax' },
  { id: 'ct600_filing', label: 'CT600' },
  { id: 'companies_house', label: 'Companies House' },
  { id: 'vat_return', label: 'VAT Return' },
  { id: 'self_assessment', label: 'Self Assessment' },
];

const STATUS_OPTIONS = [
  { value: "clear", label: "Clear Override (Auto)" },
  { value: "green", label: "On Track" },
  { value: "red", label: "Overdue" },
];

export function BulkEditStatusModal({
  open,
  onClose,
  selectedClients,
  onComplete,
}: BulkEditStatusModalProps) {
  const [filingStates, setFilingStates] = useState<Record<string, FilingTypeState>>({
    corporation_tax_payment: { enabled: false, status: null },
    ct600_filing: { enabled: false, status: null },
    companies_house: { enabled: false, status: null },
    vat_return: { enabled: false, status: null },
    self_assessment: { enabled: false, status: null },
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleSave = async () => {
    if (!showConfirmation) {
      setShowConfirmation(true);
      return;
    }

    setIsUpdating(true);

    try {
      const clientIds = selectedClients.map((c) => c.id);

      // Process each enabled filing type
      const enabledFilings = FILING_TYPES.filter((ft) => filingStates[ft.id].enabled);

      for (const filing of enabledFilings) {
        const statusValue = filingStates[filing.id].status;

        await fetch('/api/clients/bulk-status-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_ids: clientIds,
            filing_type_id: filing.id,
            override_status: statusValue, // null clears override
          }),
        });
      }

      toast.success(`Updated ${clientIds.length} client(s)`);
      onComplete();
      handleClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClose = () => {
    setFilingStates({
      corporation_tax_payment: { enabled: false, status: null },
      ct600_filing: { enabled: false, status: null },
      companies_house: { enabled: false, status: null },
      vat_return: { enabled: false, status: null },
      self_assessment: { enabled: false, status: null },
    });
    setShowConfirmation(false);
    onClose();
  };

  const getPreviewChanges = () => {
    return FILING_TYPES
      .filter((ft) => filingStates[ft.id].enabled)
      .map((ft) => {
        const status = filingStates[ft.id].status;
        const statusLabel = status === null
          ? "Auto (Calculated)"
          : STATUS_OPTIONS.find((o) => o.value === status)?.label || status;
        return `Set ${ft.label} to: ${statusLabel}`;
      });
  };

  const previewChanges = getPreviewChanges();
  const hasChanges = previewChanges.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Edit Filing Statuses</DialogTitle>
          <DialogDescription>
            Update filing statuses for {selectedClients.length} selected client
            {selectedClients.length !== 1 ? "s" : ""}. Enable a filing type to set its status.
          </DialogDescription>
        </DialogHeader>

        {!showConfirmation ? (
          <div className="space-y-4 py-4">
            {FILING_TYPES.map((filing) => (
              <div key={filing.id} className="flex items-start gap-4">
                <CheckButton
                  checked={filingStates[filing.id].enabled}
                  onCheckedChange={(checked) =>
                    setFilingStates((prev) => ({
                      ...prev,
                      [filing.id]: {
                        ...prev[filing.id],
                        enabled: checked === true,
                      },
                    }))
                  }
                  className="mt-2"
                />
                <div className="flex-1 space-y-2">
                  <Label htmlFor={`status-${filing.id}`}>{filing.label}</Label>
                  <Select
                    disabled={!filingStates[filing.id].enabled}
                    value={filingStates[filing.id].status || "clear"}
                    onValueChange={(value) =>
                      setFilingStates((prev) => ({
                        ...prev,
                        [filing.id]: {
                          ...prev[filing.id],
                          status: value === "clear" ? null : (value as TrafficLightStatus),
                        },
                      }))
                    }
                  >
                    <SelectTrigger id={`status-${filing.id}`}>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-4">
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm font-medium mb-2">Confirm bulk update:</p>
              <p className="text-sm text-muted-foreground mb-3">
                This will update <strong>{selectedClients.length}</strong> client
                {selectedClients.length !== 1 ? "s" : ""} with the following changes:
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
          <IconButtonWithText variant="destructive" onClick={handleClose}>
            <X className="h-5 w-5" />
            Cancel
          </IconButtonWithText>
          {showConfirmation && (
            <IconButtonWithText
              variant="ghost"
              onClick={() => setShowConfirmation(false)}
            >
              Back
            </IconButtonWithText>
          )}
          <IconButtonWithText
            variant="blue"
            onClick={handleSave}
            disabled={!hasChanges || isUpdating}
          >
            <Save className="h-5 w-5" />
            {showConfirmation ? "Confirm Update" : "Continue"}
          </IconButtonWithText>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
