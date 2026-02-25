'use client';

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
    extractedPayeRef ? { label: 'PAYE reference', value: extractedPayeRef } : null,
  ].filter((row): row is { label: string; value: string } => row !== null);

  return (
    <div className="mt-3 rounded-md bg-green-50 border border-green-100 px-3 py-2.5 space-y-1.5">
      <p className="text-xs font-medium text-green-700">We&apos;ve read this document</p>
      {rows.map(row => (
        <div key={row.label} className="flex items-baseline gap-2">
          <span className="text-xs text-gray-500 w-28 shrink-0">{row.label}</span>
          <span className="text-xs font-medium text-gray-800">{row.value}</span>
        </div>
      ))}
    </div>
  );
}
