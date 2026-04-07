import { describe, it, expect } from 'vitest';
import {
  parseDate,
  normalizeClientType,
  transformToEditableRows,
  formatDatePreview,
  formatVatRegisteredPreview,
} from './validate';

// ── parseDate ─────────────────────────────────────────────────────────────────

describe('parseDate', () => {
  it('returns null for empty string', () => {
    expect(parseDate('')).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(parseDate('   ')).toBeNull();
  });

  it('passes through already-correct YYYY-MM-DD format', () => {
    expect(parseDate('2026-03-31')).toBe('2026-03-31');
  });

  it('parses DD/MM/YYYY (UK standard)', () => {
    expect(parseDate('31/03/2026')).toBe('2026-03-31');
  });

  it('parses DD-MM-YYYY', () => {
    expect(parseDate('31-03-2026')).toBe('2026-03-31');
  });

  it('parses DD.MM.YYYY', () => {
    expect(parseDate('31.03.2026')).toBe('2026-03-31');
  });

  it('parses YYYY/MM/DD', () => {
    expect(parseDate('2026/03/31')).toBe('2026-03-31');
  });

  it('parses DD/MM/YY with 2-digit year < 50 as 20xx', () => {
    expect(parseDate('31/03/26')).toBe('2026-03-31');
  });

  it('parses DD/MM/YY with 2-digit year >= 50 as 19xx', () => {
    expect(parseDate('31/03/55')).toBe('1955-03-31');
  });

  it('parses "31 March 2026" (day-month-year text)', () => {
    expect(parseDate('31 March 2026')).toBe('2026-03-31');
  });

  it('parses "31 Mar 2026" (abbreviated month)', () => {
    expect(parseDate('31 Mar 2026')).toBe('2026-03-31');
  });

  it('parses "March 31, 2026" (US-style with comma)', () => {
    expect(parseDate('March 31, 2026')).toBe('2026-03-31');
  });

  it('parses "March 31 2026" (US-style without comma)', () => {
    expect(parseDate('March 31 2026')).toBe('2026-03-31');
  });

  it('returns null for completely unrecognised date strings', () => {
    expect(parseDate('not-a-date')).toBeNull();
  });

  it('returns null for unknown month name', () => {
    expect(parseDate('31 Blarg 2026')).toBeNull();
  });

  it('pads single-digit day and month correctly', () => {
    expect(parseDate('1/1/2026')).toBe('2026-01-01');
  });

  it('parses Excel serial number 45747 as a date', () => {
    // Excel serial 45747 = 2025-03-31 (verified separately)
    const result = parseDate('45747');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Should be a plausible modern date
    const year = parseInt(result!.split('-')[0]);
    expect(year).toBeGreaterThan(2000);
  });

  it('does NOT treat a small number like 123 as an Excel serial', () => {
    // 123 is below the 1000 threshold
    expect(parseDate('123')).toBeNull();
  });
});

// ── normalizeClientType ───────────────────────────────────────────────────────

describe('normalizeClientType', () => {
  it('converts "Sole Trader" to "Individual"', () => {
    expect(normalizeClientType('Sole Trader')).toBe('Individual');
  });

  it('converts "sole trader" (lowercase) to "Individual"', () => {
    expect(normalizeClientType('sole trader')).toBe('Individual');
  });

  it('converts "  Sole Trader  " (trimmed) to "Individual"', () => {
    expect(normalizeClientType('  Sole Trader  ')).toBe('Individual');
  });

  it('leaves "Limited Company" unchanged', () => {
    expect(normalizeClientType('Limited Company')).toBe('Limited Company');
  });

  it('leaves "Partnership" unchanged', () => {
    expect(normalizeClientType('Partnership')).toBe('Partnership');
  });

  it('leaves "LLP" unchanged', () => {
    expect(normalizeClientType('LLP')).toBe('LLP');
  });

  it('returns undefined when value is undefined', () => {
    expect(normalizeClientType(undefined)).toBeUndefined();
  });

  it('returns empty string when value is empty string', () => {
    expect(normalizeClientType('')).toBe('');
  });
});

// ── transformToEditableRows ───────────────────────────────────────────────────

