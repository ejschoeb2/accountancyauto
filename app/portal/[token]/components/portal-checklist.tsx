'use client';

import { useState } from 'react';
import { ChecklistItem } from './checklist-item';
import { ProgressBar } from './progress-bar';
import type { ChecklistItem as ChecklistItemType } from '../page';

interface UploadedFile {
  filename: string;
  confidence: string;
}

interface PortalChecklistProps {
  checklist: ChecklistItemType[];
  rawToken: string;
  orgName: string;
}

export function PortalChecklist({ checklist, rawToken, orgName }: PortalChecklistProps) {
  const [uploadedByItemId, setUploadedByItemId] = useState<Record<string, UploadedFile[]>>({});

  const totalProvided = Object.values(uploadedByItemId).filter(files => files.length > 0).length;

  const handleUpload = async (itemId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('checklistItemId', itemId);

    const res = await fetch(`/api/portal/${rawToken}/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(data.error ?? 'Upload failed. Please try again.');
    }

    const data = await res.json();

    setUploadedByItemId(prev => ({
      ...prev,
      [itemId]: [
        ...(prev[itemId] ?? []),
        { filename: file.name, confidence: data.confidence ?? 'unclassified' },
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
        {checklist.map((item) => (
          <ChecklistItem
            key={item.id}
            item={item}
            uploaded={uploadedByItemId[item.id] ?? []}
            onUpload={(file) => handleUpload(item.id, file)}
          />
        ))}
      </div>
      <p className="mt-6 text-xs text-gray-400 text-center">
        Powered by Prompt. Your files are securely stored and only accessible to {orgName}.
      </p>
    </div>
  );
}
