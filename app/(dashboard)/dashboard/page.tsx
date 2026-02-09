import { createClient } from '@/lib/supabase/server';
import { getDashboardMetrics, getClientStatusList } from '@/lib/dashboard/metrics';
import { PageLoadingProvider } from '@/components/page-loading';
import { SummaryCards } from './components/summary-cards';
import { UpcomingDeadlines } from './components/upcoming-deadlines';
import { StatusDistribution } from './components/status-distribution';
import { AuditLogCard } from './components/audit-log-card';

export default async function DashboardPage() {
  const supabase = await createClient();

  // Fetch dashboard data
  const [metrics, clientStatusList] = await Promise.all([
    getDashboardMetrics(supabase),
    getClientStatusList(supabase),
  ]);

  return (
    <PageLoadingProvider>
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

        {/* Upcoming Deadlines & Recent Emails */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <UpcomingDeadlines clients={clientStatusList} />
          <AuditLogCard />
        </div>

        {/* Status Distribution */}
        <StatusDistribution clients={clientStatusList} />
      </div>
    </PageLoadingProvider>
  );
}
