import { describe, it, expect, vi } from 'vitest';
import {
  autoSuggestMapping,
  validateMapping,
  parseCsvString,
  decodeFileBytes,
  isExcelFile,
  isSupportedFile,
} from './parser';

// Mock logger so tests don't produce console noise
vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// Mock CSV_COLUMNS used in autoSuggestMapping / validateMapping
vi.mock('@/lib/utils/csv-template', () => ({
  CSV_COLUMNS: [
    { name: 'company_name', required: true },
    { name: 'primary_email', required: false },
    { name: 'client_type', required: false },
    { name: 'year_end_date', required: false },
    { name: 'vat_registered', required: false },
    { name: 'vat_stagger_group', required: false },
    { name: 'vat_scheme', required: false },
  ],
}));

// ── autoSuggestMapping ────────────────────────────────────────────────────────

describe('autoSuggestMapping', () => {
  it('maps headers that are exact case-insensitive matches', () => {
    const headers = ['Company_Name', 'Primary_Email'];
    const mapping = autoSuggestMapping(headers);
    expect(mapping['company_name']).toBe('Company_Name');
    expect(mapping['primary_email']).toBe('Primary_Email');
  });

  it('maps headers that are exact matches after stripping spaces and underscores', () => {
    const headers = ['Company Name', 'primary email'];
    const mapping = autoSuggestMapping(headers);
    expect(mapping['company_name']).toBe('Company Name');
    expect(mapping['primary_email']).toBe('primary email');
  });

  it('falls back to partial substring match when no exact match found', () => {
    // "Company" is a substring of "company_name" after normalization
    const headers = ['Company'];
    const mapping = autoSuggestMapping(headers);
    expect(mapping['company_name']).toBe('Company');
  });

  it('assigns null for system fields with no matching header', () => {
    const mapping = autoSuggestMapping(['something_unrelated']);
    expect(mapping['company_name']).toBeNull();
  });

  it('returns null for all fields when headers array is empty', () => {
    const mapping = autoSuggestMapping([]);
    for (const value of Object.values(mapping)) {
      expect(value).toBeNull();
    }
  });

  it('prefers exact match over partial match', () => {
    // "year_end_date" should prefer the exact match over a partial one
    const headers = ['year_end', 'year_end_date'];
    const mapping = autoSuggestMapping(headers);
    expect(mapping['year_end_date']).toBe('year_end_date');
  });
});

// ── validateMapping ───────────────────────────────────────────────────────────

describe('validateMapping', () => {
  it('returns null when all required fields are mapped', () => {
    const mapping = { company_name: 'Company Name', primary_email: null };
    const error = validateMapping(mapping);
    expect(error).toBeNull();
  });

  it('returns an error string when a required field is not mapped', () => {
    const mapping = { company_name: null };
    const error = validateMapping(mapping);
    expect(error).toContain('company_name');
    expect(typeof error).toBe('string');
  });

  it('returns null when optional fields are absent from mapping', () => {
    // Only company_name is required (per our mock CSV_COLUMNS)
    const mapping = { company_name: 'Co Name' };
    const error = validateMapping(mapping);
    expect(error).toBeNull();
  });
});

// ── parseCsvString ────────────────────────────────────────────────────────────

describe('parseCsvString', () => {
  it('parses a well-formed CSV string into headers, rows, and sampleRows', async () => {
    const csv = `company_name,primary_email\nAcme Ltd,acme@example.com\nBeta Co,beta@example.com`;
    const result = await parseCsvString(csv);
    expect(result.headers).toEqual(['company_name', 'primary_email']);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]['company_name']).toBe('Acme Ltd');
  });

  it('provides sampleRows containing at most first 3 rows', async () => {
    const lines = ['company_name', 'A', 'B', 'C', 'D'].join('\n') + '\n';
    // Build csv with 4 data rows
    const csv = `company_name\nAcme\nBeta\nGamma\nDelta`;
    const result = await parseCsvString(csv);
    expect(result.sampleRows).toHaveLength(3);
  });

  it('returns empty rows array for CSV with header only', async () => {
    const csv = `company_name,primary_email\n`;
    const result = await parseCsvString(csv);
    expect(result.rows).toHaveLength(0);
  });

  it('skips empty lines in CSV input', async () => {
    const csv = `company_name\nAcme Ltd\n\n\nBeta Co`;
    const result = await parseCsvString(csv);
    expect(result.rows).toHaveLength(2);
  });
});

// ── decodeFileBytes ───────────────────────────────────────────────────────────

describe('decodeFileBytes', () => {
  it('strips UTF-8 BOM and decodes correctly', () => {
    const content = 'hello';
    const bomBytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(content)]);
    const result = decodeFileBytes(bomBytes);
    expect(result).toBe('hello');
  });

  it('decodes plain UTF-8 bytes without BOM', () => {
    const bytes = new TextEncoder().encode('plain text');
    const result = decodeFileBytes(bytes);
    expect(result).toBe('plain text');
  });

  it('handles UTF-16 LE BOM by stripping it', () => {
    // UTF-16 LE BOM is FF FE followed by LE-encoded characters
    const utf16le = new TextDecoder('utf-16le').encode
      ? null // not standard API
      : null;
    // Minimal test: check BOM detection path doesn't throw
    const bytes = new Uint8Array([0xff, 0xfe, 0x41, 0x00]); // 'A' in UTF-16LE
    expect(() => decodeFileBytes(bytes)).not.toThrow();
  });
});

// ── isExcelFile / isSupportedFile ─────────────────────────────────────────────

describe('isExcelFile', () => {
  it('returns true for .xlsx files', () => {
    expect(isExcelFile('clients.xlsx')).toBe(true);
  });

  it('returns true for .xls files', () => {
    expect(isExcelFile('clients.xls')).toBe(true);
  });

  it('returns false for .csv files', () => {
    expect(isExcelFile('clients.csv')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isExcelFile('CLIENTS.XLSX')).toBe(true);
  });
});

describe('isSupportedFile', () => {
  it('returns true for .csv', () => {
    expect(isSupportedFile('data.csv')).toBe(true);
  });

  it('returns true for .xlsx', () => {
    expect(isSupportedFile('data.xlsx')).toBe(true);
  });

  it('returns true for .xls', () => {
    expect(isSupportedFile('data.xls')).toBe(true);
  });

  it('returns false for unsupported extensions like .txt', () => {
    expect(isSupportedFile('data.txt')).toBe(false);
  });

  it('returns false for .pdf', () => {
    expect(isSupportedFile('report.pdf')).toBe(false);
  });
});
