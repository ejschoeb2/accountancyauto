'use client';

import { useState, useEffect, useTransition, useRef } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { IconButtonWithText } from '@/components/ui/icon-button-with-text';
import {
  CheckCircle,
  Download,
  Link,
  Plus,
  Loader2,
  Settings,
  AlertTriangle,
  X,
} from 'lucide-react';
import { CheckButton } from '@/components/ui/check-button';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DocumentType {
  id: string;
  code: string;
  label: string;
}

// Phase 30: Advisory validation warning (mirrors ValidationWarning in lib/documents/validate.ts)
interface ValidationWarning {
  code: string;
  message: string;
  expected?: string;
  found?: string;
}

interface ClientDocument {
  id: string;
  filing_type_id: string;
  document_type_id: string | null;
  original_filename: string;
  received_at: string | null;
  classification_confidence: 'high' | 'medium' | 'low' | 'unclassified';
  source: 'portal_upload' | 'manual';
  created_at: string;
  retention_flagged: boolean;
  document_types: DocumentType | null;
  // Phase 22 additions:
  extracted_tax_year: string | null;
  extracted_employer: string | null;
  extracted_paye_ref: string | null;
  extraction_source: 'ocr' | 'keyword' | 'rules' | 'manual' | null;
  page_count: number | null;
  // Phase 30 additions:
  needs_review: boolean;
  validation_warnings: ValidationWarning[] | null;
}

interface ChecklistRequirement {
  id: string;
  document_type_id: string;
  is_mandatory: boolean;
  document_types: {
    id: string;
    code: string;
    label: string;
  };
}

interface Customisation {
  id: string;
  document_type_id: string | null;
  is_enabled: boolean;
  is_ad_hoc: boolean;
  ad_hoc_label: string | null;
  manually_received: boolean;
}

interface EffectiveChecklistItem {
  documentTypeId: string;
  label: string;
  is_mandatory: boolean;
  manuallyReceived: boolean;
}

export interface DocumentCardActions {
  selectAll: () => void;
  deselectAll: () => void;
}

export interface DocumentCardProps {
  clientId: string;
  filingTypeId: string;
  filingTypeName: string;
  docCount: number;
  lastReceivedAt: string | null;
  checklistOpen?: boolean;
  onChecklistClose?: () => void;
  portalUrl?: string | null;
  portalExpiresAt?: string | null;
  onActionsReady?: (actions: DocumentCardActions) => void;
  onReceivedCountChange?: (received: number, total: number) => void;
  onRequiredAllReceivedChange?: (allReceived: boolean) => void;
}

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

/**
 * Confidence badge uses the inline div+span pattern from DESIGN.md (not Badge component).
 * Traffic light colours for confidence levels (distinct from filing status colours).
 */
function ConfidenceBadge({ confidence }: { confidence: ClientDocument['classification_confidence'] }) {
  const config: Record<
    ClientDocument['classification_confidence'],
    { bg: string; text: string; label: string }
  > = {
    high: { bg: 'bg-green-500/10', text: 'text-green-600', label: 'High' },
    medium: { bg: 'bg-amber-500/10', text: 'text-amber-600', label: 'Medium' },
    low: { bg: 'bg-red-500/10', text: 'text-red-600', label: 'Low' },
    unclassified: { bg: 'bg-neutral-500/10', text: 'text-neutral-500', label: 'Unclassified' },
  };

  const { bg, text, label } = config[confidence] ?? config.unclassified;

  return (
    <div className={`px-3 py-2 rounded-md inline-flex items-center ${bg}`}>
      <span className={`text-sm font-medium ${text}`}>{label}</span>
    </div>
  );
}

// "Scanned PDF" badge — document type was keyword-matched but OCR found no readable text (image-only PDF)
// Signal: extraction_source='rules' AND document_type_id IS NOT NULL
function ScannedPdfBadge() {
  return (
    <div className="px-3 py-2 rounded-md inline-flex items-center bg-amber-500/10">
      <span className="text-sm font-medium text-amber-600">Scanned PDF</span>
    </div>
  );
}

