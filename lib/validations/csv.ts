import { z } from "zod";

const MONTH_NAMES: Record<string, string> = {
  jan: "01", january: "01",
  feb: "02", february: "02",
  mar: "03", march: "03",
  apr: "04", april: "04",
  may: "05",
  jun: "06", june: "06",
  jul: "07", july: "07",
  aug: "08", august: "08",
  sep: "09", september: "09",
  oct: "10", october: "10",
  nov: "11", november: "11",
  dec: "12", december: "12",
};

function expandYear(yy: string): string {
  const n = parseInt(yy, 10);
  return n < 50 ? `20${yy.padStart(2, "0")}` : `19${yy.padStart(2, "0")}`;
}

/**
 * Parse various date formats and convert to YYYY-MM-DD
 */
function parseFlexibleDate(dateStr: string): string | undefined {
  if (!dateStr || dateStr.trim() === "") return undefined;

  const trimmed = dateStr.trim();

  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // DD/MM/YYYY or DD-MM-YYYY (4-digit year, UK-first assumption)
  const ddmmyyyy = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  // YYYY/MM/DD or YYYY.MM.DD
  const yyyymmdd = trimmed.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (yyyymmdd) {
    const [, year, month, day] = yyyymmdd;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  // DD/MM/YY or DD-MM-YY (2-digit year)
  const ddmmyy = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2})$/);
  if (ddmmyy) {
    const [, day, month, yy] = ddmmyy;
    return `${expandYear(yy)}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  // "31 March 2026", "31 Mar 2026", "31-Mar-2026", "31/Mar/2026"
  const dayMonthYear = trimmed.match(/^(\d{1,2})[\s\-/]([A-Za-z]+)[\s\-/](\d{2,4})$/);
  if (dayMonthYear) {
    const [, day, monthStr, yearStr] = dayMonthYear;
    const month = MONTH_NAMES[monthStr.toLowerCase()];
    if (month) {
      const year = yearStr.length === 2 ? expandYear(yearStr) : yearStr;
      return `${year}-${month}-${day.padStart(2, "0")}`;
    }
  }

  // "March 31 2026", "March 31, 2026", "Mar 31 2026"
  const monthDayYear = trimmed.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{2,4})$/);
  if (monthDayYear) {
    const [, monthStr, day, yearStr] = monthDayYear;
    const month = MONTH_NAMES[monthStr.toLowerCase()];
    if (month) {
      const year = yearStr.length === 2 ? expandYear(yearStr) : yearStr;
      return `${year}-${month}-${day.padStart(2, "0")}`;
    }
  }

  return undefined;
}

/**
 * Zod schema for validating CSV rows during import.
 * Be lenient on input formats to accommodate various CSV sources.
 */
export const csvRowSchema = z.object({
  company_name: z.string().min(1, "Client name is required"),
  primary_email: z
    .string()
    .optional()
    .transform((val) => (val === "" || val === undefined ? undefined : val)),
  client_type: z
    .union([
      z.enum(["Limited Company", "Partnership", "LLP", "Individual"]),
      z.literal(""),
    ])
    .optional()
    .transform((val) => (val === "" || val === undefined ? undefined : val)),
  year_end_date: z
    .string()
    .optional()
    .transform((val) => {
      if (!val || val === "") return "";
      const parsed = parseFlexibleDate(val);
      if (!parsed) {
        throw new Error(`Invalid date format: ${val}. Use DD/MM/YYYY, MM/DD/YYYY, or YYYY-MM-DD`);
      }
      return parsed;
    })
    .or(z.literal("")),
  vat_registered: z
    .enum(["Yes", "No", "yes", "no", "TRUE", "FALSE", "true", "false", ""])
    .optional()
    .transform((val) =>
      val ? ["Yes", "yes", "TRUE", "true"].includes(val) : undefined
    ),
  vat_stagger_group: z
    .enum(["1", "2", "3", ""])
    .optional()
    .transform((val) => (val === "" || val === undefined ? undefined : parseInt(val))),
  vat_scheme: z
    .enum([
      "Standard",
      "Flat Rate",
      "Cash Accounting",
      "Annual Accounting",
      "",
    ])
    .optional()
    .transform((val) => (val === "" ? undefined : val)),
});

/**
 * Type inferred from the CSV row schema
 */
export type CsvRow = z.infer<typeof csvRowSchema>;

/**
 * Interface for validation errors with row numbers
 */
export interface CsvValidationError {
  row: number;
  errors: string[];
}
