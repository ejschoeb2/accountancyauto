'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ButtonBase } from '@/components/ui/button-base';
import { ButtonWithText } from '@/components/ui/button-with-text';
import { IconButtonWithText } from '@/components/ui/icon-button-with-text';
import { usePageLoading } from '@/components/page-loading';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
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
import {
  getInboundEmails,
  markInboundEmailAsRead,
  updateRecordsReceivedManual,
  type InboundEmail
} from '@/app/actions/inbound-emails';
import { InboundEmailDetailModal } from './inbound-email-detail-modal';
import { format } from 'date-fns';
import {
  Search,
  X,
  SlidersHorizontal,
  CheckCircle,
  Mail,
  MailOpen,
} from 'lucide-react';

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

export function InboundEmailTable() {
  const router = useRouter();
  const [data, setData] = useState<InboundEmail[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [selectedEmail, setSelectedEmail] = useState<InboundEmail | null>(null);
  const [showModal, setShowModal] = useState(false);

  usePageLoading('inbound-email-table', loading);

  // Filter state
  const [clientSearch, setClientSearch] = useState('');
  const [debouncedClientSearch, setDebouncedClientSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activeClientTypeFilters, setActiveClientTypeFilters] = useState<Set<string>>(new Set());
  const [activeDeadlineTypeFilters, setActiveDeadlineTypeFilters] = useState<Set<string>>(new Set());
  const [activeReadFilter, setActiveReadFilter] = useState<'all' | 'read' | 'unread'>('all');
  const [activeRecordsFilter, setActiveRecordsFilter] = useState<'all' | 'detected' | 'not-detected'>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Sort state
  const [sortBy, setSortBy] = useState<string>("received-date-desc");

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

      const result = await getInboundEmails({
        clientSearch: debouncedClientSearch || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        offset,
        limit: ITEMS_PER_PAGE,
      });
      setData(result.data);
      setTotalCount(result.totalCount);
    } catch (error) {
      console.error('Error fetching inbound emails:', error);
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

  // Client-side filtering and sorting
  const sortedData = useMemo(() => {
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

      // Read/Unread filter
      if (activeReadFilter === 'read' && !item.read) {
        return false;
      }
      if (activeReadFilter === 'unread' && item.read) {
        return false;
      }

      // Records detected filter
      if (activeRecordsFilter === 'detected' && !item.records_received_detected) {
        return false;
      }
      if (activeRecordsFilter === 'not-detected' && item.records_received_detected) {
        return false;
      }

      return true;
    });

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "client-name-asc":
          return (a.client_name || '').localeCompare(b.client_name || '');
        case "client-name-desc":
          return (b.client_name || '').localeCompare(a.client_name || '');
        case "received-date-asc":
          return a.received_at.localeCompare(b.received_at);
        case "received-date-desc":
          return b.received_at.localeCompare(a.received_at);
        default:
          return 0;
      }
    });

    return sorted;
  }, [data, activeClientTypeFilters, activeDeadlineTypeFilters, activeReadFilter, activeRecordsFilter, sortBy]);

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

  const activeFilterCount =
    activeClientTypeFilters.size +
    activeDeadlineTypeFilters.size +
    (activeReadFilter !== 'all' ? 1 : 0) +
    (activeRecordsFilter !== 'all' ? 1 : 0);

  const hasActiveFilters =
    clientSearch !== '' ||
    dateFrom !== '' ||
    dateTo !== '' ||
    activeClientTypeFilters.size > 0 ||
    activeDeadlineTypeFilters.size > 0 ||
    activeReadFilter !== 'all' ||
    activeRecordsFilter !== 'all';

  function clearAllFilters() {
    setClientSearch('');
    setDateFrom('');
    setDateTo('');
    setActiveClientTypeFilters(new Set());
    setActiveDeadlineTypeFilters(new Set());
    setActiveReadFilter('all');
    setActiveRecordsFilter('all');
    setCurrentPage(1);
  }

  // Row click handler - open modal
  const handleRowClick = (email: InboundEmail) => {
    setSelectedEmail(email);
    setShowModal(true);
  };

  // Modal navigation
  const handleNavigate = (direction: 'prev' | 'next') => {
    if (!selectedEmail) return;

    const currentIndex = sortedData.findIndex((e) => e.id === selectedEmail.id);
    let newIndex: number;

    if (direction === 'prev') {
      newIndex = currentIndex - 1;
    } else {
      newIndex = currentIndex + 1;
    }

    if (newIndex >= 0 && newIndex < sortedData.length) {
      setSelectedEmail(sortedData[newIndex]);
    }
  };

  // Mark email as read handler
  const handleMarkAsRead = async (emailId: string) => {
    try {
      const result = await markInboundEmailAsRead(emailId);
      if (result.success) {
        // Update local state to reflect read status
        setData((prevData) =>
          prevData.map((email) =>
            email.id === emailId ? { ...email, read: true } : email
          )
        );
      } else {
        console.error('Failed to mark email as read:', result.error);
      }
    } catch (error) {
      console.error('Error marking email as read:', error);
    }
  };

  // Update records received handler (for recommend mode)
  const handleUpdateRecordsReceived = async (
    emailId: string,
    clientId: string,
    filingTypeId: string
  ) => {
    try {
      const result = await updateRecordsReceivedManual(emailId, clientId, filingTypeId);
      if (result.success) {
        // Refresh data to show updated status
        await fetchData();
        setShowModal(false);
      } else {
        console.error('Failed to update records received:', result.error);
        alert(`Failed to update: ${result.error}`);
      }
    } catch (error) {
      console.error('Error updating records received:', error);
      alert('An error occurred while updating records received');
    }
  };

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
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="h-9 min-w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="received-date-desc">Received Date (Latest)</SelectItem>
                  <SelectItem value="received-date-asc">Received Date (Earliest)</SelectItem>
                  <SelectItem value="client-name-asc">Client Name (A-Z)</SelectItem>
                  <SelectItem value="client-name-desc">Client Name (Z-A)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Collapsible filter panel */}
        {showFilters && (
          <Card>
            <CardContent className="space-y-4">
              {/* Read Status and Records Detected */}
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Read Status</span>
                  <div className="flex flex-wrap gap-2">
                    <ButtonWithText
                      onClick={() => setActiveReadFilter('all')}
                      isSelected={activeReadFilter === 'all'}
                      variant="muted"
                    >
                      All
                    </ButtonWithText>
                    <ButtonWithText
                      onClick={() => setActiveReadFilter('read')}
                      isSelected={activeReadFilter === 'read'}
                      variant="muted"
                    >
                      Read
                    </ButtonWithText>
                    <ButtonWithText
                      onClick={() => setActiveReadFilter('unread')}
                      isSelected={activeReadFilter === 'unread'}
                      variant="muted"
                    >
                      Unread
                    </ButtonWithText>
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

              {/* Records Received Status */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Records Received</span>
                <div className="flex flex-wrap gap-2">
                  <ButtonWithText
                    onClick={() => setActiveRecordsFilter('all')}
                    isSelected={activeRecordsFilter === 'all'}
                    variant="muted"
                  >
                    All
                  </ButtonWithText>
                  <ButtonWithText
                    onClick={() => setActiveRecordsFilter('detected')}
                    isSelected={activeRecordsFilter === 'detected'}
                    variant="muted"
                  >
                    Detected
                  </ButtonWithText>
                  <ButtonWithText
                    onClick={() => setActiveRecordsFilter('not-detected')}
                    isSelected={activeRecordsFilter === 'not-detected'}
                    variant="muted"
                  >
                    Not Detected
                  </ButtonWithText>
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

              {/* Date Range Filter */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Received Date Range</span>
                <div className="flex flex-wrap gap-4 items-end">
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
          inbound emails
          {hasActiveFilters && <span className="text-muted-foreground ml-1">(filtered)</span>}
        </div>
      </div>

      {/* Table - Full page width like client table */}
      <div className="-mx-8 -mb-10 border-y shadow-sm hover:shadow-lg transition-shadow duration-300 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              {/* Client Name */}
              <TableHead>
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Client Name
                </span>
              </TableHead>
              {/* Received Date + Time */}
              <TableHead>
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Received
                </span>
              </TableHead>
              {/* Deadline Type */}
              <TableHead>
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Deadline Type
                </span>
              </TableHead>
              {/* Read Status */}
              <TableHead>
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Read
                </span>
              </TableHead>
              {/* Records Received */}
              <TableHead>
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Records Received
                </span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : sortedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No inbound emails found
                </TableCell>
              </TableRow>
            ) : (
              sortedData.map((email) => (
                <TableRow
                  key={email.id}
                  className="group cursor-pointer"
                  onClick={() => handleRowClick(email)}
                >
                  {/* Client Name */}
                  <TableCell className="font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                    {email.client_name || <span className="italic">Unknown Client</span>}
                  </TableCell>
                  {/* Received Date + Time */}
                  <TableCell className="text-muted-foreground group-hover:text-foreground transition-colors">
                    {format(new Date(email.received_at), 'dd MMM yyyy HH:mm')}
                  </TableCell>
                  {/* Deadline Type */}
                  <TableCell className="text-muted-foreground group-hover:text-foreground transition-colors">
                    {email.filing_type_id ? (FILING_TYPE_LABELS[email.filing_type_id] || email.filing_type_name) : '—'}
                  </TableCell>
                  {/* Read Status */}
                  <TableCell>
                    {email.read ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MailOpen className="h-4 w-4" />
                        <span className="text-sm">Read</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-blue-600">
                        <Mail className="h-4 w-4" />
                        <span className="text-sm font-medium">Unread</span>
                      </div>
                    )}
                  </TableCell>
                  {/* Records Received */}
                  <TableCell>
                    {email.records_received_detected ? (
                      <div className="px-3 py-2 rounded-md bg-green-500/10 inline-flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-600">
                          Detected
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="max-w-7xl mx-auto mt-16">
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

      {/* Email Detail Modal */}
      <InboundEmailDetailModal
        open={showModal}
        onClose={() => setShowModal(false)}
        email={selectedEmail as any}
        emails={sortedData as any[]}
        onNavigate={handleNavigate}
        onMarkAsRead={handleMarkAsRead}
        onUpdateRecordsReceived={handleUpdateRecordsReceived}
      />
    </div>
  );
}
