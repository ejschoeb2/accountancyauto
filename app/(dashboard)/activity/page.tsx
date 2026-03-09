'use client';

import { useState, Component, type ReactNode } from 'react';
import { PageLoadingProvider } from '@/components/page-loading';
import { DeliveryLogTable } from '@/app/(dashboard)/email-logs/components/delivery-log-table';
import { UploadsTable } from '@/app/(dashboard)/email-logs/components/uploads-table';
import { ToggleGroup } from '@/components/ui/toggle-group';
import { AlertCircle } from 'lucide-react';

type DirectionMode = 'outbound' | 'uploads';
type ViewMode = 'sent' | 'queued';

class UploadsErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <AlertCircle className="size-8 opacity-40" />
          <p className="text-sm">Failed to load uploads.</p>
          <button
            type="button"
            className="text-sm text-violet-600 hover:underline"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function ActivityContent() {
  const [directionMode, setDirectionMode] = useState<DirectionMode>('outbound');
  const [viewMode, setViewMode] = useState<ViewMode>('queued');

  return (
    <div className="space-y-6 pb-0">
      {/* Page header */}
      <div className="max-w-7xl mx-auto">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1>Activity</h1>
            <p className="text-muted-foreground mt-1">
              Outbound reminders and client document uploads
            </p>
          </div>

          <div className="flex flex-col gap-3 items-end">
            <ToggleGroup
              options={[
                { value: 'outbound', label: 'Outbound' },
                { value: 'uploads', label: 'Uploads' },
              ]}
              value={directionMode}
              onChange={setDirectionMode}
            />

            {/* Sent/Queued sub-toggle (outbound only) */}
            {directionMode === 'outbound' && (
              <ToggleGroup
                options={[
                  { value: 'queued', label: 'Queued Emails' },
                  { value: 'sent', label: 'Sent Emails' },
                ]}
                value={viewMode}
                onChange={setViewMode}
              />
            )}
          </div>
        </div>
      </div>

      {directionMode === 'outbound' && <DeliveryLogTable viewMode={viewMode} />}
      {directionMode === 'uploads' && (
        <UploadsErrorBoundary>
          <UploadsTable />
        </UploadsErrorBoundary>
      )}
    </div>
  );
}

export default function ActivityPage() {
  return (
    <PageLoadingProvider>
      <ActivityContent />
    </PageLoadingProvider>
  );
}
