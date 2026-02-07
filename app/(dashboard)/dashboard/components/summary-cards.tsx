'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Overdue Clients
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-status-danger">
              {metrics.overdueCount}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Actively Chasing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-status-warning">
              {metrics.chasingCount}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Sent Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-status-info">
              {metrics.sentTodayCount}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Paused Clients
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-status-neutral">
              {metrics.pausedCount}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
