'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ButtonWithText } from '@/components/ui/button-with-text';
import { IconButtonWithText } from '@/components/ui/icon-button-with-text';
import { Card, CardContent } from '@/components/ui/card';
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
import { getPortalUploads, type PortalUpload } from '@/app/actions/document-uploads';
import { format } from 'date-fns';
import { Search, X, SlidersHorizontal, FileUp, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { DocumentPreviewModal, type ClientDocument } from '@/app/(dashboard)/clients/[id]/components/document-preview-modal';
import { toast } from 'sonner';

const ITEMS_PER_PAGE = 20;

const FILING_TYPE_OPTIONS = [
  { value: 'corporation_tax_payment', label: 'Corp Tax' },
  { value: 'ct600_filing', label: 'CT600' },
  { value: 'companies_house', label: 'Companies House' },
  { value: 'vat_return', label: 'VAT Return' },
  { value: 'self_assessment', label: 'Self Assessment' },
];

function getVerdict(upload: PortalUpload): { label: string; bg: string; text: string } {
  if (upload.needs_review) return { label: 'Review needed', bg: 'bg-amber-500/10', text: 'text-amber-600' };
  const c = upload.classification_confidence;
  if (c === 'low' || c === 'unclassified' || !c)
    return { label: 'Low confidence', bg: 'bg-red-500/10', text: 'text-red-600' };
  if (c === 'medium')
    return { label: 'Likely match', bg: 'bg-amber-500/10', text: 'text-amber-600' };
  return { label: 'Verified', bg: 'bg-green-500/10', text: 'text-green-600' };
}

const VERDICT_OPTIONS = [
  { value: 'review', label: 'Review needed' },
  { value: 'low', label: 'Low confidence' },
  { value: 'medium', label: 'Likely match' },
  { value: 'high', label: 'Verified' },
];

const FILING_LABELS: Record<string, string> = {
  corporation_tax_payment: 'Corp Tax',
  ct600_filing: 'CT600',
  companies_house: 'Companies House',
  vat_return: 'VAT Return',
  self_assessment: 'Self Assessment',
};

interface UploadsTableProps {
  initialSort?: string;
}

export function UploadsTable({ initialSort }: UploadsTableProps) {
  const [data, setData] = useState<PortalUpload[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Search
  const [clientSearch, setClientSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilingFilters, setActiveFilingFilters] = useState<Set<string>>(new Set());
  const [activeVerdictFilters, setActiveVerdictFilters] = useState<Set<string>>(new Set());
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  // Phase 30: Needs Review filter
  const [filterNeedsReview, setFilterNeedsReview] = useState(false);

  // Sort
  const [sortBy, setSortBy] = useState(initialSort || 'received-desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  // Document preview modal state
  const [previewDoc, setPreviewDoc] = useState<ClientDocument | null>(null);
  const [previewClientId, setPreviewClientId] = useState<string>('');
  const [previewClientName, setPreviewClientName] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number>(-1);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(clientSearch); setCurrentPage(1); }, 300);
    return () => clearTimeout(t);
  }, [clientSearch]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getPortalUploads({
        clientSearch: debouncedSearch || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        offset: (currentPage - 1) * ITEMS_PER_PAGE,
        limit: ITEMS_PER_PAGE,
      });
      setData(result.data);
      setTotalCount(result.totalCount);
    } catch (err) {
      console.error('Failed to load uploads:', err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, dateFrom, dateTo, currentPage]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Client-side filter chips (filing type + confidence + needs review) applied on top of server results
  const filteredData = useMemo(() => {
    let rows = data;
    if (activeFilingFilters.size > 0) {
      rows = rows.filter((r) => r.filing_type_id && activeFilingFilters.has(r.filing_type_id));
    }
    if (activeVerdictFilters.size > 0) {
      rows = rows.filter((r) => {
        const v = getVerdict(r);
        if (activeVerdictFilters.has('review') && v.label === 'Review needed') return true;
        if (activeVerdictFilters.has('low') && v.label === 'Low confidence') return true;
        if (activeVerdictFilters.has('medium') && v.label === 'Likely match') return true;
        if (activeVerdictFilters.has('high') && v.label === 'Verified') return true;
        return false;
      });
    }
    // Phase 30: filter to only rows that need review
    if (filterNeedsReview) {
      rows = rows.filter((r) => r.needs_review === true);
    }
    return rows;
  }, [data, activeFilingFilters, activeVerdictFilters, filterNeedsReview]);

  // Client-side sort
  const sortedData = useMemo(() => {
    const rows = [...filteredData];
    switch (sortBy) {
      case 'client-asc':
        return rows.sort((a, b) => (a.client_name ?? '').localeCompare(b.client_name ?? ''));
      case 'client-desc':
        return rows.sort((a, b) => (b.client_name ?? '').localeCompare(a.client_name ?? ''));
      case 'received-asc':
        return rows.sort((a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime());
      case 'received-desc':
      default:
        return rows.sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime());
    }
  }, [filteredData, sortBy]);

  // Preview navigation — must be after sortedData
  const openPreviewForUpload = useCallback(async (upload: PortalUpload, index: number) => {
    if (!upload.client_id) return;
    const supabase = createClient();
    const { data: docData, error } = await supabase
      .from('client_documents')
      .select('id, filing_type_id, document_type_id, original_filename, received_at, classification_confidence, source, created_at, retention_flagged, extracted_tax_year, extracted_employer, extracted_paye_ref, extraction_source, page_count, needs_review, validation_warnings, document_types(id, code, label)')
      .eq('id', upload.id)
      .single();
    if (error || !docData) {
      toast.error('Failed to load document details');
      return;
    }
    setPreviewDoc(docData as unknown as ClientDocument);
    setPreviewClientId(upload.client_id);
    setPreviewClientName(upload.client_name);
    setPreviewIndex(index);
  }, []);

  const handleRowClick = useCallback((upload: PortalUpload) => {
    const index = sortedData.findIndex((u) => u.id === upload.id);
    openPreviewForUpload(upload, index);
  }, [sortedData, openPreviewForUpload]);

  const handlePrevious = useCallback(() => {
    if (previewIndex <= 0) return;
    const prevUpload = sortedData[previewIndex - 1];
    if (prevUpload) openPreviewForUpload(prevUpload, previewIndex - 1);
  }, [previewIndex, sortedData, openPreviewForUpload]);

  const handleNext = useCallback(() => {
    if (previewIndex >= sortedData.length - 1) return;
    const nextUpload = sortedData[previewIndex + 1];
    if (nextUpload) openPreviewForUpload(nextUpload, previewIndex + 1);
  }, [previewIndex, sortedData, openPreviewForUpload]);

  function toggleFilingFilter(v: string) {
    setActiveFilingFilters((prev) => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n; });
  }
  function toggleVerdictFilter(v: string) {
    setActiveVerdictFilters((prev) => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n; });
  }

  const activeFilterCount = activeFilingFilters.size + activeVerdictFilters.size + (filterNeedsReview ? 1 : 0);
  const hasActiveFilters = debouncedSearch !== '' || dateFrom !== '' || dateTo !== '' || activeFilterCount > 0;

  function clearAllFilters() {
    setClientSearch('');
    setDebouncedSearch('');
    setDateFrom('');
    setDateTo('');
    setActiveFilingFilters(new Set());
    setActiveVerdictFilters(new Set());
    setFilterNeedsReview(false);
    setCurrentPage(1);
  }

  return (
    <div className="space-y-6 pb-0">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Search and Controls */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          {/* Search */}
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

          {/* Controls toolbar */}
          <div className="flex gap-2 sm:ml-auto items-center">
            <IconButtonWithText
              type="button"
              variant={showFilters ? 'amber' : 'violet'}
              onClick={() => setShowFilters((v) => !v)}
              title={showFilters ? 'Close filters' : 'Open filters'}
            >
              <SlidersHorizontal className="h-5 w-5" />
              {showFilters ? 'Close Filters' : 'Filter'}
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
                  <SelectItem value="received-desc">Received (Latest)</SelectItem>
                  <SelectItem value="received-asc">Received (Earliest)</SelectItem>
                  <SelectItem value="client-asc">Client Name (A-Z)</SelectItem>
                  <SelectItem value="client-desc">Client Name (Z-A)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Collapsible filter panel */}
        {showFilters && (
          <Card>
            <CardContent className="space-y-4">
              {/* Filing Type + Clear button row */}
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Filing Type</span>
                  <div className="flex flex-wrap gap-2">
                    {FILING_TYPE_OPTIONS.map((opt) => (
                      <ButtonWithText
                        key={opt.value}
                        onClick={() => toggleFilingFilter(opt.value)}
                        isSelected={activeFilingFilters.has(opt.value)}
                        variant="muted"
                      >
                        {opt.label}
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

              {/* Verdict */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Verdict</span>
                <div className="flex flex-wrap gap-2">
                  {VERDICT_OPTIONS.map((opt) => (
                    <ButtonWithText
                      key={opt.value}
                      onClick={() => toggleVerdictFilter(opt.value)}
                      isSelected={activeVerdictFilters.has(opt.value)}
                      variant="muted"
                    >
                      {opt.label}
                    </ButtonWithText>
                  ))}
                </div>
              </div>

              {/* Phase 30: Needs Review filter */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Validation</span>
                <div className="flex flex-wrap gap-2">
                  <ButtonWithText
                    onClick={() => { setFilterNeedsReview((v) => !v); setCurrentPage(1); }}
                    isSelected={filterNeedsReview}
                    variant="muted"
                  >
                    <AlertTriangle className="size-3 mr-1" />
                    Needs Review
                  </ButtonWithText>
                </div>
              </div>

              {/* Date Range */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date Range</span>
                <div className="flex flex-wrap gap-4 items-end">
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-muted-foreground whitespace-nowrap">From:</label>
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
                      className="w-40 hover:border-foreground/20"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-muted-foreground whitespace-nowrap">To:</label>
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
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
          Showing <span className="font-semibold text-foreground">{sortedData.length}</span> of{' '}
          <span className="font-semibold text-foreground">{totalCount}</span> uploads
          {hasActiveFilters && <span className="text-muted-foreground ml-1">(filtered)</span>}
        </div>
      </div>

      {/* Table — full page width */}
      <div className="-mx-8 -mb-10 border-y shadow-sm hover:shadow-lg transition-shadow duration-300 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Client</span>
              </TableHead>
              <TableHead>
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">File</span>
              </TableHead>
              <TableHead>
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Filing Type</span>
              </TableHead>
              <TableHead>
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Document Type</span>
              </TableHead>
              <TableHead>
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Received</span>
              </TableHead>
              <TableHead>
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Verdict</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-sm">
                  Loading uploads...
                </TableCell>
              </TableRow>
            ) : sortedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <FileUp className="size-8 opacity-40" />
                    <p className="text-sm">
                      {hasActiveFilters ? 'No uploads match your filters' : 'No portal uploads yet'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              sortedData.map((upload) => (
                <TableRow
                  key={upload.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleRowClick(upload)}
                >
                  <TableCell className="font-medium">
                    {upload.client_id ? (
                      <Link
                        href={`/clients/${upload.client_id}`}
                        className="hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {upload.client_name ?? '—'}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">Unknown client</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[220px]">
                    <span className="truncate block text-sm" title={upload.original_filename}>
                      {upload.original_filename}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {upload.filing_type_id ? (FILING_LABELS[upload.filing_type_id] ?? upload.filing_type_name ?? upload.filing_type_id) : '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {upload.document_type_label ?? '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {upload.received_at ? format(new Date(upload.received_at), 'd MMM yyyy, HH:mm') : '—'}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const verdict = getVerdict(upload);
                      return (
                        <div className={`px-3 py-2 rounded-md inline-flex items-center ${verdict.bg}`}>
                          <span className={`text-sm font-medium ${verdict.text}`}>{verdict.label}</span>
                        </div>
                      );
                    })()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Document preview modal */}
      <DocumentPreviewModal
        doc={previewDoc}
        clientId={previewClientId}
        clientName={previewClientName}
        onClose={() => { setPreviewDoc(null); setPreviewIndex(-1); }}
        onDeleted={(docId) => {
          setPreviewDoc(null);
          setPreviewIndex(-1);
          setData((prev) => prev.filter((u) => u.id !== docId));
          setTotalCount((prev) => prev - 1);
        }}
        onPrevious={handlePrevious}
        onNext={handleNext}
        hasPrevious={previewIndex > 0}
        hasNext={previewIndex < sortedData.length - 1}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1 || loading}
            >
              <ChevronLeft className="size-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || loading}
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
