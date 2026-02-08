'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getAuditLog, type AuditEntry } from '@/app/actions/audit-log';
import { format } from 'date-fns';
import { Mail } from 'lucide-react';

const ITEMS_PER_PAGE = 20;

export function AuditLogTable() {
  const [data, setData] = useState<AuditEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

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

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'default';
      case 'sent':
        return 'secondary';
      case 'bounced':
        return 'outline';
      case 'failed':
        return 'destructive';
      default:
        return 'secondary';
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

          {/* Table */}
          <div className="border rounded-lg -mx-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date Sent</TableHead>
                  <TableHead>Client Name</TableHead>
                  <TableHead>Filing Type</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Delivery Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No email logs found
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((entry) => (
                    <TableRow key={entry.id} className="hover:bg-accent/5">
                      <TableCell>{formatDate(entry.sent_at)}</TableCell>
                      <TableCell className="font-medium">{entry.client_name}</TableCell>
                      <TableCell>{entry.filing_type_name || '-'}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{entry.subject || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(entry.delivery_status)}>
                          {entry.delivery_status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
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
