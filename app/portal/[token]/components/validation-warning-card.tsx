'use client';

import { AlertTriangle } from 'lucide-react';

interface ValidationWarning {
  code: string;
  message: string;
  expected?: string;
  found?: string;
}

interface ValidationWarningCardProps {
  warnings: ValidationWarning[];
}

export function ValidationWarningCard({ warnings }: ValidationWarningCardProps) {
  return (
    <div className="mt-3 flex items-start gap-3 p-4 bg-amber-500/10 rounded-xl">
      <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
      <div className="space-y-2">
        <p className="text-sm font-medium text-amber-600">
          {warnings.length === 1 ? 'Possible issue detected' : `${warnings.length} possible issues detected`}
        </p>
        <div className="space-y-1.5">
          {warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-600/80">{w.message}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
