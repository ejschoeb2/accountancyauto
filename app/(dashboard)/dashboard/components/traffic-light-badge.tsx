'use client';

import { Badge } from '@/components/ui/badge';
import type { TrafficLightStatus } from '@/lib/dashboard/traffic-light';

interface TrafficLightBadgeProps {
  status: TrafficLightStatus;
}

const STATUS_CONFIG: Record<
  TrafficLightStatus,
  { label: string; className: string }
> = {
  green: {
    label: 'On Track',
    className: 'bg-status-success text-white hover:bg-status-success',
  },
  amber: {
    label: 'Chasing',
    className: 'bg-status-warning text-white hover:bg-status-warning',
  },
  red: {
    label: 'Overdue',
    className: 'bg-status-danger text-white hover:bg-status-danger',
  },
  grey: {
    label: 'Inactive',
    className: 'bg-status-neutral/20 text-status-neutral hover:bg-status-neutral/20',
  },
};

export function TrafficLightBadge({ status }: TrafficLightBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <Badge
      className={config.className}
      aria-label={`Status: ${config.label}`}
    >
      {config.label}
    </Badge>
  );
}
