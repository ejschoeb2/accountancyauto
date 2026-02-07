/**
 * CSV column definitions with descriptions for help text
 */
export const CSV_COLUMNS = [
  {
    name: "company_name",
    required: true,
    description: "Exact company name as in QuickBooks",
  },
  {
    name: "client_type",
    required: false,
    description: "Limited Company, Sole Trader, Partnership, or LLP",
  },
  {
    name: "year_end_date",
    required: false,
    description: "YYYY-MM-DD format",
  },
  {
    name: "vat_registered",
    required: false,
    description: "Yes/No or true/false",
  },
  {
    name: "vat_quarter",
    required: false,
    description: "Jan-Mar, Apr-Jun, Jul-Sep, or Oct-Dec",
  },
  {
    name: "vat_scheme",
    required: false,
    description: "Standard, Flat Rate, Cash Accounting, or Annual Accounting",
  },
];

/**
 * Generates a CSV template string with headers and example rows
 * @returns CSV content as a string
 */
export function generateCsvTemplate(): string {
  const headers = CSV_COLUMNS.map((col) => col.name).join(",");

  // Example row 1: Limited Company with all fields
  const example1 = [
    '"Acme Ltd"',
    '"Limited Company"',
    '"2026-03-31"',
    '"Yes"',
    '"Jan-Mar"',
    '"Standard"',
  ].join(",");

  // Example row 2: Sole Trader with minimal fields
  const example2 = [
    '"Jane Smith Trading"',
    '"Sole Trader"',
    '"2026-04-05"',
    '"No"',
    '""',
    '""',
  ].join(",");

  // Example row 3: Partnership with partial fields
  const example3 = [
    '"Smith & Jones Partnership"',
    '"Partnership"',
    '"2026-06-30"',
    '"Yes"',
    '"Apr-Jun"',
    '""',
  ].join(",");

  return [headers, example1, example2, example3].join("\n");
}

/**
 * Generates a CSV template with comments/explanations
 * @returns CSV content as a string with comments
 */
export function generateCsvTemplateWithComments(): string {
  const template = generateCsvTemplate();
  const comments = [
    "# Client Metadata Import Template",
    "#",
    "# Instructions:",
    "# 1. Required column: company_name (must match exactly as in QuickBooks)",
    "# 2. Optional columns: client_type, year_end_date, vat_registered, vat_quarter, vat_scheme",
    "# 3. Dates must be in YYYY-MM-DD format",
    "# 4. Boolean values can be: Yes/No, yes/no, TRUE/FALSE, true/false",
    "# 5. Empty optional fields will not overwrite existing data",
    "#",
    "# Valid values:",
    "# - client_type: Limited Company, Sole Trader, Partnership, LLP",
    "# - vat_quarter: Jan-Mar, Apr-Jun, Jul-Sep, Oct-Dec",
    "# - vat_scheme: Standard, Flat Rate, Cash Accounting, Annual Accounting",
    "#",
  ].join("\n");

  return comments + "\n" + template;
}
