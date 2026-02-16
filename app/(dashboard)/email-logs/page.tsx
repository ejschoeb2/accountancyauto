'use client';

import { useState } from 'react';
import { PageLoadingProvider } from '@/components/page-loading';
import { DeliveryLogTable } from './components/delivery-log-table';
import { InboundEmailTable } from './components/inbound-email-table';
import { ToggleGroup } from '@/components/ui/toggle-group';

type ViewMode = 'sent' | 'queued';
type DirectionMode = 'outbound' | 'inbound';

function EmailLogsContent() {
  const [directionMode, setDirectionMode] = useState<DirectionMode>('outbound');
  const [viewMode, setViewMode] = useState<ViewMode>('queued');

  return (
    <div className="space-y-6 pb-0">
      {/* Page header */}
      <div className="max-w-7xl mx-auto">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h1>Email Activity</h1>
            <p className="text-muted-foreground mt-1">
              View outbound reminders and inbound email responses
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {/* Outbound/Inbound toggle */}
            <ToggleGroup
              options={[
                { value: 'outbound', label: 'Outbound' },
                { value: 'inbound', label: 'Inbound' },
              ]}
              value={directionMode}
              onChange={setDirectionMode}
              variant="muted"
            />

            {/* Sent/Queued toggle (only for outbound) */}
            {directionMode === 'outbound' && (
              <ToggleGroup
                options={[
                  { value: 'queued', label: 'Queued Emails' },
                  { value: 'sent', label: 'Sent Emails' },
                ]}
                value={viewMode}
                onChange={setViewMode}
                variant="muted"
              />
            )}
          </div>
        </div>
      </div>

      {directionMode === 'outbound' ? (
        <DeliveryLogTable viewMode={viewMode} />
      ) : (
        <InboundEmailTable />
      )}
    </div>
  );
}

export default function EmailLogsPage() {
  return (
    <PageLoadingProvider>
      <EmailLogsContent />
    </PageLoadingProvider>
  );
}
