"use client";

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { enGB } from 'date-fns/locale';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { usePageLoading } from '@/components/page-loading';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckButton } from '@/components/ui/check-button';
import type { FilingType } from '@/lib/types/database';

interface FilingAssignment {
  filing_type: FilingType;
  is_active: boolean;
  calculated_deadline: string | null;
  override_deadline: string | null;
  override_reason: string | null;
}

interface FilingAssignmentsProps {
  clientId: string;
}

export function FilingAssignments({ clientId }: FilingAssignmentsProps) {
  const [filings, setFilings] = useState<FilingAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  usePageLoading('filing-assignments', loading);
  const [overrideForms, setOverrideForms] = useState<Record<string, boolean>>({});
  const [overrideData, setOverrideData] = useState<Record<string, { date: string; reason: string }>>({});

  // Fetch filing assignments
  useEffect(() => {
    async function fetchFilings() {
      try {
        const response = await fetch(`/api/clients/${clientId}/filings`);
        if (!response.ok) {
          throw new Error('Failed to fetch filing assignments');
        }
        const data = await response.json();
        setFilings(data.filings || []);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        toast.error(`Failed to load filing assignments: ${message}`);
      } finally {
        setLoading(false);
      }
    }

    fetchFilings();
  }, [clientId]);

  // Toggle filing assignment
  const handleToggle = async (filingTypeId: string, currentActive: boolean) => {
    const previousFilings = [...filings];

    // Optimistic update
    setFilings((prev) =>
      prev.map((f) =>
        f.filing_type.id === filingTypeId ? { ...f, is_active: !currentActive } : f
      )
    );

    try {
      const response = await fetch(`/api/clients/${clientId}/filings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignments: filings.map((f) => ({
            filing_type_id: f.filing_type.id,
            is_active: f.filing_type.id === filingTypeId ? !currentActive : f.is_active,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update filing assignment');
      }

      toast.success('Filing assignment updated');
    } catch (error) {
      // Revert on error
      setFilings(previousFilings);
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(message);
    }
  };

  // Save deadline override
  const handleSaveOverride = async (filingTypeId: string) => {
    const override = overrideData[filingTypeId];
    if (!override?.date) {
      toast.error('Please select a date');
      return;
    }

    try {
      const response = await fetch(`/api/clients/${clientId}/deadlines`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filing_type_id: filingTypeId,
          override_date: override.date,
          reason: override.reason || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save override');
      }

      // Refresh filings to get updated override
      const filingsResponse = await fetch(`/api/clients/${clientId}/filings`);
      const filingsData = await filingsResponse.json();
      setFilings(filingsData.filings || []);

      setOverrideForms((prev) => ({ ...prev, [filingTypeId]: false }));
      setOverrideData((prev) => ({ ...prev, [filingTypeId]: { date: '', reason: '' } }));
      toast.success('Deadline override saved');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(message);
    }
  };

  // Remove deadline override
  const handleRemoveOverride = async (filingTypeId: string) => {
    try {
      const response = await fetch(
        `/api/clients/${clientId}/deadlines?filing_type_id=${filingTypeId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        throw new Error('Failed to remove override');
      }

      // Refresh filings
      const filingsResponse = await fetch(`/api/clients/${clientId}/filings`);
      const filingsData = await filingsResponse.json();
      setFilings(filingsData.filings || []);

      toast.success('Deadline override removed');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(message);
    }
  };

  const formatDeadline = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      return format(new Date(dateStr), 'dd MMMM yyyy', { locale: enGB });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Filing Types & Deadlines</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (filings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Filing Types & Deadlines</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No applicable filing types for this client. Set client type to auto-assign filing types.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Filing Types & Deadlines</CardTitle>
      </CardHeader>
      <CardContent>
      <div className="space-y-4">
        {filings.map((filing) => {
          const hasOverride = !!filing.override_deadline;
          const showForm = overrideForms[filing.filing_type.id];

          return (
            <div
              key={filing.filing_type.id}
              className="rounded-lg border p-4 space-y-3"
            >
              {/* Filing type header with toggle */}
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <CheckButton
                    checked={filing.is_active}
                    onCheckedChange={() =>
                      handleToggle(filing.filing_type.id, filing.is_active)
                    }
                    aria-label={`Toggle ${filing.filing_type.name}`}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium">{filing.filing_type.name}</div>
                    {filing.filing_type.description && (
                      <div className="text-sm text-muted-foreground">
                        {filing.filing_type.description}
                      </div>
                    )}
                  </div>
                </div>
                {!filing.is_active && (
                  <Badge variant="outline" className="text-muted-foreground">
                    Inactive
                  </Badge>
                )}
              </div>

              {/* Deadline display */}
              {filing.is_active && (
                <div className="ml-7 space-y-2">
                  {hasOverride ? (
                    <div className="space-y-1">
                      <div className="text-sm">
                        <span className="font-medium">Deadline:</span>{' '}
                        <span className="text-accent font-medium">
                          {formatDeadline(filing.override_deadline)}
                        </span>{' '}
                        <Badge variant="outline" className="ml-2 border-accent text-accent">
                          Overridden
                        </Badge>
                      </div>
                      {filing.override_reason && (
                        <div className="text-sm text-muted-foreground">
                          Reason: {filing.override_reason}
                        </div>
                      )}
                      <div className="text-sm text-muted-foreground">
                        Calculated: {formatDeadline(filing.calculated_deadline) || 'Unable to calculate'}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveOverride(filing.filing_type.id)}
                        className="h-8 text-destructive hover:text-destructive/80"
                      >
                        Remove Override
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="text-sm">
                        <span className="font-medium">Deadline:</span>{' '}
                        {filing.calculated_deadline ? (
                          formatDeadline(filing.calculated_deadline)
                        ) : (
                          <span className="text-muted-foreground">
                            Set year-end date to calculate
                          </span>
                        )}
                      </div>
                      {filing.calculated_deadline && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setOverrideForms((prev) => ({
                              ...prev,
                              [filing.filing_type.id]: true,
                            }))
                          }
                          className="h-8"
                        >
                          Override Deadline
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Override form */}
                  {showForm && !hasOverride && (
                    <div className="space-y-3 rounded-md border p-3 bg-muted/50">
                      <div className="space-y-2">
                        <Label htmlFor={`override-date-${filing.filing_type.id}`}>
                          Override Date
                        </Label>
                        <Input
                          id={`override-date-${filing.filing_type.id}`}
                          type="date"
                          className="hover:border-foreground/20"
                          value={overrideData[filing.filing_type.id]?.date || ''}
                          onChange={(e) =>
                            setOverrideData((prev) => ({
                              ...prev,
                              [filing.filing_type.id]: {
                                ...prev[filing.filing_type.id],
                                date: e.target.value,
                              },
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`override-reason-${filing.filing_type.id}`}>
                          Reason (optional)
                        </Label>
                        <Input
                          id={`override-reason-${filing.filing_type.id}`}
                          type="text"
                          className="hover:border-foreground/20"
                          placeholder="e.g., Extension granted by HMRC"
                          value={overrideData[filing.filing_type.id]?.reason || ''}
                          onChange={(e) =>
                            setOverrideData((prev) => ({
                              ...prev,
                              [filing.filing_type.id]: {
                                ...prev[filing.filing_type.id],
                                reason: e.target.value,
                              },
                            }))
                          }
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleSaveOverride(filing.filing_type.id)}
                        >
                          Save Override
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setOverrideForms((prev) => ({
                              ...prev,
                              [filing.filing_type.id]: false,
                            }))
                          }
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      </CardContent>
    </Card>
  );
}
