'use client';

import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Upload, Loader2, Trash2, Info, FlaskConical } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { IconButtonWithText } from '@/components/ui/icon-button-with-text';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { DocumentPreviewModal, type ClientDocument, type ValidationWarning } from '@/app/(dashboard)/clients/[id]/components/document-preview-modal';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TestResult {
  id: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  pageCount: number | null;
  documentTypeCode: string | null;
  documentTypeLabel: string | null;
  confidence: 'high' | 'medium' | 'low' | 'unclassified';
  extractedTaxYear: string | null;
  extractedEmployer: string | null;
  extractedPayeRef: string | null;
  extractionSource: 'ocr' | 'keyword' | 'rules';
  isImageOnly: boolean;
  isCorruptPdf: boolean;
  needsReview: boolean;
  validationWarnings: ValidationWarning[];
  wouldReject: boolean;
  hasRejectableWarning: boolean;
  rejectMismatchedEnabled: boolean;
  blobUrl: string;
  testedAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getVerdict(result: TestResult): { label: string; bg: string; text: string } {
  if (result.wouldReject) return { label: 'Rejected', bg: 'bg-red-500/10', text: 'text-red-600' };
  if (result.needsReview) return { label: 'Review needed', bg: 'bg-amber-500/10', text: 'text-amber-600' };
  if (result.confidence === 'low' || result.confidence === 'unclassified')
    return { label: 'Low confidence', bg: 'bg-red-500/10', text: 'text-red-600' };
  if (result.extractionSource === 'rules' && result.documentTypeCode !== null)
    return { label: 'Scanned PDF', bg: 'bg-amber-500/10', text: 'text-amber-600' };
  if (result.confidence === 'medium')
    return { label: 'Likely match', bg: 'bg-amber-500/10', text: 'text-amber-600' };
  return { label: 'Verified', bg: 'bg-green-500/10', text: 'text-green-600' };
}

function getRejectStatus(result: TestResult): { label: string; bg: string; text: string } {
  if (result.wouldReject) return { label: 'Yes — rejected', bg: 'bg-red-500/10', text: 'text-red-600' };
  if (result.hasRejectableWarning && !result.rejectMismatchedEnabled)
    return { label: 'Would reject if enabled', bg: 'bg-amber-500/10', text: 'text-amber-600' };
  return { label: 'No', bg: 'bg-muted/50', text: 'text-muted-foreground' };
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function toClientDocument(result: TestResult): ClientDocument {
  return {
    id: result.id,
    filing_type_id: 'test',
    document_type_id: null,
    original_filename: result.originalFilename,
    received_at: result.testedAt,
    classification_confidence: result.confidence,
    source: 'portal_upload',
    created_at: result.testedAt,
    retention_flagged: false,
    document_types: result.documentTypeLabel
      ? { id: 'test', code: result.documentTypeCode ?? 'UNKNOWN', label: result.documentTypeLabel }
      : null,
    extracted_tax_year: result.extractedTaxYear,
    extracted_employer: result.extractedEmployer,
    extracted_paye_ref: result.extractedPayeRef,
    extraction_source: result.extractionSource,
    page_count: result.pageCount,
    needs_review: result.needsReview,
    validation_warnings: result.validationWarnings.length > 0 ? result.validationWarnings : null,
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function UploadTestPage() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [uploading, setUploading] = useState(false);
  const [taxYear, setTaxYear] = useState('2025');
  const [previewResult, setPreviewResult] = useState<TestResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('taxYear', taxYear);

      const res = await fetch('/api/upload-test', { method: 'POST', body: formData });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Upload failed' }));
        toast.error(err.error ?? 'Upload failed');
        return;
      }

      const data = await res.json();
      const blobUrl = URL.createObjectURL(file);

      const result: TestResult = {
        id: crypto.randomUUID(),
        originalFilename: data.originalFilename,
        mimeType: data.mimeType ?? file.type,
        fileSizeBytes: data.fileSizeBytes,
        pageCount: data.pageCount,
        documentTypeCode: data.documentTypeCode,
        documentTypeLabel: data.documentTypeLabel,
        confidence: data.confidence,
        extractedTaxYear: data.extractedTaxYear,
        extractedEmployer: data.extractedEmployer,
        extractedPayeRef: data.extractedPayeRef,
        extractionSource: data.extractionSource,
        isImageOnly: data.isImageOnly,
        isCorruptPdf: data.isCorruptPdf,
        needsReview: data.needsReview,
        validationWarnings: data.validationWarnings ?? [],
        wouldReject: data.wouldReject ?? false,
        hasRejectableWarning: data.hasRejectableWarning ?? false,
        rejectMismatchedEnabled: data.rejectMismatchedEnabled ?? false,
        blobUrl,
        testedAt: new Date().toISOString(),
      };

      setResults(prev => [result, ...prev]);
      toast.success(`Analysed: ${data.documentTypeLabel ?? data.originalFilename}`);
    } catch {
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = '';
  };

  const handleClearAll = () => {
    for (const r of results) URL.revokeObjectURL(r.blobUrl);
    setResults([]);
    setPreviewResult(null);
  };

  const handleRemoveResult = (id: string) => {
    const result = results.find(r => r.id === id);
    if (result) URL.revokeObjectURL(result.blobUrl);
    setResults(prev => prev.filter(r => r.id !== id));
    if (previewResult?.id === id) setPreviewResult(null);
  };

  // Drag and drop
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/settings" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="space-y-1">
          <h1>Upload Check Sandbox</h1>
          <p className="text-muted-foreground">
            Test how Prompt classifies and validates documents — nothing is saved.
          </p>
        </div>
      </div>

      {/* Upload area */}
      <Card className="p-6 space-y-4">
        <div className="flex items-start gap-4 mb-2">
          <div className="flex items-center justify-center size-12 rounded-lg bg-violet-500/10 shrink-0">
            <FlaskConical className="size-6 text-violet-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Test a file</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Upload any document to see how Prompt would classify it, what metadata it extracts,
              and whether any validation warnings would fire. Files are processed in memory and
              not stored.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/10">
          <Info className="size-5 text-blue-600 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-600">
            <strong className="font-medium">What you&apos;re testing.</strong> The result shows exactly what
            would happen if a client uploaded this file through the portal &mdash; the classification
            verdict, extracted metadata, and any validation warnings. The Reject column shows whether
            a mismatched HMRC document would be blocked, and Auto-confirm shows whether the upload
            would be automatically marked as received.
          </p>
        </div>

        <div className="flex items-end gap-3">
          <div className="space-y-1">
            <label htmlFor="tax-year-input" className="text-sm font-medium">Expected tax year</label>
            <Input
              id="tax-year-input"
              value={taxYear}
              onChange={e => setTaxYear(e.target.value)}
              placeholder="e.g. 2024-25 or 2025"
              className="w-48"
            />
          </div>
        </div>

        {/* Drop zone */}
        <div
          className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
            dragOver
              ? 'border-violet-500 bg-violet-500/5'
              : 'border-muted-foreground/20 hover:border-muted-foreground/40'
          }`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.tiff,.tif,.doc,.docx,.xls,.xlsx,.csv"
            onChange={handleFileChange}
          />

          {uploading ? (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="size-8 animate-spin" />
              <p className="text-sm">Analysing document...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Upload className="size-8 text-muted-foreground/40" />
              <div>
                <button
                  type="button"
                  className="text-sm font-medium text-violet-600 hover:underline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choose a file
                </button>
                <span className="text-sm text-muted-foreground"> or drag and drop</span>
              </div>
              <p className="text-xs text-muted-foreground">
                PDF, images, Word, Excel, CSV — up to 20 MB
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Results table */}
      {results.length > 0 && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Results</h2>
            <IconButtonWithText variant="amber" onClick={handleClearAll}>
              <Trash2 className="size-4" />
              Clear all
            </IconButtonWithText>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><span className="text-sm font-semibold uppercase tracking-wide">Type</span></TableHead>
                <TableHead><span className="text-sm font-semibold uppercase tracking-wide">Filename</span></TableHead>
                <TableHead><span className="text-sm font-semibold uppercase tracking-wide">Size</span></TableHead>
                <TableHead><span className="text-sm font-semibold uppercase tracking-wide">Verdict</span></TableHead>
                <TableHead><span className="text-sm font-semibold uppercase tracking-wide">Reject?</span></TableHead>
                <TableHead><span className="text-sm font-semibold uppercase tracking-wide">Auto-confirm?</span></TableHead>
                <TableHead><span className="text-sm font-semibold uppercase tracking-wide">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map(result => {
                const verdict = getVerdict(result);
                const rejectStatus = getRejectStatus(result);
                // Would auto-confirm? Same logic as isDocReceived in document-card
                const wouldAutoConfirm =
                  !result.needsReview &&
                  !result.wouldReject &&
                  result.confidence === 'high';

                return (
                  <TableRow
                    key={result.id}
                    className="hover:bg-muted/30 cursor-pointer"
                    onClick={() => setPreviewResult(result)}
                  >
                    <TableCell>
                      <span className="text-sm font-medium">
                        {result.documentTypeLabel ?? <span className="text-muted-foreground italic">Unknown</span>}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm truncate block max-w-[240px]" title={result.originalFilename}>
                        {result.originalFilename}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span className="text-sm">{formatFileSize(result.fileSizeBytes)}</span>
                    </TableCell>
                    <TableCell>
                      <div className={`px-3 py-2 rounded-md inline-flex items-center ${verdict.bg}`}>
                        <span className={`text-sm font-medium ${verdict.text}`}>{verdict.label}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className={`px-3 py-2 rounded-md inline-flex items-center ${rejectStatus.bg}`}>
                        <span className={`text-sm font-medium ${rejectStatus.text}`}>{rejectStatus.label}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className={`px-3 py-2 rounded-md inline-flex items-center ${
                        wouldAutoConfirm
                          ? 'bg-green-500/10'
                          : 'bg-amber-500/10'
                      }`}>
                        <span className={`text-sm font-medium ${
                          wouldAutoConfirm
                            ? 'text-green-600'
                            : 'text-amber-600'
                        }`}>
                          {wouldAutoConfirm ? 'Yes' : 'No — manual'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <IconButtonWithText variant="amber" onClick={() => handleRemoveResult(result.id)}>
                        <Trash2 className="size-3" />
                      </IconButtonWithText>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Preview modal — reuses the real DocumentPreviewModal with blob URL */}
      <DocumentPreviewModal
        doc={previewResult ? toClientDocument(previewResult) : null}
        clientId=""
        onClose={() => setPreviewResult(null)}
        onDeleted={() => {
          if (previewResult) handleRemoveResult(previewResult.id);
          setPreviewResult(null);
        }}
        previewBlobUrl={previewResult?.blobUrl ?? null}
      />
    </div>
  );
}
