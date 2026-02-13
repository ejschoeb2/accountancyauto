'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ButtonBase } from '@/components/ui/button-base';
import { CheckButton } from '@/components/ui/check-button';
import { ButtonWithText } from '@/components/ui/button-with-text';
import { IconButtonWithText } from '@/components/ui/icon-button-with-text';
import { usePageLoading } from '@/components/page-loading';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
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
import { Search, X, ArrowUpDown, SlidersHorizontal, ChevronDown } from 'lucide-react';

const ITEMS_PER_PAGE = 20;

const FILING_TYPE_LABELS: Record<string, string> = {
  corporation_tax_payment: "Corp Tax",
  ct600_filing: "CT600",
  companies_house: "Companies House",
  vat_return: "VAT Return",
  self_assessment: "Self Assessment",
};

// Client type options
const CLIENT_TYPE_OPTIONS = [
  { value: "Limited Company", label: "Limited Company" },
  { value: "Sole Trader", label: "Sole Trader" },
  { value: "Partnership", label: "Partnership" },
  { value: "LLP", label: "LLP" },
];

// Deadline type options (filing types)
const DEADLINE_TYPE_OPTIONS = [
  { value: "corporation_tax_payment", label: "Corp Tax" },
  { value: "ct600_filing", label: "CT600" },
  { value: "companies_house", label: "Companies House" },
  { value: "vat_return", label: "VAT Return" },
  { value: "self_assessment", label: "Self Assessment" },
];

// Status labels for both queued and sent
const STATUS_LABELS_QUEUED: Record<string, string> = {
  scheduled: "Scheduled",
  pending: "Pending",
  sent: "Sent",
  cancelled: "Cancelled",
  failed: "Failed",
};

const STATUS_LABELS_SENT: Record<string, string> = {
  sent: "Sent",
  delivered: "Delivered",
  bounced: "Bounced",
  failed: "Failed",
};

// Sort option labels
const SORT_LABELS: Record<string, string> = {
  "client-name-asc": "Client Name (A-Z)",
  "client-name-desc": "Client Name (Z-A)",
  "send-date-asc": "Send Date (Earliest)",
  "send-date-desc": "Send Date (Latest)",
  "deadline-date-asc": "Deadline Date (Earliest)",
  "deadline-date-desc": "Deadline Date (Latest)",
};

