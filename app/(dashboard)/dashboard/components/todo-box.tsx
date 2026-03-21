'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import {
  ClipboardCheck,
  CheckCircle2,
  Send,
  FileSearch,
  MailX,
  AlertTriangle,
} from 'lucide-react';
import type { DashboardMetrics, ClientStatusRow } from '@/lib/dashboard/metrics';

interface TodoBoxProps {
  metrics: DashboardMetrics;
  clients: ClientStatusRow[];
}

export function TodoBox({ metrics, clients }: TodoBoxProps) {
  // Count violet/overdue from clientStatusList so it matches the upcoming deadlines view
  const violetCount = clients.filter(c => c.status === 'violet').length;
  const overdueCount = clients.filter(c => c.status === 'red').length;

  const todoItems: {
    label: string;
    count: number;
    href: string;
    icon: React.ReactNode;
    color: string;
  }[] = [];

  if (violetCount > 0) {
    todoItems.push({
      label: 'Ready to submit',
      count: violetCount,
      href: '/clients?filter=violet',
      icon: <Send className="size-4" />,
      color: 'text-violet-600',
    });
  }

  if (metrics.docsNeedingReviewCount > 0) {
    todoItems.push({
      label: 'Documents to verify',
      count: metrics.docsNeedingReviewCount,
      href: '/clients?view=deadlines&editProgress=true',
      icon: <FileSearch className="size-4" />,
      color: 'text-amber-600',
    });
  }

  if (metrics.failedDeliveryCount > 0) {
    todoItems.push({
      label: 'Failed deliveries',
      count: metrics.failedDeliveryCount,
      href: '/activity?tab=outbound&view=queued&status=failed',
      icon: <MailX className="size-4" />,
      color: 'text-status-danger',
    });
  }

  if (overdueCount > 0) {
    todoItems.push({
      label: 'Overdue clients to chase',
      count: overdueCount,
      href: '/clients?filter=red',
      icon: <AlertTriangle className="size-4" />,
      color: 'text-status-danger',
    });
  }

  if (metrics.approachingCount > 0) {
    todoItems.push({
      label: 'Approaching — no reminder sent',
      count: metrics.approachingCount,
      href: '/clients?filter=amber',
      icon: <Send className="size-4" />,
      color: 'text-status-warning',
    });
  }

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

        {todoItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-2">
            <CheckCircle2 className="size-8 text-green-500" />
            <p className="text-sm text-muted-foreground">
              All caught up — nothing to do right now
            </p>
          </div>
        ) : (
          <div className="space-y-1 flex-1">
            {todoItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <span className={item.color}>{item.icon}</span>
                <span className="text-sm text-foreground flex-1">
                  {item.label}
                </span>
                <span className={`text-sm font-semibold ${item.color}`}>
                  {item.count}
                </span>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
