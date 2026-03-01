import { Badge } from "@/components/ui/badge";
import type { TrafficLightStatus } from "@/lib/dashboard/traffic-light";

interface FilingStatusBadgeProps {
  status: TrafficLightStatus;
  isRecordsReceived: boolean;
  isOverride: boolean;
}

const STATUS_CONFIG: Record<TrafficLightStatus, { bg: string; text: string; label: string }> = {
  red: {
    bg: 'bg-status-danger/10',
    text: 'text-status-danger',
    label: 'Overdue',
  },
  orange: {
    bg: 'bg-status-critical/10',
    text: 'text-status-critical',
    label: 'Critical',
  },
  amber: {
    bg: 'bg-status-warning/10',
    text: 'text-status-warning',
    label: 'Approaching',
  },
  blue: {
    bg: 'bg-status-info/10',
    text: 'text-status-info',
    label: 'Scheduled',
  },
  violet: {
    bg: 'bg-violet-500/10',
    text: 'text-violet-600',
    label: 'Records Received',
  },
  green: {
    bg: 'bg-green-500/10',
    text: 'text-green-600',
    label: 'Completed',
  },
  grey: {
    bg: 'bg-status-neutral/10',
    text: 'text-status-neutral',
    label: 'Inactive',
  },
};

export function FilingStatusBadge({
  status,
  isRecordsReceived,
  isOverride,
}: FilingStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <div className={`px-3 py-2 rounded-md ${config.bg} inline-flex items-center gap-2`}>
      <span className={`text-sm font-medium ${config.text}`}>
        {config.label}
      </span>
      {isOverride && (
        <Badge variant="outline" className="text-xs border-accent text-accent h-5">
          Manual
        </Badge>
      )}
    </div>
  );
}
