'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getDashboardMetrics, getClientStatusList, type DashboardMetrics, type ClientStatusRow } from '@/lib/dashboard/metrics';
import { PageLoadingProvider, usePageLoading } from '@/components/page-loading';
import { SummaryCards } from './components/summary-cards';
import { UpcomingDeadlines } from './components/upcoming-deadlines';
import { StatusDistribution } from './components/status-distribution';
import { DeliveryLogTable } from '../delivery-log/components/delivery-log-table';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

type ViewMode = 'sent' | 'queued';

function DashboardContent() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    overdueCount: 0,
    chasingCount: 0,
    sentTodayCount: 0,
    pausedCount: 0,
    failedDeliveryCount: 0,
  });
  const [clientStatusList, setClientStatusList] = useState<ClientStatusRow[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('sent');
  const [loading, setLoading] = useState(true);

  usePageLoading('dashboard-data', loading);

  useEffect(() => {
    const supabase = createClient();

    Promise.all([
      getDashboardMetrics(supabase),
      getClientStatusList(supabase),
    ])
      .then(([metricsData, clientsData]) => {
        setMetrics(metricsData);
        setClientStatusList(clientsData);
      })
      .catch((error) => {
        console.error('Error loading dashboard:', error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div className="space-y-10">
      {/* Page header */}
      <div className="space-y-1">
        <h1>Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Monitor client reminder status and email activity
        </p>
      </div>

      {/* Summary metrics */}
      <SummaryCards metrics={metrics} />

      {/* Upcoming Deadlines & Client Status Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UpcomingDeadlines clients={clientStatusList} />
        <StatusDistribution clients={clientStatusList} />
      </div>

      {/* Delivery Log Section */}
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight">Delivery Log</h2>
            <p className="text-muted-foreground">
              View sent email history and queued reminders
            </p>
          </div>

          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <TabsList>
              <TabsTrigger value="sent">Sent Emails</TabsTrigger>
              <TabsTrigger value="queued">Queued Emails</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <DeliveryLogTable viewMode={viewMode} />
      </div>
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
