'use client';

import type { TrafficLightStatus } from '@/lib/dashboard/traffic-light';

interface TrafficLightBadgeProps {
  status: TrafficLightStatus;
}

const STATUS_CONFIG: Record<
  TrafficLightStatus,
  { label: string; bg: string; text: string }
> = {
  green: {
    label: 'On Track',
    bg: 'bg-status-success/10',
    text: 'text-status-success',
  },
  amber: {
    label: 'Chasing',
    bg: 'bg-status-warning/10',
    text: 'text-status-warning',
  },
  red: {
    label: 'Overdue',
    bg: 'bg-status-danger/10',
    text: 'text-status-danger',
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
