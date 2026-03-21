import { Badge } from "@/components/ui/badge";
import type { TrafficLightStatus } from "@/lib/dashboard/traffic-light";

interface DocProgressRingProps {
  received: number;
  required: number;
  colorClass: string;
}

export function DocProgressRing({ received, required, colorClass }: DocProgressRingProps) {
  const size = 18;
  const strokeWidth = 2.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = required > 0 ? received / required : 0;
  const dashoffset = circumference * (1 - progress);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="opacity-20"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashoffset}
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

interface FilingStatusBadgeProps {
  status: TrafficLightStatus;
  isRecordsReceived: boolean;
  isOverride: boolean;
  docReceived?: number;
  docRequired?: number;
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
    label: 'On Track',
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
  docReceived,
  docRequired,
}: FilingStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const showRing = docRequired != null && docRequired > 0 && docReceived != null;

  return (
    <div className={`px-3 py-2 rounded-md ${config.bg} inline-flex items-center gap-2 ${config.text}`}>
      <span className={`text-sm font-medium`}>
        {config.label}
      </span>
      {showRing && (
        <DocProgressRing
          received={docReceived!}
          required={docRequired!}
          colorClass={config.text}
        />
      )}
      {isOverride && (
        <Badge variant="outline" className="text-xs border-accent text-accent h-5">
          Manual
        </Badge>
      )}
    </div>
  );
}
