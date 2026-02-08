'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Bell, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';

interface Alert {
  id: string;
  type: 'status_change' | 'new_overdue' | 'improvement';
  message: string;
  client: string;
  timestamp: Date;
}

export function AlertFeed() {
  // Sample alerts - in production, these would come from the database
  const alerts: Alert[] = [
    {
      id: '1',
      type: 'improvement',
      message: 'moved from Chasing to Up to Date',
      client: 'Smith & Associates',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    },
    {
      id: '2',
      type: 'new_overdue',
      message: 'moved to Overdue',
      client: 'Johnson Consulting',
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
    },
    {
      id: '3',
      type: 'status_change',
      message: 'moved from Up to Date to Chasing',
      client: 'Williams Tax Group',
      timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
    },
    {
      id: '4',
      type: 'improvement',
      message: 'moved from Chasing to Up to Date',
      client: 'Brown Financial',
      timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 hours ago
    },
  ];

  const getIcon = (type: Alert['type']) => {
    switch (type) {
      case 'improvement':
        return <CheckCircle className="size-4 text-emerald-500" />;
      case 'new_overdue':
        return <AlertCircle className="size-4 text-red-500" />;
      case 'status_change':
        return <TrendingUp className="size-4 text-amber-500" />;
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <Card className="group py-5 hover:shadow-md transition-shadow duration-200">
      <CardContent className="px-5 py-0">
        <div className="flex items-start justify-between mb-6">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Recent Alerts
          </p>
          <div className="size-10 rounded-lg bg-blue-500/10 flex items-center justify-center transition-all duration-200 group-hover:bg-blue-500/20">
            <Bell className="size-6 text-blue-500" />
          </div>
        </div>

        <div className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-start gap-3 py-2 px-2 rounded-md hover:bg-muted/50 transition-colors"
            >
              <div className="mt-0.5">{getIcon(alert.type)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight">
                  <span className="text-foreground">{alert.client}</span>{' '}
                  <span className="text-muted-foreground">{alert.message}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatTime(alert.timestamp)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
