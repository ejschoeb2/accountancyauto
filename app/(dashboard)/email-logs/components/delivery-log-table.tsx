'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ButtonBase } from '@/components/ui/button-base';
import { CheckButton } from '@/components/ui/check-button';
import { usePageLoading } from '@/components/page-loading';
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
import { getAuditLog, getQueuedReminders, type AuditEntry, type QueuedReminder } from '@/app/actions/audit-log';
import { format } from 'date-fns';
import { Search, X, ArrowUpDown } from 'lucide-react';

const ITEMS_PER_PAGE = 20;

const FILING_TYPE_LABELS: Record<string, string> = {
  corporation_tax_payment: "Corp Tax",
  ct600_filing: "CT600",
  companies_house: "Companies House",
  vat_return: "VAT Return",
  self_assessment: "Self Assessment",
};

type SortField = 'sent_at' | 'client_name' | 'send_date';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'sent' | 'queued';

interface DeliveryLogTableProps {
  viewMode: ViewMode;
}

export function DeliveryLogTable({ viewMode }: DeliveryLogTableProps) {
  const [sentData, setSentData] = useState<AuditEntry[]>([]);
  const [queuedData, setQueuedData] = useState<QueuedReminder[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  usePageLoading('email-logs-table', loading);

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

  // Selection state
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

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

      if (viewMode === 'sent') {
        const result = await getAuditLog({
          clientSearch: debouncedClientSearch || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          offset,
          limit: ITEMS_PER_PAGE,
        });
        setSentData(result.data);
        setTotalCount(result.totalCount);
      } else {
        const result = await getQueuedReminders({
          clientSearch: debouncedClientSearch || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          statusFilter: statusFilter !== 'all' ? statusFilter : undefined,
          offset,
          limit: ITEMS_PER_PAGE,
        });
        setQueuedData(result.data);
        setTotalCount(result.totalCount);
      }
    } catch (error) {
      console.error('Error fetching email logs:', error);
    } finally {
      setLoading(false);
    }
  }, [debouncedClientSearch, dateFrom, dateTo, statusFilter, currentPage, viewMode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset to page 1 when switching views
  useEffect(() => {
    setCurrentPage(1);
  }, [viewMode]);

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

  // Client-side sort (filtering now done server-side for queued view)
  const sortedData = useMemo(() => {
    const data = viewMode === 'sent' ? sentData : queuedData;

    // For sent view, apply status filter client-side
    let filtered = viewMode === 'sent' && statusFilter !== 'all'
      ? sentData.filter((entry) => entry.delivery_status === statusFilter)
      : data;

    if (sortField) {
      filtered = ([...filtered] as typeof filtered).sort((a, b) => {
        let comparison = 0;
        if (sortField === 'sent_at' && 'sent_at' in a && 'sent_at' in b) {
          comparison = a.sent_at.localeCompare(b.sent_at);
        } else if (sortField === 'send_date' && 'send_date' in a && 'send_date' in b) {
          comparison = a.send_date.localeCompare(b.send_date);
        } else if (sortField === 'client_name') {
          comparison = a.client_name.localeCompare(b.client_name);
        }
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return filtered;
  }, [sentData, queuedData, viewMode, statusFilter, sortField, sortDirection]);

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, 'dd MMM yyyy HH:mm');
    } catch {
      return dateString;
    }
  };

  const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
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
    cancelled: {
      label: 'Cancelled',
      bg: 'bg-status-danger/10',
      text: 'text-status-danger',
    },
    scheduled: {
      label: 'Scheduled',
      bg: 'bg-blue-500/10',
      text: 'text-blue-500',
    },
    pending: {
      label: 'Pending',
      bg: 'bg-amber-500/10',
      text: 'text-amber-600',
    },
  };

  // Step badge styling - button-base text-only style for all steps
  const getStepBadgeClass = (stepIndex: number) => {
    const stepColors = [
      'bg-blue-500/10 hover:bg-blue-500/20 text-blue-500', // Step 1
      'bg-violet-500/10 hover:bg-violet-500/20 text-violet-500', // Step 2
      'bg-orange-500/10 hover:bg-orange-500/20 text-orange-600', // Step 3
      'bg-teal-500/10 hover:bg-teal-500/20 text-teal-600', // Step 4
      'bg-pink-500/10 hover:bg-pink-500/20 text-pink-600', // Step 5+
    ];
    return stepColors[Math.min(stepIndex, stepColors.length - 1)];
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

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedRows.size === sortedData.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(sortedData.map((item) => item.id)));
    }
  };

  const toggleSelectRow = (id: string) => {
    const newSelection = new Set(selectedRows);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedRows(newSelection);
  };

  const isAllSelected = sortedData.length > 0 && selectedRows.size === sortedData.length;
  const isSomeSelected = selectedRows.size > 0 && selectedRows.size < sortedData.length;

  return (
    <div className="space-y-6 pb-0">
      {/* Filters and Results */}
      <div className="max-w-7xl mx-auto space-y-4">
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
            {viewMode === 'sent' ? (
              <>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="bounced">Bounced</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </>
            ) : (
              <>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </>
            )}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearAllFilters}>
            Clear filters
          </Button>
        )}
      </div>

      {/* Results count */}
      <div className="text-sm font-medium text-foreground/70">
        Showing <span className="font-semibold text-foreground">{sortedData.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to{' '}
        <span className="font-semibold text-foreground">{Math.min(currentPage * ITEMS_PER_PAGE, totalCount)}</span> of <span className="font-semibold text-foreground">{totalCount}</span>{' '}
        {viewMode === 'sent' ? 'sent emails' : 'queued emails'}
      </div>
      </div>

      {/* Table - Full page width like client table */}
      <div className="-mx-8 -mb-10 border-y shadow-sm hover:shadow-lg transition-shadow duration-300 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              {/* Checkbox column */}
              <TableHead>
                <div className="flex items-center justify-center">
                  <CheckButton
                    checked={isAllSelected ? true : isSomeSelected ? 'indeterminate' : false}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </div>
              </TableHead>

              {viewMode === 'sent' ? (
                <>
                  {/* Type */}
                  <TableHead>
                    <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Type
                    </span>
                  </TableHead>
                  {/* Client Name */}
                  <TableHead>
                    <button
                      className="flex items-center gap-1 text-sm font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
                      onClick={() => handleSort('client_name')}
                    >
                      Client Name
                      <ArrowUpDown className="size-3.5" />
                    </button>
                  </TableHead>
                  {/* Client Type */}
                  <TableHead>
                    <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Client Type
                    </span>
                  </TableHead>
                  {/* Deadline Type */}
                  <TableHead>
                    <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Deadline Type
                    </span>
                  </TableHead>
                  {/* Deadline Date */}
                  <TableHead>
                    <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Deadline Date
                    </span>
                  </TableHead>
                  {/* Date Sent */}
                  <TableHead>
                    <button
                      className="flex items-center gap-1 text-sm font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
                      onClick={() => handleSort('sent_at')}
                    >
                      Date Sent
                      <ArrowUpDown className="size-3.5" />
                    </button>
                  </TableHead>
                  {/* Reminder Step */}
                  <TableHead>
                    <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Reminder Step
                    </span>
                  </TableHead>
                  {/* Template Name */}
                  <TableHead>
                    <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Template Name
                    </span>
                  </TableHead>
                  {/* Status */}
                  <TableHead>
                    <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Status
                    </span>
                  </TableHead>
                </>
              ) : (
                <>
                  {/* Client Name */}
                  <TableHead>
                    <button
                      className="flex items-center gap-1 text-sm font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
                      onClick={() => handleSort('client_name')}
                    >
                      Client Name
                      <ArrowUpDown className="size-3.5" />
                    </button>
                  </TableHead>
                  {/* Client Type */}
                  <TableHead>
                    <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Client Type
                    </span>
                  </TableHead>
                  {/* Deadline Type */}
                  <TableHead>
                    <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Deadline Type
                    </span>
                  </TableHead>
                  {/* Deadline Date */}
                  <TableHead>
                    <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Deadline Date
                    </span>
                  </TableHead>
                  {/* Send Date */}
                  <TableHead>
                    <button
                      className="flex items-center gap-1 text-sm font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
                      onClick={() => handleSort('send_date')}
                    >
                      Send Date
                      <ArrowUpDown className="size-3.5" />
                    </button>
                  </TableHead>
                  {/* Reminder Step */}
                  <TableHead>
                    <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Reminder Step
                    </span>
                  </TableHead>
                  {/* Template Name */}
                  <TableHead>
                    <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Template Name
                    </span>
                  </TableHead>
                  {/* Status */}
                  <TableHead>
                    <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Status
                    </span>
                  </TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : sortedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                  No {viewMode === 'sent' ? 'email logs' : 'queued emails'} found
                </TableCell>
              </TableRow>
            ) : viewMode === 'sent' ? (
              (sortedData as AuditEntry[]).map((entry) => (
                <TableRow key={entry.id} className="group">
                  {/* Checkbox */}
                  <TableCell>
                    <div
                      className="flex items-center justify-center cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelectRow(entry.id);
                      }}
                    >
                      <CheckButton
                        checked={selectedRows.has(entry.id)}
                        onCheckedChange={() => toggleSelectRow(entry.id)}
                        aria-label="Select row"
                      />
                    </div>
                  </TableCell>
                  {/* Type */}
                  <TableCell>
                    {entry.send_type === 'ad-hoc' ? (
                      <div className="px-3 py-2 rounded-md bg-violet-500/10 inline-flex items-center">
                        <span className="text-sm font-medium text-violet-500">
                          Ad-hoc
                        </span>
                      </div>
                    ) : (
                      <div className="px-3 py-2 rounded-md bg-blue-500/10 inline-flex items-center">
                        <span className="text-sm font-medium text-blue-500">
                          Scheduled
                        </span>
                      </div>
                    )}
                  </TableCell>
                  {/* Client Name */}
                  <TableCell className="font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                    {entry.client_name}
                  </TableCell>
                  {/* Client Type */}
                  <TableCell className="text-muted-foreground group-hover:text-foreground transition-colors">
                    {entry.client_type || '—'}
                  </TableCell>
                  {/* Deadline Type */}
                  <TableCell className="text-muted-foreground group-hover:text-foreground transition-colors">
                    {entry.filing_type_id ? (FILING_TYPE_LABELS[entry.filing_type_id] || entry.filing_type_name) : '—'}
                  </TableCell>
                  {/* Deadline Date */}
                  <TableCell className="text-muted-foreground group-hover:text-foreground transition-colors">
                    {entry.deadline_date ? format(new Date(entry.deadline_date), 'dd MMM yyyy') : '—'}
                  </TableCell>
                  {/* Date Sent */}
                  <TableCell className="text-muted-foreground group-hover:text-foreground transition-colors">
                    {formatDate(entry.sent_at)}
                  </TableCell>
                  {/* Reminder Step */}
                  <TableCell>
                    {entry.step_index !== null ? (
                      <span className={`inline-flex items-center justify-center rounded-lg px-4 py-2 h-10 text-sm font-medium transition-all duration-200 ${getStepBadgeClass(entry.step_index)}`}>
                        Step {entry.step_index + 1}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  {/* Template Name */}
                  <TableCell className="text-muted-foreground group-hover:text-foreground transition-colors">
                    {entry.template_name || '—'}
                  </TableCell>
                  {/* Status */}
                  <TableCell>
                    <div className={`px-3 py-2 rounded-md ${statusConfig[entry.delivery_status]?.bg || 'bg-gray-500/10'} inline-flex items-center`}>
                      <span className={`text-sm font-medium ${statusConfig[entry.delivery_status]?.text || 'text-gray-500'}`}>
                        {statusConfig[entry.delivery_status]?.label || entry.delivery_status}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              (sortedData as QueuedReminder[]).map((reminder) => (
                <TableRow key={reminder.id} className="group">
                  {/* Checkbox */}
                  <TableCell>
                    <div
                      className="flex items-center justify-center cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelectRow(reminder.id);
                      }}
                    >
                      <CheckButton
                        checked={selectedRows.has(reminder.id)}
                        onCheckedChange={() => toggleSelectRow(reminder.id)}
                        aria-label="Select row"
                      />
                    </div>
                  </TableCell>
                  {/* Client Name */}
                  <TableCell className="font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                    {reminder.client_name}
                  </TableCell>
                  {/* Client Type */}
                  <TableCell className="text-muted-foreground group-hover:text-foreground transition-colors">
                    {reminder.client_type || '—'}
                  </TableCell>
                  {/* Deadline Type */}
                  <TableCell className="text-muted-foreground group-hover:text-foreground transition-colors">
                    {reminder.filing_type_id ? (FILING_TYPE_LABELS[reminder.filing_type_id] || reminder.filing_type_name) : '—'}
                  </TableCell>
                  {/* Deadline Date */}
                  <TableCell className="text-muted-foreground group-hover:text-foreground transition-colors">
                    {format(new Date(reminder.deadline_date), 'dd MMM yyyy')}
                  </TableCell>
                  {/* Send Date */}
                  <TableCell className="text-muted-foreground group-hover:text-foreground transition-colors">
                    {formatDate(reminder.send_date)}
                  </TableCell>
                  {/* Reminder Step */}
                  <TableCell>
                    <span className={`inline-flex items-center justify-center rounded-lg px-4 py-2 h-10 text-sm font-medium transition-all duration-200 ${getStepBadgeClass(reminder.step_index)}`}>
                      Step {reminder.step_index + 1}
                    </span>
                  </TableCell>
                  {/* Template Name */}
                  <TableCell className="text-muted-foreground group-hover:text-foreground transition-colors">
                    {reminder.template_name || '—'}
                  </TableCell>
                  {/* Status */}
                  <TableCell>
                    <div className={`px-3 py-2 rounded-md ${statusConfig[reminder.status]?.bg || 'bg-gray-500/10'} inline-flex items-center`}>
                      <span className={`text-sm font-medium ${statusConfig[reminder.status]?.text || 'text-gray-500'}`}>
                        {statusConfig[reminder.status]?.label || reminder.status}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Bulk Actions */}
      <div className="max-w-7xl mx-auto">
        {selectedRows.size > 0 && (
          <div className="rounded-xl border bg-blue-500/5 border-blue-500/20 p-4 flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              {selectedRows.size} {selectedRows.size === 1 ? 'email' : 'emails'} selected
            </span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedRows(new Set())}
              >
                Clear selection
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-foreground/70">
            Page <span className="font-semibold text-foreground">{currentPage}</span> of <span className="font-semibold text-foreground">{totalPages || 1}</span>
          </div>
          <div className="flex gap-2">
            <ButtonBase
              variant="muted"
              buttonType="text-only"
              onClick={() => setCurrentPage((p) => p - 1)}
              disabled={!hasPrevPage || loading}
            >
              Previous
            </ButtonBase>
            <ButtonBase
              variant="muted"
              buttonType="text-only"
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={!hasNextPage || loading}
            >
              Next
            </ButtonBase>
          </div>
        </div>
      </div>
    </div>
  );
}
