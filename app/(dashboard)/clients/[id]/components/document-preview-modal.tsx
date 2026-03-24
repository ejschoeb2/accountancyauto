'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { IconButtonWithText } from '@/components/ui/icon-button-with-text';
import { Download, Trash2, Loader2, AlertTriangle, AlertCircle, FileX, X, CheckCircle, Info, ChevronLeft, ChevronRight } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import type { LucideIcon } from 'lucide-react';

// ---------------------------------------------------------------------------
// Shared types — imported by document-card.tsx to avoid circular deps
// ---------------------------------------------------------------------------

export interface ValidationWarning {
  code: string;
  message: string;
  expected?: string;
  found?: string;
}

export interface ClientDocument {
  id: string;
  filing_type_id: string;
  document_type_id: string | null;
  original_filename: string;
  received_at: string | null;
  classification_confidence: 'high' | 'medium' | 'low' | 'unclassified';
  source: 'portal_upload' | 'manual';
  created_at: string;
  retention_flagged: boolean;
  document_types: { id: string; code: string; label: string } | null;
  extracted_tax_year: string | null;
  extracted_employer: string | null;
  extracted_paye_ref: string | null;
  extraction_source: 'ocr' | 'keyword' | 'rules' | 'manual' | null;
  page_count: number | null;
  needs_review: boolean;
  validation_warnings: ValidationWarning[] | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function inferMimeType(filename: string): string | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf': return 'application/pdf';
    case 'jpg': case 'jpeg': return 'image/jpeg';
    case 'png': return 'image/png';
    case 'tiff': case 'tif': return 'image/tiff';
    default: return null;
  }
}

interface Assessment {
  Icon: LucideIcon;
  iconClass: string;
  alertBg: string;
  alertText: string;
  alertTextMuted: string;
  title: string;
  detail: string;
}

function getAssessment(doc: ClientDocument & { needs_review: boolean }): Assessment {
  if (doc.needs_review) return {
    Icon: AlertTriangle,
    iconClass: 'text-amber-600',
    alertBg: 'bg-amber-500/10',
    alertText: 'text-amber-700',
    alertTextMuted: 'text-amber-600/80',
    title: 'Flagged for review',
    detail: 'Validation checks found potential issues with this document. Review the warnings below before marking as received.',
  };
  if (doc.classification_confidence === 'low' || doc.classification_confidence === 'unclassified') return {
    Icon: AlertTriangle,
    iconClass: 'text-red-600',
    alertBg: 'bg-red-500/10',
    alertText: 'text-red-700',
    alertTextMuted: 'text-red-600/80',
    title: 'Classification uncertain',
    detail: 'The document type could not be reliably determined. Verify it is correct before marking as received.',
  };
  if (doc.extraction_source === 'rules' && doc.document_type_id !== null) return {
    Icon: AlertCircle,
    iconClass: 'text-amber-600',
    alertBg: 'bg-amber-500/10',
    alertText: 'text-amber-700',
    alertTextMuted: 'text-amber-600/80',
    title: 'Scanned document',
    detail: 'Text was extracted via OCR from a scanned PDF. Classification accuracy may be lower than for digital documents.',
  };
  if (doc.source === 'manual') return {
    Icon: Info,
    iconClass: 'text-blue-500',
    alertBg: 'bg-blue-500/10',
    alertText: 'text-blue-600',
    alertTextMuted: 'text-blue-500/80',
    title: 'Manually added',
    detail: 'Uploaded directly by the accountant. No automatic classification was applied.',
  };
  if (doc.classification_confidence === 'medium') return {
    Icon: AlertCircle,
    iconClass: 'text-amber-600',
    alertBg: 'bg-amber-500/10',
    alertText: 'text-amber-700',
    alertTextMuted: 'text-amber-600/80',
    title: 'Classification unconfirmed',
    detail: 'Document type appears correct but confidence is moderate. Review the extracted details to confirm.',
  };
  return {
    Icon: CheckCircle,
    iconClass: 'text-green-600',
    alertBg: 'bg-green-500/10',
    alertText: 'text-green-700',
    alertTextMuted: 'text-green-600/80',
    title: 'Successfully classified',
    detail: 'Document type identified with high confidence and passed all checks.',
  };
}

