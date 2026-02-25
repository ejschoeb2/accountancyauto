import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { extractPdfText } from './ocr';

/**
 * Result of running file integrity checks against upload rules and the database.
 */
export interface IntegrityResult {
  /** True when all checks passed and the file may proceed to storage. */
  passed: boolean;
  /** File size in bytes. */
  fileSizeBytes: number;
  /** Number of pages (PDF only). Null for non-PDF files or when page count check is skipped on error. */
  pageCount: number | null;
  /** True when a file with the same SHA-256 hash already exists for this client. */
  isDuplicate: boolean;
  /** SHA-256 hex digest of the file buffer. Always populated regardless of pass/fail. */
  sha256Hash: string;
  /** Human-readable rejection reason, or null when passed=true. */
  rejectionReason: string | null;
}

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
const MAX_PAGE_COUNT = 50;

/**
 * Run file integrity checks before persisting an upload.
 *
 * Checks are run in order and stop at the first failure:
 *  1. File size — must not exceed 20 MB
 *  2. Duplicate hash — SHA-256 of buffer must not match an existing row for this client
 *  3. Page count (PDF only) — must not exceed 50 pages
 *
 * If pdf-parse throws during the page count check (corrupt PDF), pageCount is set to null
 * and the check is skipped — corrupt PDF detection is handled separately in classifyDocument.
 *
 * sha256Hash and fileSizeBytes are always populated regardless of pass/fail.
 */
export async function runIntegrityChecks(
  buffer: Buffer,
  mimeType: string,
  clientId: string,
  supabase: SupabaseClient,
  options?: { skipDuplicate?: boolean }
): Promise<IntegrityResult> {
  const fileSizeBytes = buffer.length;
  const sha256Hash = crypto.createHash('sha256').update(buffer).digest('hex');

  // ── Check 1: File size ────────────────────────────────────────────────────
  if (fileSizeBytes > MAX_FILE_SIZE_BYTES) {
    return {
      passed: false,
      fileSizeBytes,
      pageCount: null,
      isDuplicate: false,
      sha256Hash,
      rejectionReason: 'File exceeds 20MB limit',
    };
  }

  // ── Check 2: Duplicate hash ───────────────────────────────────────────────
  if (!options?.skipDuplicate) {
    const { data: duplicates, error: dupError } = await supabase
      .from('client_documents')
      .select('id')
      .eq('client_id', clientId)
      .eq('file_hash', sha256Hash)
      .limit(1);

    if (!dupError && duplicates && duplicates.length > 0) {
      return {
        passed: false,
        fileSizeBytes,
        pageCount: null,
        isDuplicate: true,
        sha256Hash,
        rejectionReason: 'This file has already been uploaded',
      };
    }
  }

  // ── Check 3: Page count (PDF only) ───────────────────────────────────────
  let pageCount: number | null = null;

  if (mimeType === 'application/pdf') {
    try {
      const ocr = await extractPdfText(buffer);
      pageCount = ocr.numpages;

      if (pageCount > MAX_PAGE_COUNT) {
        return {
          passed: false,
          fileSizeBytes,
          pageCount,
          isDuplicate: false,
          sha256Hash,
          rejectionReason: 'Document exceeds 50 page limit',
        };
      }
    } catch {
      // pdf-parse threw (corrupt/encrypted PDF) — skip page count check
      // Corrupt detection is handled in classifyDocument; do not reject here
      pageCount = null;
    }
  }

  // ── All checks passed ─────────────────────────────────────────────────────
  return {
    passed: true,
    fileSizeBytes,
    pageCount,
    isDuplicate: false,
    sha256Hash,
    rejectionReason: null,
  };
}
