'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { ButtonBase } from '@/components/ui/button-base';
import { Input } from '@/components/ui/input';
import { previewQueuedEmail } from '@/app/actions/audit-log';
import type { QueuedReminder } from '@/app/actions/audit-log';
import { cancelScheduling, uncancelScheduling, rescheduleToSpecificDate, sendNow } from '@/app/actions/email-queue';
import { getClientFilingStatusForType } from '@/app/actions/clients';
import { FilingStatusBadge } from '@/app/(dashboard)/clients/components/filing-status-badge';
import type { TrafficLightStatus } from '@/lib/dashboard/traffic-light';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Ban,
  RotateCcw,
  Calendar,
  Send,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface QueuedEmailPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reminderId: string | null;
  allReminders: QueuedReminder[];
  onNavigate: (direction: 'prev' | 'next') => void;
  onStatusChange?: () => void;
}

import { FILING_TYPE_LABELS } from '@/lib/constants/filing-types';

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  scheduled: { label: 'Scheduled', bg: 'bg-status-info/10', text: 'text-status-info' },
  rescheduled: { label: 'Rescheduled', bg: 'bg-blue-500/10', text: 'text-blue-500' },
  sent: { label: 'Sent', bg: 'bg-blue-500/10', text: 'text-blue-500' },
  cancelled: { label: 'Manually Cancelled', bg: 'bg-status-danger/10', text: 'text-status-danger' },
  failed: { label: 'Failed', bg: 'bg-status-danger/10', text: 'text-status-danger' },
  records_received: { label: 'Records Received', bg: 'bg-green-500/10', text: 'text-green-600' },
};

