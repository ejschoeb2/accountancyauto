'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { IconButtonWithText } from '@/components/ui/icon-button-with-text';
import { Badge } from '@/components/ui/badge';
import { usePageLoading } from '@/components/page-loading';
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

interface ClientAuditLogProps {
  clientId: string;
}

const ITEMS_PER_PAGE = 20;

export function ClientAuditLog({ clientId }: ClientAuditLogProps) {
  const [data, setData] = useState<AuditEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  usePageLoading('client-audit-log', loading);

  // Filter state
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch data when filters or page change
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const offset = (currentPage - 1) * ITEMS_PER_PAGE;
      const result = await getAuditLog({
        clientId,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        offset,
        limit: ITEMS_PER_PAGE,
      });
      setData(result.data);
      setTotalCount(result.totalCount);
    } catch (error) {
      console.error('Error fetching client audit log:', error);
    } finally {
      setLoading(false);
    }
  }, [clientId, dateFrom, dateTo, currentPage]);

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

      {/* Table */}
      <div className="border rounded-lg bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date Sent</TableHead>
              <TableHead>Filing Type</TableHead>
              <TableHead>Delivery Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  No reminder emails sent yet
                </TableCell>
              </TableRow>
            ) : (
              data.map((entry) => (
                <TableRow key={entry.id} className="hover:bg-accent/5">
                  <TableCell>{formatDate(entry.sent_at)}</TableCell>
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
          <IconButtonWithText
            variant="ghost"
            onClick={() => setCurrentPage((p) => p - 1)}
            disabled={!hasPrevPage || loading}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </IconButtonWithText>
          <IconButtonWithText
            variant="ghost"
            onClick={() => setCurrentPage((p) => p + 1)}
            disabled={!hasNextPage || loading}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </IconButtonWithText>
        </div>
      </div>
    </div>
  );
}
