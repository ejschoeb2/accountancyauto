"use client";

import { useState, useEffect } from 'react';
import { format, isPast } from 'date-fns';
import { enGB } from 'date-fns/locale';
import { toast } from 'sonner';
import { Calendar, CheckCircle, X, RefreshCw, Loader2, ExternalLink } from 'lucide-react';
import { rolloverFiling } from '@/lib/rollover/executor';
import { createClient } from '@/lib/supabase/client';
import { Badge } from '@/components/ui/badge';
import { IconButtonWithText } from '@/components/ui/icon-button-with-text';
import { usePageLoading } from '@/components/page-loading';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckButton } from '@/components/ui/check-button';
import { Separator } from '@/components/ui/separator';
import type { FilingType } from '@/lib/types/database';

interface FilingAssignment {
  filing_type: FilingType;
  is_active: boolean;
  calculated_deadline: string | null;
  override_deadline: string | null;
  override_reason: string | null;
}

interface FilingManagementProps {
  clientId: string;
  onUpdate?: () => void;
}

export function FilingManagement({ clientId, onUpdate }: FilingManagementProps) {
  const [filings, setFilings] = useState<FilingAssignment[]>([]);
  const [recordsReceived, setRecordsReceived] = useState<string[]>([]);
  const [completedFor, setCompletedFor] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  usePageLoading('filing-management', loading);

  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [currentFilingType, setCurrentFilingType] = useState<string | null>(null);
  const [overrideDate, setOverrideDate] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const [showRolloverDialog, setShowRolloverDialog] = useState(false);
  const [rolloverFilingType, setRolloverFilingType] = useState<string | null>(null);
  const [isRollingOver, setIsRollingOver] = useState(false);

  // Fetch all data
  useEffect(() => {
    async function fetchData() {
      try {
        const [filingsRes, clientRes] = await Promise.all([
          fetch(`/api/clients/${clientId}/filings`),
          fetch(`/api/clients/${clientId}`),
        ]);

        if (filingsRes.ok) {
          const data = await filingsRes.json();
          setFilings(data.filings || []);
        }

        if (clientRes.ok) {
          const clientData = await clientRes.json();
          const client = clientData.data || clientData;
          setRecordsReceived(client.records_received_for || []);
          setCompletedFor(client.completed_for || []);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        toast.error(`Failed to load filing data: ${message}`);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
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
      onUpdate?.();
    } catch (error) {
      // Revert on error
      setFilings(previousFilings);
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(message);
    }
  };

  // Open override dialog
  const handleOpenOverrideDialog = (filingTypeId: string) => {
    setCurrentFilingType(filingTypeId);
    setOverrideDate('');
    setOverrideReason('');
    setShowOverrideDialog(true);
  };

  // Save deadline override
  const handleSaveOverride = async () => {
    if (!currentFilingType) return;

    if (!overrideDate) {
      toast.error('Please select a date');
      return;
    }

    try {
      const response = await fetch(`/api/clients/${clientId}/deadlines`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filing_type_id: currentFilingType,
          override_date: overrideDate,
          reason: overrideReason || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save override');
      }

      // Refresh filings to get updated override
      const filingsResponse = await fetch(`/api/clients/${clientId}/filings`);
      const filingsData = await filingsResponse.json();
      setFilings(filingsData.filings || []);

      setShowOverrideDialog(false);
      setCurrentFilingType(null);
      setOverrideDate('');
      setOverrideReason('');
      toast.success('Deadline override saved');
      onUpdate?.();
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
      onUpdate?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(message);
    }
  };

  // Toggle records received
  const handleRecordsReceivedToggle = async (filingTypeId: string, checked: boolean) => {
    setIsUpdating(true);

    try {
      const newRecordsReceived = checked
        ? [...recordsReceived, filingTypeId]
        : recordsReceived.filter((id) => id !== filingTypeId);

      // If unchecking records received, also uncheck completed
      const newCompletedFor = checked
        ? completedFor
        : completedFor.filter((id) => id !== filingTypeId);

      const response = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          records_received_for: newRecordsReceived,
          completed_for: newCompletedFor,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update records received');
      }

      setRecordsReceived(newRecordsReceived);
      setCompletedFor(newCompletedFor);
      toast.success(
        checked
          ? 'Records marked as received - reminders cancelled'
          : 'Records marked as not received - reminders rescheduled'
      );
      onUpdate?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update');
    } finally {
      setIsUpdating(false);
    }
  };

  // Toggle completed
  const handleCompletedToggle = async (filingTypeId: string, checked: boolean) => {
    setIsUpdating(true);

    try {
      const newCompletedFor = checked
        ? [...completedFor, filingTypeId]
        : completedFor.filter((id) => id !== filingTypeId);

      const response = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completed_for: newCompletedFor,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update completion status');
      }

      setCompletedFor(newCompletedFor);
      toast.success(
        checked
          ? 'Filing marked as completed'
          : 'Filing marked as not completed'
      );
      onUpdate?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update');
    } finally {
      setIsUpdating(false);
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

  // Get filing portal URL and button text based on filing type
  const getFilingPortal = (filingTypeName: string): { url: string; label: string } => {
    const lowerName = filingTypeName.toLowerCase();

    if (lowerName.includes('companies house')) {
      return {
        url: 'https://ewf.companieshouse.gov.uk/',
        label: 'Take me to Companies House'
      };
    } else if (lowerName.includes('vat')) {
      return {
        url: 'https://www.tax.service.gov.uk/vat-through-software/what-you-need-to-do',
        label: 'Take me to HMRC'
      };
    } else if (lowerName.includes('self assessment')) {
      return {
        url: 'https://www.tax.service.gov.uk/personal-account',
        label: 'Take me to HMRC'
      };
    } else {
      // Corporation Tax, CT600, and others
      return {
        url: 'https://www.tax.service.gov.uk/business-account',
        label: 'Take me to HMRC'
      };
    }
  };

  // Check if deadline has passed
  const isDeadlinePassed = (filing: FilingAssignment): boolean => {
    const deadline = filing.override_deadline || filing.calculated_deadline;
    if (!deadline) return false;
    try {
      return isPast(new Date(deadline));
    } catch {
      return false;
    }
  };

  // Handle rollover confirmation
  const handleOpenRolloverDialog = (filingTypeId: string) => {
    setRolloverFilingType(filingTypeId);
    setShowRolloverDialog(true);
  };

  // Execute rollover
  const handleConfirmRollover = async () => {
    if (!rolloverFilingType) return;

    setIsRollingOver(true);
    try {
      const supabase = createClient();
      const result = await rolloverFiling(supabase, clientId, rolloverFilingType);

      if (result.success) {
        toast.success('Filing rolled over to next cycle');

        // Refresh data
        const [filingsRes, clientRes] = await Promise.all([
          fetch(`/api/clients/${clientId}/filings`),
          fetch(`/api/clients/${clientId}`),
        ]);

        if (filingsRes.ok) {
          const data = await filingsRes.json();
          setFilings(data.filings || []);
        }

        if (clientRes.ok) {
          const clientData = await clientRes.json();
          const client = clientData.data || clientData;
          setRecordsReceived(client.records_received_for || []);
          setCompletedFor(client.completed_for || []);
        }

        onUpdate?.();
      } else {
        toast.error(result.error || 'Failed to roll over filing');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to roll over');
    } finally {
      setIsRollingOver(false);
      setShowRolloverDialog(false);
      setRolloverFilingType(null);
    }
  };

  if (loading) {
    return (
      <Card className="gap-1.5">
        <div className="px-8">
          <div className="mb-6">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold">Filing Management</h2>
            </div>
          </div>
        </div>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (filings.length === 0) {
    return (
      <Card className="gap-1.5">
        <div className="px-8">
          <div className="mb-6">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold">Filing Management</h2>
            </div>
          </div>
        </div>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No applicable filing types for this client. Set client type to auto-assign filing types.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="gap-1.5">
      <div className="px-8">
        <div className="mb-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold">Filing Management</h2>
            <p className="text-sm text-muted-foreground">
              Manage filing deadlines and requirements for this client. Toggle off any filing types that don't apply.
            </p>
          </div>
        </div>
      </div>
      <CardContent>
        <div className="space-y-4 max-w-7xl">
          {filings.map((filing) => {
            const hasOverride = !!filing.override_deadline;
            const isReceived = recordsReceived.includes(filing.filing_type.id);
            const isCompleted = completedFor.includes(filing.filing_type.id);
            const deadlinePassed = isDeadlinePassed(filing);
            const canRollover = isReceived && isCompleted && deadlinePassed && filing.is_active;

            return (
              <div
                key={filing.filing_type.id}
                className="rounded-xl border bg-card p-6 shadow-sm hover:shadow-lg hover:border-primary/20 transition-all duration-300"
              >
                {/* Filing type header with toggle */}
                <div className="flex items-center justify-between gap-6">
                  {/* Left side: Large checkbox + Filing info */}
                  <div className="flex items-center gap-4 flex-1">
                    <CheckButton
                      checked={filing.is_active}
                      onCheckedChange={() =>
                        handleToggle(filing.filing_type.id, filing.is_active)
                      }
                      aria-label={`Toggle ${filing.filing_type.name}`}
                      className="scale-125"
                    />
                    <div className="flex-1 space-y-1">
                      {/* Filing type and deadline on same line */}
                      <div className="flex items-baseline gap-3">
                        <span className="font-medium text-base">{filing.filing_type.name}</span>
                        {filing.is_active && (
                          <>
                            {isReceived && isCompleted ? (
                              <span className="text-sm text-green-600">
                                Deadline met ({formatDeadline(filing.override_deadline || filing.calculated_deadline)})
                              </span>
                            ) : isReceived ? (
                              <span className="text-sm text-violet-600">
                                Records received ({formatDeadline(filing.override_deadline || filing.calculated_deadline)})
                              </span>
                            ) : hasOverride ? (
                              <span className="text-sm text-muted-foreground">
                                Deadline: <span className="text-accent font-medium">
                                  {formatDeadline(filing.override_deadline)}
                                </span>{' '}
                                <Badge variant="outline" className="ml-2 border-accent text-accent">
                                  Overridden
                                </Badge>
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                Deadline: {filing.calculated_deadline ? (
                                  formatDeadline(filing.calculated_deadline)
                                ) : (
                                  <span>Set year-end date to calculate</span>
                                )}
                              </span>
                            )}
                          </>
                        )}
                      </div>

                      {/* Additional override info */}
                      {filing.is_active && hasOverride && (
                        <div className="space-y-1">
                          {filing.override_reason && (
                            <div className="text-sm text-muted-foreground">
                              Reason: {filing.override_reason}
                            </div>
                          )}
                          <div className="text-sm text-muted-foreground">
                            Calculated: {formatDeadline(filing.calculated_deadline) || 'Unable to calculate'}
                          </div>
                        </div>
                      )}

                      {filing.is_active && isReceived && !isCompleted && (
                        <p className="text-sm text-muted-foreground">
                          Click the button to file online, then mark as completed when done.
                        </p>
                      )}
                      {filing.is_active && isReceived && isCompleted && (
                        <p className="text-sm text-muted-foreground">
                          Press "Roll Over" to prepare for next year's deadline, or wait and it will automatically update once the deadline passes.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right side: Records received and completed checkboxes + button */}
                  <div className="flex items-center gap-3">
                    {!filing.is_active ? (
                      <Badge variant="outline" className="text-muted-foreground">
                        Inactive
                      </Badge>
                    ) : (
                      <>
                        {/* Records received checkbox */}
                        <div className="flex items-center gap-2">
                          <CheckButton
                            checked={isReceived}
                            onCheckedChange={(checked) =>
                              handleRecordsReceivedToggle(
                                filing.filing_type.id,
                                checked as boolean
                              )
                            }
                            disabled={isUpdating}
                            aria-label={`Mark ${filing.filing_type.name} records as received`}
                            variant={isReceived ? "success" : "default"}
                          />
                          <label
                            className={`text-sm cursor-pointer whitespace-nowrap ${
                              isReceived ? "line-through text-muted-foreground" : "text-foreground"
                            }`}
                            onClick={() => !isUpdating && handleRecordsReceivedToggle(filing.filing_type.id, !isReceived)}
                          >
                            Records received
                          </label>
                        </div>

                        {/* Completed checkbox */}
                        <div className="flex items-center gap-2">
                          <CheckButton
                            checked={isCompleted}
                            onCheckedChange={(checked) =>
                              handleCompletedToggle(
                                filing.filing_type.id,
                                checked as boolean
                              )
                            }
                            disabled={isUpdating || !isReceived}
                            aria-label={`Mark ${filing.filing_type.name} as completed`}
                            variant={isCompleted ? "success" : "default"}
                          />
                          <label
                            className={`text-sm cursor-pointer whitespace-nowrap ${
                              isCompleted ? "line-through text-muted-foreground" : isReceived ? "text-foreground" : "text-muted-foreground"
                            }`}
                            onClick={() => !isUpdating && isReceived && handleCompletedToggle(filing.filing_type.id, !isCompleted)}
                          >
                            Completed
                          </label>
                        </div>

                        {/* Divider */}
                        {filing.calculated_deadline && (
                          <Separator orientation="vertical" className="h-8" />
                        )}

                        {/* Action button */}
                        {filing.calculated_deadline && (
                          <>
                            {/* Show Roll Over button if both records received AND completed */}
                            {isReceived && isCompleted ? (
                              <IconButtonWithText
                                variant="green"
                                onClick={() => handleOpenRolloverDialog(filing.filing_type.id)}
                              >
                                <RefreshCw className="h-4 w-4" />
                                Roll Over
                              </IconButtonWithText>
                            ) : isReceived && !isCompleted ? (
                              /* Show "Take me to HMRC/Companies House" button when records received but not yet completed */
                              (() => {
                                const portal = getFilingPortal(filing.filing_type.name);
                                return (
                                  <IconButtonWithText
                                    variant="blue"
                                    onClick={() => {
                                      window.open(portal.url, '_blank', 'noopener,noreferrer');
                                      toast.success('Opening filing portal in new tab');
                                    }}
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                    {portal.label}
                                  </IconButtonWithText>
                                );
                              })()
                            ) : hasOverride ? (
                              <IconButtonWithText
                                variant="destructive"
                                onClick={() => handleRemoveOverride(filing.filing_type.id)}
                              >
                                <X className="h-4 w-4" />
                                Remove Override
                              </IconButtonWithText>
                            ) : (
                              <IconButtonWithText
                                variant="amber"
                                onClick={() => handleOpenOverrideDialog(filing.filing_type.id)}
                              >
                                <Calendar className="h-4 w-4" />
                                Override Deadline
                              </IconButtonWithText>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>

      {/* Rollover Confirmation Dialog */}
      <Dialog open={showRolloverDialog} onOpenChange={setShowRolloverDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Roll Over to Next Cycle?</DialogTitle>
            <DialogDescription className="space-y-2">
              <p>This will:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Advance year-end date to next year (for annual filings)</li>
                <li>Clear "records received" and "completed" status</li>
                <li>Cancel scheduled reminders for this cycle</li>
                <li>Generate new reminders for the next cycle</li>
              </ul>
              <p className="text-red-600 font-medium mt-3">
                This action cannot be undone.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <IconButtonWithText
              variant="destructive"
              onClick={() => setShowRolloverDialog(false)}
              disabled={isRollingOver}
            >
              <X className="h-5 w-5" />
              Cancel
            </IconButtonWithText>
            <IconButtonWithText
              variant="blue"
              onClick={handleConfirmRollover}
              disabled={isRollingOver}
            >
              {isRollingOver ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <RefreshCw className="h-5 w-5" />
              )}
              Roll Over
            </IconButtonWithText>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Override Deadline Dialog */}
      <Dialog open={showOverrideDialog} onOpenChange={setShowOverrideDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override Deadline</DialogTitle>
            <DialogDescription>
              Set a custom deadline for this filing type. This will override the automatically calculated deadline.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="override-date">Override Date</Label>
              <Input
                id="override-date"
                type="date"
                className="hover:border-foreground/20"
                value={overrideDate}
                onChange={(e) => setOverrideDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="override-reason">Reason (optional)</Label>
              <Input
                id="override-reason"
                type="text"
                className="hover:border-foreground/20"
                placeholder="e.g., Extension granted by HMRC"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <IconButtonWithText
              variant="destructive"
              onClick={() => setShowOverrideDialog(false)}
            >
              <X className="h-5 w-5" />
              Cancel
            </IconButtonWithText>
            <IconButtonWithText
              variant="blue"
              onClick={handleSaveOverride}
            >
              <CheckCircle className="h-5 w-5" />
              Save Override
            </IconButtonWithText>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
