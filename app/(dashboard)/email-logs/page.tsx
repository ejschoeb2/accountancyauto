'use client';

import { useState } from 'react';
import { PageLoadingProvider } from '@/components/page-loading';
import { DeliveryLogTable } from './components/delivery-log-table';
import { ToggleGroup } from '@/components/ui/toggle-group';

type ViewMode = 'sent' | 'queued';

function EmailLogsContent() {
  const [viewMode, setViewMode] = useState<ViewMode>('queued');

  return (
    <div className="space-y-6 pb-0">
      {/* Page header */}
      <div className="max-w-7xl mx-auto">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h1>Email Logs</h1>
            <p className="text-muted-foreground mt-1">
              View sent email history and queued reminders
            </p>
          </div>

          <ToggleGroup
            options={[
              { value: 'queued', label: 'Queued Emails' },
              { value: 'sent', label: 'Sent Emails' },
            ]}
            value={viewMode}
            onChange={setViewMode}
            variant="muted"
          />
        </div>
      </div>

      <DeliveryLogTable viewMode={viewMode} />
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
