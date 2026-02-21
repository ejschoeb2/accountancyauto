import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function OrgDetailLoading() {
  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Back link placeholder */}
      <div className="space-y-1">
        <div className="h-4 w-44 rounded bg-muted animate-pulse" />
        <div className="h-8 w-64 rounded bg-muted animate-pulse mt-3" />
        <div className="h-4 w-32 rounded bg-muted animate-pulse mt-1" />
      </div>

      {/* Section 1: Organisation Settings skeleton */}
      <Card>
        <CardHeader>
          <div className="h-5 w-48 rounded bg-muted animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <div className="h-3 w-20 rounded bg-muted animate-pulse" />
                <div className="h-4 w-36 rounded bg-muted animate-pulse" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Team Members skeleton */}
      <Card>
        <CardHeader>
          <div className="h-5 w-40 rounded bg-muted animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-8">
                <div className="h-4 w-32 rounded bg-muted animate-pulse" />
                <div className="h-4 w-48 rounded bg-muted animate-pulse" />
                <div className="h-4 w-16 rounded bg-muted animate-pulse" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Stripe skeleton */}
      <Card>
        <CardHeader>
          <div className="h-5 w-16 rounded bg-muted animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <div className="h-3 w-24 rounded bg-muted animate-pulse" />
                <div className="h-4 w-64 rounded bg-muted animate-pulse" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
