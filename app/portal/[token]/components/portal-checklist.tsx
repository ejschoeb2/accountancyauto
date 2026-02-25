'use client';

import { useState } from 'react';
import { ChecklistItem } from './checklist-item';
import { ProgressBar } from './progress-bar';
import type { ChecklistItem as ChecklistItemType } from '../page';

interface UploadedFile {
  filename: string;
  confidence: string;
  // Phase 22 additions:
  documentTypeLabel: string | null;
  extractedTaxYear: string | null;
  extractedEmployer: string | null;
  extractedPayeRef: string | null;
  showConfirmationCard: boolean; // pre-computed: has OCR data AND not unclassified AND not image-only
}

interface PendingDuplicate {
  itemId: string;
  file: File;
}

interface PortalChecklistProps {
  checklist: ChecklistItemType[];
  rawToken: string;
  orgName: string;
}

export function PortalChecklist({ checklist, rawToken, orgName }: PortalChecklistProps) {
  const [uploadedByItemId, setUploadedByItemId] = useState<Record<string, UploadedFile[]>>({});
  const [pendingDuplicate, setPendingDuplicate] = useState<PendingDuplicate | null>(null);

  const totalProvided = Object.values(uploadedByItemId).filter(files => files.length > 0).length;

  const handleUpload = async (itemId: string, file: File, confirmDuplicate = false) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('checklistItemId', itemId);
    if (confirmDuplicate) formData.append('confirmDuplicate', 'true');

    const res = await fetch(`/api/portal/${rawToken}/upload`, {
      method: 'POST',
      body: formData,
    });

    // Duplicate detected — show warning instead of throwing
    if (res.status === 409) {
      setPendingDuplicate({ itemId, file });
      return;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(data.error ?? 'Upload failed. Please try again.');
    }

    const data = await res.json();
    setPendingDuplicate(null); // clear any pending duplicate

    const hasOcrData =
      data.extractedTaxYear !== null ||
      data.extractedEmployer !== null ||
      data.extractedPayeRef !== null;
    const showConfirmationCard = hasOcrData && data.confidence !== 'unclassified' && !data.isImageOnly;

    setUploadedByItemId(prev => ({
      ...prev,
      [itemId]: [
        ...(prev[itemId] ?? []),
        {
          filename: file.name,
          confidence: data.confidence ?? 'unclassified',
          documentTypeLabel: data.documentTypeLabel ?? null,
          extractedTaxYear: data.extractedTaxYear ?? null,
          extractedEmployer: data.extractedEmployer ?? null,
          extractedPayeRef: data.extractedPayeRef ?? null,
          showConfirmationCard,
        },
      ],
    }));
  };

  if (checklist.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-sm">No documents are required for this filing.</p>
        <p className="text-gray-400 text-xs mt-1">Contact your accountant if you believe this is an error.</p>
      </div>
    );
  }

  return (
    <div>
      <ProgressBar provided={totalProvided} total={checklist.length} />
      <div className="space-y-3">
        {checklist.map((item) => {
          const itemHasDuplicate = pendingDuplicate?.itemId === item.id;
          return (
            <ChecklistItem
              key={item.id}
              item={item}
              uploaded={uploadedByItemId[item.id] ?? []}
              onUpload={(file) => handleUpload(item.id, file)}
              disabled={pendingDuplicate !== null && !itemHasDuplicate}
              duplicateWarning={itemHasDuplicate ? pendingDuplicate?.file.name : undefined}
              onConfirmDuplicate={itemHasDuplicate ? () => handleUpload(item.id, pendingDuplicate!.file, true) : undefined}
              onDismissDuplicate={itemHasDuplicate ? () => setPendingDuplicate(null) : undefined}
            />
          );
        })}
      </div>
      <p className="mt-6 text-xs text-gray-400 text-center">
        Powered by Prompt. Your files are securely stored and only accessible to {orgName}.
      </p>
    </div>
  );
}
