'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import {
  MailCheck,
  MailX,
  AlertTriangle,
  TrendingUp,
  ClipboardCheck,
  FileSearch,
  Send,
  CheckCircle2,
} from 'lucide-react';
import type { DashboardMetrics } from '@/lib/dashboard/metrics';

interface SummaryCardsProps {
  metrics: DashboardMetrics;
}

export function SummaryCards({ metrics }: SummaryCardsProps) {
  // Build to-do items — only show items with count > 0
  const todoItems: {
    label: string;
    count: number;
    href: string;
    icon: React.ReactNode;
    color: string;
  }[] = [];

  if (metrics.violetCount > 0) {
    todoItems.push({
      label: 'Ready to submit',
      count: metrics.violetCount,
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

  if (metrics.overdueCount > 0) {
    todoItems.push({
      label: 'Overdue clients to chase',
      count: metrics.overdueCount,
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
      color: 'text-amber-600',
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6">
      {/* Left: 2x2 metric cards */}
      <div className="grid grid-cols-2 gap-4">
        <Link href="/activity?tab=outbound&view=sent&date=today">
          <Card className="group py-5 hover:shadow-md transition-shadow duration-200 cursor-pointer h-full">
            <CardContent className="px-5 py-0">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Sent Today
                  </p>
                  <p className="text-4xl font-bold mt-3">
                    {metrics.sentTodayCount}
                  </p>
                </div>
                <div className="size-10 rounded-lg bg-blue-500/10 flex items-center justify-center transition-all duration-200 group-hover:bg-blue-500/20">
                  <MailCheck className="size-6 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/activity?tab=outbound&view=queued&status=failed">
          <Card className="group py-5 hover:shadow-md transition-shadow duration-200 cursor-pointer h-full">
            <CardContent className="px-5 py-0">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Failed Deliveries
                  </p>
                  <p className="text-4xl font-bold mt-3">
                    {metrics.failedDeliveryCount}
                  </p>
                </div>
                <div className="size-10 rounded-lg bg-status-danger/10 flex items-center justify-center transition-all duration-200 group-hover:bg-status-danger/20">
                  <MailX className="size-6 text-status-danger" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/clients?filter=red">
          <Card className="group py-5 hover:shadow-md transition-shadow duration-200 cursor-pointer h-full">
            <CardContent className="px-5 py-0">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Overdue
                  </p>
                  <p className="text-4xl font-bold mt-3">
                    {metrics.overdueCount}
                  </p>
                </div>
                <div className="size-10 rounded-lg bg-status-danger/10 flex items-center justify-center transition-all duration-200 group-hover:bg-status-danger/20">
                  <AlertTriangle className="size-6 text-status-danger" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Card className="group py-5 hover:shadow-md transition-shadow duration-200 h-full">
          <CardContent className="px-5 py-0">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Completion Rate
                </p>
                <p className="text-4xl font-bold mt-3">
                  {Math.round(metrics.completionRate)}%
                </p>
              </div>
              <div className="size-10 rounded-lg bg-green-500/10 flex items-center justify-center transition-all duration-200 group-hover:bg-green-500/20">
                <TrendingUp className="size-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right: To Do box */}
      <Card className="group py-5 hover:shadow-md transition-shadow duration-200">
        <CardContent className="px-5 py-0">
          <div className="flex items-start justify-between mb-4">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              To Do
            </p>
            <div className="size-10 rounded-lg bg-violet-500/10 flex items-center justify-center transition-all duration-200 group-hover:bg-violet-500/20">
              <ClipboardCheck className="size-6 text-violet-500" />
            </div>
          </div>

          {todoItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 gap-2">
              <CheckCircle2 className="size-8 text-green-500" />
              <p className="text-sm text-muted-foreground">
                All caught up — nothing to do right now
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {todoItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors group/item"
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
    </div>
  );
}
