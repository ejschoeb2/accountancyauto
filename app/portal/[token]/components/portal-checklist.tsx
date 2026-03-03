'use client';

import { useState } from 'react';
import { ChecklistItem } from './checklist-item';
import { ProgressBar } from './progress-bar';
import type { ChecklistItem as ChecklistItemType } from '../page';

interface ValidationWarning {
  code: string;
  message: string;
  expected?: string;
  found?: string;
}

interface UploadedFile {
  filename: string;
  confidence: string;
  // Phase 22 additions:
  documentTypeLabel: string | null;
  extractedTaxYear: string | null;
  extractedEmployer: string | null;
  extractedPayeRef: string | null;
  showConfirmationCard: boolean; // pre-computed: has OCR data AND not unclassified AND not image-only AND no validation warnings
  // Phase 30: validation warnings (empty array = no issues)
  validationWarnings: ValidationWarning[];
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

// Phase 29: files over this threshold route through provider-native chunked upload
// to avoid hitting Vercel's 4.5 MB request body limit
const LARGE_FILE_THRESHOLD = 4 * 1024 * 1024; // 4 MB

// Chunk size: LCM(262144, 327680) = 1,310,720 bytes (1.25 MB)
// Satisfies both Google Drive (256 KiB multiples) and OneDrive (320 KiB multiples)
const CHUNK_SIZE = 1310720;

/**
 * Computes a SHA-256 hex digest of a File using the Web Crypto API.
 * Re-reads the full file into memory — acceptable at 4+ MB since the goal is to
 * prevent the SERVER from buffering, not the browser.
 */
async function computeSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Sends a File to a pre-authenticated session URL in fixed-size chunks using
 * Content-Range PUT requests. Compatible with both Google Drive resumable sessions
 * and OneDrive large file upload sessions.
 *
 * No Authorization header is sent — the session URL is already pre-authenticated
 * by the respective provider when the session was created.
 *
 * @param sessionUrl  Pre-authenticated URL returned by upload-session route
 * @param file        The File object to upload
 * @param onProgress  Optional progress callback (percentage 0–100)
 * @returns           { fileId } — provider-assigned file/item ID from the final response
 */
async function uploadInChunks(
  sessionUrl: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<{ fileId: string }> {
  let offset = 0;
  while (offset < file.size) {
    const end = Math.min(offset + CHUNK_SIZE, file.size) - 1;
    const chunk = file.slice(offset, end + 1);
    const chunkBuffer = await chunk.arrayBuffer();

    const res = await fetch(sessionUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': String(chunkBuffer.byteLength),
        'Content-Range': `bytes ${offset}-${end}/${file.size}`,
        // NOTE: NO Authorization header — session URL is pre-authenticated for Drive/OneDrive
      },
      body: chunkBuffer,
    });

    // 200 or 201 signals the upload is complete; the response body contains the file metadata
    if (res.status === 200 || res.status === 201) {
      const data = await res.json();
      return { fileId: data.id };
    }

    // 308 Resume Incomplete (Drive) or 202 Accepted (OneDrive) — more chunks expected
    if (res.status !== 308 && res.status !== 202) {
      throw new Error(`Chunk upload failed with unexpected status ${res.status}`);
    }

    offset = end + 1;
    onProgress?.(Math.round((offset / file.size) * 100));
  }

  throw new Error('Upload loop exited without receiving a completion response from provider');
}

