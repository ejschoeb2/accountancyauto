'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { AlertTriangle, CheckCircle, Loader2, Upload, XCircle, Ban } from 'lucide-react';
import type { ChecklistItem as ChecklistItemType } from '../page';
import { ExtractionConfirmationCard } from './upload-confirmation-card';
import { ValidationWarningCard } from './validation-warning-card';

interface ValidationWarning {
  code: string;
  message: string;
  expected?: string;
  found?: string;
}

interface UploadedFile {
  filename: string;
  confidence: string;
  // Phase 22 additions:
  documentTypeLabel: string | null;
  extractedTaxYear: string | null;
  extractedEmployer: string | null;
  extractedPayeRef: string | null;
  showConfirmationCard: boolean;
  // Phase 30: validation warnings (empty array = no issues)
  validationWarnings: ValidationWarning[];
}

interface ExistingDoc {
  filename: string;
  rejected: boolean;
}

interface ChecklistItemProps {
  item: ChecklistItemType;
  uploaded: UploadedFile[];
  existingDocs: ExistingDoc[];
  onUpload: (file: File) => Promise<void>;
  disabled?: boolean;
  duplicateWarning?: string;
  onConfirmDuplicate?: () => void;
  onDismissDuplicate?: () => void;
}

export function ChecklistItem({
  item,
  uploaded,
  existingDocs,
  onUpload,
  disabled,
  duplicateWarning,
  onConfirmDuplicate,
  onDismissDuplicate,
}: ChecklistItemProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = item.document_types?.label ?? 'Document';
  const hasSessionUpload = uploaded.length > 0;
  const hasExistingNonRejected = existingDocs.some(d => !d.rejected);
  const isUploaded = hasSessionUpload || hasExistingNonRejected;
  const hasRejected = existingDocs.some(d => d.rejected);

  // Build accept map from expected_mime_types
  const expectedMimes = item.document_types?.expected_mime_types ?? [];
  const accept = expectedMimes.length > 0
    ? Object.fromEntries(expectedMimes.map(m => [m, []]))
    : { 'application/pdf': [], 'image/*': [] };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    const file = acceptedFiles[0];
    setError(null);
    setUploading(true);
    try {
      await onUpload(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxFiles: 1,
    disabled: uploading || !!disabled,
  });

  return (
    <div className="bg-white rounded-xl border shadow-sm hover:shadow-lg hover:border-primary/20 transition-all duration-300 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{label}</span>
          </div>

          {/* Existing documents from previous sessions */}
          {existingDocs.length > 0 && (
            <div className="mt-2 space-y-1">
              {existingDocs.map((d, i) => (
                <div key={`existing-${i}`} className="flex items-center gap-1.5">
                  {d.rejected ? (
                    <>
                      <Ban className="size-4 text-red-500 shrink-0" />
                      <span className="text-xs text-red-500 truncate">{d.filename}</span>
                      <span className="text-[10px] font-medium text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded-full shrink-0">Rejected</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="size-4 text-green-600 shrink-0" />
                      <span className="text-xs text-muted-foreground truncate">{d.filename}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Uploaded files from this session */}
          {uploaded.length > 0 && (
            <div className="mt-2 space-y-1">
              {uploaded.map((u, i) => (
                <div key={`session-${i}`} className="flex items-center gap-1.5">
                  <CheckCircle className="size-4 text-green-600 shrink-0" />
                  <span className="text-xs text-muted-foreground truncate">{u.filename}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upload dropzone */}
        <div className="shrink-0">
          {uploading ? (
            <div className="h-10 px-4 rounded-md inline-flex items-center gap-2 text-sm font-medium bg-violet-500/10 text-violet-500">
              <Loader2 className="size-4 animate-spin" />
              Uploading...
            </div>
          ) : (
            <div
              {...getRootProps()}
              className={`h-10 px-4 rounded-md inline-flex items-center gap-2 text-sm font-medium transition-all duration-200 active:scale-[0.97] ${
                disabled
                  ? 'opacity-50 cursor-not-allowed bg-muted/50 text-muted-foreground'
                  : isDragActive
                  ? 'cursor-pointer bg-sky-500/20 text-sky-700'
                  : isUploaded
                  ? 'cursor-pointer bg-green-500/10 text-green-700 hover:bg-green-500/20'
                  : hasRejected
                  ? 'cursor-pointer bg-red-500/10 text-red-600 hover:bg-red-500/20'
                  : 'cursor-pointer bg-sky-500/10 text-sky-600 hover:bg-sky-500/20'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="size-4" />
              {isDragActive ? 'Drop here' : isUploaded ? 'Replace' : hasRejected ? 'Re-upload' : 'Upload'}
            </div>
          )}
        </div>
      </div>

      {/* Full-width alerts — below the name + button row */}

      {/* Rejection notice — only show if there are rejected docs and no accepted replacement */}
      {hasRejected && !hasExistingNonRejected && !hasSessionUpload && (
        <div className="mt-3 flex items-start gap-3 p-4 bg-red-500/10 rounded-xl">
          <Ban className="size-5 text-red-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-red-500">Document rejected</p>
            <p className="text-xs text-red-500/80">Your accountant has rejected the uploaded document. Please upload a replacement.</p>
          </div>
        </div>
      )}

      {/* Duplicate warning */}
      {duplicateWarning && (
        <div className="mt-3 flex items-start gap-3 p-4 bg-amber-500/10 rounded-xl">
          <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-2 flex-1 min-w-0">
            <div className="space-y-1">
              <p className="text-sm font-medium text-amber-600">Duplicate file detected</p>
              <p className="text-xs text-amber-600/80 truncate">{duplicateWarning}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="text-xs font-medium px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-700 hover:bg-amber-500/30 transition-colors active:scale-[0.97]"
                onClick={onConfirmDuplicate}
              >
                Upload anyway
              </button>
              <button
                type="button"
                className="text-xs font-medium text-amber-600/80 hover:text-amber-700 transition-colors"
                onClick={onDismissDuplicate}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Validation warnings / confirmation cards — one per uploaded file */}
      {uploaded.map((u, i) =>
        u.validationWarnings.length > 0 ? (
          <ValidationWarningCard key={i} warnings={u.validationWarnings} />
        ) : u.showConfirmationCard ? (
          <ExtractionConfirmationCard
            key={i}
            documentTypeLabel={u.documentTypeLabel ?? 'Document'}
            extractedTaxYear={u.extractedTaxYear}
            extractedEmployer={u.extractedEmployer}
            extractedPayeRef={u.extractedPayeRef}
          />
        ) : null
      )}

      {/* Error */}
      {error && (
        <div className="mt-3 flex items-center gap-3 p-4 bg-red-500/10 rounded-xl">
          <XCircle className="size-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}
    </div>
  );
}
