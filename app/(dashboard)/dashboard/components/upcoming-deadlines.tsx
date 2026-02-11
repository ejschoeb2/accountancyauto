'use client';

import { Card, CardContent } from '@/components/ui/card';
import { TrafficLightBadge } from './traffic-light-badge';
import type { ClientStatusRow } from '@/lib/dashboard/metrics';
import { CalendarClock } from 'lucide-react';
import Link from 'next/link';

interface UpcomingDeadlinesProps {
  clients: ClientStatusRow[];
}

export function UpcomingDeadlines({ clients }: UpcomingDeadlinesProps) {
  // Filter to clients with deadlines and take top 5
  const upcomingClients = clients
    .filter((c) => c.next_deadline !== null)
    .slice(0, 5);

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
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <TrafficLightBadge status={client.status} />
                    <span className="font-medium text-sm truncate">
                      {client.company_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-sm text-muted-foreground">
                    {client.days_until_deadline !== null && (
                      <>
                        <span>
                          {client.days_until_deadline === 0
                            ? 'Today'
                            : client.days_until_deadline === 1
                            ? '1 day'
                            : client.days_until_deadline < 0
                            ? `${Math.abs(client.days_until_deadline)} days overdue`
                            : `${client.days_until_deadline} days`}
                        </span>
                        <span>•</span>
                      </>
                    )}
                    <span>
                      {client.next_deadline &&
                        new Date(client.next_deadline).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                        })}
                    </span>
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
