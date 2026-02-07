import { createClient } from '@/lib/supabase/server';
import { getDashboardMetrics, getClientStatusList } from '@/lib/dashboard/metrics';
import { getAuditLog } from '@/app/actions/audit-log';
import { SummaryCards } from './components/summary-cards';
import { DashboardTabs } from './components/dashboard-tabs';

export default async function DashboardPage() {
  const supabase = await createClient();

  // Fetch dashboard data
  const [metrics, clientStatusList, auditLogResult] = await Promise.all([
    getDashboardMetrics(supabase),
    getClientStatusList(supabase),
    getAuditLog({ offset: 0, limit: 20 }), // Fetch first page of audit log
  ]);

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Monitor client reminder status and email activity
        </p>
      </div>

      {/* Summary metrics */}
      <SummaryCards metrics={metrics} />

      {/* Tabbed interface: Client Status and Audit Log */}
      <DashboardTabs
        clients={clientStatusList}
        initialAuditData={auditLogResult.data}
        auditTotalCount={auditLogResult.totalCount}
      />
    </div>
  );
}
