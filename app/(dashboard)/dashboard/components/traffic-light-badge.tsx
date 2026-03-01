'use client';

import type { TrafficLightStatus } from '@/lib/dashboard/traffic-light';

interface TrafficLightBadgeProps {
  status: TrafficLightStatus;
}

const STATUS_CONFIG: Record<
  TrafficLightStatus,
  { label: string; bg: string; text: string }
> = {
  red: {
    label: 'Overdue',
    bg: 'bg-status-danger/10',
    text: 'text-status-danger',
  },
  orange: {
    label: 'Critical',
    bg: 'bg-status-critical/10',
    text: 'text-status-critical',
  },
  amber: {
    label: 'Approaching',
    bg: 'bg-status-warning/10',
    text: 'text-status-warning',
  },
  blue: {
    label: 'Scheduled',
    bg: 'bg-status-info/10',
    text: 'text-status-info',
  },
  violet: {
    label: 'Records Received',
    bg: 'bg-violet-500/10',
    text: 'text-violet-600',
  },
  green: {
    label: 'Completed',
    bg: 'bg-green-500/10',
    text: 'text-green-600',
  },
  grey: {
    label: 'Inactive',
    bg: 'bg-status-neutral/10',
    text: 'text-status-neutral',
  },
};

export function TrafficLightBadge({ status }: TrafficLightBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <div className={`px-3 py-2 rounded-md ${config.bg} inline-flex items-center`}>
      <span className={`text-sm font-medium ${config.text}`}>
        {config.label}
      </span>
    </div>
  );
}