export function QueuedEmailPreviewModal({
  open,
  onOpenChange,
  reminderId,
  allReminders,
  onNavigate,
  onStatusChange,
}: QueuedEmailPreviewModalProps) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ html: string; subject: string; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [confirmSendNow, setConfirmSendNow] = useState(false);
  const [clientFilingStatus, setClientFilingStatus] = useState<{
    status: TrafficLightStatus;
    docReceived: number;
    docRequired: number;
  } | null>(null);

  // Load preview when reminderId changes
  useEffect(() => {
    if (!open || !reminderId) return;

    setLoading(true);
    setPreview(null);
    setError(null);
    setShowReschedule(false);
    setRescheduleDate('');
    setConfirmSendNow(false);
    setClientFilingStatus(null);

    // Fetch client filing status
    const currentReminder = allReminders.find((r) => r.id === reminderId);
    if (currentReminder?.filing_type_id) {
      getClientFilingStatusForType(
        currentReminder.client_id,
        currentReminder.filing_type_id,
        currentReminder.deadline_date
      ).then(setClientFilingStatus).catch(() => {});
    }

    previewQueuedEmail(reminderId)
      .then((result) => {
        if ('error' in result) {
          setError(result.error);
        } else {
          setPreview(result);
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load email preview');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [open, reminderId]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onNavigate('prev');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onNavigate('next');
      }
    },
    [open, onNavigate]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Find current reminder in list
  const reminder = allReminders.find((r) => r.id === reminderId);
  if (!reminder) return null;

  const currentIndex = allReminders.findIndex((r) => r.id === reminderId);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < allReminders.length - 1;

  const filingTypeLabel = reminder.filing_type_id
    ? FILING_TYPE_LABELS[reminder.filing_type_id] || reminder.filing_type_name
    : reminder.template_name || 'Custom';

  const status = STATUS_CONFIG[reminder.status] || {
    label: reminder.status,
    bg: 'bg-gray-500/10',
    text: 'text-gray-500',
  };

  const isCancelled = reminder.status === 'cancelled';
  const canCancel = reminder.status === 'scheduled' || reminder.status === 'rescheduled';
  const canReschedule = reminder.status === 'scheduled' || reminder.status === 'rescheduled';
  const canSendNow = reminder.status === 'scheduled' || reminder.status === 'rescheduled';

  const handleSendNow = async () => {
    if (!reminderId) return;
    setActionLoading(true);
    try {
      const result = await sendNow({ reminderId });
      if (result.success) {
        toast.success(result.message);
        setConfirmSendNow(false);
        onStatusChange?.();
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error('An error occurred while sending');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelOrRestore = async () => {
    if (!reminderId) return;
    setActionLoading(true);
    try {
      if (isCancelled) {
        const result = await uncancelScheduling({ reminderIds: [reminderId] });
        if (result.success) {
          toast.success('Email restored to scheduled');
          onStatusChange?.();
        } else {
          toast.error(result.message);
        }
      } else {
        const result = await cancelScheduling({ reminderIds: [reminderId] });
        if (result.success) {
          toast.success('Email cancelled');
          onStatusChange?.();
        } else {
          toast.error(result.message);
        }
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReschedule = async () => {
    if (!reminderId || !rescheduleDate) return;
    setActionLoading(true);
    try {
      const result = await rescheduleToSpecificDate({
        reminderIds: [reminderId],
        newDate: rescheduleDate,
      });
      if (result.success) {
        toast.success(`Email rescheduled to ${format(new Date(rescheduleDate), 'dd MMM yyyy')}`);
        setShowReschedule(false);
        setRescheduleDate('');
        onStatusChange?.();
      } else {
        const errorMsg = result.errors?.length
          ? `${result.message}: ${result.errors.join(', ')}`
          : result.message;
        toast.error(errorMsg);
      }
    } catch {
      toast.error('An error occurred while rescheduling');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="[&>button]:hidden sm:max-w-7xl max-h-[94vh] p-0 gap-0">
        <div className="flex h-[88vh]">
          {/* Left side: Email preview (plain text) */}
          <div className="flex-1 overflow-y-auto flex flex-col rounded-l-lg" style={{ backgroundColor: '#ffffff' }}>
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="text-center space-y-2">
                  <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              </div>
            ) : preview ? (
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="w-full max-w-3xl border rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-lg hover:border-primary/20 transition-all duration-300">
                  {preview.subject && (
                    <div className="border-b px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground shrink-0">Subject:</span>
                        <span className="text-sm">{preview.subject}</span>
                      </div>
                    </div>
                  )}
                  <div className="p-4">
                    <pre className="whitespace-pre-wrap font-sans text-sm text-foreground leading-relaxed">
                      {preview.text}
                    </pre>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Divider */}
          <div className="w-px bg-border shrink-0" />

          {/* Right side: Metadata sidebar */}
          <div className="w-[420px] p-6 flex flex-col gap-6 overflow-y-auto rounded-r-lg bg-white dark:bg-background">
            {/* Header */}
            <h3 className="text-2xl font-bold">Email Preview</h3>

            {/* Actions */}
            {(canCancel || isCancelled || canReschedule || canSendNow) && (
              <div className="flex gap-2 flex-wrap">
                {canSendNow && !confirmSendNow && (
                  <ButtonBase
                    variant="green"
                    buttonType="icon-text"
                    onClick={() => setConfirmSendNow(true)}
                    disabled={actionLoading}
                  >
                    <Send className="h-4 w-4" />
                    Send Now
                  </ButtonBase>
                )}
                {(canCancel || isCancelled) && (
                  <ButtonBase
                    variant={isCancelled ? 'green' : 'destructive'}
                    buttonType="icon-text"
                    onClick={handleCancelOrRestore}
                    disabled={actionLoading}
                  >
                    {isCancelled ? (
                      <>
                        <RotateCcw className="h-4 w-4" />
                        {actionLoading ? 'Restoring...' : 'Restore'}
                      </>
                    ) : (
                      <>
                        <Ban className="h-4 w-4" />
                        {actionLoading ? 'Cancelling...' : 'Cancel'}
                      </>
                    )}
                  </ButtonBase>
                )}
                {canReschedule && !showReschedule && (
                  <ButtonBase
                    variant="amber"
                    buttonType="icon-text"
                    onClick={() => setShowReschedule(true)}
                    disabled={actionLoading}
                  >
                    <Calendar className="h-4 w-4" />
                    Reschedule
                  </ButtonBase>
                )}
              </div>
            )}

            {/* Send Now confirmation */}
            {confirmSendNow && (
              <div className="space-y-3 p-4 border rounded-lg bg-amber-500/5 border-amber-500/20">
                <p className="text-sm text-foreground">
                  Send this email to <span className="font-medium">{reminder.client_name}</span> right now?
                </p>
                <div className="flex gap-2">
                  <ButtonBase
                    variant="green"
                    buttonType="icon-text"
                    onClick={handleSendNow}
                    disabled={actionLoading}
                  >
                    <Send className="h-4 w-4" />
                    {actionLoading ? 'Sending...' : 'Confirm Send'}
                  </ButtonBase>
                  <ButtonBase
                    variant="muted"
                    buttonType="text-only"
                    onClick={() => setConfirmSendNow(false)}
                  >
                    Cancel
                  </ButtonBase>
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Client
                </p>
                <p className="text-sm font-medium">{reminder.client_name}</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Deadline Type
                </p>
                <p className="text-sm font-medium">{filingTypeLabel}</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Deadline Date
                </p>
                <p className="text-sm font-medium">
                  {format(new Date(reminder.deadline_date), 'dd MMM yyyy')}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Send Date
                </p>
                <p className="text-sm font-medium">
                  {format(new Date(reminder.send_date), 'dd MMM yyyy')}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Step
                </p>
                <p className="text-sm font-medium">Step {reminder.step_index}</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Email Status
                </p>
                <div className={`px-3 py-2 rounded-md ${status.bg} inline-flex items-center`}>
                  <span className={`text-sm font-medium ${status.text}`}>
                    {status.label}
                  </span>
                </div>
              </div>

              {clientFilingStatus && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    Client Status
                  </p>
                  <FilingStatusBadge
                    status={clientFilingStatus.status}
                    isRecordsReceived={clientFilingStatus.status === 'violet' || clientFilingStatus.status === 'green'}
                    isOverride={false}
                    docReceived={clientFilingStatus.docReceived}
                    docRequired={clientFilingStatus.docRequired}
                  />
                </div>
              )}
            </div>

            {/* Reschedule inline section */}
            {showReschedule && (
              <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Reschedule to
                </p>
                <Input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="hover:border-foreground/20"
                />
                <div className="flex gap-2">
                  <ButtonBase
                    variant="green"
                    buttonType="icon-text"
                    onClick={handleReschedule}
                    disabled={!rescheduleDate || actionLoading}
                  >
                    <Calendar className="h-4 w-4" />
                    {actionLoading ? 'Saving...' : 'Apply'}
                  </ButtonBase>
                  <ButtonBase
                    variant="muted"
                    buttonType="text-only"
                    onClick={() => {
                      setShowReschedule(false);
                      setRescheduleDate('');
                    }}
                  >
                    Cancel
                  </ButtonBase>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="mt-auto pt-4">
              <div className="flex gap-2 justify-end">
                <ButtonBase
                  variant="blue"
                  buttonType="icon-text"
                  onClick={() => onNavigate('prev')}
                  disabled={!hasPrev}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </ButtonBase>
                <ButtonBase
                  variant="blue"
                  buttonType="icon-text"
                  onClick={() => onNavigate('next')}
                  disabled={!hasNext}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </ButtonBase>
                <Separator orientation="vertical" className="h-8" />
                <ButtonBase
                  variant="amber"
                  buttonType="icon-text"
                  onClick={() => onOpenChange(false)}
                >
                  <X className="h-4 w-4" />
                  Close
                </ButtonBase>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
