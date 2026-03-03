import { extractPdfText } from './ocr';

/**
 * An advisory warning returned by per-type document validation.
 *
 * Warnings are never blocking — documents with warnings are still accepted and stored.
 * The `code` field is a stable identifier for programmatic use (filtering, analytics).
 * The `message` field is human-readable and actionable for client display.
 */
export interface ValidationWarning {
  /** Stable warning code, e.g. 'P60_YEAR_MISMATCH', 'BANK_STMT_PERIOD_MISMATCH' */
  code: string;
  /** Human-readable, actionable warning message referencing the expected period */
  message: string;
  /** Expected value (e.g. "2024" for an expected tax year) */
  expected?: string;
  /** Found value from OCR or parsing — may be undefined if not extractable */
  found?: string;
}

/**
 * Result of per-type advisory validation.
 *
 * An empty `warnings` array means no issues were detected.
 * Multiple warnings may fire simultaneously and are all returned.
 */
export interface ValidationResult {
  warnings: ValidationWarning[];
}

/**
 * Top-5 document type codes that receive tailored per-type validation.
 * All other codes return { warnings: [] } immediately.
 */
const VALIDATED_TYPES = new Set(['BANK_STATEMENT', 'VAT_RETURN_WORKINGS', 'P60', 'P45', 'SA302']);

/**
 * MIME types that indicate a spreadsheet file (bank statements can be spreadsheets).
 */
const SPREADSHEET_MIMES = new Set([
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
]);

/**
 * Structured period markers used in bank statement PDFs.
 * Only match explicit period markers — NOT arbitrary dates in the document.
 * This prevents false positives from print dates, transaction dates, etc. (Pitfall 3).
 */
const BANK_PERIOD_PATTERNS = [
  /(?:statement\s+period|period)[:\s]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\s+(?:to|[-–—])\s+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
  /(?:from)[:\s]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\s+(?:to)[:\s]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
  /(?:for\s+the\s+period)[:\s]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\s+(?:to|[-–—])\s+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
];

/**
 * Parse a UK date string (DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, or with 2-digit year)
 * into a Date object. Returns null on parse failure.
 */
