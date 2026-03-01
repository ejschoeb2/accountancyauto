'use client';

import { CheckCircle } from 'lucide-react';

interface ExtractionConfirmationCardProps {
  documentTypeLabel: string;
  extractedTaxYear: string | null;
  extractedEmployer: string | null;
  extractedPayeRef: string | null;
}

export function ExtractionConfirmationCard({
  documentTypeLabel,
  extractedTaxYear,
  extractedEmployer,
  extractedPayeRef,
}: ExtractionConfirmationCardProps) {
  const rows = [
    { label: 'Document type', value: documentTypeLabel },
    extractedTaxYear ? { label: 'Tax year', value: extractedTaxYear } : null,
    extractedEmployer ? { label: 'Employer', value: extractedEmployer } : null,
    extractedPayeRef ? { label: 'PAYE ref', value: extractedPayeRef } : null,
  ].filter((row): row is { label: string; value: string } => row !== null);

  return (
    <div className="mt-3 flex items-start gap-3 p-4 bg-green-500/10 rounded-xl">
      <CheckCircle className="size-5 text-green-600 shrink-0 mt-0.5" />
      <div className="space-y-2">
        <p className="text-sm font-medium text-green-600">We&apos;ve read this document</p>
        <dl className="space-y-1.5">
          {rows.map(row => (
            <div key={row.label} className="flex items-baseline gap-3">
              <dt className="text-xs font-semibold text-green-600/70 uppercase tracking-wide w-24 shrink-0">
                {row.label}
              </dt>
              <dd className="text-xs font-medium text-green-700">{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
