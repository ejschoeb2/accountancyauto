'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

interface ValidationWarning {
  code: string;
  message: string;
  expected?: string;
  found?: string;
}

interface UploadValidationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filename: string;
  clientName: string | null;
  documentTypeLabel: string | null;
  filingTypeLabel: string | null;
  receivedAt: string;
  warnings: ValidationWarning[];
}

export function UploadValidationModal({
  open,
  onOpenChange,
  filename,
  clientName,
  documentTypeLabel,
  filingTypeLabel,
  receivedAt,
  warnings,
}: UploadValidationModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-600 shrink-0" />
            Upload Validation Issues
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Upload summary */}
          <div className="space-y-2 rounded-xl border border-border p-4 bg-muted/30">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Upload Details
            </p>
            <dl className="space-y-1.5">
              <div className="flex gap-3">
                <dt className="text-xs text-muted-foreground w-28 shrink-0">File</dt>
                <dd className="text-xs font-mono text-foreground truncate" title={filename}>
                  {filename}
                </dd>
              </div>
              {clientName && (
                <div className="flex gap-3">
                  <dt className="text-xs text-muted-foreground w-28 shrink-0">Client</dt>
                  <dd className="text-xs text-foreground">{clientName}</dd>
                </div>
              )}
              {filingTypeLabel && (
                <div className="flex gap-3">
                  <dt className="text-xs text-muted-foreground w-28 shrink-0">Filing type</dt>
                  <dd className="text-xs text-foreground">{filingTypeLabel}</dd>
                </div>
              )}
              {documentTypeLabel && (
                <div className="flex gap-3">
                  <dt className="text-xs text-muted-foreground w-28 shrink-0">Document type</dt>
                  <dd className="text-xs text-foreground">{documentTypeLabel}</dd>
                </div>
              )}
              <div className="flex gap-3">
                <dt className="text-xs text-muted-foreground w-28 shrink-0">Received</dt>
                <dd className="text-xs text-foreground">
                  {format(new Date(receivedAt), 'd MMM yyyy, HH:mm')}
                </dd>
              </div>
            </dl>
          </div>

          {/* Validation warnings */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Issues ({warnings.length})
            </p>
            <div className="space-y-3">
              {warnings.map((warning, i) => (
                <div
                  key={i}
                  className="rounded-xl bg-amber-500/10 p-4 space-y-2"
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="size-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-700 leading-snug">{warning.message}</p>
                  </div>
                  {(warning.expected !== undefined || warning.found !== undefined) && (
                    <dl className="ml-5 space-y-1">
                      {warning.expected !== undefined && (
                        <div className="flex gap-3">
                          <dt className="text-xs text-amber-600/70 w-16 shrink-0">Expected</dt>
                          <dd className="text-xs font-mono text-amber-700">{warning.expected}</dd>
                        </div>
                      )}
                      {warning.found !== undefined && (
                        <div className="flex gap-3">
                          <dt className="text-xs text-amber-600/70 w-16 shrink-0">Found</dt>
                          <dd className="text-xs font-mono text-amber-700">{warning.found}</dd>
                        </div>
                      )}
                    </dl>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end pt-1">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