function parseUkDate(raw: string): Date | null {
  const cleaned = raw.trim().replace(/[-\.]/g, '/');
  const parts = cleaned.split('/');
  if (parts.length !== 3) return null;

  const [dayStr, monthStr, yearStr] = parts;
  const day = parseInt(dayStr, 10);
  const month = parseInt(monthStr, 10);
  let year = parseInt(yearStr, 10);

  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;

  // Expand 2-digit years (pivot at 50: 00-49 → 2000-2049, 50-99 → 1950-1999)
  if (year < 100) {
    year = year < 50 ? 2000 + year : 1900 + year;
  }

  const date = new Date(year, month - 1, day);
  // Validate the date components were accepted as-is (guards against month=13, etc.)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

/**
 * Normalise a portal tax year string to the terminal year as a 4-digit string.
 *
 * Examples:
 *   "2024-25" → "2025"
 *   "2024-2025" → "2025"
 *   "2024" → "2024"
 */
function normalisePortalTaxYear(portalTaxYear: string): string {
  if (portalTaxYear.includes('-')) {
    const parts = portalTaxYear.split('-');
    const terminal = parts[parts.length - 1];
    // Expand 2-digit suffix to 4-digit using the century of the preceding part
    if (terminal.length === 2 && parts[0].length === 4) {
      const century = parts[0].slice(0, 2);
      return `${century}${terminal}`;
    }
    return terminal;
  }
  return portalTaxYear;
}

/**
 * Derive the expected tax year date range for a UK tax year.
 *
 * UK tax year runs 6 April (year-1) to 5 April (year) where `year` is the terminal year.
 * Example: "2025" → 6 April 2024 to 5 April 2025.
 */
function ukTaxYearRange(terminalYear: number): { start: Date; end: Date } {
  return {
    start: new Date(terminalYear - 1, 3, 6),   // 6 April of preceding year (month 3 = April, 0-indexed)
    end: new Date(terminalYear, 3, 5),           // 5 April of terminal year
  };
}

/**
 * Format a Date as DD/MM/YYYY for use in user-facing warning messages.
 */
function formatUkDate(date: Date): string {
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-type check implementations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * P60 / P45 / SA302: Compare OCR-extracted tax year against the portal's expected tax year.
 *
 * Returns null if extractedTaxYear is null (no OCR data available).
 * Returns a warning if the extracted year does not match the normalised portal year.
 */
function checkTaxYearMatch(
  documentTypeCode: string,
  extractedTaxYear: string | null,
  portalTaxYear: string,
): ValidationWarning | null {
  if (!extractedTaxYear) return null; // No OCR data — cannot check

  const normalised = normalisePortalTaxYear(portalTaxYear);

  if (extractedTaxYear === normalised) return null; // Match — no warning

  return {
    code: `${documentTypeCode}_YEAR_MISMATCH`,
    message: `This ${documentTypeCode} appears to be for tax year ${extractedTaxYear} but we requested documents for ${portalTaxYear}. Please check you've uploaded the right document.`,
    expected: normalised,
    found: extractedTaxYear,
  };
}

/**
 * BANK_STATEMENT (PDF sub-check): Check that the statement period falls within the expected
 * UK tax year derived from portalTaxYear.
 *
 * Only fires on structured period markers — NOT arbitrary dates. (Pitfall 3)
 * Returns null if no period markers are found (absence is not a warning).
 */
async function checkBankStatementPdfPeriod(
  buffer: Buffer,
  portalTaxYear: string,
): Promise<ValidationWarning | null> {
  let text: string;
  try {
    const ocr = await extractPdfText(buffer);
    if (ocr.isImageOnly) return null; // Cannot extract text from image-only PDF
    text = ocr.text;
  } catch {
    return null; // Corrupt/encrypted PDF — skip check (integrity check handles this separately)
  }

  // Normalise whitespace for multi-line pattern matching
  const normalised = text.replace(/\s+/g, ' ');

  // Try each period pattern — stop at first match
  for (const pattern of BANK_PERIOD_PATTERNS) {
    const match = normalised.match(pattern);
    if (!match) continue;

    const startDate = parseUkDate(match[1]);
    const endDate = parseUkDate(match[2]);

    if (!startDate || !endDate) continue; // Unparseable dates — skip

    // Derive expected range from portal tax year
    const terminalYear = parseInt(normalisePortalTaxYear(portalTaxYear), 10);
    if (isNaN(terminalYear)) continue;

    const expected = ukTaxYearRange(terminalYear);

    // Check overlap: the statement must overlap with the expected tax year range
    // Overlap condition: startDate <= expected.end AND endDate >= expected.start
    const hasOverlap = startDate <= expected.end && endDate >= expected.start;

    if (!hasOverlap) {
      return {
        code: 'BANK_STMT_PERIOD_MISMATCH',
        message: `This bank statement covers ${formatUkDate(startDate)} to ${formatUkDate(endDate)} which doesn't appear to fall within the ${portalTaxYear} tax period. Please check you've uploaded the right statement.`,
        expected: `${formatUkDate(expected.start)} to ${formatUkDate(expected.end)}`,
        found: `${formatUkDate(startDate)} to ${formatUkDate(endDate)}`,
      };
    }

    // Period found and overlaps — no warning needed
    return null;
  }

  // No period markers found — do not warn (absence of period markers is not a problem)
  return null;
}

/**
 * BANK_STATEMENT (spreadsheet sub-check): Check that at least one column in the first
 * sheet contains date-like values.
 *
 * SheetJS is imported inside the function body to avoid CJS/ESM issues in App Router. (Pitfall 1)
 * Uses `cellDates: true` to get native Date objects from Excel cells.
 * Also checks string cells for common UK/ISO date patterns as a fallback.
 *
 * Returns null if the parse fails (skip silently on error).
 */
async function checkBankStatementSpreadsheetDates(buffer: Buffer): Promise<ValidationWarning | null> {
  try {
    // Dynamic import inside function body — avoids App Router bundler CJS/ESM issues (Pitfall 1)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require('xlsx') as typeof import('xlsx');

    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return null;

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });

    // Sample first 20 rows for date-like values
    const sampled = rows.slice(0, 20);

    // Date-like string patterns: DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY
    const DATE_STRING_RE = /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$|^\d{4}-\d{2}-\d{2}$/;

    for (const row of sampled) {
      if (!Array.isArray(row)) continue;
      for (const cell of row) {
        // Native Date from cellDates: true
        if (cell instanceof Date && !isNaN(cell.getTime())) {
          return null; // Found a date — no warning
        }
        // String that looks like a date
        if (typeof cell === 'string' && DATE_STRING_RE.test(cell.trim())) {
          return null; // Found a date string — no warning
        }
      }
    }

    // No date-like values found in any cell of first 20 rows
    return {
      code: 'BANK_STMT_NO_DATES',
      message: "This spreadsheet doesn't appear to contain any date columns. Bank statements usually include transaction dates — please check you've uploaded the correct file.",
    };
  } catch {
    return null; // Parse error — skip check silently
  }
}

/**
 * VAT_RETURN_WORKINGS: Check that the document references a VAT period within ±1 year
 * of the portal's expected tax year.
 *
 * Uses a loose plausibility check — does NOT require exact stagger group alignment. (Pitfall 4)
 * Returns null if no VAT period markers are found (absence is not a warning).
 * Only runs on PDF MIME type.
 */
