'use client';

import { useState, useEffect, useCallback } from 'react';
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

interface AuditLogTableProps {
  initialData: AuditEntry[];
  totalCount: number;
}

const ITEMS_PER_PAGE = 20;

export function AuditLogTable({ initialData, totalCount: initialTotalCount }: AuditLogTableProps) {
  const [data, setData] = useState<AuditEntry[]>(initialData);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [loading, setLoading] = useState(false);

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
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search client name..."
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
            className="max-w-sm"
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
            className="w-40"
          />
          <Input
            type="date"
            placeholder="To date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setCurrentPage(1);
            }}
            className="w-40"
          />
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date Sent</TableHead>
              <TableHead>Client Name</TableHead>
              <TableHead>Filing Type</TableHead>
              <TableHead>Delivery Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No email logs found
                </TableCell>
              </TableRow>
            ) : (
              data.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{formatDate(entry.sent_at)}</TableCell>
                  <TableCell className="font-medium">{entry.client_name}</TableCell>
                  <TableCell>{entry.filing_type_name || '-'}</TableCell>
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
  );
}
