'use client';

import { useCallback, useRef, useState } from 'react';
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
  AlertTriangle,
  Eye,
  MailX,
} from 'lucide-react';
import { ButtonBase } from '@/components/ui/button-base';
import { buttonBaseVariants } from '@/components/ui/button-base';
import { getFilingTypeLabel } from '@/lib/constants/filing-types';
import type { DashboardMetrics, ClientStatusRow, DocNeedingReview, FailedDelivery } from '@/lib/dashboard/metrics';
import type { TrafficLightStatus } from '@/lib/dashboard/traffic-light';
import type { OnboardingProgress } from '@/lib/dashboard/onboarding';
import Link from 'next/link';

interface TodoBoxProps {
  metrics: DashboardMetrics;
  clients: ClientStatusRow[];
  onboarding: OnboardingProgress | null;
  docsNeedingReview: DocNeedingReview[];
  failedDeliveries: FailedDelivery[];
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
  /** Whether checkbox auto-ticks when CTA is clicked */
  autoTick: boolean;
  ctaLabel: string;
  ctaHref: string;
  ctaExternal: boolean;
  // Client action specific
  status?: TrafficLightStatus;
  docReceived?: number;
  docRequired?: number;
  daysUntilDeadline?: number | null;
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

export function TodoBox({ metrics, clients, onboarding, docsNeedingReview, failedDeliveries }: TodoBoxProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [completing, setCompleting] = useState<Set<string>>(new Set());
  const completingTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
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
      let autoTick: boolean;

      if (c.status === 'violet') {
        sentence = filingLabel
          ? `File ${c.company_name} ${filingLabel} with HMRC`
          : `File ${c.company_name} with HMRC`;
        ctaHref = getPortalUrl(c.next_deadline_type);
        ctaExternal = true;
        autoTick = true;
      } else if (c.status === 'orange') {
        sentence = filingLabel
          ? `Urgent: chase ${c.company_name} for ${filingLabel} records`
          : `Urgent: chase ${c.company_name} for outstanding records`;
        ctaHref = `/clients/${c.id}`;
        ctaExternal = false;
        autoTick = false;
      } else {
        sentence = filingLabel
          ? `Chase ${c.company_name} for ${filingLabel} records`
          : `Chase ${c.company_name} for outstanding records`;
        ctaHref = `/clients/${c.id}`;
        ctaExternal = false;
        autoTick = false;
      }

      return {
        id: `client-${c.id}`,
        kind: 'client-action' as const,
        sentence,
        autoTick,
        ctaLabel: 'Take me there',
        ctaHref,
        ctaExternal,
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
      autoTick: true,
      ctaLabel: 'Take me there',
      ctaHref: `/clients/${doc.client_id}?tab=documents`,
      ctaExternal: false,
      badgeBg: 'bg-amber-500/10',
      badgeText: 'text-amber-600',
      badgeLabel: 'Needs Review',
    };
  });

  const failedItems: TodoItem[] = failedDeliveries.map((email) => ({
    id: `failed-${email.id}`,
    kind: 'failed-delivery' as const,
    sentence: `Email to ${email.client_name} failed — ${email.delivery_status}`,
    autoTick: false,
    ctaLabel: 'Take me there',
    ctaHref: `/activity?tab=outbound&view=queued&status=failed`,
    ctaExternal: false,
    badgeBg: 'bg-status-danger/10',
    badgeText: 'text-status-danger',
    badgeLabel: email.delivery_status === 'bounced' ? 'Bounced' : 'Failed',
  }));

  // Merge: client actions first (by urgency), then doc reviews, then failed deliveries
  const allItems = [...clientItems, ...docReviewItems, ...failedItems];

  const visibleItems = allItems.filter((item) => !dismissed.has(item.id));
  const totalPages = Math.max(1, Math.ceil(visibleItems.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = visibleItems.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const handleDismiss = useCallback((id: string) => {
    // If already completing/dismissed, ignore
    if (completing.has(id) || dismissed.has(id)) return;

    // Show green tick + "Completed" badge
    setCompleting((prev) => new Set(prev).add(id));

    // After delay, actually remove the row
    const timer = setTimeout(() => {
      setCompleting((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setDismissed((prev) => new Set(prev).add(id));
      completingTimers.current.delete(id);
    }, 1200);

    completingTimers.current.set(id, timer);
  }, [completing, dismissed]);

  const handleCta = (item: TodoItem) => {
    if (item.autoTick) {
      handleDismiss(item.id);
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
                const isCompleting = completing.has(item.id);

                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-4 px-5 py-3.5 hover:bg-muted/50 transition-all duration-300 ${showBorder ? 'border-t' : ''} ${isCompleting ? 'opacity-60' : ''}`}
                  >
                    {/* Checkbox */}
                    <CheckButton
                      checked={isCompleting}
                      variant={isCompleting ? 'success' : 'default'}
                      onCheckedChange={() => handleDismiss(item.id)}
                      aria-label={`Mark as done`}
                    />

                    {/* Action sentence */}
                    <p className={`text-sm font-medium min-w-0 flex-1 truncate transition-colors duration-300 ${isCompleting ? 'line-through text-muted-foreground' : ''}`}>
                      {item.sentence}
                    </p>

                    {/* Badge area */}
                    <div className="flex items-center gap-2 shrink-0">
                      {isCompleting ? (
                        /* Completing state — show green "Completed" badge */
                        <div className="px-3 py-2 rounded-md inline-flex items-center gap-1.5 bg-green-500/10">
                          <CheckCircle2 className="size-3.5 text-green-600" />
                          <span className="text-sm font-medium text-green-600">
                            Completed
                          </span>
                        </div>
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
                            <div className={`px-3 py-2 rounded-md inline-flex items-center gap-1.5 ${item.badgeBg}`}>
                              {item.kind === 'doc-review' && <Eye className={`size-3.5 ${item.badgeText}`} />}
                              {item.kind === 'failed-delivery' && <MailX className={`size-3.5 ${item.badgeText}`} />}
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

                    {/* CTA button */}
                    <ButtonBase
                      variant="blue"
                      buttonType="icon-text"
                      onClick={() => handleCta(item)}
                      className="shrink-0"
                      disabled={isCompleting}
                    >
                      <ExternalLink className="size-4" />
                      {item.ctaLabel}
                    </ButtonBase>
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
    </Card>
  );
}