export function PortalChecklist({ checklist, rawToken, orgName }: PortalChecklistProps) {
  const [uploadedByItemId, setUploadedByItemId] = useState<Record<string, UploadedFile[]>>({});
  const [pendingDuplicate, setPendingDuplicate] = useState<PendingDuplicate | null>(null);

  const requiredItems = checklist.filter(item => item.is_mandatory);
  const optionalItems = checklist.filter(item => !item.is_mandatory);
  const requiredProvided = requiredItems.filter(item => (uploadedByItemId[item.id] ?? []).length > 0).length;

  const handleUpload = async (itemId: string, file: File, confirmDuplicate = false) => {
    // ── Phase 29: Large file path — provider-native chunked upload ─────────────
    // Files over 4 MB cannot be buffered in a Vercel function body (4.5 MB limit).
    // For Google Drive and OneDrive backends, the browser uploads directly to the
    // provider using a pre-authenticated session URL, then notifies the server via
    // upload-finalize to write the client_documents row.
    if (file.size > LARGE_FILE_THRESHOLD) {
      // Step 1: Request a provider session from the server
      const sessionRes = await fetch(`/api/portal/${rawToken}/upload-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type,
          fileSize: file.size,
          // Server reads clientName, filingTypeId, taxYear from the portal token
          clientName: '',
          filingTypeId: '',
          taxYear: '',
        }),
      });

      if (!sessionRes.ok) {
        const d = await sessionRes.json().catch(() => ({ error: 'Session initiation failed' }));
        throw new Error(d.error ?? 'Failed to initiate upload session. Please try again.');
      }

      const session = await sessionRes.json();

      // Supabase: no chunked session needed — fall through to existing route below
      if (session.provider === 'supabase') {
        // intentional fall-through to the small-file formData path
      } else if (session.provider === 'dropbox') {
        // Dropbox does not offer a pre-authenticated session URL — the SDK call happens
        // server-side. Large Dropbox files must still route through the existing upload
        // endpoint (which buffers in the Vercel function). This is a known limitation
        // documented in Phase 29 research; a streaming proxy endpoint would be required
        // for a full fix. Fall through to the standard route.
      } else if (session.sessionUrl) {
        // Google Drive or OneDrive: upload directly from browser to provider in chunks
        const { fileId } = await uploadInChunks(session.sessionUrl, file);

        // Step 2: Compute SHA-256 for integrity record (browser-side; server never sees bytes)
        const sha256Hash = await computeSha256(file);

        // Step 3: Notify server to write client_documents row
        const finalizeRes = await fetch(`/api/portal/${rawToken}/upload-finalize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storagePath: fileId,
            filename: file.name,
            mimeType: file.type,
            fileSize: file.size,
            provider: session.provider,
            sha256Hash,
          }),
        });

        if (!finalizeRes.ok) {
          const d = await finalizeRes.json().catch(() => ({ error: 'Finalize failed' }));
          throw new Error(d.error ?? 'Upload finalize failed. Please try again.');
        }

        const data = await finalizeRes.json();

        // Large files skip the OCR confirmation card — no extraction data is available
        // (bytes went directly to the provider; server never processed them)
        // Phase 30: no buffer = no validation, so validationWarnings is always empty
        setUploadedByItemId(prev => ({
          ...prev,
          [itemId]: [
            ...(prev[itemId] ?? []),
            {
              filename: file.name,
              confidence: data.confidence ?? 'unclassified',
              documentTypeLabel: data.documentTypeLabel ?? null,
              extractedTaxYear: null,
              extractedEmployer: null,
              extractedPayeRef: null,
              showConfirmationCard: false,
              validationWarnings: [],
            },
          ],
        }));
        return; // done — skip the small-file formData path below
      }
      // provider === 'supabase' or 'dropbox': fall through to existing route
    }

    // ── Existing small-file path (unchanged) ────────────────────────────────────
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

    const validationWarnings: ValidationWarning[] = data.validationWarnings ?? [];
    const hasOcrData =
      data.extractedTaxYear !== null ||
      data.extractedEmployer !== null ||
      data.extractedPayeRef !== null;
    // Phase 30 (Pitfall 6): amber warning card takes priority over green confirmation card
    const showConfirmationCard = validationWarnings.length === 0 && hasOcrData && data.confidence !== 'unclassified' && !data.isImageOnly;

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
          validationWarnings,
        },
      ],
    }));
  };

  if (checklist.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground text-sm">No documents are required for this filing.</p>
        <p className="text-muted-foreground/70 text-xs mt-1">Contact your accountant if you believe this is an error.</p>
      </div>
    );
  }

  const renderItem = (item: ChecklistItemType) => {
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
  };

  return (
    <div className="space-y-6">
      {requiredItems.length > 0 && (
        <div className="bg-white rounded-xl border shadow-sm hover:shadow-lg hover:border-primary/20 transition-all duration-300 p-6">
          <ProgressBar provided={requiredProvided} total={requiredItems.length} />
          <div className="space-y-3">
            {requiredItems.map(renderItem)}
          </div>
        </div>
      )}
      {optionalItems.length > 0 && (
        <div className="bg-white rounded-xl border shadow-sm hover:shadow-lg hover:border-primary/20 transition-all duration-300 p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Optional documents</h2>
          <div className="space-y-3">
            {optionalItems.map(renderItem)}
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground/70 text-center">
        Powered by Prompt. Your files are securely stored and only accessible to {orgName}.
      </p>
    </div>
  );
}
