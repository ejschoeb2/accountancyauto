'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CheckButton } from '@/components/ui/check-button';
import { TrafficLightBadge } from './traffic-light-badge';
import { ClipboardCheck, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { buttonBaseVariants } from '@/components/ui/button-base';
import { getFilingTypeLabel } from '@/lib/constants/filing-types';
import type { DashboardMetrics, ClientStatusRow } from '@/lib/dashboard/metrics';
import type { TrafficLightStatus } from '@/lib/dashboard/traffic-light';

interface TodoBoxProps {
  metrics: DashboardMetrics;
  clients: ClientStatusRow[];
}

interface TodoItem {
  id: string;
  clientName: string;
  clientId: string;
  status: TrafficLightStatus;
  docReceived: number;
  docRequired: number;
  filingTypeId: string | null;
}

const PAGE_SIZE = 6;

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

export function TodoBox({ metrics, clients }: TodoBoxProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);

  // Build individual to-do rows from clients that need action
  const actionableStatuses: TrafficLightStatus[] = ['red', 'violet'];

  const todoItems: TodoItem[] = clients
    .filter(c => actionableStatuses.includes(c.status))
    .sort((a, b) => {
      const priority: Record<string, number> = { red: 0, violet: 1 };
      return (priority[a.status] ?? 99) - (priority[b.status] ?? 99);
    })
    .map(c => ({
      id: c.id,
      clientName: c.company_name,
      clientId: c.id,
      status: c.status,
      docReceived: c.total_doc_received,
      docRequired: c.total_doc_required,
      filingTypeId: c.next_deadline_type,
    }));

  const visibleItems = todoItems.filter(item => !dismissed.has(item.id));
  const totalPages = Math.max(1, Math.ceil(visibleItems.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = visibleItems.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const handleDismiss = (id: string) => {
    setDismissed(prev => new Set(prev).add(id));
  };

  const handleRowClick = (item: TodoItem) => {
    if (item.status === 'violet') {
      window.open(getPortalUrl(item.filingTypeId), '_blank', 'noopener,noreferrer');
    } else {
      window.open(`/clients/${item.clientId}`, '_self');
    }
  };

  return (
    <Card className="group py-5 hover:shadow-md transition-shadow duration-200 h-full">
      <CardContent className="px-5 py-0 h-full flex flex-col">
        <div className="flex items-start justify-between mb-4">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            To Do
          </p>
          <div className="size-10 rounded-lg bg-green-500/10 flex items-center justify-center transition-all duration-200 group-hover:bg-green-500/20">
            <ClipboardCheck className="size-6 text-green-600" />
          </div>
        </div>

        <div className="-mx-5 flex-1">
          {visibleItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 px-5">
              <CheckCircle2 className="size-8 text-green-500" />
              <p className="text-sm text-muted-foreground">
                All caught up — nothing to do right now
              </p>
            </div>
          ) : (
            <div className="space-y-0">
              {pageItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-muted/50 transition-colors border-t first:border-t-0 cursor-pointer"
                  onClick={() => handleRowClick(item)}
                >
                  <div onClick={(e) => e.stopPropagation()}>
                    <CheckButton
                      checked={dismissed.has(item.id)}
                      variant={dismissed.has(item.id) ? 'success' : 'default'}
                      onCheckedChange={() => handleDismiss(item.id)}
                      aria-label={`Mark ${item.clientName} as done`}
                    />
                  </div>
                  <span className="font-medium text-sm truncate flex-1 min-w-0">
                    {item.clientName}
                  </span>
                  <TrafficLightBadge
                    status={item.status}
                    docReceived={item.docReceived}
                    docRequired={item.docRequired}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-end gap-2 pt-4 mt-auto">
            <button
              className={buttonBaseVariants({ variant: 'muted', buttonType: 'icon-only' })}
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={safePage === 0}
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              className={buttonBaseVariants({ variant: 'muted', buttonType: 'icon-only' })}
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
