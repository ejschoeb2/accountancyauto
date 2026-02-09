'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mail } from 'lucide-react';
import { LoadingIndicator } from '@/components/loading-indicator';
import Link from 'next/link';
import { format } from 'date-fns';
import { getAuditLog } from '@/app/actions/audit-log';
import type { AuditEntry } from '@/app/actions/audit-log';

const statusVariant = {
  delivered: 'default',
  sent: 'secondary',
  bounced: 'outline',
  failed: 'destructive',
} as const;

export function AuditLogCard() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAuditLog({ offset: 0, limit: 8 })
      .then((result) => setEntries(result.data))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Link href="/delivery-log">
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
            <div className="py-8 px-5">
              <LoadingIndicator size={32} />
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
                  className="flex items-center justify-between px-5 py-3 border-t first:border-t-0"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-xs text-muted-foreground shrink-0">
                      {format(new Date(entry.sent_at), 'dd MMM')}
                    </span>
                    <span className="font-medium text-sm truncate">
                      {entry.client_name}
                    </span>
                  </div>
                  <div className="shrink-0">
                    <Badge variant={statusVariant[entry.delivery_status]}>
                      {entry.delivery_status}
                    </Badge>
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
