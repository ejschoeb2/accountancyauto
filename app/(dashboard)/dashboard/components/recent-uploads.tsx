'use client';

import { useCallback, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, FileText, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { buttonBaseVariants } from '@/components/ui/button-base';
import { getFilingTypeLabel } from '@/lib/constants/filing-types';
import type { RecentUpload } from '@/lib/dashboard/metrics';
import { DocumentPreviewModal } from '@/app/(dashboard)/clients/[id]/components/document-preview-modal';
import type { ClientDocument } from '@/app/(dashboard)/clients/[id]/components/document-preview-modal';
import { createClient } from '@/lib/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface RecentUploadsProps {
  uploads: RecentUpload[];
  onDataChange?: () => Promise<void>;
}

const PAGE_SIZE = 6;

export function RecentUploads({ uploads, onDataChange }: RecentUploadsProps) {
  const [page, setPage] = useState(0);
  const [previewDoc, setPreviewDoc] = useState<ClientDocument | null>(null);
  const [previewClientId, setPreviewClientId] = useState<string>('');
  const [previewClientName, setPreviewClientName] = useState<string | null>(null);
  const [loadingDocId, setLoadingDocId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(uploads.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = uploads.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  // Find current preview index for prev/next navigation
  const currentPreviewIndex = previewDoc ? uploads.findIndex(u => u.id === previewDoc.id) : -1;
  const hasPrevious = currentPreviewIndex > 0;
  const hasNext = currentPreviewIndex >= 0 && currentPreviewIndex < uploads.length - 1;

  const handleOpenDoc = useCallback(async (upload: RecentUpload) => {
    setLoadingDocId(upload.id);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('client_documents')
        .select(`
          id,
          filing_type_id,
          document_type_id,
          original_filename,
          classification_confidence,
          source,
          created_at,
          received_at,
          retention_flagged,
          extracted_tax_year,
          extracted_employer,
          extracted_paye_ref,
          extraction_source,
          page_count,
          needs_review,
          validation_warnings,
          document_types ( id, code, label )
        `)
        .eq('id', upload.id)
        .single();

      if (error || !data) {
        toast.error('Failed to load document');
        return;
      }

      setPreviewClientId(upload.client_id);
      setPreviewClientName(upload.client_name);
      setPreviewDoc(data as unknown as ClientDocument);
    } catch {
      toast.error('Failed to load document');
    } finally {
      setLoadingDocId(null);
    }
  }, []);

  const handleNavigate = useCallback((direction: 'prev' | 'next') => {
    const idx = currentPreviewIndex;
    const newIdx = direction === 'prev' ? idx - 1 : idx + 1;
    if (newIdx >= 0 && newIdx < uploads.length) {
      handleOpenDoc(uploads[newIdx]);
    }
  }, [currentPreviewIndex, uploads, handleOpenDoc]);

  return (
    <Card className="group py-5 hover:shadow-md transition-shadow duration-200 h-full">
      <CardContent className="px-5 py-0 h-full flex flex-col">
        <div className="flex items-start justify-between mb-6">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Recent Uploads
          </p>
          <div className="size-10 rounded-lg bg-emerald-500/10 flex items-center justify-center transition-all duration-200 group-hover:bg-emerald-500/20">
            <Upload className="size-6 text-emerald-500" />
          </div>
        </div>

        <div className="-mx-5 flex-1">
          {uploads.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 px-5">
              <FileText className="size-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                No documents uploaded yet
              </p>
            </div>
          ) : (
            <div className="space-y-0">
              {pageItems.map((upload) => (
                <button
                  key={upload.id}
                  type="button"
                  onClick={() => handleOpenDoc(upload)}
                  disabled={loadingDocId === upload.id}
                  className="flex items-center justify-between px-5 py-3 hover:bg-muted/50 transition-colors border-t first:border-t-0 w-full text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {upload.client_name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {upload.document_type_label || upload.original_filename}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {loadingDocId === upload.id && (
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    )}
                    {upload.needs_review && (
                      <div className="px-3 py-2 rounded-md inline-flex items-center bg-amber-500/10">
                        <span className="text-sm font-medium text-amber-600">Review</span>
                      </div>
                    )}
                    {upload.filing_type_id && (
                      <div className="px-3 py-2 rounded-md inline-flex items-center bg-sky-500/10">
                        <span className="text-sm font-medium text-sky-500">
                          {getFilingTypeLabel(upload.filing_type_id)}
                        </span>
                      </div>
                    )}
                    <div className="h-4 border-r border-gray-300 dark:border-gray-700" />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(upload.created_at))} ago
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-end gap-2 pt-4 mt-auto">
            <button
              className={buttonBaseVariants({ variant: 'muted', buttonType: 'icon-only' })}
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={safePage === 0}
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              className={buttonBaseVariants({ variant: 'muted', buttonType: 'icon-only' })}
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}
      </CardContent>

      {/* Document preview modal */}
      <DocumentPreviewModal
        doc={previewDoc}
        clientId={previewClientId}
        onClose={() => setPreviewDoc(null)}
        onDeleted={() => {
          setPreviewDoc(null);
          onDataChange?.();
        }}
        clientName={previewClientName}
        onPrevious={() => handleNavigate('prev')}
        onNext={() => handleNavigate('next')}
        hasPrevious={hasPrevious}
        hasNext={hasNext}
        onMarkedReceived={() => onDataChange?.()}
      />
    </Card>
  );
}
