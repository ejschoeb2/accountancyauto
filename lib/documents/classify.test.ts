import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

// ── Mock pdf-parse-debugging-disabled ────────────────────────────────────────
// We control the mock implementation per-test via vi.mocked().mockResolvedValueOnce()
vi.mock('pdf-parse-debugging-disabled', () => ({
  default: vi.fn(),
}));

import pdfParse from 'pdf-parse-debugging-disabled';

// ── Import the modules under test ────────────────────────────────────────────
// Imported after mock setup so the mock is in place before module initialisation
import { extractPdfText, extractFieldsForType } from './ocr';
import { classifyDocument } from './classify';

// ── Shared mock data ──────────────────────────────────────────────────────────
const P60_TEXT =
  'Tax year to 5 April 2024 ' +
  "Employer's name Acme Ltd " +
  'PAYE reference 123/AB12345';

const P60_CATALOG_ENTRY = {
  id: 'type-uuid-p60',
  code: 'P60',
  expected_mime_types: ['application/pdf'],
};

/** Minimal Supabase mock that returns a P60 document_types row. */
function makeMockSupabase(overrides?: {
  data?: unknown[] | null;
  error?: object | null;
}): SupabaseClient {
  const data = overrides?.data !== undefined ? overrides.data : [P60_CATALOG_ENTRY];
  const error = overrides?.error !== undefined ? overrides.error : null;

  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ data, error }),
    }),
  } as unknown as SupabaseClient;
}

const mockSupabase = makeMockSupabase();

// ── extractPdfText tests ──────────────────────────────────────────────────────
describe('extractPdfText', () => {
  beforeEach(() => {
    vi.mocked(pdfParse).mockReset();
  });

  it('returns text, numpages, and isImageOnly=false for a text-rich PDF', async () => {
    vi.mocked(pdfParse).mockResolvedValueOnce({
      text: P60_TEXT,
      numpages: 1,
    } as never);

    const result = await extractPdfText(Buffer.from('fake-pdf'));

    expect(result.text).toBe(P60_TEXT);
    expect(result.numpages).toBe(1);
    expect(result.isImageOnly).toBe(false);
  });

  it('returns isImageOnly=true when text is near-empty (whitespace only)', async () => {
    vi.mocked(pdfParse).mockResolvedValueOnce({
      text: '   ',
      numpages: 1,
    } as never);

    const result = await extractPdfText(Buffer.from('fake-pdf'));

    expect(result.isImageOnly).toBe(true);
  });

  it('re-throws when pdfParse throws (corrupt or encrypted PDF)', async () => {
    vi.mocked(pdfParse).mockRejectedValueOnce(new Error('encrypted'));

    await expect(extractPdfText(Buffer.from('bad-pdf'))).rejects.toThrow('encrypted');
  });
});

// ── extractFieldsForType tests ────────────────────────────────────────────────
describe('extractFieldsForType', () => {
  it('P60: extracts taxYear from "Tax year to 5 April 2024"', () => {
    const result = extractFieldsForType('P60', P60_TEXT);
    expect(result.taxYear).toBe('2024');
  });

  it('P60: extracts employer from "Employer\'s name Acme Ltd"', () => {
    const result = extractFieldsForType('P60', P60_TEXT);
    expect(result.employer).toBe('Acme Ltd');
  });

  it('P60: extracts payeRef from "PAYE reference 123/AB12345"', () => {
    const result = extractFieldsForType('P60', P60_TEXT);
    expect(result.payeRef).toBe('123/AB12345');
  });

  it('SA302: always returns employer=null and payeRef=null (UTR-based, no employer)', () => {
    const sa302Text = 'Year ended 5 April 2024 Total income received 35000';
    const result = extractFieldsForType('SA302', sa302Text);
    expect(result.employer).toBeNull();
    expect(result.payeRef).toBeNull();
    expect(result.taxYear).toBe('2024');
  });

  it('Unknown code: returns all null fields', () => {
    const result = extractFieldsForType('UNKNOWN_CODE', 'some arbitrary text');
    expect(result.taxYear).toBeNull();
    expect(result.employer).toBeNull();
    expect(result.payeRef).toBeNull();
  });
});

