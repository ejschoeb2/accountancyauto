'use client';

import { useState, useEffect, useTransition } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IconButtonWithText } from '@/components/ui/icon-button-with-text';
import {
  ChevronDown,
  ChevronUp,
  Download,
  Settings,
  CheckCircle,
  Square,
  Link,
  Copy,
  Plus,
  Loader2,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DocumentType {
  id: string;
  code: string;
  label: string;
}

interface ClientDocument {
  id: string;
  filing_type_id: string;
  document_type_id: string | null;
  original_filename: string;
  received_at: string | null;
  classification_confidence: 'high' | 'medium' | 'low' | 'unclassified';
  source: 'portal_upload' | 'inbound_email' | 'manual';
  created_at: string;
  retention_flagged: boolean;
  document_types: DocumentType | null;
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
}

interface EffectiveChecklistItem {
  documentTypeId: string;
  label: string;
  is_mandatory: boolean;
}

export interface DocumentCardProps {
  clientId: string;
  filingTypeId: string;
  filingTypeName: string;
  docCount: number;
  lastReceivedAt: string | null;
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
    <div className={`px-2 py-0.5 rounded-md inline-flex items-center ${bg}`}>
      <span className={`text-xs font-medium ${text}`}>{label}</span>
    </div>
  );
}

function formatSource(source: ClientDocument['source']): string {
  if (source === 'portal_upload') return 'Portal';
  if (source === 'inbound_email') return 'Email';
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
    supabase.auth.getSession().then(({ data }) => {
      const id = data.session?.user?.app_metadata?.org_id;
      if (id) setOrgId(id);
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
        .select('id, document_type_id, is_enabled, is_ad_hoc, ad_hoc_label')
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
          { id: '', document_type_id: req.document_type_id, is_enabled: newEnabled, is_ad_hoc: false, ad_hoc_label: null },
        ]);
      }
    });

    // Persist
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
            .select('id, document_type_id, is_enabled, is_ad_hoc, ad_hoc_label')
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
      .select('id, document_type_id, is_enabled, is_ad_hoc, ad_hoc_label')
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
                      <div className="space-y-2">
                        {requirements.map(req => {
                          const enabled = isEnabled(req.document_type_id);
                          return (
                            <div
                              key={req.id}
                              className="flex items-center justify-between gap-3 py-2 px-3 rounded-md border border-gray-200 bg-white"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className={`text-sm truncate ${
                                    enabled ? 'text-gray-900' : 'text-gray-400 line-through'
                                  }`}
                                >
                                  {req.document_types?.label}
                                </span>
                                {req.is_mandatory && (
                                  <span className="text-xs text-muted-foreground shrink-0">
                                    (required)
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={enabled}
                                onClick={() => handleToggle(req)}
                                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                                  enabled ? 'bg-violet-600' : 'bg-gray-200'
                                }`}
                              >
                                <span
                                  className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform ${
                                    enabled ? 'translate-x-4' : 'translate-x-0'
                                  }`}
                                />
                              </button>
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
                      <div className="space-y-2">
                        {adHocItems.map(item => (
                          <div
                            key={item.id}
                            className="flex items-center gap-2 py-2 px-3 rounded-md border border-violet-200 bg-violet-50"
                          >
                            <span className="text-sm text-violet-900 flex-1">
                              {item.ad_hoc_label}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded bg-violet-100 text-violet-700">
                              Custom
                            </span>
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
                  <IconButtonWithText
                    variant="green"
                    onClick={handleAddAdHoc}
                    disabled={!adHocLabel.trim()}
                  >
                    Add
                  </IconButtonWithText>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowAdHoc(false);
                      setAdHocLabel('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAdHoc(true)}
                  className="flex items-center gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  Add custom item
                </Button>
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
}: DocumentCardProps) {
  // Expand / collapse state
  const [expanded, setExpanded] = useState(false);
  const [hasEverExpanded, setHasEverExpanded] = useState(false);

  // Collapsed-header: total requirement count (Y in "X of Y")
  const [requirementCount, setRequirementCount] = useState<number | null>(null);
  const [requirementCountLoading, setRequirementCountLoading] = useState(true);

  // Expanded content state
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [effectiveChecklist, setEffectiveChecklist] = useState<EffectiveChecklistItem[]>([]);
  const [expandedLoading, setExpandedLoading] = useState(false);

  // Gear icon / checklist modal
  const [checklistOpen, setChecklistOpen] = useState(false);

  // Portal link generation
  const [generating, setGenerating] = useState(false);
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  const [portalExpiresAt, setPortalExpiresAt] = useState<string | null>(null);

  // Download state
  const [downloading, setDownloading] = useState<string | null>(null);

  const supabase = createClient();

  // ---------------------------------------------------------------------------
  // Load requirement count on mount (for collapsed header progress fraction)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const loadCount = async () => {
      try {
        const { count, error } = await supabase
          .from('filing_document_requirements')
          .select('id', { count: 'exact', head: true })
          .eq('filing_type_id', filingTypeId);
        if (!error) {
          setRequirementCount(count ?? 0);
        }
      } finally {
        setRequirementCountLoading(false);
      }
    };
    loadCount();
  }, [filingTypeId]);

  // ---------------------------------------------------------------------------
  // Load full document list + effective checklist on first expand
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!expanded || hasEverExpanded) return;

    setHasEverExpanded(true);
    setExpandedLoading(true);

    const loadExpandedData = async () => {
      try {
        // Fetch documents filtered by filing type (server-side, per Plan 20-01)
        const docsRes = await fetch(
          `/api/clients/${clientId}/documents?filing_type_id=${filingTypeId}`
        );
        const docsData = docsRes.ok ? await docsRes.json() : { documents: [] };
        const docs: ClientDocument[] = docsData.documents ?? [];
        setDocuments(docs);

        // Fetch effective checklist via Supabase client
        const [reqResult, custResult] = await Promise.all([
          supabase
            .from('filing_document_requirements')
            .select('document_type_id, is_mandatory, document_types(id, code, label)')
            .eq('filing_type_id', filingTypeId),
          supabase
            .from('client_document_checklist_customisations')
            .select('document_type_id, is_enabled')
            .eq('client_id', clientId)
            .eq('filing_type_id', filingTypeId),
        ]);

        const requirements = (reqResult.data ?? []) as Array<{
          document_type_id: string;
          is_mandatory: boolean;
          document_types: { id: string; code: string; label: string } | { id: string; code: string; label: string }[] | null;
        }>;

        const customisationMap = new Map<string, boolean>();
        for (const c of custResult.data ?? []) {
          if (c.document_type_id) {
            customisationMap.set(c.document_type_id, c.is_enabled);
          }
        }

        const checklist: EffectiveChecklistItem[] = requirements
          .filter(req => customisationMap.get(req.document_type_id) !== false)
          .map(req => {
            const docTypes = req.document_types;
            const label = Array.isArray(docTypes)
              ? (docTypes as { label: string }[])[0]?.label ?? req.document_type_id
              : (docTypes as { label: string } | null)?.label ?? req.document_type_id;
            return {
              documentTypeId: req.document_type_id,
              label,
              is_mandatory: req.is_mandatory,
            };
          });

        setEffectiveChecklist(checklist);
      } catch (err) {
        console.error('[DocumentCard] Failed to load expanded data:', err);
      } finally {
        setExpandedLoading(false);
      }
    };

    loadExpandedData();
  }, [expanded, hasEverExpanded, clientId, filingTypeId]);

  // ---------------------------------------------------------------------------
  // Reload expanded data when checklist changes (gear icon saved)
  // ---------------------------------------------------------------------------
  const reloadExpandedData = async () => {
    const [reqResult, custResult, countResult] = await Promise.all([
      supabase
        .from('filing_document_requirements')
        .select('document_type_id, is_mandatory, document_types(id, code, label)')
        .eq('filing_type_id', filingTypeId),
      supabase
        .from('client_document_checklist_customisations')
        .select('document_type_id, is_enabled')
        .eq('client_id', clientId)
        .eq('filing_type_id', filingTypeId),
      supabase
        .from('filing_document_requirements')
        .select('id', { count: 'exact', head: true })
        .eq('filing_type_id', filingTypeId),
    ]);

    // Update requirement count (collapsed header)
    if (!countResult.error) {
      setRequirementCount(countResult.count ?? 0);
    }

    const requirements = (reqResult.data ?? []) as Array<{
      document_type_id: string;
      is_mandatory: boolean;
      document_types: { id: string; code: string; label: string } | { id: string; code: string; label: string }[] | null;
    }>;

    const customisationMap = new Map<string, boolean>();
    for (const c of custResult.data ?? []) {
      if (c.document_type_id) {
        customisationMap.set(c.document_type_id, c.is_enabled);
      }
    }

    const checklist: EffectiveChecklistItem[] = requirements
      .filter(req => customisationMap.get(req.document_type_id) !== false)
      .map(req => {
        const docTypes = req.document_types;
        const label = Array.isArray(docTypes)
          ? (docTypes as { label: string }[])[0]?.label ?? req.document_type_id
          : (docTypes as { label: string } | null)?.label ?? req.document_type_id;
        return {
          documentTypeId: req.document_type_id,
          label,
          is_mandatory: req.is_mandatory,
        };
      });

    setEffectiveChecklist(checklist);
  };

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

  // ---------------------------------------------------------------------------
  // Portal link generation
  // ---------------------------------------------------------------------------
  const handleGeneratePortalLink = async () => {
    setGenerating(true);
    try {
      const taxYear = new Date().getFullYear().toString();
      const res = await fetch(`/api/clients/${clientId}/portal-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filingTypeId, taxYear }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to generate link' }));
        throw new Error(err.error ?? 'Failed to generate link');
      }
      const data = await res.json();
      setPortalUrl(data.portalUrl);
      setPortalExpiresAt(data.expiresAt);
      toast.success('Portal link generated!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate portal link');
    } finally {
      setGenerating(false);
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

  /** Build the progress fraction text for the collapsed header */
  const buildProgressText = (): React.ReactNode => {
    if (requirementCountLoading) {
      return (
        <div className="flex items-center gap-1">
          <Loader2 className="size-3 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Loading...</span>
        </div>
      );
    }

    const total = requirementCount ?? 0;

    if (total === 0) {
      // No checklist configured — show raw document count
      return (
        <div className="px-2 py-0.5 rounded-md inline-flex items-center bg-neutral-500/10">
          <span className="text-xs font-medium text-neutral-600">
            {docCount} {docCount !== 1 ? 'documents' : 'document'} · no checklist
          </span>
        </div>
      );
    }

    return (
      <div className="px-2 py-0.5 rounded-md inline-flex items-center bg-neutral-500/10">
        <span className="text-xs font-medium text-neutral-600">
          {docCount} of {total} documents received
        </span>
      </div>
    );
  };

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

  const isEmptyState = effectiveChecklist.length === 0 && docCount === 0;

  const expiryDisplay = portalExpiresAt
    ? new Date(portalExpiresAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <Card className="gap-0">
        {/* Collapsed header — always visible */}
        <div
          role="button"
          tabIndex={0}
          className="w-full text-left px-5 py-4 flex items-center justify-between hover:bg-muted/30 transition-colors rounded-t-lg cursor-pointer"
          onClick={() => setExpanded(prev => !prev)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(prev => !prev); } }}
          aria-expanded={expanded}
        >
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold">{filingTypeName}</span>
            {buildProgressText()}
            {lastReceivedAt && (
              <span className="text-xs text-muted-foreground">
                Last: {formatDate(lastReceivedAt)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Gear icon — opens checklist customisation modal */}
            <button
              type="button"
              aria-label={`Customise ${filingTypeName} checklist`}
              onClick={e => {
                e.stopPropagation();
                setChecklistOpen(true);
              }}
              className="p-1 rounded hover:bg-muted/50 transition-colors"
            >
              <Settings className="size-4 text-muted-foreground" />
            </button>
            {expanded ? (
              <ChevronUp className="size-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronDown className="size-4 text-muted-foreground shrink-0" />
            )}
          </div>
        </div>

        {/* Expanded content */}
        {expanded && (
          <CardContent className="px-5 pb-5 pt-0">
            {expandedLoading ? (
              <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading documents...
              </div>
            ) : isEmptyState ? (
              /* Empty state — no checklist and no documents */
              <div className="py-4 space-y-3">
                <p className="text-sm text-muted-foreground">
                  No documents yet — set up a checklist or generate an upload link.
                </p>
                <button
                  type="button"
                  className="text-sm text-violet-600 underline underline-offset-2 hover:text-violet-700"
                  onClick={() => setChecklistOpen(true)}
                >
                  Set up checklist
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Interleaved checklist */}
                {effectiveChecklist.length > 0 && (
                  <div className="space-y-1.5">
                    {effectiveChecklist.map(item => {
                      const matchedDoc = findMatchingDocument(item.documentTypeId);
                      if (matchedDoc) {
                        // Received row
                        return (
                          <div
                            key={item.documentTypeId}
                            className="flex items-center gap-3 py-2 px-3 rounded-md bg-green-50 border border-green-100"
                          >
                            <CheckCircle className="size-4 text-green-600 shrink-0" />
                            <div className="flex-1 min-w-0 space-y-0.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-gray-800">
                                  {item.label}
                                </span>
                                <ConfidenceBadge confidence={matchedDoc.classification_confidence} />
                              </div>
                              <div className="flex items-center gap-3 flex-wrap">
                                <span className="text-xs font-mono text-muted-foreground truncate max-w-[200px]">
                                  {matchedDoc.original_filename}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {formatDate(matchedDoc.received_at ?? matchedDoc.created_at)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {formatSource(matchedDoc.source)}
                                </span>
                              </div>
                            </div>
                            <IconButtonWithText
                              variant="blue"
                              onClick={() => handleDownload(matchedDoc.id)}
                              disabled={downloading === matchedDoc.id}
                            >
                              <Download className="size-3" />
                              {downloading === matchedDoc.id ? 'Opening...' : 'Download'}
                            </IconButtonWithText>
                          </div>
                        );
                      } else {
                        // Outstanding row
                        return (
                          <div
                            key={item.documentTypeId}
                            className="flex items-center gap-3 py-2 px-3 rounded-md bg-muted/30 border border-border/50"
                          >
                            <Square className="size-4 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <span className="text-sm text-gray-700">{item.label}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">Outstanding</span>
                          </div>
                        );
                      }
                    })}
                  </div>
                )}

                {/* Extra / unmatched documents */}
                {extraDocuments.length > 0 && (
                  <div className="space-y-1.5">
                    {effectiveChecklist.length > 0 && (
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Other Documents
                      </p>
                    )}
                    {extraDocuments.map(doc => (
                      <div
                        key={doc.id}
                        className="flex items-center gap-3 py-2 px-3 rounded-md bg-muted/20 border border-border/40"
                      >
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono text-muted-foreground truncate max-w-[200px]">
                              {doc.original_filename}
                            </span>
                            <ConfidenceBadge confidence={doc.classification_confidence} />
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-muted-foreground">
                              {formatDate(doc.received_at ?? doc.created_at)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatSource(doc.source)}
                            </span>
                          </div>
                        </div>
                        <IconButtonWithText
                          variant="blue"
                          onClick={() => handleDownload(doc.id)}
                          disabled={downloading === doc.id}
                        >
                          <Download className="size-3" />
                          {downloading === doc.id ? 'Opening...' : 'Download'}
                        </IconButtonWithText>
                      </div>
                    ))}
                  </div>
                )}

                {/* Empty documents message when checklist configured but no docs */}
                {effectiveChecklist.length > 0 && documents.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No documents uploaded yet.
                  </p>
                )}

                {/* Generate Upload Link — at bottom of expanded section */}
                <div className="pt-2 border-t border-border/50 space-y-3">
                  <IconButtonWithText
                    variant="violet"
                    onClick={handleGeneratePortalLink}
                    disabled={generating}
                  >
                    {generating ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Link className="size-4" />
                    )}
                    {generating ? 'Generating...' : 'Generate Upload Link'}
                  </IconButtonWithText>

                  {portalUrl && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          readOnly
                          value={portalUrl}
                          className="flex-1 h-9 px-3 rounded-md border border-input bg-muted font-mono text-xs text-muted-foreground"
                        />
                        <button
                          type="button"
                          onClick={handleCopyPortalLink}
                          className="h-9 w-9 flex items-center justify-center rounded-md border border-input bg-background hover:bg-muted transition-colors"
                          aria-label="Copy portal URL"
                        >
                          <Copy className="size-4" />
                        </button>
                      </div>
                      {expiryDisplay && (
                        <p className="text-xs text-muted-foreground">
                          Expires {expiryDisplay}. Generating a new link will revoke this one.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Checklist customisation modal */}
      <ChecklistModal
        open={checklistOpen}
        onClose={() => setChecklistOpen(false)}
        clientId={clientId}
        filingTypeId={filingTypeId}
        filingTypeName={filingTypeName}
        onChecklistChanged={reloadExpandedData}
      />
    </>
  );
}