describe('transformToEditableRows', () => {
  const mapping = {
    company_name: 'Name',
    primary_email: 'Email',
    client_type: 'Type',
    year_end_date: 'YE Date',
    vat_registered: 'VAT',
    vat_stagger_group: 'Stagger',
    vat_scheme: 'Scheme',
  };

  it('transforms a single row correctly', () => {
    const rows = [{ Name: 'Acme Ltd', Email: 'acme@example.com', Type: 'Limited Company', 'YE Date': '31/03/2026', VAT: 'yes', Stagger: '1', Scheme: 'Standard' }];
    const result = transformToEditableRows(rows, mapping);
    expect(result).toHaveLength(1);
    expect(result[0].company_name).toBe('Acme Ltd');
    expect(result[0].primary_email).toBe('acme@example.com');
    expect(result[0].client_type).toBe('Limited Company');
    expect(result[0].year_end_date).toBe('2026-03-31');
    expect(result[0].vat_registered).toBe(true);
    expect(result[0].vat_stagger_group).toBe(1);
  });

  it('normalises "Sole Trader" client_type to "Individual"', () => {
    const rows = [{ Name: 'John Smith', Email: '', Type: 'Sole Trader', 'YE Date': '', VAT: '', Stagger: '', Scheme: '' }];
    const result = transformToEditableRows(rows, mapping);
    expect(result[0].client_type).toBe('Individual');
  });

  it('filters out rows where company_name is empty', () => {
    const rows = [
      { Name: '', Email: 'no@name.com', Type: '', 'YE Date': '', VAT: '', Stagger: '', Scheme: '' },
      { Name: 'Valid Co', Email: '', Type: '', 'YE Date': '', VAT: '', Stagger: '', Scheme: '' },
    ];
    const result = transformToEditableRows(rows, mapping);
    expect(result).toHaveLength(1);
    expect(result[0].company_name).toBe('Valid Co');
  });

  it('filters out rows where company_name is whitespace only', () => {
    const rows = [{ Name: '   ', Email: '', Type: '', 'YE Date': '', VAT: '', Stagger: '', Scheme: '' }];
    const result = transformToEditableRows(rows, mapping);
    expect(result).toHaveLength(0);
  });

  it('defaults vat_registered to true when the column is unmapped or empty', () => {
    const rows = [{ Name: 'Beta Co', Email: '', Type: '', 'YE Date': '', VAT: '', Stagger: '', Scheme: '' }];
    const result = transformToEditableRows(rows, mapping);
    expect(result[0].vat_registered).toBe(true);
  });

  it('sets vat_registered=false for values "no", "false", "0"', () => {
    for (const falseVal of ['no', 'false', '0']) {
      const rows = [{ Name: 'Co', Email: '', Type: '', 'YE Date': '', VAT: falseVal, Stagger: '', Scheme: '' }];
      const result = transformToEditableRows(rows, mapping);
      expect(result[0].vat_registered).toBe(false);
    }
  });

  it('sets vat_stagger_group=null when stagger column is empty', () => {
    const rows = [{ Name: 'Co', Email: '', Type: '', 'YE Date': '', VAT: '', Stagger: '', Scheme: '' }];
    const result = transformToEditableRows(rows, mapping);
    expect(result[0].vat_stagger_group).toBeNull();
  });

  it('assigns a unique UUID id to each row', () => {
    const rows = [
      { Name: 'Acme', Email: '', Type: '', 'YE Date': '', VAT: '', Stagger: '', Scheme: '' },
      { Name: 'Beta', Email: '', Type: '', 'YE Date': '', VAT: '', Stagger: '', Scheme: '' },
    ];
    const result = transformToEditableRows(rows, mapping);
    expect(result[0].id).not.toBe(result[1].id);
    expect(result[0].id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('returns empty array when all rows have empty company names', () => {
    const rows = [{ Name: '', Email: '', Type: '', 'YE Date': '', VAT: '', Stagger: '', Scheme: '' }];
    const result = transformToEditableRows(rows, mapping);
    expect(result).toHaveLength(0);
  });
});

// ── formatDatePreview ─────────────────────────────────────────────────────────

describe('formatDatePreview', () => {
  it('formats a parseable date as DD/MM/YYYY', () => {
    expect(formatDatePreview('2026-03-31')).toBe('31/03/2026');
  });

  it('formats a DD/MM/YYYY input by round-tripping it', () => {
    expect(formatDatePreview('31/03/2026')).toBe('31/03/2026');
  });

  it('returns original value + " (invalid date)" for unparseable input', () => {
    expect(formatDatePreview('not-a-date')).toBe('not-a-date (invalid date)');
  });
});

// ── formatVatRegisteredPreview ────────────────────────────────────────────────

describe('formatVatRegisteredPreview', () => {
  it('returns "Yes" for "yes"', () => {
    expect(formatVatRegisteredPreview('yes')).toBe('Yes');
  });

  it('returns "Yes" for "true"', () => {
    expect(formatVatRegisteredPreview('true')).toBe('Yes');
  });

  it('returns "Yes" for "1"', () => {
    expect(formatVatRegisteredPreview('1')).toBe('Yes');
  });

  it('returns "No" for "no"', () => {
    expect(formatVatRegisteredPreview('no')).toBe('No');
  });

  it('returns "No" for "false"', () => {
    expect(formatVatRegisteredPreview('false')).toBe('No');
  });

  it('returns "No" for "0"', () => {
    expect(formatVatRegisteredPreview('0')).toBe('No');
  });
});
