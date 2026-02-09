"use client";

import { useState, useEffect } from "react";
import { Check, Play, Pause } from "lucide-react";
import { CheckButton } from "@/components/ui/check-button";
import { Button } from "@/components/ui/button";
import { usePageLoading } from "@/components/page-loading";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
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
}

export function RecordsReceived({ clientId }: RecordsReceivedProps) {
  const [assignments, setAssignments] = useState<FilingAssignment[]>([]);
  const [recordsReceived, setRecordsReceived] = useState<string[]>([]);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);

  usePageLoading('records-received', loading);
  const [isUpdating, setIsUpdating] = useState(false);

  // Fetch assignments and client data client-side
  useEffect(() => {
    async function fetchData() {
      try {
        const [filingsRes, clientRes] = await Promise.all([
          fetch(`/api/clients/${clientId}/filings`),
          fetch(`/api/clients/${clientId}`),
        ]);

        if (filingsRes.ok) {
          const filingsData = await filingsRes.json();
          const active = (filingsData.filings || [])
            .filter((f: any) => f.is_active)
            .map((f: any) => ({
              id: f.filing_type.id,
              filing_type_id: f.filing_type.id,
              filing_types: { id: f.filing_type.id, name: f.filing_type.name },
            }));
          setAssignments(active);
        }

        if (clientRes.ok) {
          const clientData = await clientRes.json();
          const client = clientData.data || clientData;
          setRecordsReceived(client.records_received_for || []);
          setPaused(client.reminders_paused || false);
        }
      } catch (error) {
        // Silently fail - component just won't render
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [clientId]);

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

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Records & Reminders</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (assignments.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Records & Reminders</CardTitle>
          <Button
            variant={paused ? "default" : "outline"}
            size="sm"
            onClick={handlePauseToggle}
            disabled={isUpdating}
            className="active:scale-[0.97]"
          >
            {paused ? (
              <>
                <Play className="size-4 mr-2" />
                Resume Reminders
              </>
            ) : (
              <>
                <Pause className="size-4 mr-2" />
                Pause Reminders
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground mb-4">
          Mark filing types as received to automatically cancel upcoming reminders.
        </p>
        {assignments.map((assignment) => {
          const isReceived = recordsReceived.includes(assignment.filing_type_id);
          return (
            <div
              key={assignment.id}
              className="flex items-center space-x-3 rounded-md border p-3 hover:bg-accent/5 transition-colors"
            >
              <CheckButton
                checked={isReceived}
                onCheckedChange={(checked) =>
                  handleRecordsReceivedToggle(
                    assignment.filing_type_id,
                    checked as boolean
                  )
                }
                disabled={isUpdating}
                aria-label={`Mark ${assignment.filing_types.name} as received`}
              />
              <label
                className={`flex-1 text-sm font-medium cursor-pointer ${
                  isReceived ? "line-through text-muted-foreground" : ""
                }`}
                onClick={() => !isUpdating && handleRecordsReceivedToggle(assignment.filing_type_id, !isReceived)}
              >
                {assignment.filing_types.name}
              </label>
              {isReceived && (
                <Check className="size-4 text-status-success" />
              )}
            </div>
          );
        })}
      </div>
      </CardContent>
    </Card>
  );
}
