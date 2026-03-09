'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { ButtonBase } from '@/components/ui/button-base';
import { previewSentEmail } from '@/app/actions/audit-log';
import type { AuditEntry } from '@/app/actions/audit-log';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  ExternalLink,
  Mail,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';

interface SentEmailDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: AuditEntry | null;
  allEntries: AuditEntry[];
  onNavigate: (direction: 'prev' | 'next') => void;
}

const FILING_TYPE_LABELS: Record<string, string> = {
  corporation_tax_payment: 'Corp Tax',
  ct600_filing: 'CT600',
  companies_house: 'Companies House',
  vat_return: 'VAT Return',
  self_assessment: 'Self Assessment',
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  delivered: {
    label: 'Delivered',
    bg: 'bg-green-500/10',
    text: 'text-green-600',
  },
  sent: {
    label: 'Sent',
    bg: 'bg-blue-500/10',
    text: 'text-blue-500',
  },
  bounced: {
    label: 'Bounced',
    bg: 'bg-amber-500/10',
    text: 'text-amber-600',
  },
  failed: {
    label: 'Failed',
    bg: 'bg-red-500/10',
    text: 'text-red-500',
  },
};

export function SentEmailDetailModal({
  open,
  onOpenChange,
  entry,
  allEntries,
  onNavigate,
}: SentEmailDetailModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ html: string; subject: string; text: string } | null>(null);
  const [noBody, setNoBody] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !entry) return;

    setLoading(true);
    setPreview(null);
    setNoBody(false);
    setError(null);

    previewSentEmail(entry.id)
      .then((result) => {
        if ('noBody' in result) {
          setNoBody(true);
        } else if ('error' in result) {
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
  }, [open, entry]);

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

  if (!entry) return null;

  const currentIndex = allEntries.findIndex((e) => e.id === entry.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < allEntries.length - 1;

  const status = STATUS_CONFIG[entry.delivery_status] ?? {
    label: entry.delivery_status,
    bg: 'bg-gray-500/10',
    text: 'text-gray-500',
  };

  const filingTypeLabel = entry.filing_type_id
    ? (FILING_TYPE_LABELS[entry.filing_type_id] ?? entry.filing_type_name)
    : entry.template_name ?? '—';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="[&>button]:hidden sm:max-w-7xl max-h-[94vh] p-0 gap-0">
        <div className="flex h-[88vh]">
          {/* Left side: Email body */}
          <div className="flex-1 overflow-y-auto flex flex-col rounded-l-lg" style={{ backgroundColor: '#ffffff' }}>
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : noBody ? (
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="text-center space-y-3 text-muted-foreground">
                  <Mail className="h-10 w-10 mx-auto opacity-25" />
                  <p className="text-sm font-medium">No preview available</p>
                  <p className="text-xs opacity-70">The body for this email was not stored.</p>
                </div>
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
                  <div className="border-b px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground shrink-0">Subject:</span>
                      <span className="text-sm">{preview.subject}</span>
                    </div>
                  </div>
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
          <div className="w-[420px] p-6 flex flex-col gap-6 overflow-y-auto rounded-r-lg" style={{ backgroundColor: '#ffffff' }}>
            {/* Header */}
            <h3 className="text-lg font-semibold">Sent Email</h3>

            {/* Metadata */}
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Client
                </p>
                <button
                  className="text-sm font-medium hover:underline text-left flex items-center gap-1 group"
                  onClick={() => { onOpenChange(false); router.push(`/clients/${entry.client_id}`); }}
                >
                  {entry.client_name}
                  <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                </button>
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  To
                </p>
                <p className="text-sm font-medium">{entry.recipient_email}</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Date Sent
                </p>
                <p className="text-sm font-medium">
                  {format(new Date(entry.sent_at), 'dd MMM yyyy, HH:mm')}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Deadline Type
                </p>
                <p className="text-sm font-medium">{filingTypeLabel}</p>
              </div>

              {entry.deadline_date && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    Deadline Date
                  </p>
                  <p className="text-sm font-medium">
                    {format(new Date(entry.deadline_date), 'dd MMM yyyy')}
                  </p>
                </div>
              )}

              {entry.step_index != null && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    Step
                  </p>
                  <p className="text-sm font-medium">Step {entry.step_index + 1}</p>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Type
                </p>
                <div className={`px-3 py-2 rounded-md inline-flex items-center ${entry.send_type === 'ad-hoc' ? 'bg-violet-500/10' : 'bg-sky-500/10'}`}>
                  <span className={`text-sm font-medium ${entry.send_type === 'ad-hoc' ? 'text-violet-500' : 'text-sky-500'}`}>
                    {entry.send_type === 'ad-hoc' ? 'Ad-hoc' : 'Scheduled'}
                  </span>
                </div>
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
                <Separator orientation="vertical" className="h-8" />
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
