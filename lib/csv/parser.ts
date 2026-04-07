/**
 * Pure utility functions for CSV/Excel parsing and column mapping.
 * No React imports — independently testable.
 */

import Papa from "papaparse";
import * as XLSX from "xlsx";
import { CSV_COLUMNS } from "@/lib/utils/csv-template";
import { logger } from "@/lib/logger";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ParsedCsvData {
  headers: string[];
  rows: Record<string, string>[];
  sampleRows: Record<string, string>[]; // First 3 rows for preview
}

export interface ColumnMapping {
  [systemField: string]: string | null; // systemField -> CSV column name
}

// ── Column mapping ───────────────────────────────────────────────────────────

/**
 * Auto-suggest column mapping based on header names.
 * Tries exact match first (case-insensitive, ignoring _ and spaces),
 * then falls back to partial/substring match.
 */
export function autoSuggestMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};

  CSV_COLUMNS.forEach((col) => {
    const systemField = col.name;

    // Try exact match first (case-insensitive)
    const exactMatch = headers.find(
      (h) =>
        h.toLowerCase().replace(/[_\s]/g, "") ===
        systemField.toLowerCase().replace(/[_\s]/g, "")
    );

    if (exactMatch) {
      mapping[systemField] = exactMatch;
      return;
    }

    // Try partial match
    const partialMatch = headers.find((h) => {
      const hNorm = h.toLowerCase().replace(/[_\s]/g, "");
      const sNorm = systemField.toLowerCase().replace(/[_\s]/g, "");
      return hNorm.includes(sNorm) || sNorm.includes(hNorm);
    });

    if (partialMatch) {
      mapping[systemField] = partialMatch;
    } else {
      mapping[systemField] = null;
    }
  });

  return mapping;
}

/**
 * Validate that all required CSV_COLUMNS are mapped.
 * Returns an error message string, or null if valid.
 */
export function validateMapping(columnMapping: ColumnMapping): string | null {
  const requiredFields = CSV_COLUMNS.filter((col) => col.required);

  for (const field of requiredFields) {
    if (!columnMapping[field.name]) {
      return `Required field "${field.name}" must be mapped to a column`;
    }
  }

  return null;
}

// ── File parsing ─────────────────────────────────────────────────────────────

/**
 * Parse an Excel file (.xlsx / .xls) into ParsedCsvData.
 */
export function parseExcelFile(arrayBuffer: ArrayBuffer): ParsedCsvData {
  const workbook = XLSX.read(arrayBuffer, { type: "array" });

  // Get first sheet
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  // Convert to JSON (array of arrays when header: 1)
  const jsonData = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: "",
  }) as unknown[][];

  if (jsonData.length === 0) {
    throw new Error("Excel file is empty");
  }

  // First row is headers (filter out empty headers)
  const headers = jsonData[0]
    .map((h) => String(h).trim())
    .filter((h) => h.length > 0);
  const dataRows = jsonData.slice(1);

  // Convert to objects
  const rows = dataRows.map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((header, idx) => {
      obj[header] = String((row as unknown[])[idx] || "").trim();
    });
    return obj;
  });

  const sampleRows = rows.slice(0, 3);

  return { headers, rows, sampleRows };
}

/**
 * Decode raw bytes into a string, handling various encodings
 * (UTF-8 BOM, UTF-16 LE BOM, Windows-1252 fallback).
 */
export function decodeFileBytes(rawBytes: Uint8Array): string {
  if (rawBytes[0] === 0xef && rawBytes[1] === 0xbb && rawBytes[2] === 0xbf) {
    // UTF-8 with BOM — strip the BOM before decoding
    return new TextDecoder("utf-8").decode(rawBytes.slice(3));
  } else if (rawBytes[0] === 0xff && rawBytes[1] === 0xfe) {
    // UTF-16 LE BOM
    return new TextDecoder("utf-16le").decode(rawBytes.slice(2));
  } else {
    // No BOM — try UTF-8; if the decoded text contains replacement
    // characters (U+FFFD), fall back to Windows-1252 which is the
    // default encoding for older Excel / UK accounting software.
    const utf8 = new TextDecoder("utf-8").decode(rawBytes);
    if (utf8.includes("\uFFFD")) {
      return new TextDecoder("windows-1252").decode(rawBytes);
    }
    return utf8;
  }
}

/**
 * Parse a CSV string using PapaParse and return ParsedCsvData.
 * Returns a Promise because PapaParse's complete callback is async-style.
 */
export function parseCsvString(
  csvContent: string
): Promise<ParsedCsvData> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(csvContent, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        if (result.errors.length > 0) {
          logger.warn("CSV parse warnings:", {
            error:
              result.errors instanceof Error
                ? result.errors.message
                : String(result.errors),
          });
        }

        const headers = result.meta.fields || [];
        const rows = result.data;
        const sampleRows = rows.slice(0, 3);

        resolve({ headers, rows, sampleRows });
      },
      error: (error: Error) => {
        reject(new Error(`Failed to parse CSV: ${error.message}`));
      },
    });
  });
}

/**
 * Determine whether a filename is an Excel file.
 */
export function isExcelFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.endsWith(".xlsx") || lower.endsWith(".xls");
}

/**
 * Determine whether a filename is a supported import file.
 */
export function isSupportedFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return (
    lower.endsWith(".csv") || lower.endsWith(".xlsx") || lower.endsWith(".xls")
  );
}
