"use client";

import { useState, useEffect, useRef } from 'react';
import { format, isPast } from 'date-fns';
import { enGB } from 'date-fns/locale';
import { toast } from 'sonner';
import { Calendar, CheckCircle, X, RefreshCw, Loader2, ExternalLink, Link2 } from 'lucide-react';
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
import { calculateFilingTypeStatus, type TrafficLightStatus } from '@/lib/dashboard/traffic-light';
import { DocumentCard, type DocumentCardActions } from './document-card';
import { FilingEmailTable } from './filing-email-table';
import { ToggleGroup } from '@/components/ui/toggle-group';

const STATUS_BADGE_CONFIG: Record<TrafficLightStatus, { bg: string; text: string; label: string }> = {
  red: { bg: 'bg-status-danger/10', text: 'text-status-danger', label: 'Overdue' },
  orange: { bg: 'bg-status-critical/10', text: 'text-status-critical', label: 'Critical' },
  amber: { bg: 'bg-status-warning/10', text: 'text-status-warning', label: 'Approaching' },
  blue: { bg: 'bg-status-info/10', text: 'text-status-info', label: 'On Track' },
  violet: { bg: 'bg-violet-500/10', text: 'text-violet-600', label: 'Records Received' },
  green: { bg: 'bg-green-500/10', text: 'text-green-600', label: 'Completed' },
  grey: { bg: 'bg-status-neutral/10', text: 'text-status-neutral', label: 'Inactive' },
};

interface FilingAssignment {
  filing_type: FilingType;
  is_active: boolean;
  calculated_deadline: string | null;
  override_deadline: string | null;
  override_reason: string | null;
  doc_count: number;
  last_received_at: string | null;
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

  const documentCardActionsRef = useRef<Record<string, DocumentCardActions>>({});
  const [effectiveCounts, setEffectiveCounts] = useState<Record<string, { received: number; total: number }>>({});
  const [portalStates, setPortalStates] = useState<Record<string, { generating: boolean; url: string | null; expiresAt: string | null }>>({});

  const [cardViewModes, setCardViewModes] = useState<Record<string, 'documents' | 'emails'>>({});
  const [emailViewModes, setEmailViewModes] = useState<Record<string, 'queued' | 'sent'>>({});

  const getCardViewMode = (filingTypeId: string): 'documents' | 'emails' =>
    cardViewModes[filingTypeId] || 'documents';

  const setCardViewMode = (filingTypeId: string, mode: 'documents' | 'emails') =>
    setCardViewModes(prev => ({ ...prev, [filingTypeId]: mode }));

  const getEmailViewMode = (filingTypeId: string): 'queued' | 'sent' =>
    emailViewModes[filingTypeId] || 'queued';

  const setEmailViewMode = (filingTypeId: string, mode: 'queued' | 'sent') =>
    setEmailViewModes(prev => ({ ...prev, [filingTypeId]: mode }));

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

    // Trigger selectAll/deselectAll on the document card
    const actions = documentCardActionsRef.current[filingTypeId];
    if (actions) {
      if (checked) {
        actions.selectAll();
      } else {
        actions.deselectAll();
      }
    }

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

