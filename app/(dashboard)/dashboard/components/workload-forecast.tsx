'use client';

import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import type { MonthlyWorkload } from '@/lib/dashboard/forecast';

interface WorkloadForecastProps {
  data: MonthlyWorkload[];
}

export function WorkloadForecast({ data }: WorkloadForecastProps) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  // Current month ISO string for highlighting
  const now = new Date();
  const currentIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Generate grid line values (roughly 4 lines)
  const gridLines: number[] = [];
  if (maxCount > 0) {
    const step = Math.max(1, Math.ceil(maxCount / 4));
    for (let v = step; v <= maxCount; v += step) {
      gridLines.push(v);
    }
  }

  const totalFilings = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <Card className="group py-5 hover:shadow-md transition-shadow duration-200">
      <CardContent className="px-5 py-0">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Monthly Workload Forecast
            </p>
            <p className="text-2xl font-bold mt-1">{totalFilings} filings</p>
          </div>
          <div className="size-10 rounded-lg bg-blue-500/10 flex items-center justify-center transition-all duration-200 group-hover:bg-blue-500/20">
            <TrendingUp className="size-6 text-blue-500" />
          </div>
        </div>

        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No forecast data available
          </p>
        ) : (
          <div className="flex gap-2">
            {/* Y-axis labels */}
            <div className="flex flex-col justify-between h-48 py-0.5 pr-1 w-6">
              {[...gridLines].reverse().map((v) => (
                <span
                  key={v}
                  className="text-[10px] tabular-nums text-muted-foreground text-right leading-none"
                  style={{ position: 'relative', top: `${(1 - v / maxCount) * 100}%` }}
                >
                  {v}
                </span>
              ))}
              <span className="text-[10px] tabular-nums text-muted-foreground text-right leading-none">
                0
              </span>
            </div>

            {/* Chart area */}
            <div className="flex-1 relative">
              {/* Grid lines */}
              <div className="absolute inset-0 h-48 pointer-events-none">
                {gridLines.map((v) => (
                  <div
                    key={v}
                    className="absolute w-full border-t border-border/40"
                    style={{ bottom: `${(v / maxCount) * 100}%` }}
                  />
                ))}
                <div className="absolute w-full border-t border-border/40 bottom-0" />
              </div>

              {/* Bars */}
              <div className="flex items-end gap-1.5 sm:gap-2 h-48 relative z-10">
                {data.map((item) => {
                  const heightPct = (item.count / maxCount) * 100;
                  const isCurrent = item.isoMonth === currentIso;

                  return (
                    <div
                      key={item.isoMonth}
                      className="flex-1 flex flex-col items-center justify-end h-full group/bar"
                    >
                      {/* Count label */}
                      {item.count > 0 && (
                        <span className="text-[11px] font-semibold tabular-nums text-foreground/60 mb-1 opacity-0 group-hover/bar:opacity-100 transition-opacity duration-200">
                          {item.count}
                        </span>
                      )}
                      {/* Bar */}
                      <div
                        className="w-full flex justify-center transition-all duration-500"
                        style={{
                          height: `${Math.max(heightPct, item.count > 0 ? 4 : 0)}%`,
                        }}
                      >
                        <div
                          className={`w-full max-w-10 rounded-t-md transition-all duration-200 group-hover/bar:opacity-80 ${
                            isCurrent
                              ? 'bg-blue-500'
                              : 'bg-blue-500/30'
                          }`}
                          style={{ height: '100%' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* X-axis labels */}
              <div className="flex gap-1.5 sm:gap-2 mt-2.5">
                {data.map((item) => {
                  const isCurrent = item.isoMonth === currentIso;
                  // Show abbreviated month only (e.g. "Mar" from "Mar 2026")
                  const shortMonth = item.month.split(' ')[0];
                  return (
                    <div key={item.isoMonth} className="flex-1 text-center">
                      <span
                        className={`text-[11px] ${
                          isCurrent
                            ? 'font-semibold text-blue-600 dark:text-blue-400'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {shortMonth}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
