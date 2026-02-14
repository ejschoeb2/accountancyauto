"use client";

import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TrafficLightStatus } from "@/lib/dashboard/traffic-light";

interface StatusDropdownProps {
  clientId: string;
  filingTypeId: string;
  currentStatus: TrafficLightStatus;
  isRecordsReceived: boolean;
  isOverride: boolean;
  onUpdate: (clientId: string, filingTypeId: string, status: TrafficLightStatus | null) => Promise<void>;
}

const STATUS_OPTIONS = [
  { value: "auto", label: "Auto (Calculated)" },
  { value: "red", label: "Overdue" },
  { value: "orange", label: "Critical" },
  { value: "amber", label: "Approaching" },
  { value: "blue", label: "Scheduled" },
  { value: "green", label: "Records Received" },
];

export function StatusDropdown({
  clientId,
  filingTypeId,
  currentStatus,
  isRecordsReceived,
  isOverride,
  onUpdate,
}: StatusDropdownProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  // If records received, show disabled indicator
  if (isRecordsReceived) {
    return (
      <div className="text-sm text-muted-foreground italic">
        Records Received
      </div>
    );
  }

  const displayValue = isOverride ? currentStatus : "auto";

  const handleChange = async (value: string) => {
    setIsUpdating(true);
    try {
      const newStatus = value === "auto" ? null : (value as TrafficLightStatus);
      await onUpdate(clientId, filingTypeId, newStatus);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Select
      value={displayValue}
      onValueChange={handleChange}
      disabled={isUpdating}
    >
      <SelectTrigger className="h-8 min-w-[140px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
