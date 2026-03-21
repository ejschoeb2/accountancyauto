'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { TrafficLightBadge } from './traffic-light-badge';
import { ClipboardCheck, CheckCircle2 } from 'lucide-react';
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
}

const CHECKBOX_VARIANT: Record<TrafficLightStatus, 'violet' | 'destructive' | 'amber' | 'green' | 'blue' | 'neutral'> = {
  violet: 'violet',
  red: 'destructive',
  orange: 'destructive',
  amber: 'amber',
  blue: 'blue',
  green: 'green',
  grey: 'neutral',
};

export function TodoBox({ metrics, clients }: TodoBoxProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Build individual to-do rows from clients that need action
  // Priority: red (overdue) > violet (ready to submit)
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
    }));

  const visibleItems = todoItems.filter(item => !dismissed.has(item.id));

  const handleDismiss = (id: string) => {
    setDismissed(prev => new Set(prev).add(id));
  };

  return (
    <Card className="group py-5 hover:shadow-md transition-shadow duration-200 h-full">
      <CardContent className="px-5 py-0 h-full flex flex-col">
        <div className="flex items-start justify-between mb-4">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            To Do
          </p>
          <div className="size-10 rounded-lg bg-violet-500/10 flex items-center justify-center transition-all duration-200 group-hover:bg-violet-500/20">
            <ClipboardCheck className="size-6 text-violet-500" />
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
              {visibleItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-muted/50 transition-colors border-t first:border-t-0"
                >
                  <Checkbox
                    variant={CHECKBOX_VARIANT[item.status]}
                    size="sm"
                    onCheckedChange={() => handleDismiss(item.id)}
                  />
                  <Link
                    href={`/clients/${item.clientId}`}
                    className="flex items-center justify-between flex-1 min-w-0 gap-2"
                  >
                    <span className="font-medium text-sm truncate">
                      {item.clientName}
                    </span>
                    <TrafficLightBadge
                      status={item.status}
                      docReceived={item.docReceived}
                      docRequired={item.docRequired}
                    />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
