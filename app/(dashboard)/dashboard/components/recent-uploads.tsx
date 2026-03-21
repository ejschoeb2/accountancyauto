'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, FileText, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { buttonBaseVariants } from '@/components/ui/button-base';
import { getFilingTypeLabel } from '@/lib/constants/filing-types';
import type { RecentUpload } from '@/lib/dashboard/metrics';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

interface RecentUploadsProps {
  uploads: RecentUpload[];
}

const PAGE_SIZE = 6;

export function RecentUploads({ uploads }: RecentUploadsProps) {
  const [page, setPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(uploads.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = uploads.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

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
                <Link
                  key={upload.id}
                  href={`/clients/${upload.client_id}?tab=documents`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-muted/50 transition-colors border-t first:border-t-0"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="size-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                      <FileText className="size-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {upload.client_name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {upload.document_type_label || upload.original_filename}
                        {upload.filing_type_id && (
                          <span className="text-muted-foreground/60">
                            {' · '}{getFilingTypeLabel(upload.filing_type_id)}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {upload.needs_review && (
                      <div className="px-2 py-1 rounded-md bg-amber-500/10 inline-flex items-center gap-1">
                        <AlertCircle className="size-3 text-amber-500" />
                        <span className="text-xs font-medium text-amber-600">Review</span>
                      </div>
                    )}
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(upload.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </Link>
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
    </Card>
  );
}
