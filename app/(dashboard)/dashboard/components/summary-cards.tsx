'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { MailCheck, FileCheck, CheckCircle2, MailX } from 'lucide-react';
import type { DashboardMetrics } from '@/lib/dashboard/metrics';

interface SummaryCardsProps {
  metrics: DashboardMetrics;
}

export function SummaryCards({ metrics }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
            <div className="size-10 rounded-lg bg-blue-500/10 flex items-center justify-center transition-all duration-200 group-hover:bg-blue-500/20">
              <MailCheck className="size-6 text-blue-500" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Link href="/email-logs?delivery_status=bounced,failed">
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

      <Link href="/clients?filter=violet">
        <Card className="group py-5 hover:shadow-md transition-shadow duration-200 cursor-pointer h-full">
          <CardContent className="px-5 py-0">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Needs Processing
                </p>
                <p className="text-4xl font-bold mt-3">
                  {metrics.violetCount}
                </p>
              </div>
              <div className="size-10 rounded-lg bg-violet-500/10 flex items-center justify-center transition-all duration-200 group-hover:bg-violet-500/20">
                <FileCheck className="size-6 text-violet-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>

      <Card className="group py-5 hover:shadow-md transition-shadow duration-200">
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
              <CheckCircle2 className="size-6 text-green-500" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
