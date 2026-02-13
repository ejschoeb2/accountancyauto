'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Mail } from 'lucide-react';
import { usePageLoading } from '@/components/page-loading';
import Link from 'next/link';
import { format } from 'date-fns';
import { getAuditLog } from '@/app/actions/audit-log';
import type { AuditEntry } from '@/app/actions/audit-log';

const statusConfig = {
  delivered: {
    label: 'Delivered',
    bg: 'bg-status-success/10',
    text: 'text-status-success',
  },
  sent: {
    label: 'Sent',
    bg: 'bg-blue-500/10',
    text: 'text-blue-500',
  },
  bounced: {
    label: 'Bounced',
    bg: 'bg-status-warning/10',
    text: 'text-status-warning',
  },
  failed: {
    label: 'Failed',
    bg: 'bg-status-danger/10',
    text: 'text-status-danger',
  },
} as const;

export function AuditLogCard() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  usePageLoading('audit-log-card', loading);

  useEffect(() => {
    getAuditLog({ offset: 0, limit: 8 })
      .then((result) => setEntries(result.data))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Link href="/email-logs">
      <Card className="group py-5 hover:shadow-md transition-shadow duration-200 cursor-pointer h-full">
        <CardContent className="px-5 py-0">
        <div className="flex items-start justify-between mb-6">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Recent Emails
          </p>
          <div className="size-10 rounded-lg bg-amber-500/10 flex items-center justify-center transition-all duration-200 group-hover:bg-amber-500/20">
            <Mail className="size-6 text-amber-500" />
          </div>
        </div>
        <div className="-mx-5">
          {loading ? (
            <div className="py-8 px-5 text-center text-muted-foreground text-sm">
              Loading...
            </div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8 px-5">
              No emails sent yet
            </p>
          ) : (
            <div className="space-y-0">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between px-5 py-3 hover:bg-muted/50 transition-colors border-t first:border-t-0"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`px-3 py-2 rounded-md ${statusConfig[entry.delivery_status].bg} inline-flex items-center shrink-0`}>
                      <span className={`text-sm font-medium ${statusConfig[entry.delivery_status].text}`}>
                        {statusConfig[entry.delivery_status].label}
                      </span>
                    </div>
                    <span className="font-medium text-sm truncate">
                      {entry.client_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-sm text-muted-foreground">
                    <span>
                      {format(new Date(entry.sent_at), 'dd MMM')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        </CardContent>
      </Card>
    </Link>
  );
}
