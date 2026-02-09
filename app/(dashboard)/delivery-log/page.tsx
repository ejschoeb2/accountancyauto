'use client';

import { useState } from 'react';
import { DeliveryLogTable } from './components/delivery-log-table';
import { PageLoadingProvider } from '@/components/page-loading';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

type ViewMode = 'sent' | 'queued';

export default function DeliveryLogPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('sent');

  return (
    <PageLoadingProvider>
      <div className="space-y-10">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h1 className="text-foreground">Delivery Log</h1>
            <p className="text-muted-foreground mt-1">
              View sent email history and queued reminders with filters and search
            </p>
          </div>

          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <TabsList>
              <TabsTrigger value="sent">Sent Emails</TabsTrigger>
              <TabsTrigger value="queued">Queued Emails</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <DeliveryLogTable viewMode={viewMode} />
      </div>
    </PageLoadingProvider>
  );
}
