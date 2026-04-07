/**
 * Pure validation and transformation functions for CSV rows.
 * No React imports — independently testable.
 */

import type { ColumnMapping } from "./parser";

// ── Types ────────────────────────────────────────────────────────────────────

export interface EditableRow {
  id: string; // UUID for React key
  company_name: string; // Required, readonly
  primary_email: string | null;
  client_type: string | null;
  year_end_date: string | null; // YYYY-MM-DD format
  vat_registered: boolean | null;
  vat_stagger_group: number | null; // 1, 2, or 3
  vat_scheme: string | null;
}

// ── Normalisation helpers ────────────────────────────────────────────────────

/**
 * Normalize legacy "Sole Trader" to "Individual" (enum was renamed in migration).
 */
export function normalizeClientType(
  value: string | undefined
): string | undefined {
  if (!value) return value;
  if (value.toLowerCase().trim() === "sole trader") return "Individual";
  return value;
}

// ── Date parsing ─────────────────────────────────────────────────────────────

const MONTH_MAP: Record<string, string> = {
  jan: "01",
  january: "01",
  feb: "02",
  february: "02",
  mar: "03",
  march: "03",
  apr: "04",
  april: "04",
  may: "05",
  jun: "06",
  june: "06",
  jul: "07",
  july: "07",
  aug: "08",
  august: "08",
  sep: "09",
  september: "09",
  oct: "10",
  october: "10",
  nov: "11",
  november: "11",
  dec: "12",
  december: "12",
};

function expandYear(yy: string): string {
  const n = parseInt(yy, 10);
  return n < 50 ? `20${yy.padStart(2, "0")}` : `19${yy.padStart(2, "0")}`;
}

/**
 * Parse a date string from various common formats into YYYY-MM-DD.
 * Returns null if the value cannot be parsed.
 *
 * Supported formats:
 *   YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY,
 *   YYYY/MM/DD, DD/MM/YY, "31 March 2026", "March 31, 2026",
 *   Excel serial numbers.
 */
export function parseDate(dateValue: string): string | null {
  if (!dateValue || dateValue.trim() === "") return null;

  const trimmed = dateValue.trim();

  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY (4-digit year, UK-first)
  const ddmmyyyy = trimmed.match(
    /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/
  );
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // YYYY/MM/DD or YYYY.MM.DD
  const yyyymmdd = trimmed.match(
    /^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/
  );
  if (yyyymmdd) {
    const [, y, m, d] = yyyymmdd;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // DD/MM/YY or DD-MM-YY (2-digit year, UK-first)
  const ddmmyy = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2})$/);
  if (ddmmyy) {
    const [, d, m, yy] = ddmmyy;
    return `${expandYear(yy)}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // "31 March 2026", "31 Mar 2026", "31-Mar-2026", "31/Mar/2026"
  const dayMonthYear = trimmed.match(
    /^(\d{1,2})[\s\-/]([A-Za-z]+)[\s\-/](\d{2,4})$/
  );
  if (dayMonthYear) {
    const [, d, monthStr, yearStr] = dayMonthYear;
    const m = MONTH_MAP[monthStr.toLowerCase()];
    if (m) {
      const y = yearStr.length === 2 ? expandYear(yearStr) : yearStr;
      return `${y}-${m}-${d.padStart(2, "0")}`;
    }
  }

  // "March 31, 2026", "March 31 2026", "Mar 31 2026"
  const monthDayYear = trimmed.match(
    /^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{2,4})$/
  );
  if (monthDayYear) {
    const [, monthStr, d, yearStr] = monthDayYear;
    const m = MONTH_MAP[monthStr.toLowerCase()];
    if (m) {
      const y = yearStr.length === 2 ? expandYear(yearStr) : yearStr;
      return `${y}-${m}-${d.padStart(2, "0")}`;
    }
  }

  // Excel date serial number (days since 1900-01-01)
  const serialNumber = parseFloat(trimmed);
  if (
    !isNaN(serialNumber) &&
    serialNumber > 1000 &&
    /^\d+(\.\d+)?$/.test(trimmed)
  ) {
    const excelEpoch = new Date(1900, 0, 1);
    const daysOffset = serialNumber > 59 ? serialNumber - 2 : serialNumber - 1;
    const date = new Date(
      excelEpoch.getTime() + daysOffset * 24 * 60 * 60 * 1000
    );
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  return null;
}

// ── Row transformation ───────────────────────────────────────────────────────

/**
 * Transform raw parsed CSV rows into EditableRow[] using the column mapping.
 * Filters out rows with empty company names.
 */
export function transformToEditableRows(
  rows: Record<string, string>[],
  columnMapping: ColumnMapping
): EditableRow[] {
  return rows
    .map((row) => {
      const mappedData: Record<string, string> = {};

      Object.entries(columnMapping).forEach(([systemField, csvColumn]) => {
        if (csvColumn) {
          mappedData[systemField] = row[csvColumn] || "";
        }
      });

      // Convert to EditableRow format
      const editableRow: EditableRow = {
        id: crypto.randomUUID(),
        company_name: mappedData.company_name || "",
        primary_email: mappedData.primary_email || null,
        client_type: normalizeClientType(mappedData.client_type) || null,
        year_end_date: parseDate(mappedData.year_end_date || ""),
        vat_registered: mappedData.vat_registered
          ? ["yes", "true", "1"].includes(
              mappedData.vat_registered.toLowerCase()
            )
          : true, // Default to true if not specified
        vat_stagger_group: mappedData.vat_stagger_group
          ? parseInt(mappedData.vat_stagger_group, 10)
          : null,
        vat_scheme: mappedData.vat_scheme || null,
      };

      return editableRow;
    })
    // Filter out rows with empty company names (data cleansing)
    .filter((row) => row.company_name.trim() !== "");
}

/**
 * Format a date preview value for display in the mapping step.
 * Returns the formatted display string (DD/MM/YYYY or " (invalid date)").
 */
export function formatDatePreview(value: string): string {
  const parsed = parseDate(value);
  if (parsed) {
    const [year, month, day] = parsed.split("-");
    return `${day}/${month}/${year}`;
  }
  return value + " (invalid date)";
}

/**
 * Format a VAT registered preview value for display.
 */
export function formatVatRegisteredPreview(value: string): string {
  const isYes = ["yes", "true", "1"].includes(value.toLowerCase());
  return isYes ? "Yes" : "No";
}
