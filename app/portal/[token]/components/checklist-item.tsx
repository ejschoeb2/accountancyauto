'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import type { ChecklistItem as ChecklistItemType } from '../page';

interface UploadedFile {
  filename: string;
  confidence: string;
}

interface ChecklistItemProps {
  item: ChecklistItemType;
  uploaded: UploadedFile[];
  onUpload: (file: File) => Promise<void>;
}

export function ChecklistItem({ item, uploaded, onUpload }: ChecklistItemProps) {
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
    disabled: uploading,
  });

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 truncate">{label}</span>
            {item.is_mandatory && (
              <span className="text-xs text-red-500 font-medium shrink-0">Required</span>
            )}
          </div>
          {/* Uploaded files list */}
          {uploaded.length > 0 && (
            <div className="mt-2 space-y-1">
              {uploaded.map((u, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-xs text-gray-700 truncate">{u.filename}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upload area */}
        <div className="shrink-0">
          {uploading ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-50 border border-violet-200">
              <svg className="w-4 h-4 text-violet-500 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-xs text-violet-600">Uploading...</span>
            </div>
          ) : (
            <div
              {...getRootProps()}
              className={`cursor-pointer px-3 py-2 rounded-lg border-2 border-dashed text-xs font-medium transition-colors ${
                isDragActive
                  ? 'border-violet-400 bg-violet-50 text-violet-600'
                  : isUploaded
                  ? 'border-green-300 bg-green-50 text-green-700 hover:border-green-400'
                  : 'border-gray-300 bg-gray-50 text-gray-600 hover:border-violet-400 hover:bg-violet-50 hover:text-violet-600'
              }`}
            >
              <input {...getInputProps()} />
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {isDragActive ? 'Drop here' : isUploaded ? 'Replace' : 'Upload'}
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
