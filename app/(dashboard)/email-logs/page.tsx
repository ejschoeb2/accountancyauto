'use client';

import { useState } from 'react';
import { PageLoadingProvider } from '@/components/page-loading';
import { DeliveryLogTable } from './components/delivery-log-table';
import { InboundEmailTable } from './components/inbound-email-table';
import { UploadsTable } from './components/uploads-table';
import { ToggleGroup } from '@/components/ui/toggle-group';

type DirectionMode = 'outbound' | 'inbound' | 'uploads';
type ViewMode = 'sent' | 'queued';

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
              Outbound reminders, inbound email responses, and client document uploads
            </p>
          </div>

          <div className="flex flex-col gap-3 items-end">
            {/* Three-way toggle */}
            <ToggleGroup
              options={[
                { value: 'outbound', label: 'Outbound' },
                { value: 'inbound', label: 'Inbound' },
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
      {directionMode === 'inbound' && <InboundEmailTable />}
      {directionMode === 'uploads' && <UploadsTable />}
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