// "Review needed" badge — classification failed entirely, no document type identified
// Signal: classification_confidence='unclassified' AND document_type_id IS NULL
function ReviewNeededBadge() {
  return (
    <div className="px-3 py-2 rounded-md inline-flex items-center bg-red-500/10">
      <span className="text-sm font-medium text-red-500">Review needed</span>
    </div>
  );
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
    if (newVal !== value) {
      await onSave(newVal);
    }
  };

  if (saving) {
    return <span className="text-xs text-muted-foreground italic">Saving...</span>;
  }

  if (editing) {
    return (
      <Input
        className="h-7 min-w-[110px] text-xs px-2"
        value={draft}
        autoFocus
        onChange={e => setDraft(e.target.value)}
        onBlur={handleSave}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.currentTarget.blur(); }
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

interface DocumentRowProps {
  doc: ClientDocument;
  clientId: string;
  label?: string;
  showLabel?: boolean;
  onDownload: () => void;
  isDownloading: boolean;
}

function DocumentRow({ doc, clientId, label, showLabel, onDownload, isDownloading }: DocumentRowProps) {
  const [saving, setSaving] = useState(false);
  const [extractedTaxYear, setExtractedTaxYear] = useState(doc.extracted_tax_year);
  const [extractedEmployer, setExtractedEmployer] = useState(doc.extracted_employer);
  const [extractedPayeRef, setExtractedPayeRef] = useState(doc.extracted_paye_ref);
  // Phase 30: needs_review state — optimistic local copy
  const [needsReview, setNeedsReview] = useState(doc.needs_review);
  const [clearingReview, startClearReviewTransition] = useTransition();

  const hasExtractionData = extractedTaxYear !== null || extractedEmployer !== null || extractedPayeRef !== null;
  // Historical: pre-Phase-21 doc with no extraction data and keyword source
  const isHistorical = !hasExtractionData && doc.extraction_source === 'keyword';
  // Scanned PDF: type was keyword-identified, but OCR found no readable text
  const isScannedPdf = doc.extraction_source === 'rules' && doc.document_type_id !== null;
  // Review needed: classification failed entirely
  const isReviewNeeded = doc.classification_confidence === 'unclassified' && doc.document_type_id === null;

  const handleSaveField = async (field: 'extracted_tax_year' | 'extracted_employer' | 'extracted_paye_ref', value: string | null) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-extraction', documentId: doc.id, field, value }),
      });
      if (!res.ok) {
        toast.error('Failed to save — please try again');
        return;
      }
      if (field === 'extracted_tax_year') setExtractedTaxYear(value);
      if (field === 'extracted_employer') setExtractedEmployer(value);
      if (field === 'extracted_paye_ref') setExtractedPayeRef(value);
      toast.success('Saved');
    } finally {
      setSaving(false);
    }
  };

  // Phase 30: Clear the needs_review flag on this document
  const handleClearReview = () => {
    startClearReviewTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase
        .from('client_documents')
        .update({ needs_review: false, validation_warnings: null })
        .eq('id', doc.id);
      if (error) {
        toast.error('Failed to clear review flag — please try again');
        return;
      }
      setNeedsReview(false);
      toast.success('Review flag cleared');
    });
  };

  return (
    <div className="flex items-start gap-3 py-2 px-3 rounded-md bg-green-50 border border-green-100">
      <CheckCircle className="size-4 text-green-600 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          {showLabel && label && (
            <span className="text-sm font-medium text-gray-800">{label}</span>
          )}
          <ConfidenceBadge confidence={doc.classification_confidence} />
          {isScannedPdf && <ScannedPdfBadge />}
          {isReviewNeeded && <ReviewNeededBadge />}
          {/* Phase 30: amber badge for advisory validation warnings */}
          {needsReview && (
            <div className="px-2 py-0.5 rounded-md inline-flex items-center bg-amber-500/10">
              <AlertTriangle className="size-3 text-amber-600 mr-1" />
              <span className="text-xs font-medium text-amber-600">Needs review</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-mono text-muted-foreground truncate max-w-[200px]">
            {doc.original_filename}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDate(doc.received_at ?? doc.created_at)}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatSource(doc.source)}
          </span>
        </div>
        {!isHistorical && (
          <div className="flex items-center gap-4 flex-wrap pt-0.5">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground w-16 shrink-0">Tax year</span>
              <EditableField
                value={extractedTaxYear}
                placeholder="—"
                onSave={val => handleSaveField('extracted_tax_year', val)}
                saving={saving}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground w-16 shrink-0">Employer</span>
              <EditableField
                value={extractedEmployer}
                placeholder="—"
                onSave={val => handleSaveField('extracted_employer', val)}
                saving={saving}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground w-16 shrink-0">PAYE ref</span>
              <EditableField
                value={extractedPayeRef}
                placeholder="—"
                onSave={val => handleSaveField('extracted_paye_ref', val)}
                saving={saving}
              />
            </div>
          </div>
        )}
        {/* Phase 30: Show validation warning messages when needs_review is true */}
        {needsReview && doc.validation_warnings && doc.validation_warnings.length > 0 && (
          <div className="mt-2 space-y-1">
            {doc.validation_warnings.map((w: ValidationWarning, i: number) => (
              <p key={i} className="text-xs text-amber-600/80">{w.message}</p>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1 shrink-0">
        <IconButtonWithText
          variant="blue"
          onClick={onDownload}
          disabled={isDownloading}
        >
          <Download className="size-3" />
          {isDownloading ? 'Opening...' : 'Download'}
        </IconButtonWithText>
        {/* Phase 30: Clear review button */}
        {needsReview && (
          <IconButtonWithText
            variant="amber"
            onClick={handleClearReview}
            disabled={clearingReview}
          >
            {clearingReview ? <Loader2 className="size-3 animate-spin" /> : <AlertTriangle className="size-3" />}
            {clearingReview ? 'Clearing...' : 'Clear'}
          </IconButtonWithText>
        )}
      </div>
    </div>
  );
}

function formatSource(source: ClientDocument['source']): string {
  if (source === 'portal_upload') return 'Portal';
  return 'Manual';
}

function formatDate(isoDate: string | null): string {
  if (!isoDate) return '—';
  return new Date(isoDate).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Checklist customisation sub-component (inline, no filing type dropdown)
// ---------------------------------------------------------------------------

interface ChecklistModalProps {
  open: boolean;
  onClose: () => void;
  clientId: string;
  filingTypeId: string;
  filingTypeName: string;
  onChecklistChanged: () => void;
}

function ChecklistModal({
  open,
  onClose,
  clientId,
  filingTypeId,
  filingTypeName,
  onChecklistChanged,
}: ChecklistModalProps) {
  const [requirements, setRequirements] = useState<ChecklistRequirement[]>([]);
  const [customisations, setCustomisations] = useState<Customisation[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [adHocLabel, setAdHocLabel] = useState('');
  const [showAdHoc, setShowAdHoc] = useState(false);
  const [, startTransition] = useTransition();

  const supabase = createClient();

  // Load org_id from user session
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const id = user.app_metadata?.org_id;
      if (id) { setOrgId(id); return; }
      supabase.from('user_organisations').select('org_id').eq('user_id', user.id).limit(1).single()
        .then(({ data }) => { if (data?.org_id) setOrgId(data.org_id); });
    });
  }, []);

  // Load requirements + customisations when modal opens
  useEffect(() => {
    if (!open || !filingTypeId || !clientId) return;
    setLoading(true);

    Promise.all([
      supabase
        .from('filing_document_requirements')
        .select('id, document_type_id, is_mandatory, document_types(id, code, label)')
        .eq('filing_type_id', filingTypeId),
      supabase
        .from('client_document_checklist_customisations')
        .select('id, document_type_id, is_enabled, is_ad_hoc, ad_hoc_label, manually_received')
        .eq('client_id', clientId)
        .eq('filing_type_id', filingTypeId),
    ]).then(([reqResult, custResult]) => {
      setRequirements((reqResult.data ?? []) as unknown as ChecklistRequirement[]);
      setCustomisations((custResult.data ?? []) as Customisation[]);
    }).finally(() => setLoading(false));
  }, [open, filingTypeId, clientId]);

  const isEnabled = (documentTypeId: string): boolean => {
    const cust = customisations.find(c => c.document_type_id === documentTypeId);
    return cust ? cust.is_enabled : true;
  };

  const handleToggle = (req: ChecklistRequirement) => {
    if (!orgId) return;
    const currentlyEnabled = isEnabled(req.document_type_id);
    const newEnabled = !currentlyEnabled;

    // Optimistic update
    startTransition(() => {
      const existing = customisations.find(c => c.document_type_id === req.document_type_id);
      if (existing) {
        setCustomisations(prev =>
          prev.map(c =>
            c.document_type_id === req.document_type_id ? { ...c, is_enabled: newEnabled } : c
          )
        );
      } else {
        setCustomisations(prev => [
          ...prev,
          { id: '', document_type_id: req.document_type_id, is_enabled: newEnabled, is_ad_hoc: false, ad_hoc_label: null, manually_received: false },
        ]);
      }
    });

    // Persist — preserve manually_received from existing row
    const existingCust = customisations.find(c => c.document_type_id === req.document_type_id);
    supabase
      .from('client_document_checklist_customisations')
      .upsert(
        {
          org_id: orgId,
          client_id: clientId,
          filing_type_id: filingTypeId,
          document_type_id: req.document_type_id,
          is_enabled: newEnabled,
          is_ad_hoc: false,
          manually_received: existingCust?.manually_received ?? false,
        },
        { onConflict: 'client_id,filing_type_id,document_type_id' }
      )
      .then(({ error }) => {
        if (error) {
          toast.error('Failed to save change');
          // Revert on error
          startTransition(() => {
            setCustomisations(prev =>
              prev.map(c =>
                c.document_type_id === req.document_type_id
                  ? { ...c, is_enabled: currentlyEnabled }
                  : c
              )
            );
          });
        } else {
          // Reload to get real IDs
          supabase
            .from('client_document_checklist_customisations')
            .select('id, document_type_id, is_enabled, is_ad_hoc, ad_hoc_label, manually_received')
            .eq('client_id', clientId)
            .eq('filing_type_id', filingTypeId)
            .then(({ data }) => {
              if (data) setCustomisations(data as Customisation[]);
            });
          onChecklistChanged();
        }
      });
  };

  const handleAddAdHoc = async () => {
    if (!adHocLabel.trim() || !orgId) return;

    const { error } = await supabase.from('client_document_checklist_customisations').insert({
      org_id: orgId,
      client_id: clientId,
      filing_type_id: filingTypeId,
      is_enabled: true,
      is_ad_hoc: true,
      ad_hoc_label: adHocLabel.trim(),
    });

    if (error) {
      toast.error('Failed to add custom item');
      return;
    }

    toast.success('Custom item added');
    setAdHocLabel('');
    setShowAdHoc(false);

    const { data } = await supabase
      .from('client_document_checklist_customisations')
      .select('id, document_type_id, is_enabled, is_ad_hoc, ad_hoc_label, manually_received')
      .eq('client_id', clientId)
      .eq('filing_type_id', filingTypeId);
    if (data) setCustomisations(data as Customisation[]);
    onChecklistChanged();
  };

  const adHocItems = customisations.filter(c => c.is_ad_hoc);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Checklist Customisation — {filingTypeName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading checklist...
            </div>
          ) : (
            <>
              {requirements.length === 0 && adHocItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No document requirements configured for this filing type.
                </p>
              ) : (
                <>
                  {/* Standard requirements */}
                  {requirements.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Standard Documents
                      </p>
                      <div className="space-y-1.5">
                        {requirements.map(req => {
                          const enabled = isEnabled(req.document_type_id);
                          return (
                            <div key={req.id} className="flex items-center gap-2">
                              <CheckButton
                                checked={enabled}
                                variant={enabled ? 'success' : 'default'}
                                onCheckedChange={() => handleToggle(req)}
                              />
                              <span className={`text-sm ${enabled ? 'text-foreground' : 'text-muted-foreground line-through'}`}>
                                {req.document_types?.label}
                              </span>
                              {req.is_mandatory && (
                                <span className="text-xs text-muted-foreground shrink-0">(required)</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Ad-hoc items */}
                  {adHocItems.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Custom Items
                      </p>
                      <div className="space-y-1.5">
                        {adHocItems.map(item => (
                          <div key={item.id} className="flex items-center gap-2">
                            <CheckButton checked={true} variant="success" disabled className="pointer-events-none" />
                            <span className="text-sm text-foreground">{item.ad_hoc_label}</span>
                            <span className="text-xs px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-600 shrink-0">Custom</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Add custom item */}
              {showAdHoc ? (
                <div className="flex items-center gap-2 pt-2">
                  <Input
                    value={adHocLabel}
                    onChange={e => setAdHocLabel(e.target.value)}
                    placeholder="e.g. Rental income spreadsheet"
                    className="h-9"
                    onKeyDown={e => e.key === 'Enter' && handleAddAdHoc()}
                    autoFocus
                  />
                  <IconButtonWithText variant="green" onClick={handleAddAdHoc} disabled={!adHocLabel.trim()}>
                    Add
                  </IconButtonWithText>
                  <IconButtonWithText variant="amber" onClick={() => { setShowAdHoc(false); setAdHocLabel(''); }}>
                    <X className="size-4" />
                    Cancel
                  </IconButtonWithText>
                </div>
              ) : (
                <IconButtonWithText variant="blue" onClick={() => setShowAdHoc(true)}>
                  <Plus className="size-4" />
                  Add custom item
                </IconButtonWithText>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main DocumentCard component
// ---------------------------------------------------------------------------

/**
 * Notify that Records Received was auto-set for a filing type.
 * Called from the upload handler response path when checkAndAutoSetRecordsReceived returns true.
 * Exported so parent components can call it after receiving the upload API response.
 */
export function notifyAutoRecordsReceived(filingTypeName: string): void {
  toast.success(
    `Records Received auto-set — all mandatory documents received for ${filingTypeName}.`
  );
}

export function DocumentCard({
  clientId,
  filingTypeId,
  filingTypeName,
  docCount,
  lastReceivedAt,
  checklistOpen,
  onChecklistClose,
  portalUrl,
  portalExpiresAt,
  onActionsReady,
  onReceivedCountChange,
  onRequiredAllReceivedChange,
}: DocumentCardProps) {
  // Content state
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [effectiveChecklist, setEffectiveChecklist] = useState<EffectiveChecklistItem[]>([]);
  const [customisations, setCustomisations] = useState<Customisation[]>([]);
  const [loading, setLoading] = useState(true);

  // Download state
  const [downloading, setDownloading] = useState<string | null>(null);

  // Org ID for upserts
  const [orgId, setOrgId] = useState<string | null>(null);

  const supabase = createClient();

  // Load org_id from user session
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const id = user.app_metadata?.org_id;
      if (id) { setOrgId(id); return; }
      supabase.from('user_organisations').select('org_id').eq('user_id', user.id).limit(1).single()
        .then(({ data }) => { if (data?.org_id) setOrgId(data.org_id); });
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Load document list + effective checklist on mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const loadData = async () => {
      try {
        const docsRes = await fetch(
          `/api/clients/${clientId}/documents?filing_type_id=${filingTypeId}`
        );
        const docsData = docsRes.ok ? await docsRes.json() : { documents: [] };
        setDocuments(docsData.documents ?? []);

        const [reqResult, custResult] = await Promise.all([
          supabase
            .from('filing_document_requirements')
            .select('document_type_id, is_mandatory, document_types(id, code, label)')
            .eq('filing_type_id', filingTypeId),
          supabase
            .from('client_document_checklist_customisations')
            .select('id, document_type_id, is_enabled, is_ad_hoc, ad_hoc_label, manually_received')
            .eq('client_id', clientId)
            .eq('filing_type_id', filingTypeId),
        ]);

        const requirements = (reqResult.data ?? []) as Array<{
          document_type_id: string;
          is_mandatory: boolean;
          document_types: { id: string; code: string; label: string } | { id: string; code: string; label: string }[] | null;
        }>;

        const custs = (custResult.data ?? []) as Customisation[];
        setCustomisations(custs);

        const customisationMap = new Map<string, { is_enabled: boolean; manually_received: boolean }>();
        for (const c of custs) {
          if (c.document_type_id) {
            customisationMap.set(c.document_type_id, { is_enabled: c.is_enabled, manually_received: c.manually_received });
          }
        }

        const checklist: EffectiveChecklistItem[] = requirements
          .filter(req => customisationMap.get(req.document_type_id)?.is_enabled !== false)
          .map(req => {
            const docTypes = req.document_types;
            const label = Array.isArray(docTypes)
              ? (docTypes as { label: string }[])[0]?.label ?? req.document_type_id
              : (docTypes as { label: string } | null)?.label ?? req.document_type_id;
            return {
              documentTypeId: req.document_type_id,
              label,
              is_mandatory: req.is_mandatory,
              manuallyReceived: customisationMap.get(req.document_type_id)?.manually_received ?? false,
            };
          });

        setEffectiveChecklist(checklist);
      } catch (err) {
        console.error('[DocumentCard] Failed to load data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [clientId, filingTypeId]);

  // ---------------------------------------------------------------------------
  // Reload data when checklist changes (configure modal saved)
  // ---------------------------------------------------------------------------
  const reloadData = async () => {
    const [reqResult, custResult] = await Promise.all([
      supabase
        .from('filing_document_requirements')
        .select('document_type_id, is_mandatory, document_types(id, code, label)')
        .eq('filing_type_id', filingTypeId),
      supabase
        .from('client_document_checklist_customisations')
        .select('id, document_type_id, is_enabled, is_ad_hoc, ad_hoc_label, manually_received')
        .eq('client_id', clientId)
        .eq('filing_type_id', filingTypeId),
    ]);

    const requirements = (reqResult.data ?? []) as Array<{
      document_type_id: string;
      is_mandatory: boolean;
      document_types: { id: string; code: string; label: string } | { id: string; code: string; label: string }[] | null;
    }>;

    const custs = (custResult.data ?? []) as Customisation[];
    setCustomisations(custs);

    const customisationMap = new Map<string, { is_enabled: boolean; manually_received: boolean }>();
    for (const c of custs) {
      if (c.document_type_id) {
        customisationMap.set(c.document_type_id, { is_enabled: c.is_enabled, manually_received: c.manually_received });
      }
    }

    const checklist: EffectiveChecklistItem[] = requirements
      .filter(req => customisationMap.get(req.document_type_id)?.is_enabled !== false)
      .map(req => {
        const docTypes = req.document_types;
        const label = Array.isArray(docTypes)
          ? (docTypes as { label: string }[])[0]?.label ?? req.document_type_id
          : (docTypes as { label: string } | null)?.label ?? req.document_type_id;
        return {
          documentTypeId: req.document_type_id,
          label,
          is_mandatory: req.is_mandatory,
          manuallyReceived: customisationMap.get(req.document_type_id)?.manually_received ?? false,
        };
      });

    setEffectiveChecklist(checklist);
  };

  // ---------------------------------------------------------------------------
  // Manual toggle handler
  // ---------------------------------------------------------------------------
  const handleManualToggle = async (item: EffectiveChecklistItem) => {
    if (!orgId) return;
    const newValue = !item.manuallyReceived;

    // Optimistic update
    setEffectiveChecklist(prev =>
      prev.map(i =>
        i.documentTypeId === item.documentTypeId ? { ...i, manuallyReceived: newValue } : i
      )
    );

    const existing = customisations.find(c => c.document_type_id === item.documentTypeId);
    const { error } = await supabase
      .from('client_document_checklist_customisations')
      .upsert(
        {
          org_id: orgId,
          client_id: clientId,
          filing_type_id: filingTypeId,
          document_type_id: item.documentTypeId,
          is_enabled: existing?.is_enabled ?? true,
          is_ad_hoc: existing?.is_ad_hoc ?? false,
          manually_received: newValue,
        },
        { onConflict: 'client_id,filing_type_id,document_type_id' }
      );

    if (error) {
      toast.error('Failed to save change');
      // Revert on error
      setEffectiveChecklist(prev =>
        prev.map(i =>
          i.documentTypeId === item.documentTypeId ? { ...i, manuallyReceived: !newValue } : i
        )
      );
      return;
    }

    // Reload customisations to keep IDs in sync
    const { data } = await supabase
      .from('client_document_checklist_customisations')
      .select('id, document_type_id, is_enabled, is_ad_hoc, ad_hoc_label, manually_received')
      .eq('client_id', clientId)
      .eq('filing_type_id', filingTypeId);
    if (data) setCustomisations(data as Customisation[]);
  };

  // ---------------------------------------------------------------------------
  // Bulk select all / deselect all
  // ---------------------------------------------------------------------------
  const selectAll = async () => {
    if (!orgId) return;

    const toUpdate = effectiveChecklist.filter(item => {
      const matchedDoc = findMatchingDocument(item.documentTypeId);
      return !matchedDoc && !item.manuallyReceived;
    });

    if (toUpdate.length === 0) return;

    // Optimistic update
    setEffectiveChecklist(prev =>
      prev.map(i => {
        const matchedDoc = findMatchingDocument(i.documentTypeId);
        return !matchedDoc ? { ...i, manuallyReceived: true } : i;
      })
    );

    // Upsert all
    const upserts = toUpdate.map(item => {
      const existing = customisations.find(c => c.document_type_id === item.documentTypeId);
      return {
        org_id: orgId,
        client_id: clientId,
        filing_type_id: filingTypeId,
        document_type_id: item.documentTypeId,
        is_enabled: existing?.is_enabled ?? true,
        is_ad_hoc: existing?.is_ad_hoc ?? false,
        manually_received: true,
      };
    });

    const { error } = await supabase
      .from('client_document_checklist_customisations')
      .upsert(upserts, { onConflict: 'client_id,filing_type_id,document_type_id' });

    if (error) {
      toast.error('Failed to select all');
      reloadData();
      return;
    }

    const { data } = await supabase
      .from('client_document_checklist_customisations')
      .select('id, document_type_id, is_enabled, is_ad_hoc, ad_hoc_label, manually_received')
      .eq('client_id', clientId)
      .eq('filing_type_id', filingTypeId);
    if (data) setCustomisations(data as Customisation[]);
  };

  const deselectAll = async () => {
    if (!orgId) return;

    const toUpdate = effectiveChecklist.filter(item => item.manuallyReceived);

    if (toUpdate.length === 0) return;

    // Optimistic update
    setEffectiveChecklist(prev =>
      prev.map(i => ({ ...i, manuallyReceived: false }))
    );

    // Upsert all with manually_received = false
    const upserts = toUpdate.map(item => {
      const existing = customisations.find(c => c.document_type_id === item.documentTypeId);
      return {
        org_id: orgId,
        client_id: clientId,
        filing_type_id: filingTypeId,
        document_type_id: item.documentTypeId,
        is_enabled: existing?.is_enabled ?? true,
        is_ad_hoc: existing?.is_ad_hoc ?? false,
        manually_received: false,
      };
    });

    const { error } = await supabase
      .from('client_document_checklist_customisations')
      .upsert(upserts, { onConflict: 'client_id,filing_type_id,document_type_id' });

    if (error) {
      toast.error('Failed to deselect all');
      reloadData();
      return;
    }

    const { data } = await supabase
      .from('client_document_checklist_customisations')
      .select('id, document_type_id, is_enabled, is_ad_hoc, ad_hoc_label, manually_received')
      .eq('client_id', clientId)
      .eq('filing_type_id', filingTypeId);
    if (data) setCustomisations(data as Customisation[]);
  };

  // Set all items in a group to a specific manually_received value
  const setGroupManuallyReceived = async (items: EffectiveChecklistItem[], received: boolean) => {
    if (!orgId) return;
    const toUpdate = items.filter(item => !findMatchingDocument(item.documentTypeId));
    if (toUpdate.length === 0) return;

    setEffectiveChecklist(prev =>
      prev.map(i =>
        toUpdate.some(u => u.documentTypeId === i.documentTypeId) ? { ...i, manuallyReceived: received } : i
      )
    );

    const upserts = toUpdate.map(item => {
      const existing = customisations.find(c => c.document_type_id === item.documentTypeId);
      return {
        org_id: orgId,
        client_id: clientId,
        filing_type_id: filingTypeId,
        document_type_id: item.documentTypeId,
        is_enabled: existing?.is_enabled ?? true,
        is_ad_hoc: existing?.is_ad_hoc ?? false,
        manually_received: received,
      };
    });

    const { error } = await supabase
      .from('client_document_checklist_customisations')
      .upsert(upserts, { onConflict: 'client_id,filing_type_id,document_type_id' });

    if (error) {
      toast.error('Failed to update');
      setEffectiveChecklist(prev =>
        prev.map(i =>
          toUpdate.some(u => u.documentTypeId === i.documentTypeId) ? { ...i, manuallyReceived: !received } : i
        )
      );
      return;
    }

    const { data } = await supabase
      .from('client_document_checklist_customisations')
      .select('id, document_type_id, is_enabled, is_ad_hoc, ad_hoc_label, manually_received')
      .eq('client_id', clientId)
      .eq('filing_type_id', filingTypeId);
    if (data) setCustomisations(data as Customisation[]);
  };

  // Expose selectAll/deselectAll to parent
  useEffect(() => {
    onActionsReady?.({ selectAll, deselectAll });
  }, [orgId, effectiveChecklist, customisations, documents]);

  // Report received counts to parent
  useEffect(() => {
    if (loading) return;
    const total = effectiveChecklist.length;
    const received = effectiveChecklist.filter(item => {
      const matchedDoc = findMatchingDocument(item.documentTypeId);
      return !!matchedDoc || item.manuallyReceived;
    }).length;
    onReceivedCountChange?.(received, total);
  }, [effectiveChecklist, documents, loading]);

  // Fire onRequiredAllReceivedChange when mandatory docs all-received state transitions.
  // Skips the initial load to avoid overwriting the DB value on mount.
  const prevMandatoryAllReceivedRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (loading) return;
    const mandatoryItems = effectiveChecklist.filter(item => item.is_mandatory);
    if (mandatoryItems.length === 0) return;
    const allReceived = mandatoryItems.every(
      item => !!documents.find(d => d.document_type_id === item.documentTypeId && (d.classification_confidence === 'high' || d.classification_confidence === 'medium')) || item.manuallyReceived
    );
    if (prevMandatoryAllReceivedRef.current === null) {
      prevMandatoryAllReceivedRef.current = allReceived;
      return;
    }
    if (prevMandatoryAllReceivedRef.current !== allReceived) {
      prevMandatoryAllReceivedRef.current = allReceived;
      onRequiredAllReceivedChange?.(allReceived);
    }
  }, [effectiveChecklist, documents, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Download handler
  // ---------------------------------------------------------------------------
  const handleDownload = async (documentId: string) => {
    setDownloading(documentId);
    try {
      const res = await fetch(`/api/clients/${clientId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'download', documentId }),
      });
      if (!res.ok) {
        const err = await res.json();
        console.error('Download failed:', err.error);
        toast.error('Failed to download document');
        return;
      }
      const { signedUrl } = (await res.json()) as { signedUrl: string };
      window.open(signedUrl, '_blank');
    } catch (e) {
      console.error('Download error:', e);
      toast.error('Failed to download document');
    } finally {
      setDownloading(null);
    }
  };

  const handleCopyPortalLink = async () => {
    if (!portalUrl) return;
    try {
      await navigator.clipboard.writeText(portalUrl);
      toast.success('Portal link copied');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  /** Find a matching document for a checklist item (high or medium confidence) */
  const findMatchingDocument = (documentTypeId: string): ClientDocument | undefined => {
    return documents.find(
      doc =>
        doc.document_type_id === documentTypeId &&
        (doc.classification_confidence === 'high' || doc.classification_confidence === 'medium')
    );
  };

  /** Documents that are extra / unmatched to any checklist item */
  const extraDocuments = documents.filter(doc => {
    if (doc.document_type_id === null) return true;
    return !effectiveChecklist.some(item => item.documentTypeId === doc.document_type_id);
  });

  const mandatoryItems = effectiveChecklist.filter(item => item.is_mandatory);
  const otherItems = effectiveChecklist.filter(item => !item.is_mandatory);
  const useTwoColumns = mandatoryItems.length > 0 && (otherItems.length > 0 || extraDocuments.length > 0);

  const mandatoryReceivedCount = mandatoryItems.filter(
    item => !!findMatchingDocument(item.documentTypeId) || item.manuallyReceived
  ).length;
  const mandatoryAllReceived = mandatoryItems.length > 0 && mandatoryReceivedCount === mandatoryItems.length;

  const otherTotalCount = otherItems.length + extraDocuments.length;
  const otherReceivedCount =
    otherItems.filter(item => !!findMatchingDocument(item.documentTypeId) || item.manuallyReceived).length +
    extraDocuments.length; // extra docs are always received (they exist as uploaded files)
  const otherAllReceived = otherTotalCount > 0 && otherReceivedCount === otherTotalCount;

  const expiryDisplay = portalExpiresAt
    ? new Date(portalExpiresAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  // ---------------------------------------------------------------------------
  // Render — inline checklist (no Card wrapper, no expand/collapse)
  // ---------------------------------------------------------------------------

  return (
    <>
      <div className="space-y-1.5">
        {loading ? (
          <div className="space-y-1.5 animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-2 py-1">
                <div className="size-5 rounded bg-muted" />
                <div className="h-4 rounded bg-muted" style={{ width: `${100 + i * 30}px` }} />
              </div>
            ))}
          </div>
        ) : effectiveChecklist.length === 0 && documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No documents yet — use Configure to set up a checklist.
          </p>
        ) : (
          <>
            {useTwoColumns ? (
              <div className="grid grid-cols-2 gap-6">
                {/* Required documents — left column */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckButton
                      checked={mandatoryAllReceived}
                      variant={mandatoryAllReceived ? 'success' : 'default'}
                      onCheckedChange={(checked) => setGroupManuallyReceived(mandatoryItems, checked as boolean)}
                    />
                    <label
                      className={`text-sm cursor-pointer ${mandatoryAllReceived ? 'line-through text-muted-foreground' : 'text-foreground'}`}
                      onClick={() => setGroupManuallyReceived(mandatoryItems, !mandatoryAllReceived)}
                    >
                      {mandatoryReceivedCount} of {mandatoryItems.length} required document{mandatoryItems.length !== 1 ? 's' : ''} received
                    </label>
                  </div>
                  <div className="pl-7 space-y-1.5">
                    {mandatoryItems.map(item => {
                      const matchedDoc = findMatchingDocument(item.documentTypeId);
                      const isChecked = !!matchedDoc || item.manuallyReceived;
                      return (
                        <div key={item.documentTypeId} className="flex items-center gap-2">
                          <CheckButton
                            checked={isChecked}
                            variant={isChecked ? 'success' : 'default'}
                            disabled={!!matchedDoc}
                            onCheckedChange={() => handleManualToggle(item)}
                          />
                          <span className={`text-sm whitespace-nowrap ${isChecked ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                            {item.label}
                          </span>
                          {matchedDoc && (
                            <IconButtonWithText variant="blue" onClick={() => handleDownload(matchedDoc.id)} disabled={downloading === matchedDoc.id}>
                              <Download className="size-3" />
                              {downloading === matchedDoc.id ? 'Opening...' : 'Download'}
                            </IconButtonWithText>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Optional documents — right column */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckButton
                      checked={otherAllReceived}
                      variant={otherAllReceived ? 'success' : 'default'}
                      onCheckedChange={(checked) => setGroupManuallyReceived(otherItems, checked as boolean)}
                    />
                    <label
                      className={`text-sm cursor-pointer ${otherAllReceived ? 'line-through text-muted-foreground' : 'text-foreground'}`}
                      onClick={() => setGroupManuallyReceived(otherItems, !otherAllReceived)}
                    >
                      {otherReceivedCount} of {otherTotalCount} optional document{otherTotalCount !== 1 ? 's' : ''} received
                    </label>
                  </div>
                  <div className="pl-7 space-y-1.5">
                    {otherItems.map(item => {
                      const matchedDoc = findMatchingDocument(item.documentTypeId);
                      const isChecked = !!matchedDoc || item.manuallyReceived;
                      return (
                        <div key={item.documentTypeId} className="flex items-center gap-2">
                          <CheckButton
                            checked={isChecked}
                            variant={isChecked ? 'success' : 'default'}
                            disabled={!!matchedDoc}
                            onCheckedChange={() => handleManualToggle(item)}
                          />
                          <span className={`text-sm whitespace-nowrap ${isChecked ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                            {item.label}
                          </span>
                          {matchedDoc && (
                            <IconButtonWithText variant="blue" onClick={() => handleDownload(matchedDoc.id)} disabled={downloading === matchedDoc.id}>
                              <Download className="size-3" />
                              {downloading === matchedDoc.id ? 'Opening...' : 'Download'}
                            </IconButtonWithText>
                          )}
                        </div>
                      );
                    })}
                    {extraDocuments.map(doc => (
                      <div key={doc.id} className="flex items-center gap-2">
                        <CheckButton checked={true} variant="success" disabled className="pointer-events-none" />
                        <span className="text-sm text-muted-foreground line-through">
                          {doc.document_types?.label || doc.original_filename}
                        </span>
                        <IconButtonWithText variant="blue" onClick={() => handleDownload(doc.id)} disabled={downloading === doc.id}>
                          <Download className="size-3" />
                          {downloading === doc.id ? 'Opening...' : 'Download'}
                        </IconButtonWithText>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Single column fallback — only one type of item exists */}
                {effectiveChecklist.length > 0 && (
                  <div className="space-y-1.5">
                    {effectiveChecklist.map(item => {
                      const matchedDoc = findMatchingDocument(item.documentTypeId);
                      const isChecked = !!matchedDoc || item.manuallyReceived;
                      return (
                        <div key={item.documentTypeId} className="flex items-center gap-2">
                          <CheckButton
                            checked={isChecked}
                            variant={isChecked ? 'success' : 'default'}
                            disabled={!!matchedDoc}
                            onCheckedChange={() => handleManualToggle(item)}
                          />
                          <span className={`text-sm whitespace-nowrap ${isChecked ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                            {item.label}
                          </span>
                          {matchedDoc && (
                            <IconButtonWithText variant="blue" onClick={() => handleDownload(matchedDoc.id)} disabled={downloading === matchedDoc.id}>
                              <Download className="size-3" />
                              {downloading === matchedDoc.id ? 'Opening...' : 'Download'}
                            </IconButtonWithText>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {extraDocuments.length > 0 && (
                  <div className="space-y-1.5">
                    {effectiveChecklist.length > 0 && (
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">Other Documents</p>
                    )}
                    {extraDocuments.map(doc => (
                      <div key={doc.id} className="flex items-center gap-2">
                        <CheckButton checked={true} variant="success" disabled className="pointer-events-none" />
                        <span className="text-sm text-muted-foreground line-through">
                          {doc.document_types?.label || doc.original_filename}
                        </span>
                        <IconButtonWithText variant="blue" onClick={() => handleDownload(doc.id)} disabled={downloading === doc.id}>
                          <Download className="size-3" />
                          {downloading === doc.id ? 'Opening...' : 'Download'}
                        </IconButtonWithText>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Portal URL display (generated from parent) */}
            {portalUrl && (
              <div className="mt-5 space-y-2">
                <input
                  readOnly
                  value={portalUrl}
                  onClick={handleCopyPortalLink}
                  className="w-full h-9 px-3 rounded-md border border-input bg-muted font-mono text-xs text-muted-foreground cursor-pointer hover:border-foreground/30 transition-colors"
                  title="Click to copy"
                />
                {expiryDisplay && (
                  <p className="text-xs text-muted-foreground">
                    Expires {expiryDisplay}. Generating a new link will revoke this one.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Checklist customisation modal */}
      <ChecklistModal
        open={checklistOpen ?? false}
        onClose={() => onChecklistClose?.()}
        clientId={clientId}
        filingTypeId={filingTypeId}
        filingTypeName={filingTypeName}
        onChecklistChanged={reloadData}
      />
    </>
  );
}
