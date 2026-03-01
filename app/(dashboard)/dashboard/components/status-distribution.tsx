'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import type { ClientStatusRow } from '@/lib/dashboard/metrics';
import { BarChart3 } from 'lucide-react';

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

  const statusData = [
    {
      label: 'Overdue',
      count: statusCounts.red,
      percentage: total > 0 ? (statusCounts.red / total) * 100 : 0,
      color: '#ef4444',
      bgColor: 'bg-status-danger',
      filterValue: 'red',
    },
    {
      label: 'Critical',
      count: statusCounts.orange,
      percentage: total > 0 ? (statusCounts.orange / total) * 100 : 0,
      color: '#f97316',
      bgColor: 'bg-status-critical',
      filterValue: 'orange',
    },
    {
      label: 'Approaching',
      count: statusCounts.amber,
      percentage: total > 0 ? (statusCounts.amber / total) * 100 : 0,
      color: '#eab308',
      bgColor: 'bg-status-warning',
      filterValue: 'amber',
    },
    {
      label: 'Scheduled',
      count: statusCounts.blue,
      percentage: total > 0 ? (statusCounts.blue / total) * 100 : 0,
      color: '#3b82f6',
      bgColor: 'bg-status-info',
      filterValue: 'blue',
    },
    {
      label: 'Records In',
      count: statusCounts.violet,
      percentage: total > 0 ? (statusCounts.violet / total) * 100 : 0,
      color: '#8b5cf6',
      bgColor: 'bg-violet-500',
      filterValue: 'violet',
    },
    {
      label: 'Completed',
      count: statusCounts.green,
      percentage: total > 0 ? (statusCounts.green / total) * 100 : 0,
      color: '#10b981',
      bgColor: 'bg-green-500',
      filterValue: 'green',
    },
    {
      label: 'Inactive',
      count: statusCounts.grey,
      percentage: total > 0 ? (statusCounts.grey / total) * 100 : 0,
      color: '#94a3b8',
      bgColor: 'bg-status-neutral',
      filterValue: 'grey',
    },
  ];

  const visibleSegments = statusData.filter((item) => item.count > 0);

  return (
    <Card className="group py-5 hover:shadow-md transition-shadow duration-200">
      <CardContent className="px-5 py-0">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Client Status Distribution
            </p>
            <p className="text-2xl font-bold mt-1">{total} clients</p>
          </div>
          <div className="size-10 rounded-lg bg-green-500/10 flex items-center justify-center transition-all duration-200 group-hover:bg-green-500/20">
            <BarChart3 className="size-6 text-green-600" />
          </div>
        </div>

        {total === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No clients to display
          </p>
        ) : (
          <>
            {/* Stacked bar */}
            <div className="flex h-2.5 rounded-full overflow-hidden gap-px">
              {visibleSegments.map((item) => (
                <Link
                  key={item.filterValue}
                  href={`/clients?filter=${item.filterValue}`}
                  className="transition-opacity hover:opacity-80 rounded-full"
                  style={{
                    backgroundColor: item.color,
                    width: `${item.percentage}%`,
                  }}
                  title={`${item.label}: ${item.count} (${item.percentage.toFixed(0)}%)`}
                />
              ))}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4">
              {statusData.map((item) => (
                <Link
                  key={item.filterValue}
                  href={`/clients?filter=${item.filterValue}`}
                  className="flex items-center gap-1.5 hover:opacity-70 transition-opacity"
                >
                  <div
                    className="size-3 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm text-muted-foreground">
                    {item.label}{' '}
                    <span className="font-medium text-foreground">{item.count}</span>
                  </span>
                </Link>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