  // Sync records_received_for when DocumentCard's required group all-received state changes.
  // Does NOT call selectAll/deselectAll — DocumentCard owns its own item state.
  const handleRequiredDocsAllReceived = async (filingTypeId: string, allReceived: boolean) => {
    try {
      const newRecordsReceived = allReceived
        ? [...new Set([...recordsReceived, filingTypeId])]
        : recordsReceived.filter(id => id !== filingTypeId);

      const newCompletedFor = allReceived
        ? completedFor
        : completedFor.filter(id => id !== filingTypeId);

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
      onUpdate?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update');
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

  // Generate portal upload link
  const handleGeneratePortalLink = async (filingTypeId: string) => {
    setPortalStates(prev => ({ ...prev, [filingTypeId]: { generating: true, url: null, expiresAt: null } }));
    try {
      const taxYear = new Date().getFullYear().toString();
      const res = await fetch(`/api/clients/${clientId}/portal-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filingTypeId, taxYear }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to generate link' }));
        throw new Error(err.error ?? 'Failed to generate link');
      }
      const data = await res.json();
      setPortalStates(prev => ({ ...prev, [filingTypeId]: { generating: false, url: data.portalUrl, expiresAt: data.expiresAt } }));
      toast.success('Portal link generated!');
    } catch (err) {
      setPortalStates(prev => ({ ...prev, [filingTypeId]: { generating: false, url: null, expiresAt: null } }));
      toast.error(err instanceof Error ? err.message : 'Failed to generate portal link');
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
              Manage filing deadlines and document collection for this client. Deactivate any filing types that don't apply.
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

            // Compute reactive traffic-light status
            const filingStatus = calculateFilingTypeStatus({
              filing_type_id: filing.filing_type.id,
              deadline_date: filing.override_deadline || filing.calculated_deadline,
              is_records_received: isReceived,
              is_completed: isCompleted,
              override_status: null,
            });
            const showStatusBadge = filing.is_active && filingStatus !== 'violet' && filingStatus !== 'green';
            const badgeConfig = STATUS_BADGE_CONFIG[filingStatus];

            return (
              <div
                key={filing.filing_type.id}
                className={`rounded-xl border bg-card p-6 shadow-sm hover:shadow-lg hover:border-primary/20 transition-all duration-300 ${!filing.is_active ? 'opacity-60' : ''}`}
              >
                {/* Row 1: Filing name + due date (left) | Received count + checkboxes (right) */}
                <div className="flex items-center justify-between gap-6">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-semibold text-lg">{filing.filing_type.name}</span>
                    {filing.is_active && (
                      <span className="text-sm text-muted-foreground shrink-0">
                        {isReceived && isCompleted ? (
                          <span className="text-green-600">
                            Filed — deadline met ({formatDeadline(filing.override_deadline || filing.calculated_deadline)})
                          </span>
                        ) : isReceived ? (
                          <span className="text-violet-600">
                            Documents received — awaiting filing ({formatDeadline(filing.override_deadline || filing.calculated_deadline)})
                          </span>
                        ) : hasOverride ? (
                          <span>
                            Due: <span className="text-accent font-medium">{formatDeadline(filing.override_deadline)}</span>{' '}
                            <Badge variant="outline" className="ml-1 border-accent text-accent">Overridden</Badge>
                          </span>
                        ) : (
                          <span>
                            Due: {filing.calculated_deadline ? formatDeadline(filing.calculated_deadline) : 'Set year-end date to calculate'}
                          </span>
                        )}
                      </span>
                    )}
                    {showStatusBadge && (
                      <div className={`px-3 py-2 rounded-md ${badgeConfig.bg} inline-flex items-center shrink-0`}>
                        <span className={`text-sm font-medium ${badgeConfig.text}`}>
                          {badgeConfig.label}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Right: checkboxes */}
                  <div className="flex items-center gap-3 shrink-0">
                    {/* Received count — clickable to toggle all documents received */}
                    {filing.is_active && effectiveCounts[filing.filing_type.id] && effectiveCounts[filing.filing_type.id].total > 0 && (
                      <div className="flex items-center gap-2">
                        <CheckButton
                          checked={effectiveCounts[filing.filing_type.id].received === effectiveCounts[filing.filing_type.id].total}
                          variant={effectiveCounts[filing.filing_type.id].received === effectiveCounts[filing.filing_type.id].total ? "success" : "default"}
                          onCheckedChange={(checked) => handleRecordsReceivedToggle(filing.filing_type.id, checked as boolean)}
                          disabled={isUpdating}
                          aria-label={`Mark all ${filing.filing_type.name} documents as received`}
                        />
                        <label
                          className="text-sm text-muted-foreground whitespace-nowrap cursor-pointer"
                          onClick={() => {
                            if (!isUpdating) {
                              const allReceived = effectiveCounts[filing.filing_type.id].received === effectiveCounts[filing.filing_type.id].total;
                              handleRecordsReceivedToggle(filing.filing_type.id, !allReceived);
                            }
                          }}
                        >
                          {effectiveCounts[filing.filing_type.id].received} of {effectiveCounts[filing.filing_type.id].total} required received
                        </label>
                      </div>
                    )}

                    {filing.is_active && (
                      <>
                        {/* Completed checkbox */}
                        <div className="flex items-center gap-2">
                          <CheckButton
                            checked={isCompleted}
                            onCheckedChange={(checked) => handleCompletedToggle(filing.filing_type.id, checked as boolean)}
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

                        <Separator orientation="vertical" className="h-8" />
                      </>
                    )}

                    {/* Active checkbox — always shown */}
                    <div className="flex items-center gap-2">
                      <CheckButton
                        checked={filing.is_active}
                        onCheckedChange={() => handleToggle(filing.filing_type.id, filing.is_active)}
                        aria-label={`Toggle ${filing.filing_type.name} active`}
                        variant={filing.is_active ? "success" : "default"}
                      />
                      <label
                        className="text-sm cursor-pointer whitespace-nowrap text-muted-foreground"
                        onClick={() => handleToggle(filing.filing_type.id, filing.is_active)}
                      >
                        Active
                      </label>
                    </div>
                  </div>
                </div>

                {/* Override details (shown below row 1 when overridden) */}
                {filing.is_active && hasOverride && !isReceived && (
                  <div className="mt-1 space-y-0.5">
                    {filing.override_reason && (
                      <div className="text-sm text-muted-foreground">Reason: {filing.override_reason}</div>
                    )}
                    <div className="text-sm text-muted-foreground">
                      Calculated: {formatDeadline(filing.calculated_deadline) || 'Unable to calculate'}
                    </div>
                  </div>
                )}

                {/* Row 2: Documents/Emails toggle + action buttons */}
                {filing.is_active && (
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <ToggleGroup
                        options={[
                          { value: 'documents' as const, label: 'Documents' },
                          { value: 'emails' as const, label: 'Emails' },
                        ]}
                        value={getCardViewMode(filing.filing_type.id)}
                        onChange={(mode) => setCardViewMode(filing.filing_type.id, mode)}
                      />

                      <div className="flex items-center gap-3">
                      {/* Generate Upload Link */}
                      <IconButtonWithText
                        variant="violet"
                        onClick={() => handleGeneratePortalLink(filing.filing_type.id)}
                        disabled={
                          portalStates[filing.filing_type.id]?.generating ||
                          (effectiveCounts[filing.filing_type.id] !== undefined &&
                            effectiveCounts[filing.filing_type.id].total === 0)
                        }
                      >
                        {portalStates[filing.filing_type.id]?.generating ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Link2 className="size-4" />
                        )}
                        {portalStates[filing.filing_type.id]?.generating ? 'Generating...' : (
                          <>
                            <span className="hidden sm:inline">Generate Upload Link</span>
                            <span className="sm:hidden">Upload</span>
                          </>
                        )}
                      </IconButtonWithText>

                      {/* Deadline action button */}
                      {filing.calculated_deadline && (
                        <>
                          {isReceived && isCompleted ? (
                            <IconButtonWithText variant="green" onClick={() => handleOpenRolloverDialog(filing.filing_type.id)}>
                              <RefreshCw className="h-4 w-4" />
                              Roll Over
                            </IconButtonWithText>
                          ) : isReceived && !isCompleted ? (
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
                            <IconButtonWithText variant="destructive" onClick={() => handleRemoveOverride(filing.filing_type.id)}>
                              <X className="h-4 w-4" />
                              Remove Override
                            </IconButtonWithText>
                          ) : (
                            <IconButtonWithText variant="amber" onClick={() => handleOpenOverrideDialog(filing.filing_type.id)}>
                              <Calendar className="h-4 w-4" />
                              Override Deadline
                            </IconButtonWithText>
                          )}
                        </>
                      )}
                      </div>
                    </div>
                    {getCardViewMode(filing.filing_type.id) === 'emails' && (
                      <ToggleGroup
                        options={[
                          { value: 'queued' as const, label: 'Queued' },
                          { value: 'sent' as const, label: 'Sent' },
                        ]}
                        value={getEmailViewMode(filing.filing_type.id)}
                        onChange={(mode) => setEmailViewMode(filing.filing_type.id, mode)}
                      />
                    )}
                  </div>
                )}

                {/* Content area */}
                {filing.is_active && (
                  <div className="mt-4 -mx-6 -mb-6">
                    {getCardViewMode(filing.filing_type.id) === 'documents' ? (
                      <DocumentCard
                        clientId={clientId}
                        filingTypeId={filing.filing_type.id}
                        filingTypeName={filing.filing_type.name}
                        docCount={filing.doc_count ?? 0}
                        lastReceivedAt={filing.last_received_at ?? null}
                        portalUrl={portalStates[filing.filing_type.id]?.url ?? null}
                        portalExpiresAt={portalStates[filing.filing_type.id]?.expiresAt ?? null}
                        onActionsReady={(actions) => {
                          documentCardActionsRef.current[filing.filing_type.id] = actions;
                        }}
                        onReceivedCountChange={(received, total) => {
                          setEffectiveCounts(prev => {
                            const existing = prev[filing.filing_type.id];
                            if (existing?.received === received && existing?.total === total) return prev;
                            return { ...prev, [filing.filing_type.id]: { received, total } };
                          });
                        }}
                        onRequiredAllReceivedChange={(allReceived) =>
                          handleRequiredDocsAllReceived(filing.filing_type.id, allReceived)
                        }
                      />
                    ) : (
                      <FilingEmailTable
                        clientId={clientId}
                        filingTypeId={filing.filing_type.id}
                        viewMode={getEmailViewMode(filing.filing_type.id)}
                      />
                    )}
                  </div>
                )}
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
