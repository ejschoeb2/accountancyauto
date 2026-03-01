'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { ButtonBase } from '@/components/ui/button-base';
import { previewQueuedEmail } from '@/app/actions/audit-log';
import type { QueuedReminder } from '@/app/actions/audit-log';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';

interface QueuedEmailPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reminderId: string | null;
  allReminders: QueuedReminder[];
  onNavigate: (direction: 'prev' | 'next') => void;
}

const FILING_TYPE_LABELS: Record<string, string> = {
  corporation_tax_payment: "Corp Tax",
  ct600_filing: "CT600",
  companies_house: "Companies House",
  vat_return: "VAT Return",
  self_assessment: "Self Assessment",
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  scheduled: { label: 'Scheduled', bg: 'bg-sky-500/10', text: 'text-sky-500' },
  rescheduled: { label: 'Rescheduled', bg: 'bg-blue-500/10', text: 'text-blue-500' },
  pending: { label: 'Pending', bg: 'bg-amber-500/10', text: 'text-amber-600' },
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
}: QueuedEmailPreviewModalProps) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ html: string; subject: string; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load preview when reminderId changes
  useEffect(() => {
    if (!open || !reminderId) return;

    setLoading(true);
    setPreview(null);
    setError(null);

    previewQueuedEmail(reminderId).then((result) => {
      if ('error' in result) {
        setError(result.error);
      } else {
        setPreview(result);
      }
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="[&>button]:hidden sm:max-w-7xl max-h-[90vh] p-0 gap-0">
        <div className="flex h-[80vh]">
          {/* Left side: Email preview (plain text) */}
          <div className="flex-1 overflow-y-auto flex flex-col">
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
                <div className="w-full max-w-2xl border rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-lg hover:border-primary/20 transition-all duration-300">
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

          {/* Right side: Metadata sidebar */}
          <div className="w-[420px] p-6 flex flex-col gap-6 overflow-y-auto border-l">
            {/* Header */}
            <h3 className="text-lg font-semibold">Email Preview</h3>

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
                  Status
                </p>
                <div className={`px-3 py-2 rounded-md ${status.bg} inline-flex items-center`}>
                  <span className={`text-sm font-medium ${status.text}`}>
                    {status.label}
                  </span>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="mt-auto pt-4">
              <div className="flex gap-2">
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
                <ButtonBase
                  variant="destructive"
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
