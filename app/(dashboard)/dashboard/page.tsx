'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getDashboardMetrics, getClientStatusList, type DashboardMetrics, type ClientStatusRow } from '@/lib/dashboard/metrics';
import { getOnboardingProgress, getGoFurtherProgress, type OnboardingProgress, type GoFurtherProgress } from '@/lib/dashboard/onboarding';
import { PageLoadingProvider, usePageLoading } from '@/components/page-loading';
import { buttonBaseVariants } from '@/components/ui/button-base';
import { EyeOff, Rocket, Zap } from 'lucide-react';
import { SummaryCards } from './components/summary-cards';
import { UpcomingDeadlines } from './components/upcoming-deadlines';
import { AlertFeed } from './components/alert-feed';
import { WorkloadForecast } from './components/workload-forecast';
import { GettingStarted } from './components/getting-started';
import { GoFurther } from './components/go-further';

type ActivePanel = 'getting-started' | 'go-further' | null;

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
  const [activePanel, setActivePanel] = useState<ActivePanel>('getting-started');
  const [loading, setLoading] = useState(true);

  usePageLoading('dashboard-data', loading);

  useEffect(() => {
    const supabase = createClient();

    Promise.all([
      getDashboardMetrics(supabase),
      getClientStatusList(supabase),
      getOnboardingProgress(supabase),
      getGoFurtherProgress(supabase),
    ])
      .then(([metricsData, clientsData, onboardingData, goFurtherData]) => {
        setMetrics(metricsData);
        setClientStatusList(clientsData);
        setOnboarding(onboardingData);
        setGoFurther(goFurtherData);
        // If getting started was dismissed, don't show either panel by default
        if (onboardingData.dismissed) setActivePanel(null);
      })
      .catch((error) => {
        console.error('Error loading dashboard:', error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const onboardingDismissed = onboarding?.dismissed ?? false;

  function togglePanel(panel: 'getting-started' | 'go-further') {
    setActivePanel((current) => (current === panel ? null : panel));
  }

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
            onClick={() => togglePanel('go-further')}
            className={buttonBaseVariants({
              variant: activePanel === 'go-further' ? 'amber' : 'blue',
              buttonType: 'icon-text',
            })}
          >
            {activePanel === 'go-further' ? (
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
          {!onboardingDismissed && (
            <button
              onClick={() => togglePanel('getting-started')}
              className={buttonBaseVariants({
                variant: activePanel === 'getting-started' ? 'amber' : 'green',
                buttonType: 'icon-text',
              })}
            >
              {activePanel === 'getting-started' ? (
                <>
                  <EyeOff className="size-4" />
                  Hide get started
                </>
              ) : (
                <>
                  <Rocket className="size-4" />
                  Get started
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Getting started checklist */}
      {onboarding && activePanel === 'getting-started' && !onboardingDismissed && (
        <GettingStarted
          progress={onboarding}
          onDismiss={() => {
            setActivePanel(null);
            setOnboarding((prev) => prev ? { ...prev, dismissed: true } : prev);
          }}
        />
      )}

      {/* Go further checklist */}
      {goFurther && activePanel === 'go-further' && (
        <GoFurther progress={goFurther} />
      )}

      {/* Summary metrics */}
      <SummaryCards metrics={metrics} />

      {/* Workload Forecast - full width */}
      <WorkloadForecast />

      {/* Upcoming Deadlines & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UpcomingDeadlines clients={clientStatusList} />
        <AlertFeed />
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
