'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { usePageLoading } from '@/components/page-loading';
import { getAuditLog, type AuditEntry } from '@/app/actions/audit-log';
import { format } from 'date-fns';
import { Mail } from 'lucide-react';

const ITEMS_PER_PAGE = 20;

const statusConfig = {
  delivered: {
    label: 'Delivered',
    bg: 'bg-green-500/10',
    text: 'text-green-600',
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

export function AuditLogTable() {
  const [data, setData] = useState<AuditEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  usePageLoading('audit-log-table', loading);

  // Filter state
  const [clientSearch, setClientSearch] = useState('');
  const [debouncedClientSearch, setDebouncedClientSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Debounce client search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedClientSearch(clientSearch);
      setCurrentPage(1); // Reset to first page on search
    }, 500);

    return () => clearTimeout(timer);
  }, [clientSearch]);

  // Fetch data when filters or page change
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const offset = (currentPage - 1) * ITEMS_PER_PAGE;
      const result = await getAuditLog({
        clientSearch: debouncedClientSearch || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        offset,
        limit: ITEMS_PER_PAGE,
      });
      setData(result.data);
      setTotalCount(result.totalCount);
    } catch (error) {
      console.error('Error fetching audit log:', error);
    } finally {
      setLoading(false);
    }
  }, [debouncedClientSearch, dateFrom, dateTo, currentPage]);

  // Fetch data when filters change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate pagination
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, 'dd MMM yyyy HH:mm');
    } catch {
      return dateString;
    }
  };

  return (
    <Card className="group py-5 hover:shadow-md transition-shadow duration-200">
      <CardContent className="px-5 py-0">
        <div className="flex items-start justify-between mb-6">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Email Delivery Log
          </p>
          <div className="size-10 rounded-lg bg-amber-500/10 flex items-center justify-center transition-all duration-200 group-hover:bg-amber-500/20">
            <Mail className="size-6 text-amber-500" />
          </div>
        </div>

        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search client name..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="max-w-sm hover:border-foreground/20"
              />
            </div>
            <div className="flex gap-2">
              <Input
                type="date"
                placeholder="From date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-40 hover:border-foreground/20"
              />
              <Input
                type="date"
                placeholder="To date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-40 hover:border-foreground/20"
              />
            </div>
          </div>

          {/* Email List */}
          <div className="-mx-5">
            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-8 px-5">
                Loading...
              </p>
            ) : data.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8 px-5">
                No email logs found
              </p>
            ) : (
              <div className="space-y-0">
                {data.map((entry) => (
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
                        {formatDate(entry.sent_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {data.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
              {Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} of {totalCount} entries
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => p - 1)}
                disabled={!hasPrevPage || loading}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => p + 1)}
                disabled={!hasNextPage || loading}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
