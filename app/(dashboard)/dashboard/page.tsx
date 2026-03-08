'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { getDashboardMetrics, getClientStatusList, type DashboardMetrics, type ClientStatusRow } from '@/lib/dashboard/metrics';
import { getWorkloadForecast, type MonthlyWorkload } from '@/lib/dashboard/forecast';
import { PageLoadingProvider, usePageLoading } from '@/components/page-loading';
import { buttonBaseVariants } from '@/components/ui/button-base';
import { Rocket, Zap } from 'lucide-react';
import { SummaryCards } from './components/summary-cards';
import { UpcomingDeadlines } from './components/upcoming-deadlines';
import { StatusDistribution } from './components/status-distribution';
import { AlertFeed } from './components/alert-feed';
import { WorkloadForecast } from './components/workload-forecast';

function DashboardContent() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    overdueCount: 0,
    criticalCount: 0,
    approachingCount: 0,
    approachingSentCount: 0,
    scheduledCount: 0,
    completedCount: 0,
    violetCount: 0,
    inactiveCount: 0,
    sentTodayCount: 0,
    pausedCount: 0,
    failedDeliveryCount: 0,
    completionRate: 0,
  });
  const [clientStatusList, setClientStatusList] = useState<ClientStatusRow[]>([]);
  const [forecastData, setForecastData] = useState<MonthlyWorkload[]>([]);
  const [loading, setLoading] = useState(true);

  usePageLoading('dashboard-data', loading);

  useEffect(() => {
    const supabase = createClient();

    Promise.all([
      getDashboardMetrics(supabase),
      getClientStatusList(supabase),
      getWorkloadForecast(supabase),
    ])
      .then(([metricsData, clientsData, forecast]) => {
        setMetrics(metricsData);
        setClientStatusList(clientsData);
        setForecastData(forecast);
      })
      .catch((error) => {
        console.error('Error loading dashboard:', error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div className="space-y-10 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1>Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Monitor client reminder status and email activity
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/help#go-further"
            target="_blank"
            className={buttonBaseVariants({ variant: 'blue', buttonType: 'icon-text' })}
          >
            <Zap className="size-4" />
            Go further
          </Link>
          <Link
            href="/help#getting-started"
            target="_blank"
            className={buttonBaseVariants({ variant: 'green', buttonType: 'icon-text' })}
          >
            <Rocket className="size-4" />
            Get started
          </Link>
        </div>
      </div>

      {/* Summary metrics */}
      <SummaryCards metrics={metrics} />

      {/* Status distribution - full width */}
      <StatusDistribution clients={clientStatusList} />

      {/* Upcoming Deadlines & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UpcomingDeadlines clients={clientStatusList} />
        <AlertFeed />
      </div>

      {/* Workload forecast - full width */}
      <WorkloadForecast data={forecastData} />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <PageLoadingProvider>
      <DashboardContent />
    </PageLoadingProvider>
  );
}
