'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getDashboardMetrics, getClientStatusList, getRecentUploads, getDocsNeedingReview, getFailedDeliveries, type DashboardMetrics, type ClientStatusRow, type RecentUpload, type DocNeedingReview, type FailedDelivery } from '@/lib/dashboard/metrics';
import { getGoFurtherProgress, getOnboardingProgress, type OnboardingProgress, type GoFurtherProgress } from '@/lib/dashboard/onboarding';
import { PageLoadingProvider, usePageLoading } from '@/components/page-loading';
import { buttonBaseVariants } from '@/components/ui/button-base';
import { EyeOff, Zap } from 'lucide-react';
import { UpcomingDeadlines } from './components/upcoming-deadlines';
import { WorkloadForecast } from './components/workload-forecast';
import { TodoBox } from './components/todo-box';
import { GoFurther } from './components/go-further';
import { RecentUploads } from './components/recent-uploads';
import { logger } from '@/lib/logger';

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
    docsNeedingReviewCount: 0,
    completionRate: 0,
  });
  const [clientStatusList, setClientStatusList] = useState<ClientStatusRow[]>([]);
  const [onboarding, setOnboarding] = useState<OnboardingProgress | null>(null);
  const [goFurther, setGoFurther] = useState<GoFurtherProgress | null>(null);
  const [recentUploads, setRecentUploads] = useState<RecentUpload[]>([]);
  const [docsNeedingReview, setDocsNeedingReview] = useState<DocNeedingReview[]>([]);
  const [failedDeliveries, setFailedDeliveries] = useState<FailedDelivery[]>([]);
  const [showGoFurther, setShowGoFurther] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  usePageLoading('dashboard-data', loading);

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    try {
      const [metricsData, clientsData, onboardingData, goFurtherData, uploadsData, docsReviewData, failedData] =
        await Promise.all([
          getDashboardMetrics(supabase),
          getClientStatusList(supabase),
          getOnboardingProgress(supabase),
          getGoFurtherProgress(supabase),
          getRecentUploads(supabase),
          getDocsNeedingReview(supabase),
          getFailedDeliveries(supabase),
        ]);
      setMetrics(metricsData);
      setClientStatusList(clientsData);
      setOnboarding(onboardingData);
      setGoFurther(goFurtherData);
      setRecentUploads(uploadsData);
      setDocsNeedingReview(docsReviewData);
      setFailedDeliveries(failedData);
      // Bump refreshKey so WorkloadForecast re-fetches its own data
      setRefreshKey((k) => k + 1);
    } catch (error) {
      logger.error('Error loading dashboard:', { error: (error as any)?.message ?? String(error) });
    }
  }, []);

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

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
          <button
            onClick={() => setShowGoFurther((v) => !v)}
            className={buttonBaseVariants({
              variant: showGoFurther ? 'amber' : 'blue',
              buttonType: 'icon-text',
            })}
          >
            {showGoFurther ? (
              <>
                <EyeOff className="size-4" />
                Hide go further
              </>
            ) : (
              <>
                <Zap className="size-4" />
                Go further
              </>
            )}
          </button>
        </div>
      </div>

      {/* Go further checklist */}
      {goFurther && showGoFurther && (
        <GoFurther progress={goFurther} />
      )}

      {/* To Do — full width */}
      <TodoBox
        metrics={metrics}
        clients={clientStatusList}
        onboarding={onboarding}
        docsNeedingReview={docsNeedingReview}
        failedDeliveries={failedDeliveries}
        onDataChange={fetchData}
      />

      {/* Upcoming Deadlines & Recent Uploads — side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UpcomingDeadlines clients={clientStatusList} />
        <RecentUploads uploads={recentUploads} onDataChange={fetchData} />
      </div>

      {/* Workload Forecast — full width */}
      <WorkloadForecast refreshKey={refreshKey} />
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
