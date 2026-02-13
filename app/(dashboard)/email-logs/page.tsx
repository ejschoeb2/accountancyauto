'use client';

import { useState } from 'react';
import { PageLoadingProvider } from '@/components/page-loading';
import { DeliveryLogTable } from './components/delivery-log-table';
import { ButtonWithText } from '@/components/ui/button-with-text';

type ViewMode = 'sent' | 'queued';

function EmailLogsContent() {
  const [viewMode, setViewMode] = useState<ViewMode>('queued');

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1>Email Logs</h1>
          <p className="text-muted-foreground mt-1">
            View sent email history and queued reminders
          </p>
        </div>

        <div className="flex gap-2 items-center">
          <ButtonWithText
            onClick={() => setViewMode('queued')}
            isSelected={viewMode === 'queued'}
            variant="muted"
          >
            Queued Emails
          </ButtonWithText>
          <ButtonWithText
            onClick={() => setViewMode('sent')}
            isSelected={viewMode === 'sent'}
            variant="muted"
          >
            Sent Emails
          </ButtonWithText>
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