type SortField = 'sent_at' | 'client_name' | 'send_date';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'sent' | 'queued';
type DateFilterType = 'send_date' | 'deadline_date';

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
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>('send_date');
  const [activeClientTypeFilters, setActiveClientTypeFilters] = useState<Set<string>>(new Set());
  const [activeDeadlineTypeFilters, setActiveDeadlineTypeFilters] = useState<Set<string>>(new Set());
  const [activeStatusFilters, setActiveStatusFilters] = useState<Set<string>>(new Set());
  const [templateFilter, setTemplateFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Sort state
  const [sortBy, setSortBy] = useState<string>("send-date-asc");

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

      // Only pass date filters to server if filtering by send_date (server supports this)
      // If filtering by deadline_date, we'll filter client-side
      const shouldPassDateToServer = dateFilterType === 'send_date';

      if (viewMode === 'sent') {
        const result = await getAuditLog({
          clientSearch: debouncedClientSearch || undefined,
          dateFrom: shouldPassDateToServer && dateFrom ? dateFrom : undefined,
          dateTo: shouldPassDateToServer && dateTo ? dateTo : undefined,
          offset,
          limit: ITEMS_PER_PAGE,
        });
        setSentData(result.data);
        setTotalCount(result.totalCount);
      } else {
        const result = await getQueuedReminders({
          clientSearch: debouncedClientSearch || undefined,
          dateFrom: shouldPassDateToServer && dateFrom ? dateFrom : undefined,
          dateTo: shouldPassDateToServer && dateTo ? dateTo : undefined,
          statusFilter: undefined, // Now handled client-side
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
  }, [debouncedClientSearch, dateFrom, dateTo, dateFilterType, currentPage, viewMode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset to page 1 when switching views
  useEffect(() => {
    setCurrentPage(1);
    // Clear filters when switching views
    setActiveClientTypeFilters(new Set());
    setActiveDeadlineTypeFilters(new Set());
    setActiveStatusFilters(new Set());
    setTemplateFilter('all');
  }, [viewMode]);

  // Calculate pagination
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;

  // Client-side filtering and sorting
  const sortedData = useMemo(() => {
    const data = viewMode === 'sent' ? sentData : queuedData;

    // Apply filters
    let filtered = data.filter((item) => {
      // Client type filter
      if (activeClientTypeFilters.size > 0 && (!item.client_type || !activeClientTypeFilters.has(item.client_type))) {
        return false;
      }

      // Deadline type filter (filing type)
      if (activeDeadlineTypeFilters.size > 0 && (!item.filing_type_id || !activeDeadlineTypeFilters.has(item.filing_type_id))) {
        return false;
      }

      // Template filter
      if (templateFilter !== 'all' && item.template_name !== templateFilter) {
        return false;
      }

      // Status filter
      if (activeStatusFilters.size > 0) {
        const itemStatus = viewMode === 'sent'
          ? (item as AuditEntry).delivery_status
          : (item as QueuedReminder).status;
        if (!activeStatusFilters.has(itemStatus)) {
          return false;
        }
      }

      // Date range filter (client-side)
      if (dateFrom || dateTo) {
        let dateToFilter: string | null = null;

        if (dateFilterType === 'send_date') {
          dateToFilter = viewMode === 'sent' ? (item as AuditEntry).sent_at : (item as QueuedReminder).send_date;
        } else if (dateFilterType === 'deadline_date') {
          dateToFilter = item.deadline_date;
        }

        if (!dateToFilter) return false;

        const itemDate = dateToFilter.split('T')[0]; // Get just the date part

        if (dateFrom && itemDate < dateFrom) {
          return false;
        }

        if (dateTo && itemDate > dateTo) {
          return false;
        }
      }

      return true;
    });

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "client-name-asc":
          return a.client_name.localeCompare(b.client_name);
        case "client-name-desc":
          return b.client_name.localeCompare(a.client_name);
        case "send-date-asc": {
          const dateA = viewMode === 'sent' ? (a as AuditEntry).sent_at : (a as QueuedReminder).send_date;
          const dateB = viewMode === 'sent' ? (b as AuditEntry).sent_at : (b as QueuedReminder).send_date;
          return dateA.localeCompare(dateB);
        }
        case "send-date-desc": {
          const dateA = viewMode === 'sent' ? (a as AuditEntry).sent_at : (a as QueuedReminder).send_date;
          const dateB = viewMode === 'sent' ? (b as AuditEntry).sent_at : (b as QueuedReminder).send_date;
          return dateB.localeCompare(dateA);
        }
        case "deadline-date-asc": {
          const deadlineA = viewMode === 'sent' ? (a as AuditEntry).deadline_date : (a as QueuedReminder).deadline_date;
          const deadlineB = viewMode === 'sent' ? (b as AuditEntry).deadline_date : (b as QueuedReminder).deadline_date;
          if (!deadlineA && !deadlineB) return 0;
          if (!deadlineA) return 1;
          if (!deadlineB) return -1;
          return deadlineA.localeCompare(deadlineB);
        }
        case "deadline-date-desc": {
          const deadlineA = viewMode === 'sent' ? (a as AuditEntry).deadline_date : (a as QueuedReminder).deadline_date;
          const deadlineB = viewMode === 'sent' ? (b as AuditEntry).deadline_date : (b as QueuedReminder).deadline_date;
          if (!deadlineA && !deadlineB) return 0;
          if (!deadlineA) return -1;
          if (!deadlineB) return 1;
          return deadlineB.localeCompare(deadlineA);
        }
        default:
          return 0;
      }
    });

    return sorted;
  }, [sentData, queuedData, viewMode, activeClientTypeFilters, activeDeadlineTypeFilters, activeStatusFilters, templateFilter, sortBy, dateFrom, dateTo, dateFilterType]);

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

  // Filter toggle handlers
  function toggleClientTypeFilter(type: string) {
    setActiveClientTypeFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }

  function toggleDeadlineTypeFilter(type: string) {
    setActiveDeadlineTypeFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }

  function toggleStatusFilter(status: string) {
    setActiveStatusFilters((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  }

  // Get unique templates for filter options
  const uniqueTemplates = useMemo(() => {
    const data = viewMode === 'sent' ? sentData : queuedData;
    const templates = new Set<string>();
    data.forEach((item) => {
      if (item.template_name) {
        templates.add(item.template_name);
      }
    });
    return Array.from(templates).sort();
  }, [sentData, queuedData, viewMode]);

  const activeFilterCount =
    activeClientTypeFilters.size +
    activeDeadlineTypeFilters.size +
    activeStatusFilters.size;

  const hasActiveFilters =
    clientSearch !== '' ||
    dateFrom !== '' ||
    dateTo !== '' ||
    activeClientTypeFilters.size > 0 ||
    activeDeadlineTypeFilters.size > 0 ||
    activeStatusFilters.size > 0 ||
    templateFilter !== 'all';

  function clearAllFilters() {
    setClientSearch('');
    setDateFrom('');
    setDateTo('');
    setActiveClientTypeFilters(new Set());
    setActiveDeadlineTypeFilters(new Set());
    setActiveStatusFilters(new Set());
    setTemplateFilter('all');
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
      {/* Search and Controls */}
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          {/* Search Input */}
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

          {/* Controls toolbar - Filter & Sort */}
          <div className="flex gap-2 sm:ml-auto items-center">
            <IconButtonWithText
              type="button"
              variant={showFilters ? "amber" : "violet"}
              onClick={() => setShowFilters((v) => !v)}
              title={showFilters ? "Close filters" : "Open filters"}
            >
              <SlidersHorizontal className="h-5 w-5" />
              {showFilters ? "Close Filters" : "Filter"}
              {activeFilterCount > 0 && !showFilters && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/20 text-xs font-semibold">
                  {activeFilterCount}
                </span>
              )}
            </IconButtonWithText>
            <div className="w-px h-6 bg-border mx-1" />
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Sort by:</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center justify-between gap-2 rounded-md border border-input bg-white px-3 py-2 h-9 text-sm whitespace-nowrap shadow-xs outline-none disabled:cursor-not-allowed disabled:opacity-50 hover:shadow-md hover:border-primary/20 transition-all duration-200 focus-visible:border-2 focus-visible:border-primary focus-visible:ring-0 focus-visible:shadow-md">
                    {SORT_LABELS[sortBy]}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuRadioGroup value={sortBy} onValueChange={setSortBy}>
                    <DropdownMenuRadioItem value="client-name-asc">Client Name (A-Z)</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="client-name-desc">Client Name (Z-A)</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="send-date-asc">Send Date (Earliest)</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="send-date-desc">Send Date (Latest)</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="deadline-date-asc">Deadline Date (Earliest)</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="deadline-date-desc">Deadline Date (Latest)</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Collapsible filter panel */}
        {showFilters && (
          <Card>
            <CardContent className="space-y-4">
              {/* Status and Clear Filters */}
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</span>
                  <div className="flex flex-wrap gap-2">
                    {viewMode === 'sent'
                      ? Object.entries(STATUS_LABELS_SENT).map(([value, label]) => (
                          <ButtonWithText
                            key={value}
                            onClick={() => toggleStatusFilter(value)}
                            isSelected={activeStatusFilters.has(value)}
                            variant="muted"
                          >
                            {label}
                          </ButtonWithText>
                        ))
                      : Object.entries(STATUS_LABELS_QUEUED).map(([value, label]) => (
                          <ButtonWithText
                            key={value}
                            onClick={() => toggleStatusFilter(value)}
                            isSelected={activeStatusFilters.has(value)}
                            variant="muted"
                          >
                            {label}
                          </ButtonWithText>
                        ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide invisible">Clear</span>
                  <IconButtonWithText
                    type="button"
                    variant="destructive"
                    onClick={clearAllFilters}
                    title="Clear all filters"
                  >
                    <X className="h-5 w-5" />
                    Clear all filters
                  </IconButtonWithText>
                </div>
              </div>

              {/* Client Type */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Client Type</span>
                <div className="flex flex-wrap gap-2">
                  {CLIENT_TYPE_OPTIONS.map((opt) => (
                    <ButtonWithText
                      key={opt.value}
                      onClick={() => toggleClientTypeFilter(opt.value)}
                      isSelected={activeClientTypeFilters.has(opt.value)}
                      variant="muted"
                    >
                      {opt.label}
                    </ButtonWithText>
                  ))}
                </div>
              </div>

              {/* Deadline Type */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Deadline Type</span>
                <div className="flex flex-wrap gap-2">
                  {DEADLINE_TYPE_OPTIONS.map((opt) => (
                    <ButtonWithText
                      key={opt.value}
                      onClick={() => toggleDeadlineTypeFilter(opt.value)}
                      isSelected={activeDeadlineTypeFilters.has(opt.value)}
                      variant="muted"
                    >
                      {opt.label}
                    </ButtonWithText>
                  ))}
                </div>
              </div>

              {/* Template Filter */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Template</span>
                <Select value={templateFilter} onValueChange={setTemplateFilter}>
                  <SelectTrigger className="w-[280px]">
                    <SelectValue placeholder="All templates" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All templates</SelectItem>
                    {uniqueTemplates.map((template) => (
                      <SelectItem key={template} value={template}>
                        {template}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range Filter */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date Range</span>
                <div className="flex flex-wrap gap-4 items-end">
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-muted-foreground whitespace-nowrap">Filter by:</label>
                    <Select value={dateFilterType} onValueChange={(value) => setDateFilterType(value as DateFilterType)}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="send_date">
                          {viewMode === 'sent' ? 'Date Sent' : 'Send Date'}
                        </SelectItem>
                        <SelectItem value="deadline_date">Deadline Date</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-muted-foreground whitespace-nowrap">From:</label>
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => {
                        setDateFrom(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-40 hover:border-foreground/20"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-muted-foreground whitespace-nowrap">To:</label>
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(e) => {
                        setDateTo(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-40 hover:border-foreground/20"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results count */}
        <div className="text-sm font-medium text-foreground/70">
          Showing <span className="font-semibold text-foreground">{sortedData.length}</span> of <span className="font-semibold text-foreground">{totalCount}</span>{' '}
          {viewMode === 'sent' ? 'sent emails' : 'queued emails'}
          {hasActiveFilters && <span className="text-muted-foreground ml-1">(filtered)</span>}
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
                    <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Client Name
                    </span>
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
                    <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Date Sent
                    </span>
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
                    <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Client Name
                    </span>
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
                    <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Send Date
                    </span>
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
