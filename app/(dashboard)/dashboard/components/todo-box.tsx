'use client';

import { useCallback, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CheckButton } from '@/components/ui/check-button';
import { TrafficLightBadge } from './traffic-light-badge';
import {
  ClipboardCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  ListChecks,
  Send,
  ExternalLink,
  Mail,
  RotateCcw,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { ButtonBase } from '@/components/ui/button-base';
import { buttonBaseVariants } from '@/components/ui/button-base';
import { getFilingTypeLabel } from '@/lib/constants/filing-types';
import { markFilingComplete, revertFilingComplete, rolloverToNextCycle, markDocReviewed } from '@/app/actions/todo';
import type { DashboardMetrics, ClientStatusRow, DocNeedingReview, FailedDelivery } from '@/lib/dashboard/metrics';
import type { TrafficLightStatus } from '@/lib/dashboard/traffic-light';
import type { OnboardingProgress } from '@/lib/dashboard/onboarding';
import type { AuditEntry } from '@/app/actions/audit-log';
import { DocumentPreviewModal } from '@/app/(dashboard)/clients/[id]/components/document-preview-modal';
import type { ClientDocument } from '@/app/(dashboard)/clients/[id]/components/document-preview-modal';
import { SentEmailDetailModal } from '@/app/(dashboard)/email-logs/components/sent-email-detail-modal';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { toast } from 'sonner';

interface TodoBoxProps {
  metrics: DashboardMetrics;
  clients: ClientStatusRow[];
  onboarding: OnboardingProgress | null;
  docsNeedingReview: DocNeedingReview[];
  failedDeliveries: FailedDelivery[];
  onDataChange: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Getting started steps (shown at top for new accounts)
// ---------------------------------------------------------------------------

const onboardingSteps = [
  {
    key: 'hasReviewedProgress' as const,
    label: 'Review client progress',
    description: 'Check each client\'s deadline status and mark any documents already received.',
    href: '/clients?view=deadlines&editProgress=true',
    icon: ClipboardList,
  },
  {
    key: 'hasCheckedTemplates' as const,
    label: 'Check reminder schedules & email templates',
    description: 'Review the default reminder schedules and email templates — customise them to match your practice.',
    href: '/templates',
    icon: FileText,
  },
  {
    key: 'hasCheckedQueue' as const,
    label: 'Check queued emails',
    description: 'See which reminder emails are queued for your clients before they go out.',
    href: '/activity',
    icon: ListChecks,
  },
  {
    key: 'hasEmailSent' as const,
    label: 'Send your first reminder',
    description: 'Send a deadline reminder email to one of your clients from the queue.',
    href: '/activity?view=queued',
    icon: Send,
  },
];

// ---------------------------------------------------------------------------
// Unified to-do item types
// ---------------------------------------------------------------------------

type TodoKind = 'client-action' | 'doc-review' | 'failed-delivery';

interface TodoItem {
  id: string;
  kind: TodoKind;
  sentence: string;
  ctaLabel: string;
  ctaHref: string;
  ctaExternal: boolean;
  // Client action specific
  clientId?: string;
  filingTypeId?: string | null;
  deadlineDate?: string | null;
  status?: TrafficLightStatus;
  docReceived?: number;
  docRequired?: number;
  daysUntilDeadline?: number | null;
  // Doc review specific
  docId?: string;
  docClientId?: string;
  // Failed delivery specific
  failedDelivery?: FailedDelivery;
  // Badge overrides for non-client items
  badgeBg?: string;
  badgeText?: string;
  badgeLabel?: string;
}

/** Map filing_type_id to the appropriate government portal URL */
function getPortalUrl(filingTypeId: string | null): string {
  switch (filingTypeId) {
    case 'companies_house':
    case 'confirmation_statement':
      return 'https://ewf.companieshouse.gov.uk/';
    case 'vat_return':
      return 'https://www.tax.service.gov.uk/vat-through-software/what-you-need-to-do';
    case 'self_assessment':
    case 'sa_payment_on_account':
    case 'mtd_quarterly_update':
      return 'https://www.tax.service.gov.uk/personal-account';
    default:
      return 'https://www.tax.service.gov.uk/business-account';
  }
}

function formatDeadlineLabel(daysUntil: number | null | undefined): string | null {
  if (daysUntil === null || daysUntil === undefined) return null;
  if (daysUntil === 0) return 'Due today';
  if (daysUntil === 1) return 'Due tomorrow';
  if (daysUntil < 0) return `${Math.abs(daysUntil)}d overdue`;
  return `${daysUntil}d`;
}

const PAGE_SIZE = 6;

export function TodoBox({ metrics, clients, onboarding, docsNeedingReview, failedDeliveries, onDataChange }: TodoBoxProps) {
  // Items fully removed from the list (after rollover or simple dismiss)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  // Items in "completed" state awaiting rollover (client actions only)
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  // Loading states for async operations
  const [loadingAction, setLoadingAction] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);

  // --- Onboarding items ---
  const showOnboarding = onboarding && !onboarding.dismissed;
  const incompleteOnboarding = showOnboarding
    ? onboardingSteps.filter((s) => !onboarding[s.key])
    : [];

  // --- Build unified to-do list ---
  const actionableStatuses: TrafficLightStatus[] = ['red', 'orange', 'violet'];

  const clientItems: TodoItem[] = clients
    .filter((c) => actionableStatuses.includes(c.status))
    .sort((a, b) => {
      const priority: Record<string, number> = { red: 0, orange: 1, violet: 2 };
      return (priority[a.status] ?? 99) - (priority[b.status] ?? 99);
    })
    .map((c) => {
      const filingLabel = c.next_deadline_type ? getFilingTypeLabel(c.next_deadline_type) : null;
      let sentence: string;
      let ctaHref: string;
      let ctaExternal: boolean;

      if (c.status === 'violet') {
        sentence = filingLabel
          ? `File ${c.company_name} ${filingLabel} with HMRC`
          : `File ${c.company_name} with HMRC`;
        ctaHref = getPortalUrl(c.next_deadline_type);
        ctaExternal = true;
      } else if (c.status === 'orange') {
        sentence = filingLabel
          ? `Urgent: chase ${c.company_name} for ${filingLabel} records`
          : `Urgent: chase ${c.company_name} for outstanding records`;
        ctaHref = `/clients/${c.id}`;
        ctaExternal = false;
      } else {
        sentence = filingLabel
          ? `Chase ${c.company_name} for ${filingLabel} records`
          : `Chase ${c.company_name} for outstanding records`;
        ctaHref = `/clients/${c.id}`;
        ctaExternal = false;
      }

      return {
        id: `client-${c.id}`,
        kind: 'client-action' as const,
        sentence,
        ctaLabel: 'Take me there',
        ctaHref,
        ctaExternal,
        clientId: c.id,
        filingTypeId: c.next_deadline_type,
        deadlineDate: c.next_deadline,
        status: c.status,
        docReceived: c.total_doc_received,
        docRequired: c.total_doc_required,
        daysUntilDeadline: c.days_until_deadline,
      };
    });

  const docReviewItems: TodoItem[] = docsNeedingReview.map((doc) => {
    const docLabel = doc.document_type_label || doc.original_filename;
    return {
      id: `doc-${doc.id}`,
      kind: 'doc-review' as const,
      sentence: `Review ${docLabel} uploaded by ${doc.client_name}`,
      ctaLabel: 'Open file',
      ctaHref: `/clients/${doc.client_id}?tab=documents`,
      ctaExternal: false,
      docId: doc.id,
      docClientId: doc.client_id,
      badgeBg: 'bg-amber-500/10',
      badgeText: 'text-amber-600',
      badgeLabel: 'Needs Review',
    };
  });

  const failedItems: TodoItem[] = failedDeliveries.map((email) => ({
    id: `failed-${email.id}`,
    kind: 'failed-delivery' as const,
    sentence: `Email to ${email.client_name} failed — ${email.delivery_status}`,
    ctaLabel: 'Open email',
    ctaHref: `/activity?tab=outbound&view=queued&status=failed`,
    ctaExternal: false,
    failedDelivery: email,
    badgeBg: 'bg-status-danger/10',
    badgeText: 'text-status-danger',
    badgeLabel: email.delivery_status === 'bounced' ? 'Bounced' : 'Failed',
  }));

  // Merge: failed deliveries first, then doc reviews, then client actions (by urgency)
  const allItems = [...failedItems, ...docReviewItems, ...clientItems];

  const visibleItems = allItems.filter((item) => !dismissed.has(item.id));
  const totalPages = Math.max(1, Math.ceil(visibleItems.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = visibleItems.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  // --- Actions ---

  const setItemLoading = (id: string, action: string) => {
    setLoadingAction((prev) => ({ ...prev, [id]: action }));
  };
  const clearItemLoading = (id: string) => {
    setLoadingAction((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  /** Tick checkbox — marks filing as complete in DB (client actions) or dismisses (simple items) */
  const handleTick = useCallback(async (item: TodoItem) => {
    if (completed.has(item.id) || dismissed.has(item.id)) return;

    if (item.kind === 'client-action' && item.clientId && item.filingTypeId) {
      setItemLoading(item.id, 'completing');
      const result = await markFilingComplete(item.clientId, item.filingTypeId, item.deadlineDate ?? null);
      clearItemLoading(item.id);

      if (result.error) {
        toast.error('Failed to mark as complete', { description: result.error });
        return;
      }

      setCompleted((prev) => new Set(prev).add(item.id));
      await onDataChange();
    } else if (item.kind === 'doc-review' && item.docId) {
      // Simple dismiss with DB update
      setItemLoading(item.id, 'completing');
      const result = await markDocReviewed(item.docId);
      clearItemLoading(item.id);

      if (result.error) {
        toast.error('Failed to mark as reviewed', { description: result.error });
        return;
      }

      setDismissed((prev) => new Set(prev).add(item.id));
      await onDataChange();
    } else {
      // Simple UI dismiss (failed deliveries)
      setDismissed((prev) => new Set(prev).add(item.id));
    }
  }, [completed, dismissed, onDataChange]);

  /** Revert a completed filing back to its previous state */
  const handleRevert = useCallback(async (item: TodoItem) => {
    if (!item.clientId || !item.filingTypeId) return;

    setItemLoading(item.id, 'reverting');
    const result = await revertFilingComplete(item.clientId, item.filingTypeId);
    clearItemLoading(item.id);

    if (result.error) {
      toast.error('Failed to revert', { description: result.error });
      return;
    }

    setCompleted((prev) => {
      const next = new Set(prev);
      next.delete(item.id);
      return next;
    });
    await onDataChange();
  }, [onDataChange]);

  /** Roll over to next cycle and remove from list */
  const handleRollover = useCallback(async (item: TodoItem) => {
    if (!item.clientId || !item.filingTypeId) return;

    setItemLoading(item.id, 'rolling-over');
    const result = await rolloverToNextCycle(item.clientId, item.filingTypeId);
    clearItemLoading(item.id);

    if (result.error) {
      toast.error('Rollover failed', { description: result.error });
      return;
    }

    setCompleted((prev) => {
      const next = new Set(prev);
      next.delete(item.id);
      return next;
    });
    setDismissed((prev) => new Set(prev).add(item.id));
    toast.success('Rolled over to next cycle');
    await onDataChange();
  }, [onDataChange]);

  // --- Modal state ---
  const [previewDoc, setPreviewDoc] = useState<ClientDocument | null>(null);
  const [previewDocClientId, setPreviewDocClientId] = useState<string>('');
  const [loadingDocId, setLoadingDocId] = useState<string | null>(null);

  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailModalEntry, setEmailModalEntry] = useState<AuditEntry | null>(null);
  const [emailModalEntries, setEmailModalEntries] = useState<AuditEntry[]>([]);

  /** Fetch full document data and open preview modal */
  const handleOpenDoc = useCallback(async (docId: string, clientId: string) => {
    setLoadingDocId(docId);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('client_documents')
        .select(`
          id,
          filing_type_id,
          document_type_id,
          original_filename,
          classification_confidence,
          source,
          created_at,
          received_at,
          retention_flagged,
          extracted_tax_year,
          extracted_employer,
          extracted_paye_ref,
          extraction_source,
          page_count,
          needs_review,
          validation_warnings,
          document_types ( id, code, label )
        `)
        .eq('id', docId)
        .single();

      if (error || !data) {
        toast.error('Failed to load document');
        return;
      }

      setPreviewDocClientId(clientId);
      setPreviewDoc(data as unknown as ClientDocument);
    } catch {
      toast.error('Failed to load document');
    } finally {
      setLoadingDocId(null);
    }
  }, []);

  /** Open email detail modal for a failed delivery */
  const handleOpenEmail = useCallback((delivery: FailedDelivery) => {
    const entry: AuditEntry = {
      id: delivery.id,
      sent_at: delivery.sent_at,
      client_id: delivery.client_id,
      client_name: delivery.client_name,
      client_type: null,
      filing_type_id: delivery.filing_type_id,
      filing_type_name: null,
      deadline_date: null,
      step_index: null,
      template_name: null,
      delivery_status: delivery.delivery_status as AuditEntry['delivery_status'],
      recipient_email: delivery.recipient_email,
      subject: delivery.subject,
      send_type: delivery.send_type,
    };
    // Build entries list from all failed deliveries for navigation
    const allEntries: AuditEntry[] = failedDeliveries.map((d) => ({
      id: d.id,
      sent_at: d.sent_at,
      client_id: d.client_id,
      client_name: d.client_name,
      client_type: null,
      filing_type_id: d.filing_type_id,
      filing_type_name: null,
      deadline_date: null,
      step_index: null,
      template_name: null,
      delivery_status: d.delivery_status as AuditEntry['delivery_status'],
      recipient_email: d.recipient_email,
      subject: d.subject,
      send_type: d.send_type,
    }));
    setEmailModalEntries(allEntries);
    setEmailModalEntry(entry);
    setEmailModalOpen(true);
  }, [failedDeliveries]);

  /** CTA button click — opens modal or navigates */
  const handleCta = (item: TodoItem) => {
    if (item.kind === 'doc-review' && item.docId && item.docClientId) {
      handleOpenDoc(item.docId, item.docClientId);
      return;
    }
    if (item.kind === 'failed-delivery' && item.failedDelivery) {
      handleOpenEmail(item.failedDelivery);
      return;
    }
    if (item.ctaExternal) {
      window.open(item.ctaHref, '_blank', 'noopener,noreferrer');
    } else {
      window.open(item.ctaHref, '_self');
    }
  };

  const hasAnything = incompleteOnboarding.length > 0 || visibleItems.length > 0;

  // Track whether the first visible row has been rendered (to skip top border)
  let isFirstRow = true;

  return (
    <Card className="group py-5 hover:shadow-md transition-shadow duration-200">
      <CardContent className="px-5 py-0 flex flex-col">
        <div className="flex items-start justify-between mb-4">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            To Do
          </p>
          <div className="size-10 rounded-lg bg-green-500/10 flex items-center justify-center transition-all duration-200 group-hover:bg-green-500/20">
            <ClipboardCheck className="size-6 text-green-600" />
          </div>
        </div>

        <div className="-mx-5">
          {!hasAnything ? (
            <div className="flex flex-col items-center justify-center gap-2 px-5 py-10">
              <CheckCircle2 className="size-8 text-green-500" />
              <p className="text-sm text-muted-foreground">
                All caught up — nothing to do right now
              </p>
            </div>
          ) : (
            <div className="space-y-0">
              {/* Getting started items */}
              {incompleteOnboarding.map((step) => {
                const Icon = step.icon;
                const showBorder = !isFirstRow;
                isFirstRow = false;
                return (
                  <Link
                    key={step.key}
                    href={step.href}
                    className={`flex items-center gap-4 px-5 py-3.5 hover:bg-muted/50 transition-colors ${showBorder ? 'border-t' : ''}`}
                  >
                    <div className="size-8 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                      <Icon className="size-4 text-green-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {step.label}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {step.description}
                      </p>
                    </div>
                    <div className="px-2.5 py-1 rounded-md bg-green-500/10 shrink-0">
                      <span className="text-xs font-medium text-green-600">Get started</span>
                    </div>
                  </Link>
                );
              })}

              {/* Section divider if both sections present */}
              {incompleteOnboarding.length > 0 && visibleItems.length > 0 && (
                <div className="px-5 py-2 bg-muted/30 border-t">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Client Actions
                  </p>
                </div>
              )}

              {/* Unified to-do items */}
              {pageItems.map((item) => {
                const showBorder = !isFirstRow;
                isFirstRow = false;
                const isCompleted = completed.has(item.id);
                const itemLoading = loadingAction[item.id];

                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-4 px-5 py-3.5 hover:bg-muted/50 transition-all duration-300 ${showBorder ? 'border-t' : ''}`}
                  >
                    {/* Checkbox */}
                    <CheckButton
                      checked={isCompleted}
                      variant={isCompleted ? 'success' : 'default'}
                      onCheckedChange={() => handleTick(item)}
                      disabled={!!itemLoading || isCompleted}
                      aria-label="Mark as done"
                    />

                    {/* Action sentence */}
                    <p className={`text-sm font-medium min-w-0 flex-1 truncate transition-colors duration-300 ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                      {item.sentence}
                    </p>

                    {/* Badge area */}
                    <div className="flex items-center gap-2 shrink-0">
                      {isCompleted ? (
                        /* Completed state — matches TrafficLightBadge green style with full ring */
                        <TrafficLightBadge
                          status="green"
                          docReceived={item.docRequired ?? 0}
                          docRequired={item.docRequired ?? 0}
                        />
                      ) : (
                        <>
                          {/* Days remaining (client actions only) */}
                          {item.kind === 'client-action' && (() => {
                            const deadlineLabel = formatDeadlineLabel(item.daysUntilDeadline);
                            if (!deadlineLabel) return null;
                            return (
                              <span className={`text-sm font-medium whitespace-nowrap ${
                                (item.daysUntilDeadline ?? 0) < 0
                                  ? 'text-status-danger'
                                  : (item.daysUntilDeadline ?? 0) <= 7
                                  ? 'text-status-warning'
                                  : 'text-muted-foreground'
                              }`}>
                                {deadlineLabel}
                              </span>
                            );
                          })()}

                          {/* Traffic light badge for client actions */}
                          {item.kind === 'client-action' && item.status && (
                            <TrafficLightBadge
                              status={item.status}
                              docReceived={item.docReceived}
                              docRequired={item.docRequired}
                            />
                          )}

                          {/* Custom badge for doc reviews / failed deliveries */}
                          {item.kind !== 'client-action' && item.badgeLabel && (
                            <div className={`px-3 py-2 rounded-md inline-flex items-center ${item.badgeBg}`}>
                              <span className={`text-sm font-medium ${item.badgeText}`}>
                                {item.badgeLabel}
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Divider */}
                    <div className="h-6 border-r border-gray-300 dark:border-gray-700 shrink-0" />

                    {/* Action buttons */}
                    {isCompleted ? (
                      /* Completed state — Revert + Roll over buttons */
                      <div className="flex items-center gap-2 shrink-0">
                        <ButtonBase
                          variant="muted"
                          buttonType="icon-text"
                          onClick={() => handleRevert(item)}
                          disabled={!!itemLoading}
                        >
                          {itemLoading === 'reverting' ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <RotateCcw className="size-4" />
                          )}
                          Revert
                        </ButtonBase>
                        <ButtonBase
                          variant="green"
                          buttonType="icon-text"
                          onClick={() => handleRollover(item)}
                          disabled={!!itemLoading}
                        >
                          {itemLoading === 'rolling-over' ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <RefreshCw className="size-4" />
                          )}
                          Roll over
                        </ButtonBase>
                      </div>
                    ) : (
                      /* Normal state — CTA button */
                      <ButtonBase
                        variant="blue"
                        buttonType="icon-text"
                        onClick={() => handleCta(item)}
                        disabled={!!itemLoading || loadingDocId === item.docId}
                        className="shrink-0"
                      >
                        {(itemLoading === 'completing' || loadingDocId === item.docId) ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : item.kind === 'doc-review' ? (
                          <FileText className="size-4" />
                        ) : item.kind === 'failed-delivery' ? (
                          <Mail className="size-4" />
                        ) : (
                          <ExternalLink className="size-4" />
                        )}
                        {item.ctaLabel}
                      </ButtonBase>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Navigation arrows — always visible */}
        <div className="flex items-center justify-end gap-2 pt-4 mt-auto">
          <button
            className={buttonBaseVariants({ variant: 'muted', buttonType: 'icon-only' })}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            className={buttonBaseVariants({ variant: 'muted', buttonType: 'icon-only' })}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={safePage >= totalPages - 1}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </CardContent>

      {/* Document preview modal */}
      <DocumentPreviewModal
        doc={previewDoc}
        clientId={previewDocClientId}
        onClose={() => setPreviewDoc(null)}
        onDeleted={(docId) => {
          setPreviewDoc(null);
          onDataChange();
        }}
        onMarkedReceived={() => onDataChange()}
      />

      {/* Sent email detail modal (for failed deliveries) */}
      <SentEmailDetailModal
        open={emailModalOpen}
        onOpenChange={setEmailModalOpen}
        entry={emailModalEntry}
        allEntries={emailModalEntries}
        onNavigate={(direction) => {
          if (!emailModalEntry) return;
          const idx = emailModalEntries.findIndex((e) => e.id === emailModalEntry.id);
          const newIdx = direction === 'prev' ? idx - 1 : idx + 1;
          if (newIdx >= 0 && newIdx < emailModalEntries.length) {
            setEmailModalEntry(emailModalEntries[newIdx]);
          }
        }}
      />
    </Card>
  );
}
