"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { toast } from "sonner";

interface FilingAssignment {
  id: string;
  filing_type_id: string;
  filing_types: {
    id: string;
    name: string;
  };
}

interface RecordsReceivedProps {
  clientId: string;
  assignments: FilingAssignment[];
  recordsReceivedFor: string[];
  remindersPaused: boolean;
}

export function RecordsReceived({
  clientId,
  assignments,
  recordsReceivedFor,
  remindersPaused,
}: RecordsReceivedProps) {
  const [recordsReceived, setRecordsReceived] = useState<string[]>(recordsReceivedFor || []);
  const [paused, setPaused] = useState(remindersPaused);
  const [isUpdating, setIsUpdating] = useState(false);

  async function handleRecordsReceivedToggle(filingTypeId: string, checked: boolean) {
    setIsUpdating(true);

    try {
      const newRecordsReceived = checked
        ? [...recordsReceived, filingTypeId]
        : recordsReceived.filter((id) => id !== filingTypeId);

      const response = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          records_received_for: newRecordsReceived,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update records received");
      }

      setRecordsReceived(newRecordsReceived);
      toast.success(
        checked
          ? "Records marked as received - reminders cancelled"
          : "Records marked as not received - reminders rescheduled"
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update");
    } finally {
      setIsUpdating(false);
    }
  }

  async function handlePauseToggle() {
    setIsUpdating(true);

    try {
      const newPaused = !paused;
      const response = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reminders_paused: newPaused,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update reminder pause status");
      }

      setPaused(newPaused);
      toast.success(
        newPaused
          ? "Reminders paused"
          : "Reminders unpaused - missed reminders skipped"
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update");
    } finally {
      setIsUpdating(false);
    }
  }

  if (assignments.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Records & Reminders</h2>
        <Button
          variant={paused ? "default" : "outline"}
          size="sm"
          onClick={handlePauseToggle}
          disabled={isUpdating}
        >
          {paused ? (
            <>
              <Icon name="play_arrow" size="sm" className="mr-2" />
              Resume Reminders
            </>
          ) : (
            <>
              <Icon name="pause" size="sm" className="mr-2" />
              Pause Reminders
            </>
          )}
        </Button>
      </div>

      <div className="space-y-3">
        <p className="text-sm text-muted-foreground mb-4">
          Mark filing types as received to automatically cancel upcoming reminders.
        </p>
        {assignments.map((assignment) => {
          const isReceived = recordsReceived.includes(assignment.filing_type_id);
          return (
            <div
              key={assignment.id}
              className="flex items-center space-x-3 rounded-md border p-3 hover:bg-accent/50 transition-colors"
            >
              <Checkbox
                id={`records-${assignment.filing_type_id}`}
                checked={isReceived}
                onCheckedChange={(checked) =>
                  handleRecordsReceivedToggle(
                    assignment.filing_type_id,
                    checked as boolean
                  )
                }
                disabled={isUpdating}
              />
              <label
                htmlFor={`records-${assignment.filing_type_id}`}
                className={`flex-1 text-sm font-medium cursor-pointer ${
                  isReceived ? "line-through text-muted-foreground" : ""
                }`}
              >
                {assignment.filing_types.name}
              </label>
              {isReceived && (
                <Icon name="check" size="sm" className="text-status-success" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
