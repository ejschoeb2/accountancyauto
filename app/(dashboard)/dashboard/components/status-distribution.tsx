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
    amber: clients.filter((c) => c.status === 'amber').length,
    green: clients.filter((c) => c.status === 'green').length,
    grey: clients.filter((c) => c.status === 'grey').length,
  };

  const total = clients.length;

  // Calculate percentages
  const statusData = [
    {
      label: 'Overdue',
      count: statusCounts.red,
      percentage: total > 0 ? (statusCounts.red / total) * 100 : 0,
      color: '#ef4444',
      bgColor: 'bg-status-danger',
    },
    {
      label: 'Chasing',
      count: statusCounts.amber,
      percentage: total > 0 ? (statusCounts.amber / total) * 100 : 0,
      color: '#f59e0b',
      bgColor: 'bg-status-warning',
    },
    {
      label: 'Up to Date',
      count: statusCounts.green,
      percentage: total > 0 ? (statusCounts.green / total) * 100 : 0,
      color: '#10b981',
      bgColor: 'bg-status-success',
    },
    {
      label: 'Paused',
      count: statusCounts.grey,
      percentage: total > 0 ? (statusCounts.grey / total) * 100 : 0,
      color: '#9ca3af',
      bgColor: 'bg-status-neutral',
    },
  ].filter((item) => item.count > 0); // Only show statuses with clients

  return (
    <Card className="group py-5 hover:shadow-md transition-shadow duration-200">
      <CardContent className="px-5 py-0">
        <div className="flex items-start justify-between mb-6">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Client Status Distribution
          </p>
          <div className="size-10 rounded-lg bg-emerald-500/10 flex items-center justify-center transition-all duration-200 group-hover:bg-emerald-500/20">
            <PieChart className="size-6 text-emerald-500" />
          </div>
        </div>
        <div>
          {total === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No clients to display
            </p>
          ) : (
            <div className="space-y-6">
              {/* Simple pie chart using conic gradient */}
              <div className="flex items-center justify-center py-4">
                <div className="relative size-48">
                  <div
                    className="size-full rounded-full"
                    style={{
                      background: `conic-gradient(${statusData
                        .map((item, index) => {
                          const startPercent = statusData
                            .slice(0, index)
                            .reduce((sum, d) => sum + d.percentage, 0);
                          const endPercent = startPercent + item.percentage;
                          return `${item.color} ${startPercent}% ${endPercent}%`;
                        })
                        .join(', ')})`,
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="size-32 rounded-full bg-card flex flex-col items-center justify-center">
                      <span className="text-3xl font-bold">{total}</span>
                      <span className="text-xs text-muted-foreground">Clients</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div className="grid grid-cols-2 gap-3">
                {statusData.map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <div className={`size-3 rounded-sm ${item.bgColor}`} />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-xs font-medium truncate">{item.label}</span>
                      <span className="text-xs text-muted-foreground">
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
