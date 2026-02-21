export default function AdminLoading() {
  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-pulse">
      {/* Page header skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-24 bg-muted rounded" />
        <div className="h-5 w-64 bg-muted rounded" />
      </div>

      {/* Table skeleton */}
      <div className="border rounded-lg overflow-hidden">
        {/* Header row */}
        <div className="bg-muted/50 border-b px-4 py-3 grid grid-cols-7 gap-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-4 bg-muted rounded" />
          ))}
        </div>

        {/* Body rows */}
        {Array.from({ length: 5 }).map((_, rowIdx) => (
          <div
            key={rowIdx}
            className="border-b px-4 py-3 grid grid-cols-7 gap-4 last:border-b-0"
          >
            {Array.from({ length: 7 }).map((_, colIdx) => (
              <div
                key={colIdx}
                className="h-4 bg-muted rounded"
                style={{ width: `${60 + Math.random() * 40}%` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
