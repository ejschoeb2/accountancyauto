'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { ButtonBase } from '@/components/ui/button-base';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Mail,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import { format } from 'date-fns';
import { getInboundCheckerMode, type InboundCheckerMode } from '@/app/actions/settings';
import type { InboundEmail } from '@/app/actions/inbound-emails';

const FILING_TYPE_LABELS: Record<string, string> = {
  corporation_tax_payment: 'Corp Tax',
  ct600_filing: 'CT600',
  companies_house: 'Companies House',
  vat_return: 'VAT Return',
  self_assessment: 'Self Assessment',
};

interface InboundEmailDetailModalProps {
  open: boolean;
  onClose: () => void;
  email: InboundEmail | null;
  emails: InboundEmail[];
  onNavigate?: (direction: 'prev' | 'next') => void;
  onMarkAsRead?: (emailId: string) => void;
  onUpdateRecordsReceived?: (emailId: string, clientId: string, filingTypeId: string) => void;
}

export function InboundEmailDetailModal({
  open,
  onClose,
  email,
  emails,
  onNavigate,
  onMarkAsRead,
  onUpdateRecordsReceived,
}: InboundEmailDetailModalProps) {
  const router = useRouter();
  const [checkerMode, setCheckerMode] = useState<InboundCheckerMode>('auto');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    getInboundCheckerMode().then(setCheckerMode);
  }, []);

  // Mark as read when opened
  useEffect(() => {
    if (email && !email.read && onMarkAsRead) {
      onMarkAsRead(email.id);
    }
  }, [email?.id]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onNavigate?.('prev');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onNavigate?.('next');
      }
    },
    [open, onNavigate]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleApprove = async () => {
    if (!email || !email.client_id || !email.filing_type_id) return;
    setIsUpdating(true);
    try {
      await onUpdateRecordsReceived?.(email.id, email.client_id, email.filing_type_id);
      onClose();
    } catch (error) {
      console.error('Failed to update records received:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  if (!email) return null;

  const currentIndex = emails.findIndex((e) => e.id === email.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < emails.length - 1;

  const filingTypeLabel = email.filing_type_id
    ? (FILING_TYPE_LABELS[email.filing_type_id] ?? email.filing_type_name)
    : null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="[&>button]:hidden sm:max-w-7xl max-h-[90vh] p-0 gap-0">
        <div className="flex h-[80vh]">
          {/* Left side: Email body */}
          <div className="flex-1 overflow-y-auto flex flex-col">
            {email.email_body ? (
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="w-full max-w-2xl border rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-lg hover:border-primary/20 transition-all duration-300">
                  <div className="border-b px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground shrink-0">Subject:</span>
                      <span className="text-sm">{email.email_subject || '(No subject)'}</span>
                    </div>
                  </div>
                  <div className="p-4">
                    <pre className="whitespace-pre-wrap font-sans text-sm text-foreground leading-relaxed">
                      {email.email_body}
                    </pre>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="text-center space-y-3 text-muted-foreground">
                  <Mail className="h-10 w-10 mx-auto opacity-25" />
                  <p className="text-sm font-medium">No preview available</p>
                  <p className="text-xs opacity-70">No email body was stored for this message.</p>
                </div>
              </div>
            )}
          </div>

          {/* Right side: Metadata sidebar */}
          <div className="w-[420px] p-6 flex flex-col gap-6 overflow-y-auto border-l">
            {/* Header */}
            <h3 className="text-lg font-semibold">Inbound Email</h3>

            {/* Metadata */}
            <div className="space-y-4">
              {email.client_id && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    Client
                  </p>
                  <button
                    className="text-sm font-medium hover:underline text-left flex items-center gap-1 group"
                    onClick={() => { onClose(); router.push(`/clients/${email.client_id}`); }}
                  >
                    {email.client_name}
                    <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                  </button>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  From
                </p>
                <p className="text-sm font-medium">{email.email_from}</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Date Received
                </p>
                <p className="text-sm font-medium">
                  {format(new Date(email.received_at), 'dd MMM yyyy, HH:mm')}
                </p>
              </div>

              {filingTypeLabel && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    Deadline Type
                  </p>
                  <p className="text-sm font-medium">{filingTypeLabel}</p>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Read
                </p>
                <div className={`px-3 py-2 rounded-md inline-flex items-center ${email.read ? 'bg-status-neutral/10' : 'bg-blue-500/10'}`}>
                  <span className={`text-sm font-medium ${email.read ? 'text-status-neutral' : 'text-blue-500'}`}>
                    {email.read ? 'Read' : 'Unread'}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Records Received
                </p>
                <div className={`px-3 py-2 rounded-md inline-flex items-center ${email.records_received_detected ? 'bg-green-500/10' : 'bg-status-neutral/10'}`}>
                  <span className={`text-sm font-medium ${email.records_received_detected ? 'text-green-600' : 'text-status-neutral'}`}>
                    {email.records_received_detected ? 'Detected' : 'Not Detected'}
                  </span>
                </div>
              </div>

              {email.records_received_detected && checkerMode === 'recommend' && email.client_id && email.filing_type_id && (
                <div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Recommendation mode is enabled. Approve below to mark records received for this client.
                  </p>
                  <ButtonBase
                    onClick={handleApprove}
                    disabled={isUpdating}
                    buttonType="icon-text"
                    variant="green"
                    className="w-full"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {isUpdating ? 'Updating...' : 'Mark Records Received'}
                  </ButtonBase>
                </div>
              )}

              {email.records_received_detected && checkerMode === 'auto' && (
                <div className="px-3 py-2 rounded-md inline-flex items-center bg-green-500/10">
                  <span className="text-sm font-medium text-green-600">Auto-updated</span>
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="mt-auto pt-4">
              <div className="flex gap-2">
                <ButtonBase
                  variant="blue"
                  buttonType="icon-text"
                  onClick={() => onNavigate?.('prev')}
                  disabled={!hasPrev}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </ButtonBase>
                <ButtonBase
                  variant="blue"
                  buttonType="icon-text"
                  onClick={() => onNavigate?.('next')}
                  disabled={!hasNext}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </ButtonBase>
                <ButtonBase
                  variant="destructive"
                  buttonType="icon-text"
                  onClick={onClose}
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
