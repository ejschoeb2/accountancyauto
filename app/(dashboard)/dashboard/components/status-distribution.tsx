'use client';

import { Card, CardContent } from '@/components/ui/card';
import type { ClientStatusRow } from '@/lib/dashboard/metrics';
import { PieChart } from 'lucide-react';

interface StatusDistributionProps {
  clients: ClientStatusRow[];
}

export function StatusDistribution({ clients }: StatusDistributionProps) {
  // Count clients by status
  const statusCounts = {
    red: clients.filter((c) => c.status === 'red').length,
    orange: clients.filter((c) => c.status === 'orange').length,
    amber: clients.filter((c) => c.status === 'amber').length,
    blue: clients.filter((c) => c.status === 'blue').length,
    violet: clients.filter((c) => c.status === 'violet').length,
    green: clients.filter((c) => c.status === 'green').length,
    grey: clients.filter((c) => c.status === 'grey').length,
  };

  const total = clients.length;

  // Calculate percentages - show all statuses regardless of count
  const statusData = [
    {
      label: 'Overdue',
      subtext: 'Deadline passed',
      count: statusCounts.red,
      percentage: total > 0 ? (statusCounts.red / total) * 100 : 0,
      color: '#ef4444', // Lighter red to match badge style
      bgColor: 'bg-status-danger',
    },
    {
      label: 'Critical',
      subtext: '< 1 week',
      count: statusCounts.orange,
      percentage: total > 0 ? (statusCounts.orange / total) * 100 : 0,
      color: '#f97316', // Lighter orange to match badge style
      bgColor: 'bg-status-critical',
    },
    {
      label: 'Approaching',
      subtext: '1-4 weeks',
      count: statusCounts.amber,
      percentage: total > 0 ? (statusCounts.amber / total) * 100 : 0,
      color: '#eab308', // Lighter yellow to match badge style
      bgColor: 'bg-status-warning',
    },
    {
      label: 'Scheduled',
      subtext: '> 4 weeks',
      count: statusCounts.blue,
      percentage: total > 0 ? (statusCounts.blue / total) * 100 : 0,
      color: '#38bdf8', // Lighter sky blue to match badge style
      bgColor: 'bg-sky-500',
    },
    {
      label: 'Records Received',
      subtext: 'Awaiting Submission',
      count: statusCounts.violet,
      percentage: total > 0 ? (statusCounts.violet / total) * 100 : 0,
      color: '#8b5cf6', // Violet to match badge style
      bgColor: 'bg-violet-500',
    },
    {
      label: 'Completed',
      subtext: 'Fully processed',
      count: statusCounts.green,
      percentage: total > 0 ? (statusCounts.green / total) * 100 : 0,
      color: '#10b981', // Standard button green (green-500)
      bgColor: 'bg-green-500',
    },
    {
      label: 'Inactive',
      subtext: 'Paused/No filings',
      count: statusCounts.grey,
      percentage: total > 0 ? (statusCounts.grey / total) * 100 : 0,
      color: '#94a3b8', // Lighter slate to match badge style
      bgColor: 'bg-status-neutral',
    },
  ];

  return (
    <Card className="group py-5 hover:shadow-md transition-shadow duration-200">
      <CardContent className="px-5 py-0 h-full flex flex-col">
        <div className="flex items-start justify-between mb-6">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Client Status Distribution
          </p>
          <div className="size-10 rounded-lg bg-green-500/10 flex items-center justify-center transition-all duration-200 group-hover:bg-green-500/20">
            <PieChart className="size-6 text-green-600" />
          </div>
        </div>
        <div className="flex-1">
          {total === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No clients to display
            </p>
          ) : (
            <div className="flex items-center justify-center gap-9">
              {/* Pie chart */}
              <div className="flex items-center justify-center flex-shrink-0">
                <div className="relative size-40">
                  <div
                    className="size-full rounded-full"
                    style={{
                      background: `conic-gradient(${statusData
                        .filter((item) => item.count > 0)
                        .map((item, index, arr) => {
                          const startPercent = arr
                            .slice(0, index)
                            .reduce((sum, d) => sum + d.percentage, 0);
                          const endPercent = startPercent + item.percentage;
                          return `${item.color} ${startPercent}% ${endPercent}%`;
                        })
                        .join(', ')})`,
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="size-28 rounded-full bg-card flex items-center justify-center">
                      <span className="text-4xl font-bold">{total}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div className="space-y-3 min-w-[300px]">
                {statusData.map((item) => (
                  <div key={item.label} className="flex items-center gap-2.5">
                    <div className={`size-4 rounded ${item.bgColor} flex-shrink-0`} />
                    <div className="flex items-baseline gap-6 flex-1">
                      <div className="flex items-baseline gap-1 flex-1">
                        <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>
                        <span className="text-sm whitespace-nowrap">({item.subtext})</span>
                      </div>
                      <span className="text-sm text-muted-foreground whitespace-nowrap">
                        {item.count} ({item.percentage.toFixed(0)}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
