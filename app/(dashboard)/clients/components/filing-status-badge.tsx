import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertCircle, Minus } from "lucide-react";
import type { TrafficLightStatus } from "@/lib/dashboard/traffic-light";

interface FilingStatusBadgeProps {
  status: TrafficLightStatus;
  isRecordsReceived: boolean;
  isOverride: boolean;
}

const STATUS_CONFIG: Record<TrafficLightStatus, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
  red: {
    bg: 'bg-status-danger/10',
    text: 'text-status-danger',
    icon: <XCircle className="h-4 w-4" />,
    label: 'Overdue',
  },
  orange: {
    bg: 'bg-status-critical/10',
    text: 'text-status-critical',
    icon: <AlertCircle className="h-4 w-4" />,
    label: 'Critical',
  },
  amber: {
    bg: 'bg-status-warning/10',
    text: 'text-status-warning',
    icon: <AlertCircle className="h-4 w-4" />,
    label: 'Approaching',
  },
  blue: {
    bg: 'bg-status-info/10',
    text: 'text-status-info',
    icon: <CheckCircle className="h-4 w-4" />,
    label: 'Scheduled',
  },
  green: {
    bg: 'bg-green-500/10',
    text: 'text-green-600',
    icon: <CheckCircle className="h-4 w-4" />,
    label: 'Records Received',
  },
  grey: {
    bg: 'bg-status-neutral/10',
    text: 'text-status-neutral',
    icon: <Minus className="h-4 w-4" />,
    label: 'Inactive',
  },
};

export function FilingStatusBadge({
  status,
  isRecordsReceived,
  isOverride,
}: FilingStatusBadgeProps) {
  // Records Received styling - GREEN (completed state)
  if (isRecordsReceived) {
    return (
      <div className="px-3 py-2 rounded-md bg-green-500/10 inline-flex items-center gap-2">
        <span className="text-green-600">
          <CheckCircle className="h-4 w-4" />
        </span>
        <span className="text-sm font-medium text-green-600">
          Records Received
        </span>
      </div>
    );
  }

  const config = STATUS_CONFIG[status];

  return (
    <div className={`px-3 py-2 rounded-md ${config.bg} inline-flex items-center gap-2`}>
      <span className={config.text}>
        {config.icon}
      </span>
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
