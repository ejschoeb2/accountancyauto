import { z } from "zod";

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

  // DD/MM/YYYY or DD-MM-YYYY
  const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (ddmmyyyyMatch) {
    const [, day, month, year] = ddmmyyyyMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  // MM/DD/YYYY or MM-DD-YYYY (common in US)
  const mmddyyyyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (mmddyyyyMatch) {
    const [, month, day, year] = mmddyyyyMatch;
    // Ambiguous - assume DD/MM/YYYY for UK context (Peninsula is UK-based)
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  // YYYY/MM/DD or YYYY.MM.DD
  const yyyymmddMatch = trimmed.match(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/);
  if (yyyymmddMatch) {
    const [, year, month, day] = yyyymmddMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return undefined;
}

/**
 * Zod schema for validating CSV rows during import.
 * Be lenient on input formats to accommodate various CSV sources.
 */
export const csvRowSchema = z.object({
  company_name: z.string().min(1, "Company name is required"),
  client_type: z
    .enum(["Limited Company", "Sole Trader", "Partnership", "LLP"])
    .optional(),
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
