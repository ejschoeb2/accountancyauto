'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingIndicator } from '@/components/loading-indicator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Search, X, ArrowUpDown } from 'lucide-react';

const ITEMS_PER_PAGE = 20;

type SortField = 'sent_at' | 'client_name';
type SortDirection = 'asc' | 'desc';

export function DeliveryLogTable() {
  const [data, setData] = useState<AuditEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [clientSearch, setClientSearch] = useState('');
  const [debouncedClientSearch, setDebouncedClientSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Sort state
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Debounce client search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedClientSearch(clientSearch);
      setCurrentPage(1);
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
      console.error('Error fetching delivery log:', error);
    } finally {
      setLoading(false);
    }
  }, [debouncedClientSearch, dateFrom, dateTo, currentPage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate pagination
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;

  // Sort toggle handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Client-side filter + sort
  const sortedData = useMemo(() => {
    let filtered = statusFilter !== 'all'
      ? data.filter((entry) => entry.delivery_status === statusFilter)
      : data;

    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        let comparison = 0;
        if (sortField === 'sent_at') {
          comparison = a.sent_at.localeCompare(b.sent_at);
        } else if (sortField === 'client_name') {
          comparison = a.client_name.localeCompare(b.client_name);
        }
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return filtered;
  }, [data, statusFilter, sortField, sortDirection]);

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

  const hasActiveFilters =
    clientSearch !== '' ||
    dateFrom !== '' ||
    dateTo !== '' ||
    statusFilter !== 'all';

  function clearAllFilters() {
    setClientSearch('');
    setDateFrom('');
    setDateTo('');
    setStatusFilter('all');
    setCurrentPage(1);
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by client name..."
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
            className="pl-9 hover:border-foreground/20"
          />
          {clientSearch && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
              onClick={() => setClientSearch('')}
            >
              <X className="size-4" />
            </Button>
          )}
        </div>

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

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="bounced">Bounced</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearAllFilters}>
            Clear filters
          </Button>
        )}
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {data.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
        {Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} of {totalCount} entries
      </div>

      {/* Table */}
      <div className="rounded-xl border shadow-sm hover:shadow-lg transition-shadow duration-300 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button
                  className="flex items-center gap-1 text-sm font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
                  onClick={() => handleSort('sent_at')}
                >
                  Date Sent
                  <ArrowUpDown className="size-3.5" />
                </button>
              </TableHead>
              <TableHead>
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Type
                </span>
              </TableHead>
              <TableHead>
                <button
                  className="flex items-center gap-1 text-sm font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
                  onClick={() => handleSort('client_name')}
                >
                  Client Name
                  <ArrowUpDown className="size-3.5" />
                </button>
              </TableHead>
              <TableHead>
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Filing Type
                </span>
              </TableHead>
              <TableHead>
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Subject
                </span>
              </TableHead>
              <TableHead>
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Delivery Status
                </span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <LoadingIndicator size={32} />
                </TableCell>
              </TableRow>
            ) : sortedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No email logs found
                </TableCell>
              </TableRow>
            ) : (
              sortedData.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{formatDate(entry.sent_at)}</TableCell>
                  <TableCell>
                    {entry.send_type === 'ad-hoc' ? (
                      <Badge variant="outline" className="border-accent text-accent">
                        ad-hoc
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">scheduled</span>
                    )}
                  </TableCell>
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
          Page {currentPage} of {totalPages || 1}
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
