'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrafficLightBadge } from './traffic-light-badge';
import type { ClientStatusRow } from '@/lib/dashboard/metrics';
import { CalendarClock, ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getFilingTypeLabel } from '@/lib/constants/filing-types';
import { buttonBaseVariants } from '@/components/ui/button-base';

interface UpcomingDeadlinesProps {
  clients: ClientStatusRow[];
}

const PAGE_SIZE = 6;

export function UpcomingDeadlines({ clients }: UpcomingDeadlinesProps) {
  const router = useRouter();
  const [page, setPage] = useState(0);

  // Filter to clients with deadlines, sort by deadline (earliest first)
  const upcomingClients = clients
    .filter((c) => c.next_deadline !== null)
    .sort((a, b) => {
      if (!a.next_deadline || !b.next_deadline) return 0;
      return a.next_deadline.localeCompare(b.next_deadline);
    });

  const totalPages = Math.max(1, Math.ceil(upcomingClients.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageClients = upcomingClients.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  return (
    <Card
      className="group py-5 hover:shadow-md transition-shadow duration-200 cursor-pointer"
      onClick={() => router.push('/clients?sort=deadline-asc')}
    >
      <CardContent className="px-5 py-0 h-full flex flex-col">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Upcoming Deadlines
            </p>
          </div>
          <div className="size-10 rounded-lg bg-violet-500/10 flex items-center justify-center transition-all duration-200 group-hover:bg-violet-500/20">
            <CalendarClock className="size-6 text-violet-500" />
          </div>
        </div>
        <div className="-mx-5 flex-1">
          {upcomingClients.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8 px-5">
              No upcoming deadlines
            </p>
          ) : (
            <div className="space-y-0">
              {pageClients.map((client) => (
                <Link
                  key={client.id}
                  href={`/clients/${client.id}${client.next_deadline_type ? `?filing=${client.next_deadline_type}` : ''}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center justify-between px-5 py-3 hover:bg-muted/50 transition-colors border-t first:border-t-0"
                >
                  {/* Left: Company name */}
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="font-medium text-sm truncate">
                      {client.company_name}
                    </span>
                  </div>

                  {/* Right: Deadline type tag + Status badge + divider + days/date */}
                  <div className="flex items-center gap-2 shrink-0">
                    {client.next_deadline_type && (
                      <div className="px-3 py-2 rounded-md inline-flex items-center bg-sky-500/10">
                        <span className="text-sm font-medium text-sky-500">
                          {getFilingTypeLabel(client.next_deadline_type)}
                        </span>
                      </div>
                    )}
                    <TrafficLightBadge
                      status={client.status}
                      docReceived={client.total_doc_received}
                      docRequired={client.total_doc_required}
                    />
                    <div className="h-4 border-r border-gray-300 dark:border-gray-700" />
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {client.days_until_deadline !== null && (
                        <span>
                          {client.days_until_deadline === 0
                            ? 'Today'
                            : client.days_until_deadline === 1
                            ? '1 day'
                            : client.days_until_deadline < 0
                            ? `${Math.abs(client.days_until_deadline)} days overdue`
                            : `${client.days_until_deadline} days`}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            className="flex items-center justify-end gap-2 pt-4 mt-auto"
            onClick={(e) => e.stopPropagation()}
          >
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
