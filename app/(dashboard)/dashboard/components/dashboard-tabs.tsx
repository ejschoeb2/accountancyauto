'use client';

import { useState } from 'react';
import { ClientStatusTable } from './client-status-table';
import { AuditLogTable } from './audit-log-table';
import type { ClientStatusRow } from '@/lib/dashboard/metrics';
import type { AuditEntry } from '@/app/actions/audit-log';

interface DashboardTabsProps {
  clients: ClientStatusRow[];
  initialAuditData: AuditEntry[];
  auditTotalCount: number;
}

type TabType = 'status' | 'audit';

export function DashboardTabs({ clients, initialAuditData, auditTotalCount }: DashboardTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('status');

  return (
    <div className="space-y-6">
      {/* Tab navigation */}
      <div className="border-b">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('status')}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              ${
                activeTab === 'status'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }
            `}
          >
            Client Status
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              ${
                activeTab === 'audit'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }
            `}
          >
            Audit Log
          </button>
        </nav>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'status' && <ClientStatusTable clients={clients} />}
        {activeTab === 'audit' && (
          <AuditLogTable initialData={initialAuditData} totalCount={auditTotalCount} />
        )}
      </div>
    </div>
  );
}
