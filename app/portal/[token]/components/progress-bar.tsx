'use client';

interface ProgressBarProps {
  provided: number;
  total: number;
}

export function ProgressBar({ provided, total }: ProgressBarProps) {
  const percentage = total > 0 ? Math.round((provided / total) * 100) : 0;
  const allDone = total > 0 && provided >= total;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">
          {provided} of {total} items provided
        </span>
        <span className={`text-sm font-medium ${allDone ? 'text-green-600' : 'text-violet-600'}`}>
          {percentage}%
        </span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${allDone ? 'bg-green-500' : 'bg-violet-500'}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {allDone && (
        <p className="mt-2 text-sm text-green-600 font-medium">
          All items provided — thank you!
        </p>
      )}
    </div>
  );
}