interface EditableFieldProps {
  value: string | null;
  placeholder: string;
  onSave: (val: string | null) => Promise<void>;
  saving?: boolean;
}

function EditableField({ value, placeholder, onSave, saving }: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');

  useEffect(() => {
    if (!editing) setDraft(value ?? '');
  }, [value, editing]);

  const handleSave = async () => {
    setEditing(false);
    const newVal = draft.trim() || null;
    if (newVal !== value) await onSave(newVal);
  };

  if (saving) return <span className="text-xs text-muted-foreground italic">Saving...</span>;

  if (editing) {
    return (
      <Input
        className="h-7 min-w-[110px] text-xs px-2"
        value={draft}
        autoFocus
        onChange={e => setDraft(e.target.value)}
        onBlur={handleSave}
        onKeyDown={e => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') { setEditing(false); setDraft(value ?? ''); }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      className="text-xs text-left hover:underline hover:text-violet-600 cursor-text"
      onClick={() => setEditing(true)}
      title="Click to edit"
    >
      {value ?? <span className="text-muted-foreground italic">{placeholder}</span>}
    </button>
  );
}

// ---------------------------------------------------------------------------
// DocumentPreviewModal
// ---------------------------------------------------------------------------

export interface DocumentPreviewModalProps {
  doc: ClientDocument | null;
  clientId: string;
  onClose: () => void;
  onDeleted: (docId: string) => void;
  /** Uploads-page extras: show client name heading + prev/next navigation */
  clientName?: string | null;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  /** When provided, skip server fetch and use this blob URL directly for preview */
  previewBlobUrl?: string | null;
  /** Called after the document is marked as received so parent can refresh */
  onMarkedReceived?: (docId: string) => void;
}

export function DocumentPreviewModal({ doc, clientId, onClose, onDeleted, clientName, onPrevious, onNext, hasPrevious, hasNext, previewBlobUrl, onMarkedReceived }: DocumentPreviewModalProps) {
  const isUploadsMode = !!onPrevious || !!onNext;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [fileNotFound, setFileNotFound] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [savingField, setSavingField] = useState(false);
  const [clearingReview, startClearTransition] = useTransition();
  const [markingReceived, setMarkingReceived] = useState(false);
  const [isReceived, setIsReceived] = useState(false);
  const blobUrlRef = useRef<string | null>(null);

  const [extractedTaxYear, setExtractedTaxYear] = useState<string | null>(null);
  const [extractedEmployer, setExtractedEmployer] = useState<string | null>(null);
  const [extractedPayeRef, setExtractedPayeRef] = useState<string | null>(null);
  const [needsReview, setNeedsReview] = useState(false);
  const [validationWarnings, setValidationWarnings] = useState<ValidationWarning[] | null>(null);

  const supabase = createClient();

  // Sync metadata state when doc changes
  useEffect(() => {
    if (!doc) return;
    setExtractedTaxYear(doc.extracted_tax_year);
    setExtractedEmployer(doc.extracted_employer);
    setExtractedPayeRef(doc.extracted_paye_ref);
    setNeedsReview(doc.needs_review);
    setValidationWarnings(doc.validation_warnings);
    setIsReceived(false);
  }, [doc?.id]);

  // Check if this document's type is already marked as received
  useEffect(() => {
    if (!doc || !doc.document_type_id || !clientId) { setIsReceived(false); return; }
    supabase
      .from('client_document_checklist_customisations')
      .select('manually_received')
      .eq('client_id', clientId)
      .eq('filing_type_id', doc.filing_type_id)
      .eq('document_type_id', doc.document_type_id)
      .maybeSingle()
      .then(({ data }) => {
        setIsReceived(data?.manually_received ?? false);
      });
  }, [doc?.id, clientId]);

  // Fetch preview URL/bytes when doc changes
  useEffect(() => {
    if (!doc) { setPreviewUrl(null); setPreviewError(false); setFileNotFound(false); return; }

    // When a blob URL is provided externally (e.g. upload test page), use it directly
    if (previewBlobUrl) {
      setPreviewUrl(previewBlobUrl);
      setPreviewError(false);
      setFileNotFound(false);
      setLoadingPreview(false);
      return;
    }

    const mime = inferMimeType(doc.original_filename);
    if (!mime) { setPreviewUrl(null); setPreviewError(false); setFileNotFound(false); return; }

    // Need a valid clientId to fetch — skip if not yet set
    if (!clientId) { setPreviewUrl(null); setPreviewError(false); setFileNotFound(false); return; }

    // Revoke previous blob URL
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setPreviewUrl(null);
    setPreviewError(false);
    setFileNotFound(false);
    setLoadingPreview(true);

    fetch(`/api/clients/${clientId}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'download', documentId: doc.id }),
    })
      .then(async (res) => {
        if (!res.ok) {
          // 404 = file doesn't exist in storage (e.g. demo/seed data)
          if (res.status === 404) { setFileNotFound(true); return; }
          throw new Error('Failed to load');
        }
        const contentType = res.headers.get('content-type') ?? '';
        if (contentType.includes('application/json')) {
          const json = (await res.json()) as { signedUrl?: string; error?: string };
          if (!json.signedUrl) { setFileNotFound(true); return; }
          // Supabase / OneDrive / Dropbox — signed/temp URL
          // Re-fetch as blob to avoid CORS issues with <object> embeds
          const blobRes = await fetch(json.signedUrl);
          if (!blobRes.ok) throw new Error('Failed to load');
          const blob = await blobRes.blob();
          const url = URL.createObjectURL(blob);
          blobUrlRef.current = url;
          setPreviewUrl(url);
        } else {
          // Google Drive — proxied bytes; build a blob URL
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          blobUrlRef.current = url;
          setPreviewUrl(url);
        }
      })
      .catch(() => { setFileNotFound(true); })
      .finally(() => setLoadingPreview(false));
  }, [doc?.id, clientId, previewBlobUrl]);

  // Revoke blob URL on unmount
  useEffect(() => () => { if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current); }, []);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleDownload = async () => {
    if (!doc) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'download', documentId: doc.id }),
      });
      if (!res.ok) { toast.error('Failed to download'); return; }
      const contentType = res.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        const { signedUrl } = (await res.json()) as { signedUrl: string };
        window.open(signedUrl, '_blank');
      } else {
        const blob = await res.blob();
        const disposition = res.headers.get('content-disposition') ?? '';
        const filenameMatch = disposition.match(/filename="(.+?)"/);
        const filename = filenameMatch?.[1] ?? doc.original_filename;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
      }
    } catch { toast.error('Failed to download'); }
    finally { setDownloading(false); }
  };

  const handleReject = async () => {
    if (!doc) return;
    if (!confirm('Delete this document? This cannot be undone.')) return;
    setRejecting(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', documentId: doc.id }),
      });
      if (!res.ok) { toast.error('Failed to delete'); return; }
      toast.success('Document deleted');
      onDeleted(doc.id);
      onClose();
    } catch { toast.error('Failed to delete'); }
    finally { setRejecting(false); }
  };

  const handleSaveField = async (
    field: 'extracted_tax_year' | 'extracted_employer' | 'extracted_paye_ref',
    value: string | null,
  ) => {
    if (!doc) return;
    setSavingField(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-extraction', documentId: doc.id, field, value }),
      });
      if (!res.ok) { toast.error('Failed to save'); return; }
      toast.success('Saved');
    } finally { setSavingField(false); }
  };

  const handleClearReview = () => {
    if (!doc) return;
    startClearTransition(async () => {
      const { error } = await supabase
        .from('client_documents')
        .update({ needs_review: false, validation_warnings: null })
        .eq('id', doc.id);
      if (error) { toast.error('Failed to clear review flag'); return; }
      setNeedsReview(false);
      setValidationWarnings(null);
      toast.success('Review flag cleared');
    });
  };

  const handleMarkReceived = async () => {
    if (!doc || !doc.document_type_id) return;
    setMarkingReceived(true);
    try {
      // Get org_id from user session
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('Not authenticated'); return; }
      const orgId = user.app_metadata?.org_id
        ?? (await supabase.from('user_organisations').select('org_id').eq('user_id', user.id).limit(1).single()).data?.org_id;
      if (!orgId) { toast.error('Organisation not found'); return; }

      // Check if there's an existing customisation to preserve is_enabled
      const { data: existing } = await supabase
        .from('client_document_checklist_customisations')
        .select('is_enabled, is_ad_hoc')
        .eq('client_id', clientId)
        .eq('filing_type_id', doc.filing_type_id)
        .eq('document_type_id', doc.document_type_id)
        .maybeSingle();

      const { error } = await supabase
        .from('client_document_checklist_customisations')
        .upsert(
          {
            org_id: orgId,
            client_id: clientId,
            filing_type_id: doc.filing_type_id,
            document_type_id: doc.document_type_id,
            is_enabled: existing?.is_enabled ?? true,
            is_ad_hoc: existing?.is_ad_hoc ?? false,
            manually_received: true,
          },
          { onConflict: 'client_id,filing_type_id,document_type_id' }
        );

      if (error) { toast.error('Failed to mark as received'); return; }
      setIsReceived(true);
      toast.success('Document marked as received');
      onMarkedReceived?.(doc.id);
    } catch {
      toast.error('Failed to mark as received');
    } finally {
      setMarkingReceived(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Derived display values
  // ---------------------------------------------------------------------------

  const mime = doc ? inferMimeType(doc.original_filename) : null;
  const isPdf = mime === 'application/pdf';
  const isImage = mime?.startsWith('image/') ?? false;

  // Use needsReview state (can change after clear) for assessment
  const docWithState = doc ? { ...doc, needs_review: needsReview } : null;
  const assessment = docWithState ? getAssessment(docWithState) : null;

  const hasExtractionData = extractedTaxYear !== null || extractedEmployer !== null || extractedPayeRef !== null;
  const isHistorical = !hasExtractionData && doc?.extraction_source === 'keyword';

  const dateLabel = doc
    ? new Date(doc.received_at ?? doc.created_at).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
      })
    : '';

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Dialog open={!!doc} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="[&>button]:hidden sm:!max-w-[1350px] max-h-[95vh] p-0 gap-0">
        <div className="flex h-[88vh]">

          {/* ── Left: preview area ── */}
          <div className="flex-1 min-w-0 bg-muted/20 overflow-hidden">
            {loadingPreview ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  <Loader2 className="size-6 animate-spin" />
                  <p className="text-sm">Loading preview…</p>
                </div>
              </div>
            ) : previewUrl && isPdf ? (
              <object data={previewUrl} type="application/pdf" className="w-full h-full">
                <div className="flex items-center justify-center h-full p-6">
                  <p className="text-sm text-muted-foreground text-center">
                    PDF preview not supported in this browser.{' '}
                    <button type="button" className="underline hover:text-foreground" onClick={handleDownload}>
                      Download instead
                    </button>
                  </p>
                </div>
              </object>
            ) : previewUrl && isImage ? (
              <div className="flex items-center justify-center h-full p-6">
                <img
                  src={previewUrl}
                  alt={doc?.original_filename}
                  className="max-h-full max-w-full object-contain rounded"
                />
              </div>
            ) : fileNotFound ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  <FileX className="size-10 opacity-30" />
                  <p className="text-sm font-medium">No file stored</p>
                  <p className="text-xs opacity-70">This document record has no uploaded file yet.</p>
                </div>
              </div>
            ) : previewError ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  <AlertCircle className="size-10 opacity-30" />
                  <p className="text-sm">Failed to load preview</p>
                  <button
                    type="button"
                    className="text-xs underline hover:text-foreground"
                    onClick={handleDownload}
                  >
                    Download instead
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  <FileX className="size-10 opacity-30" />
                  <p className="text-sm">Preview not available for this file type</p>
                  <button
                    type="button"
                    className="text-xs underline hover:text-foreground"
                    onClick={handleDownload}
                  >
                    Download instead
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Right: info panel ── */}
          <div className="w-[480px] shrink-0 border-l p-6 flex flex-col gap-6 overflow-y-auto">

            {/* Filename */}
            <DialogTitle className="text-xl font-semibold leading-snug break-words">
              {doc?.original_filename ?? ''}
            </DialogTitle>

            {/* Assessment alert — above action buttons */}
            {assessment && (
              <div className={`flex items-start gap-3 p-4 ${assessment.alertBg} rounded-xl`}>
                <assessment.Icon className={`size-5 ${assessment.iconClass} shrink-0 mt-0.5`} />
                <div className="space-y-1">
                  <p className={`text-sm font-medium ${assessment.alertText}`}>{assessment.title}</p>
                  <p className={`text-sm ${assessment.alertTextMuted}`}>{assessment.detail}</p>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              {needsReview && (
                <IconButtonWithText variant="green" onClick={handleClearReview} disabled={clearingReview}>
                  {clearingReview ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle className="size-4" />}
                  {clearingReview ? 'Passing…' : 'Pass Review'}
                </IconButtonWithText>
              )}
              {doc?.document_type_id && !needsReview && (
                <IconButtonWithText
                  variant="green"
                  onClick={handleMarkReceived}
                  disabled={markingReceived || isReceived}
                >
                  {markingReceived ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle className="size-4" />}
                  {isReceived ? 'Received' : 'Mark Received'}
                </IconButtonWithText>
              )}
              <IconButtonWithText variant="destructive" onClick={handleReject} disabled={rejecting}>
                {rejecting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                Reject
              </IconButtonWithText>
              <Separator orientation="vertical" className="h-6" />
              <IconButtonWithText variant="blue" onClick={handleDownload} disabled={downloading}>
                {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                Download
              </IconButtonWithText>
            </div>

            {/* File details */}
            <div className="space-y-3">
              {isUploadsMode && clientName && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Client</p>
                  <p className="text-sm font-medium">{clientName}</p>
                </div>
              )}
              {doc?.document_types?.label && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Filing Type</p>
                  <p className="text-sm font-medium">{doc.document_types.label}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Date</p>
                <p className="text-sm font-medium">{dateLabel || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Source</p>
                <p className="text-sm font-medium">
                  {doc?.source === 'portal_upload' ? 'Portal upload' : 'Manual'}
                </p>
              </div>
              {doc?.page_count && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Pages</p>
                  <p className="text-sm font-medium">{doc.page_count}</p>
                </div>
              )}
            </div>

            {/* Extraction fields (editable) */}
            {!isHistorical && doc && (
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Tax Year</p>
                  <EditableField
                    value={extractedTaxYear}
                    placeholder="—"
                    onSave={async (val) => { await handleSaveField('extracted_tax_year', val); setExtractedTaxYear(val); }}
                    saving={savingField}
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Employer</p>
                  <EditableField
                    value={extractedEmployer}
                    placeholder="—"
                    onSave={async (val) => { await handleSaveField('extracted_employer', val); setExtractedEmployer(val); }}
                    saving={savingField}
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">PAYE Ref</p>
                  <EditableField
                    value={extractedPayeRef}
                    placeholder="—"
                    onSave={async (val) => { await handleSaveField('extracted_paye_ref', val); setExtractedPayeRef(val); }}
                    saving={savingField}
                  />
                </div>
              </div>
            )}

            {/* Validation warnings */}
            {needsReview && validationWarnings && validationWarnings.filter(w => w.message).length > 0 && (
              <div className="space-y-2">
                {validationWarnings.filter(w => w.message).map((w, i) => (
                  <div key={i} className="rounded-xl bg-amber-500/10 p-4 flex items-start gap-3">
                    <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-700 leading-snug">{w.message}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Bottom navigation / close */}
            <div className="mt-auto pt-4 flex items-center gap-2">
              {isUploadsMode && (
                <>
                  <IconButtonWithText variant="blue" onClick={onPrevious} disabled={!hasPrevious}>
                    <ChevronLeft className="size-4" />
                    Previous
                  </IconButtonWithText>
                  <IconButtonWithText variant="blue" onClick={onNext} disabled={!hasNext}>
                    Next
                    <ChevronRight className="size-4" />
                  </IconButtonWithText>
                </>
              )}
              <div className="flex-1" />
              <IconButtonWithText variant="amber" onClick={onClose}>
                <X className="size-4" />
                Close
              </IconButtonWithText>
            </div>

          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
