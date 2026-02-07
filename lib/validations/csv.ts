import { z } from "zod";

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
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format")
    .optional()
    .or(z.literal("")),
  vat_registered: z
    .enum(["Yes", "No", "yes", "no", "TRUE", "FALSE", "true", "false", ""])
    .optional()
    .transform((val) =>
      val ? ["Yes", "yes", "TRUE", "true"].includes(val) : undefined
    ),
  vat_quarter: z
    .enum(["Jan-Mar", "Apr-Jun", "Jul-Sep", "Oct-Dec", ""])
    .optional()
    .transform((val) => (val === "" ? undefined : val)),
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
