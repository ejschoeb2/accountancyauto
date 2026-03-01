'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { AlertTriangle, CheckCircle, Loader2, Upload, XCircle } from 'lucide-react';
import type { ChecklistItem as ChecklistItemType } from '../page';
import { ExtractionConfirmationCard } from './upload-confirmation-card';

interface UploadedFile {
  filename: string;
  confidence: string;
  // Phase 22 additions:
  documentTypeLabel: string | null;
  extractedTaxYear: string | null;
  extractedEmployer: string | null;
  extractedPayeRef: string | null;
  showConfirmationCard: boolean;
}

interface ChecklistItemProps {
  item: ChecklistItemType;
  uploaded: UploadedFile[];
  onUpload: (file: File) => Promise<void>;
  disabled?: boolean;
  duplicateWarning?: string;
  onConfirmDuplicate?: () => void;
  onDismissDuplicate?: () => void;
}

export function ChecklistItem({
  item,
  uploaded,
  onUpload,
  disabled,
  duplicateWarning,
  onConfirmDuplicate,
  onDismissDuplicate,
}: ChecklistItemProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = item.document_types?.label ?? 'Document';
  const isUploaded = uploaded.length > 0;

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
    <div className="bg-background rounded-xl border p-4 transition-all duration-200 hover:border-primary/20 hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{label}</span>
            {item.is_mandatory && (
              <div className="px-2 py-0.5 rounded-md inline-flex items-center bg-red-500/10 shrink-0">
                <span className="text-xs font-medium text-red-500">Required</span>
              </div>
            )}
          </div>

          {/* Uploaded files list */}
          {uploaded.length > 0 && (
            <div className="mt-2 space-y-1">
              {uploaded.map((u, i) => (
                <div key={i}>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle className="size-4 text-green-600 shrink-0" />
                    <span className="text-xs text-muted-foreground truncate">{u.filename}</span>
                  </div>
                  {u.showConfirmationCard && (
                    <ExtractionConfirmationCard
                      documentTypeLabel={u.documentTypeLabel ?? 'Document'}
                      extractedTaxYear={u.extractedTaxYear}
                      extractedEmployer={u.extractedEmployer}
                      extractedPayeRef={u.extractedPayeRef}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Duplicate warning — Alert Box amber */}
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
        </div>

        {/* Upload dropzone */}
        <div className="shrink-0">
          {uploading ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-500/10">
              <Loader2 className="size-4 text-violet-500 animate-spin" />
              <span className="text-xs text-violet-500 font-medium">Uploading...</span>
            </div>
          ) : (
            <div
              {...getRootProps()}
              className={`cursor-pointer px-3 py-2 rounded-lg border-2 border-dashed text-xs font-medium transition-all duration-200 ${
                disabled
                  ? 'border-muted-foreground/20 bg-muted/50 text-muted-foreground/50 cursor-not-allowed'
                  : isDragActive
                  ? 'border-violet-400 bg-violet-500/10 text-violet-600'
                  : isUploaded
                  ? 'border-green-300 bg-green-500/10 text-green-700 hover:border-green-400'
                  : 'border-border bg-muted/50 text-muted-foreground hover:border-violet-400 hover:bg-violet-500/10 hover:text-violet-600'
              }`}
            >
              <input {...getInputProps()} />
              <div className="flex items-center gap-1.5">
                <Upload className="size-4" />
                {isDragActive ? 'Drop here' : isUploaded ? 'Replace' : 'Upload'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error — Alert Box red */}
      {error && (
        <div className="mt-3 flex items-center gap-3 p-4 bg-red-500/10 rounded-xl">
          <XCircle className="size-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}
    </div>
  );
}
