'use client';

import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import type { MonthlyWorkload } from '@/lib/dashboard/forecast';

interface WorkloadForecastProps {
  data: MonthlyWorkload[];
}

export function WorkloadForecast({ data }: WorkloadForecastProps) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <Card className="group py-5 hover:shadow-md transition-shadow duration-200">
      <CardContent className="px-5 py-0">
        <div className="flex items-start justify-between mb-6">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Monthly Workload Forecast
          </p>
          <div className="size-10 rounded-lg bg-blue-500/10 flex items-center justify-center transition-all duration-200 group-hover:bg-blue-500/20">
            <TrendingUp className="size-6 text-blue-500" />
          </div>
        </div>

        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No forecast data available
          </p>
        ) : (
          <div className="flex gap-3">
            {/* Y-axis label */}
            <div className="flex items-center justify-center">
              <span
                className="text-xs text-muted-foreground whitespace-nowrap"
                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
              >
                Filings due
              </span>
            </div>

            {/* Chart area */}
            <div className="flex-1">
              <div className="flex items-end gap-3 h-40">
                {data.map((item) => {
                  const heightPct = (item.count / maxCount) * 100;
                  return (
                    <div key={item.isoMonth} className="flex-1 flex flex-col items-center justify-end gap-1.5 h-full">
                      {item.count > 0 && (
                        <span className="text-xs font-semibold tabular-nums text-foreground/70">
                          {item.count}
                        </span>
                      )}
                      <div className="flex justify-center w-full" style={{ height: `${Math.max(heightPct, item.count > 0 ? 4 : 0)}%` }}>
                        <div
                          className="w-8 rounded-t-md bg-blue-500 transition-all duration-500"
                          style={{ height: '100%' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-3 mt-2 border-t border-border/50 pt-2">
                {data.map((item) => (
                  <div key={item.isoMonth} className="flex-1 text-center">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {item.month}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
