'use client';

import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, Send, MailCheck, PauseCircle } from 'lucide-react';
import type { DashboardMetrics } from '@/lib/dashboard/metrics';

interface SummaryCardsProps {
  metrics: DashboardMetrics;
}

export function SummaryCards({ metrics }: SummaryCardsProps) {
  return (
    <div className="space-y-4">
      {/* Warning banner if failed deliveries exist */}
      {metrics.failedDeliveryCount > 0 && (
        <div className="bg-status-warning/10 border border-status-warning/20 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <div className="text-status-warning font-semibold">
              Warning: {metrics.failedDeliveryCount} failed email{' '}
              {metrics.failedDeliveryCount === 1 ? 'delivery' : 'deliveries'}
            </div>
          </div>
          <p className="text-sm text-status-warning mt-1">
            Some reminder emails failed to deliver. Check the email log for details.
          </p>
        </div>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="group py-5 hover:shadow-md transition-shadow duration-200">
          <CardContent className="px-5 py-0">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Overdue Clients
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

        <Card className="group py-5 hover:shadow-md transition-shadow duration-200">
          <CardContent className="px-5 py-0">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Actively Chasing
                </p>
                <p className="text-4xl font-bold mt-3">
                  {metrics.chasingCount}
                </p>
              </div>
              <div className="size-10 rounded-lg bg-status-warning/10 flex items-center justify-center transition-all duration-200 group-hover:bg-status-warning/20">
                <Send className="size-6 text-status-warning" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="group py-5 hover:shadow-md transition-shadow duration-200">
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
              <div className="size-10 rounded-lg bg-status-info/10 flex items-center justify-center transition-all duration-200 group-hover:bg-status-info/20">
                <MailCheck className="size-6 text-status-info" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="group py-5 hover:shadow-md transition-shadow duration-200">
          <CardContent className="px-5 py-0">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Paused Clients
                </p>
                <p className="text-4xl font-bold mt-3">
                  {metrics.pausedCount}
                </p>
              </div>
              <div className="size-10 rounded-lg bg-sky-500/10 flex items-center justify-center transition-all duration-200 group-hover:bg-sky-500/20">
                <PauseCircle className="size-6 text-sky-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