async function checkVatPeriodPlausibility(
  buffer: Buffer,
  portalTaxYear: string,
): Promise<ValidationWarning | null> {
  let text: string;
  try {
    const ocr = await extractPdfText(buffer);
    if (ocr.isImageOnly) return null;
    text = ocr.text;
  } catch {
    return null;
  }

  const normalised = text.replace(/\s+/g, ' ');

  // Look for VAT period markers followed by a date
  // Patterns: "Quarter ending DD/MM/YYYY", "Period DD/MM/YYYY", "VAT period DD/MM/YYYY",
  // "for the period ending DD/MM/YYYY", "quarter ended DD/MM/YYYY"
  const VAT_PERIOD_PATTERNS = [
    /(?:quarter\s+end(?:ing|ed)|period\s+end(?:ing|ed))[:\s]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /(?:vat\s+period|for\s+the\s+period)[:\s]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /(?:period)[:\s]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\s+(?:to|-)\s+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
  ];

  for (const pattern of VAT_PERIOD_PATTERNS) {
    const match = normalised.match(pattern);
    if (!match) continue;

    // Use the last captured date group (end of period is more meaningful for plausibility)
    const dateStr = match[match.length - 1]; // Last captured group
    const periodDate = parseUkDate(dateStr);
    if (!periodDate) continue;

    const periodYear = periodDate.getFullYear();
    const terminalYear = parseInt(normalisePortalTaxYear(portalTaxYear), 10);
    if (isNaN(terminalYear)) continue;

    // Plausibility: is the period year within ±1 year of the expected terminal year?
    if (Math.abs(periodYear - terminalYear) > 1) {
      const foundPeriodLabel = dateStr.trim();
      return {
        code: 'VAT_PERIOD_IMPLAUSIBLE',
        message: `This VAT return workings document references a period around ${foundPeriodLabel} which seems outside the ${portalTaxYear} tax year. Please check you've uploaded the right document.`,
        expected: portalTaxYear,
        found: foundPeriodLabel,
      };
    }

    // Period found and plausible — no warning needed
    return null;
  }

  // No VAT period markers found — do not warn
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run per-document-type advisory validation on an uploaded document.
 *
 * Returns a `ValidationResult` with zero or more warnings. An empty warnings array
 * means no issues were detected.
 *
 * All checks are advisory — this function NEVER rejects a document. Existing hard
 * blocks (corrupt PDF, >50 pages, >20MB) remain in `runIntegrityChecks()` and
 * `classifyDocument()` respectively.
 *
 * Only the top 5 document types receive tailored checks:
 *   - BANK_STATEMENT: PDF period marker check + spreadsheet date column check
 *   - VAT_RETURN_WORKINGS: VAT period plausibility check (PDF only)
 *   - P60 / P45 / SA302: OCR-extracted tax year vs portal tax year comparison
 *
 * All other document types return { warnings: [] } immediately.
 *
 * @param documentTypeCode  - Document type code from classification (e.g. 'P60', 'BANK_STATEMENT')
 * @param mimeType          - MIME type of the uploaded file
 * @param buffer            - File buffer (small-file path only — large files skip validation)
 * @param portalTaxYear     - Tax year from the portal token (e.g. "2024" or "2024-25")
 * @param extractedTaxYear  - OCR-extracted tax year from classify.ts (null if not extracted)
 * @param filingTypeId      - Filing type ID from the portal token (reserved for future use)
 */
export async function runValidation(
  documentTypeCode: string | null,
  mimeType: string,
  buffer: Buffer,
  portalTaxYear: string,
  extractedTaxYear: string | null,
  filingTypeId: string,
): Promise<ValidationResult> {
  // Fast path: only top-5 types get tailored checks
  if (!documentTypeCode || !VALIDATED_TYPES.has(documentTypeCode)) {
    return { warnings: [] };
  }

  const warnings: ValidationWarning[] = [];

  // ── P60 / P45 / SA302: Tax year mismatch check ────────────────────────────
  if (documentTypeCode === 'P60' || documentTypeCode === 'P45' || documentTypeCode === 'SA302') {
    const warning = checkTaxYearMatch(documentTypeCode, extractedTaxYear, portalTaxYear);
    if (warning) warnings.push(warning);
  }

  // ── BANK_STATEMENT ─────────────────────────────────────────────────────────
  if (documentTypeCode === 'BANK_STATEMENT') {
    if (mimeType === 'application/pdf') {
      // Sub-check A: PDF period marker date range
      const pdfWarning = await checkBankStatementPdfPeriod(buffer, portalTaxYear);
      if (pdfWarning) warnings.push(pdfWarning);
    } else if (SPREADSHEET_MIMES.has(mimeType)) {
      // Sub-check B: Spreadsheet date column presence
      const sheetWarning = await checkBankStatementSpreadsheetDates(buffer);
      if (sheetWarning) warnings.push(sheetWarning);
    }
  }

  // ── VAT_RETURN_WORKINGS: Period plausibility (PDF only) ───────────────────
  if (documentTypeCode === 'VAT_RETURN_WORKINGS' && mimeType === 'application/pdf') {
    const vatWarning = await checkVatPeriodPlausibility(buffer, portalTaxYear);
    if (vatWarning) warnings.push(vatWarning);
  }

  return { warnings };
}
