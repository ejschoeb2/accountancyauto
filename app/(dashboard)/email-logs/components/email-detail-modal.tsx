'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ButtonBase } from '@/components/ui/button-base';
import { IconButtonWithText } from '@/components/ui/icon-button-with-text';
import { EmailPreview } from './email-preview';
import type { InboundEmail } from '@/app/actions/inbound-emails';
import type { InboundCheckerMode } from '@/app/actions/settings';
import {
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmailDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: InboundEmail | null;
  allEmails: InboundEmail[];
  mode: InboundCheckerMode;
  onNavigate: (direction: 'prev' | 'next') => void;
}

const FILING_TYPE_LABELS: Record<string, string> = {
  corporation_tax_payment: "Corp Tax",
  ct600_filing: "CT600",
  companies_house: "Companies House",
  vat_return: "VAT Return",
  self_assessment: "Self Assessment",
};

export function EmailDetailModal({
  open,
  onOpenChange,
  email,
  allEmails,
  mode,
  onNavigate,
}: EmailDetailModalProps) {
  const [markingAsRead, setMarkingAsRead] = useState(false);
  const [updatingRecords, setUpdatingRecords] = useState(false);

  // Mark as read when opened
  useEffect(() => {
    if (open && email && !email.read) {
      handleMarkAsRead();
    }
  }, [open, email?.id]);

  const handleMarkAsRead = async () => {
    if (!email || email.read) return;

    setMarkingAsRead(true);
    try {
      // TODO: Create server action to mark email as read
      console.log('Marking email as read:', email.id);
      // await markInboundEmailAsRead(email.id);
    } catch (error) {
      console.error('Error marking email as read:', error);
    } finally {
      setMarkingAsRead(false);
    }
  };

  const handleMarkRecordsReceived = async () => {
    if (!email) return;

    setUpdatingRecords(true);
    try {
      // TODO: Create server action to mark records as received
      console.log('Marking records as received for email:', email.id);
      // await updateRecordsReceived({ emailId: email.id, detected: true });
    } catch (error) {
      console.error('Error updating records received:', error);
    } finally {
      setUpdatingRecords(false);
    }
  };

  if (!email) return null;

  const currentIndex = allEmails.findIndex((e) => e.id === email.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < allEmails.length - 1;

  const filingTypeLabel = email.filing_type_id
    ? FILING_TYPE_LABELS[email.filing_type_id] || email.filing_type_name
    : 'Unknown';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] p-0 gap-0">
        <div className="flex h-full">
          {/* Left side: Email preview */}
          <div className="flex-1 p-6 overflow-y-auto border-r">
            <EmailPreview
              subject={email.email_subject}
              body={email.email_body}
              from={email.email_from}
              receivedAt={email.received_at}
            />
          </div>

          {/* Right side: Controls */}
          <div className="w-80 p-6 flex flex-col gap-6">
            {/* Close button */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Email Details</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Client info */}
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Client
                </p>
                <p className="text-sm font-medium">
                  {email.client_name || <span className="italic text-muted-foreground">Unknown</span>}
                </p>
                {email.client_type && (
                  <p className="text-xs text-muted-foreground">{email.client_type}</p>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Deadline Type
                </p>
                <p className="text-sm font-medium">{filingTypeLabel}</p>
              </div>
            </div>

            {/* Records received status */}
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Records Received Status
                </p>
                {email.records_received_detected ? (
                  <div className="flex items-center gap-2 p-3 rounded-md bg-green-500/10">
                    <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-green-600">Detected</p>
                      {mode === 'auto' && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Status updated automatically
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-3 rounded-md bg-muted">
                    <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0" />
                    <p className="text-sm text-muted-foreground">Not detected</p>
                  </div>
                )}
              </div>

              {/* Manual update button (only show if not already detected and in recommend mode) */}
              {!email.records_received_detected && mode === 'recommend' && (
                <IconButtonWithText
                  variant="green"
                  onClick={handleMarkRecordsReceived}
                  disabled={updatingRecords}
                >
                  <CheckCircle className="h-5 w-5" />
                  Mark Records Received
                </IconButtonWithText>
              )}

              {/* Info message based on mode */}
              {mode === 'auto' && !email.records_received_detected && (
                <p className="text-xs text-muted-foreground">
                  This email did not contain keywords indicating records were sent. If records were actually received, please update the client manually.
                </p>
              )}
              {mode === 'recommend' && email.records_received_detected && (
                <p className="text-xs text-muted-foreground">
                  The system detected records in this email. Update the client status manually from the client page.
                </p>
              )}
            </div>

            {/* Navigation */}
            <div className="mt-auto pt-6 border-t space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Navigation
              </p>
              <div className="flex gap-2">
                <ButtonBase
                  variant="muted"
                  buttonType="icon-text"
                  onClick={() => onNavigate('prev')}
                  disabled={!hasPrev}
                  className="flex-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </ButtonBase>
                <ButtonBase
                  variant="muted"
                  buttonType="icon-text"
                  onClick={() => onNavigate('next')}
                  disabled={!hasNext}
                  className="flex-1"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </ButtonBase>
              </div>
              <p className="text-xs text-center text-muted-foreground">
                {currentIndex + 1} of {allEmails.length}
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
