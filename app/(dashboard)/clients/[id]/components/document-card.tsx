'use client';

import { useState, useEffect, useTransition, useRef } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { IconButtonWithText } from '@/components/ui/icon-button-with-text';
import { IconButton } from '@/components/ui/icon-button';
import {
  Plus,
  Loader2,
  X,
  Upload,
  Trash2,
} from 'lucide-react';
import { DocumentPreviewModal, type ClientDocument } from './document-preview-modal';
import { CheckButton } from '@/components/ui/check-button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// ClientDocument and ValidationWarning are imported from document-preview-modal

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

/** Compute a verdict from document signals — prioritised by severity */
function getVerdict(doc: ClientDocument): { label: string; bg: string; text: string } {
  if (doc.needs_review) return { label: 'Review needed', bg: 'bg-amber-500/10', text: 'text-amber-600' };
  if (doc.classification_confidence === 'low' || doc.classification_confidence === 'unclassified')
    return { label: 'Low confidence', bg: 'bg-red-500/10', text: 'text-red-600' };
  if (doc.extraction_source === 'rules' && doc.document_type_id !== null)
    return { label: 'Scanned PDF', bg: 'bg-amber-500/10', text: 'text-amber-600' };
  if (doc.source === 'manual') return { label: 'Manual', bg: 'bg-neutral-500/10', text: 'text-neutral-500' };
  if (doc.classification_confidence === 'medium')
    return { label: 'Likely match', bg: 'bg-amber-500/10', text: 'text-amber-600' };
  return { label: 'Verified', bg: 'bg-green-500/10', text: 'text-green-600' };
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

  const isEnabled = (documentTypeId: string, isMandatory: boolean): boolean => {
    const cust = customisations.find(c => c.document_type_id === documentTypeId);
    // If no customisation row exists, default mandatory items to enabled, optional to disabled
    return cust ? cust.is_enabled : isMandatory;
  };

  const handleToggle = (req: ChecklistRequirement) => {
    if (!orgId) return;
    const currentlyEnabled = isEnabled(req.document_type_id, req.is_mandatory);
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
      <DialogContent className="max-w-lg" showCloseButton={false}>
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
                          const enabled = isEnabled(req.document_type_id, req.is_mandatory);
                          return (
                            <div key={req.id} className="flex items-center gap-2">
                              <CheckButton
                                checked={enabled}
                                variant={enabled ? 'success' : 'default'}
                                onCheckedChange={() => handleToggle(req)}
                              />
                              <span className={`text-sm ${enabled ? 'text-foreground' : 'text-muted-foreground'}`}>
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
        <div className="flex justify-end pt-2">
          <DialogClose asChild>
            <IconButtonWithText variant="muted">
              <X className="size-4" />
              Close
            </IconButtonWithText>
          </DialogClose>
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

  // Preview modal state
  const [previewDoc, setPreviewDoc] = useState<ClientDocument | null>(null);

  // Accountant upload state — tracks which slot (documentTypeId) or 'generic' is uploading
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [deletingDoc, setDeletingDoc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetTypeIdRef = useRef<string | null>(null);

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
          .filter(req => {
            const cust = customisationMap.get(req.document_type_id);
            // If customisation exists, use its is_enabled; otherwise default optional items to disabled
            return cust ? cust.is_enabled : req.is_mandatory;
          })
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
  // Realtime: auto-refresh documents when a new upload arrives for this client
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const channel = supabase
      .channel(`doc-refresh-${clientId}-${filingTypeId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'client_documents',
          filter: `client_id=eq.${clientId}`,
        },
        async (payload) => {
          const newDoc = payload.new as { filing_type_id?: string };
          // Only refresh if the new document is for this filing type
          if (newDoc.filing_type_id !== filingTypeId) return;
          // Re-fetch documents
          try {
            const docsRes = await fetch(
              `/api/clients/${clientId}/documents?filing_type_id=${filingTypeId}`
            );
            const docsData = docsRes.ok ? await docsRes.json() : { documents: [] };
            setDocuments(docsData.documents ?? []);
          } catch (err) {
            console.error('[DocumentCard] Realtime refresh failed:', err);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
      .filter(req => {
            const cust = customisationMap.get(req.document_type_id);
            // If customisation exists, use its is_enabled; otherwise default optional items to disabled
            return cust ? cust.is_enabled : req.is_mandatory;
          })
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
      item => !!documents.find(d => d.document_type_id === item.documentTypeId) || item.manuallyReceived
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
  // Accountant upload handlers
  // ---------------------------------------------------------------------------

  /** Trigger the file picker for a specific checklist slot (or generic upload) */
  const handleUploadForItem = (documentTypeId: string | null) => {
    uploadTargetTypeIdRef.current = documentTypeId;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // Reset so same file can be re-uploaded if needed

    const targetTypeId = uploadTargetTypeIdRef.current;
    uploadTargetTypeIdRef.current = null;

    const uploadKey = targetTypeId ?? 'generic';
    setUploadingFor(uploadKey);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('filingTypeId', filingTypeId);
      if (targetTypeId) formData.append('documentTypeId', targetTypeId);

      const res = await fetch(`/api/clients/${clientId}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Upload failed' }));
        if (res.status === 409) {
          toast.error('This file has already been uploaded for this client.');
        } else {
          toast.error(err.error ?? 'Upload failed. Please try again.');
        }
        return;
      }

      const result = await res.json();
      const label = result.documentTypeLabel ?? result.documentTypeCode;

      if (result.validationWarnings?.length > 0) {
        toast.warning(
          `Uploaded with ${result.validationWarnings.length} issue${result.validationWarnings.length > 1 ? 's' : ''} — click the document to review.`,
        );
      } else {
        toast.success(label ? `Uploaded as ${label}` : `${file.name} uploaded`);
      }

      // Reload document list
      const docsRes = await fetch(`/api/clients/${clientId}/documents?filing_type_id=${filingTypeId}`);
      const docsData = docsRes.ok ? await docsRes.json() : { documents: [] };
      setDocuments(docsData.documents ?? []);
    } catch {
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploadingFor(null);
    }
  };

  const handleDeleteDoc = async (documentId: string) => {
    if (!confirm('Delete this document? This cannot be undone.')) return;
    setDeletingDoc(documentId);
    try {
      const res = await fetch(`/api/clients/${clientId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', documentId }),
      });
      if (!res.ok) { toast.error('Failed to delete document'); return; }
      toast.success('Document deleted');
      setDocuments(prev => prev.filter(d => d.id !== documentId));
      if (previewDoc?.id === documentId) setPreviewDoc(null);
    } catch {
      toast.error('Failed to delete document');
    } finally {
      setDeletingDoc(null);
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

  /** Find a matching document for a checklist item.
   *  Matches on document_type_id regardless of confidence — portal uploads set the
   *  type explicitly via the checklist item, so even 'low'/'unclassified' docs are valid. */
  const findMatchingDocument = (documentTypeId: string): ClientDocument | undefined => {
    return documents.find(doc => doc.document_type_id === documentTypeId);
  };

  /** Documents that are extra / unmatched to any checklist item */
  const extraDocuments = documents.filter(doc => {
    if (doc.document_type_id === null) return true;
    return !effectiveChecklist.some(item => item.documentTypeId === doc.document_type_id);
  });

  const mandatoryItems = effectiveChecklist.filter(item => item.is_mandatory);
  const optionalItems = effectiveChecklist.filter(item => !item.is_mandatory);

  const expiryDisplay = portalExpiresAt
    ? new Date(portalExpiresAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  /** Shared row cells for a document (used by both checklist and extra rows) */
  const renderDocCells = (
    doc: ClientDocument,
    label: string,
    isChecked: boolean,
    rowKey: string,
    disableCheck: boolean,
    onCheck?: () => void,
  ) => {
    const verdict = getVerdict(doc);
    return (
      <TableRow
        key={rowKey}
        className="hover:bg-muted/30 cursor-pointer"
        onClick={() => setPreviewDoc(doc)}
      >
        <TableCell className="w-10" onClick={e => e.stopPropagation()}>
          <CheckButton
            checked={isChecked}
            variant={isChecked ? 'success' : 'default'}
            disabled={disableCheck}
            onCheckedChange={onCheck}
          />
        </TableCell>
        <TableCell>
          <span className={`text-sm ${isChecked ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
            {label}
          </span>
        </TableCell>
        <TableCell>
          <span className="text-sm truncate block max-w-[240px]" title={doc.original_filename}>
            {doc.original_filename}
          </span>
        </TableCell>
        <TableCell className="whitespace-nowrap">
          <span className="text-sm">{formatDate(doc.received_at ?? doc.created_at)}</span>
        </TableCell>
        <TableCell className="whitespace-nowrap">
          <span className="text-sm">{formatSource(doc.source)}</span>
        </TableCell>
        <TableCell>
          <div className={`px-3 py-2 rounded-md inline-flex items-center ${verdict.bg}`}>
            <span className={`text-sm font-medium ${verdict.text}`}>{verdict.label}</span>
          </div>
        </TableCell>
        <TableCell onClick={e => e.stopPropagation()}>
          <IconButton
            variant="red"
            title="Delete document"
            onClick={() => handleDeleteDoc(doc.id)}
            disabled={deletingDoc === doc.id}
          >
            {deletingDoc === doc.id
              ? <Loader2 className="size-3 animate-spin" />
              : <Trash2 className="size-3" />}
          </IconButton>
        </TableCell>
      </TableRow>
    );
  };

  /** Render a table row for a checklist item — empty row if no matched doc */
  const renderChecklistRow = (item: EffectiveChecklistItem) => {
    const matchedDoc = findMatchingDocument(item.documentTypeId);
    const isChecked = !!matchedDoc || item.manuallyReceived;
    const rowKey = `item-${item.documentTypeId}`;

    if (matchedDoc) {
      return renderDocCells(matchedDoc, item.label, isChecked, rowKey, true);
    }

    // No document yet — clicking the row toggles manually received
    return (
      <TableRow
        key={rowKey}
        className="hover:bg-muted/30 cursor-pointer"
        onClick={() => handleManualToggle(item)}
      >
        <TableCell className="w-10" onClick={e => e.stopPropagation()}>
          <CheckButton
            checked={isChecked}
            variant={isChecked ? 'success' : 'default'}
            onCheckedChange={() => handleManualToggle(item)}
          />
        </TableCell>
        <TableCell>
          <span className={`text-sm ${isChecked ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
            {item.label}
          </span>
        </TableCell>
        <TableCell colSpan={4} />{/* Filename, Date, Source, Verdict — empty */}
        <TableCell onClick={e => e.stopPropagation()}>
          <IconButton
            variant="sky"
            title="Upload file for this slot"
            onClick={() => handleUploadForItem(item.documentTypeId)}
            disabled={uploadingFor === item.documentTypeId}
          >
            {uploadingFor === item.documentTypeId
              ? <Loader2 className="size-3 animate-spin" />
              : <Upload className="size-3" />}
          </IconButton>
        </TableCell>
      </TableRow>
    );
  };

  /** Render a table row for an extra (unmatched) document */
  const renderExtraRow = (doc: ClientDocument) => {
    const rowKey = `extra-${doc.id}`;
    const label = doc.document_types?.label || doc.original_filename;
    return renderDocCells(doc, label, true, rowKey, true);
  };

  // ---------------------------------------------------------------------------
  // Render — table layout
  // ---------------------------------------------------------------------------

  return (
    <>
      <div className="space-y-4">
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
          <p className="text-sm text-muted-foreground text-center py-6 px-6">
            No documents yet — use Configure to set up a checklist.
          </p>
        ) : (
          <>
            {/* Documents table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead><span className="text-sm font-semibold uppercase tracking-wide">Type</span></TableHead>
                  <TableHead><span className="text-sm font-semibold uppercase tracking-wide">Filename</span></TableHead>
                  <TableHead><span className="text-sm font-semibold uppercase tracking-wide">Date</span></TableHead>
                  <TableHead><span className="text-sm font-semibold uppercase tracking-wide">Source</span></TableHead>
                  <TableHead><span className="text-sm font-semibold uppercase tracking-wide">Verdict</span></TableHead>
                  <TableHead><span className="text-sm font-semibold uppercase tracking-wide">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mandatoryItems.map(renderChecklistRow)}
                {optionalItems.map(renderChecklistRow)}
                {extraDocuments.map(renderExtraRow)}
              </TableBody>
            </Table>

          </>
        )}
      </div>

      {/* Portal URL display (generated from parent) — shown outside table so always visible */}
      {portalUrl && (
        <div className="px-6 pt-3 space-y-2">
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

      {/* Hidden file input shared by all per-row upload buttons */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff,.doc,.docx,.xls,.xlsx,.csv"
        onChange={handleFileChange}
      />

      {/* Checklist customisation modal */}
      <ChecklistModal
        open={checklistOpen ?? false}
        onClose={() => onChecklistClose?.()}
        clientId={clientId}
        filingTypeId={filingTypeId}
        filingTypeName={filingTypeName}
        onChecklistChanged={reloadData}
      />

      {/* Document preview modal — opened by clicking any document row */}
      <DocumentPreviewModal
        doc={previewDoc}
        clientId={clientId}
        onClose={() => setPreviewDoc(null)}
        onDeleted={(docId) => {
          setDocuments(prev => prev.filter(d => d.id !== docId));
          setPreviewDoc(null);
        }}
      />
    </>
  );
}
