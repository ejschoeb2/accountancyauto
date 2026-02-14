'use client';

import { Card, CardContent } from '@/components/ui/card';
import { TrafficLightBadge } from './traffic-light-badge';
import type { ClientStatusRow } from '@/lib/dashboard/metrics';
import { CalendarClock } from 'lucide-react';
import Link from 'next/link';

interface UpcomingDeadlinesProps {
  clients: ClientStatusRow[];
}

// Map filing type IDs to short display names
function getFilingTypeLabel(filingTypeId: string | null): string {
  if (!filingTypeId) return '';

  const labels: Record<string, string> = {
    corporation_tax_payment: 'Corp Tax',
    ct600_filing: 'CT600',
    companies_house: 'Companies House',
    vat_return: 'VAT Return',
    self_assessment: 'Self Assessment',
  };

  return labels[filingTypeId] || filingTypeId;
}

export function UpcomingDeadlines({ clients }: UpcomingDeadlinesProps) {
  // Filter to clients with deadlines, sort by deadline (earliest first), and take top 4
  const upcomingClients = clients
    .filter((c) => c.next_deadline !== null)
    .sort((a, b) => {
      if (!a.next_deadline || !b.next_deadline) return 0;
      return a.next_deadline.localeCompare(b.next_deadline);
    })
    .slice(0, 4);

  return (
    <Card className="group py-5 hover:shadow-md transition-shadow duration-200">
      <CardContent className="px-5 py-0">
        <div className="flex items-start justify-between mb-6">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Upcoming Deadlines
          </p>
          <div className="size-10 rounded-lg bg-violet-500/10 flex items-center justify-center transition-all duration-200 group-hover:bg-violet-500/20">
            <CalendarClock className="size-6 text-violet-500" />
          </div>
        </div>
        <div className="-mx-5">
          {upcomingClients.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8 px-5">
              No upcoming deadlines
            </p>
          ) : (
            <div className="space-y-0">
              {upcomingClients.map((client, index) => (
                <Link
                  key={client.id}
                  href={`/clients/${client.id}`}
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
                      <div className="px-3 py-1.5 rounded-md inline-flex items-center bg-blue-500/10">
                        <span className="text-sm font-normal text-blue-500">
                          {getFilingTypeLabel(client.next_deadline_type)}
                        </span>
                      </div>
                    )}
                    <TrafficLightBadge status={client.status} />
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
      </CardContent>
    </Card>
  );
}