// ── classifyDocument integration tests ───────────────────────────────────────
describe('classifyDocument', () => {
  beforeEach(() => {
    vi.mocked(pdfParse).mockReset();
  });

  it('OCR path: when buffer provided and OCR returns tax year → confidence=high, extractionSource=ocr', async () => {
    vi.mocked(pdfParse).mockResolvedValueOnce({
      text: P60_TEXT,
      numpages: 1,
    } as never);

    const result = await classifyDocument(
      'p60.pdf',
      'application/pdf',
      mockSupabase,
      Buffer.from('fake-pdf')
    );

    expect(result.confidence).toBe('high');
    expect(result.extractionSource).toBe('ocr');
    expect(result.extractedTaxYear).toBe('2024');
    expect(result.extractedEmployer).toBe('Acme Ltd');
    expect(result.isCorruptPdf).toBe(false);
    expect(result.isImageOnly).toBe(false);
  });

  it('Keyword-only path: no buffer → extractionSource=keyword, isCorruptPdf=false (backward compat)', async () => {
    // No buffer — old caller pattern
    const result = await classifyDocument('p60.pdf', 'application/pdf', mockSupabase);

    expect(result.extractionSource).toBe('keyword');
    expect(result.isCorruptPdf).toBe(false);
    expect(result.isImageOnly).toBe(false);
    expect(result.extractedTaxYear).toBeNull();
    expect(result.extractedEmployer).toBeNull();
    expect(result.extractedPayeRef).toBeNull();
    // Should still classify correctly by filename keyword
    expect(result.documentTypeCode).toBe('P60');
  });

  it('Corrupt PDF path: extractPdfText throws → isCorruptPdf=true, confidence=unclassified', async () => {
    vi.mocked(pdfParse).mockRejectedValueOnce(new Error('encrypted'));

    const result = await classifyDocument(
      'p60.pdf',
      'application/pdf',
      mockSupabase,
      Buffer.from('bad-pdf')
    );

    expect(result.isCorruptPdf).toBe(true);
    expect(result.confidence).toBe('unclassified');
    expect(result.extractedTaxYear).toBeNull();
    expect(result.extractionSource).toBe('rules');
  });

  it('Image-only PDF path: near-empty text → isImageOnly=true, confidence=unclassified, extractionSource=rules', async () => {
    vi.mocked(pdfParse).mockResolvedValueOnce({
      text: '   ',
      numpages: 1,
    } as never);

    const result = await classifyDocument(
      'p60.pdf',
      'application/pdf',
      mockSupabase,
      Buffer.from('image-pdf')
    );

    expect(result.isImageOnly).toBe(true);
    expect(result.confidence).toBe('unclassified');
    expect(result.extractionSource).toBe('rules');
    expect(result.extractedTaxYear).toBeNull();
  });

  it('Generic PDF fallback (no keyword match): extractionSource=keyword, confidence=low', async () => {
    const genericSupabase = makeMockSupabase({ data: [] }); // No document_types match

    const result = await classifyDocument(
      'unknown-document.pdf',
      'application/pdf',
      genericSupabase
    );

    expect(result.confidence).toBe('low');
    expect(result.extractionSource).toBe('keyword');
    expect(result.isCorruptPdf).toBe(false);
  });

  it('Unclassified non-PDF: extractionSource=rules, confidence=unclassified', async () => {
    const noMatchSupabase = makeMockSupabase({ data: [] });

    const result = await classifyDocument(
      'mystery-file.xyz',
      'application/octet-stream',
      noMatchSupabase
    );

    expect(result.confidence).toBe('unclassified');
    expect(result.extractionSource).toBe('rules');
    expect(result.isCorruptPdf).toBe(false);
    expect(result.isImageOnly).toBe(false);
  });
});
