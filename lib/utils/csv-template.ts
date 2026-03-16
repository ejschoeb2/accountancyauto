/**
 * Rolls a year-end date forward (one year at a time) until it is today or in
 * the future. Applied during CSV import so that clients with historical year
 * ends don't immediately surface a backlog of overdue deadlines.
 *
 * @param dateStr - YYYY-MM-DD string (or null/empty)
 * @returns A YYYY-MM-DD string >= today, or null if input is invalid/empty
 */
export function rollYearEndToFuture(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;

  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return dateStr; // Unrecognised format — leave unchanged

  let year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  // Compare against UTC midnight today to avoid timezone artefacts
  const today = new Date();
  const todayMs = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());

  while (Date.UTC(year, month - 1, day) < todayMs) {
    year += 1;
  }

  return `${year}-${match[2]}-${match[3]}`;
}

/**
 * CSV column definitions with descriptions for help text
 */
export const CSV_COLUMNS = [
  {
    name: "company_name",
    required: true,
    description: "Client name to match existing clients",
  },
  {
    name: "primary_email",
    required: false,
    description: "Client's primary email address for reminders",
  },
  {
    name: "client_type",
    required: false,
    description: "Limited Company, Partnership, LLP, or Individual",
  },
  {
    name: "year_end_date",
    required: false,
    description: "DD/MM/YYYY, MM/DD/YYYY, or YYYY-MM-DD",
  },
  {
    name: "vat_registered",
    required: false,
    description: "Yes/No or true/false",
  },
  {
    name: "vat_stagger_group",
    required: false,
    description: "HMRC VAT stagger: 1 = quarters end Mar/Jun/Sep/Dec · 2 = quarters end Jan/Apr/Jul/Oct · 3 = quarters end Feb/May/Aug/Nov",
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
    '"accounts@acmeltd.co.uk"',
    '"Limited Company"',
    '"2026-03-31"',
    '"Yes"',
    '"1"',
    '"Standard"',
  ].join(",");

  // Example row 2: Individual with minimal fields
  const example2 = [
    '"Jane Smith Trading"',
    '"jane@janesmith.co.uk"',
    '"Individual"',
    '"2026-04-05"',
    '"No"',
    '""',
    '""',
  ].join(",");

  // Example row 3: Partnership with partial fields
  const example3 = [
    '"Smith & Jones Partnership"',
    '"info@smithjones.co.uk"',
    '"Partnership"',
    '"2026-06-30"',
    '"Yes"',
    '"2"',
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
    "# Prompt - Client Import Template",
    "#",
    "# Instructions:",
    "# 1. Required: company_name — the client name, must match existing clients exactly (case-insensitive)",
    "# 2. All other columns are optional — leave blank to skip that field",
    "# 3. Dates accepted in any of: DD/MM/YYYY, DD/MM/YY, YYYY-MM-DD, '31 March 2026', '31 Mar 2026'",
    "# 4. Yes/No fields accept: Yes, No, yes, no, TRUE, FALSE, true, false",
    "#",
    "# client_type values:",
    "#   Limited Company | Partnership | LLP | Individual",
    "#",
    "# vat_stagger_group - which HMRC VAT stagger group the client is in:",
    "#   1 = VAT quarters end in March / June / September / December",
    "#   2 = VAT quarters end in January / April / July / October",
    "#   3 = VAT quarters end in February / May / August / November",
    "#   (Return and payment due 1 month + 7 days after each quarter end)",
    "#",
    "# vat_scheme values:",
    "#   Standard | Flat Rate | Cash Accounting | Annual Accounting",
    "#",
    "# --- DATA ROWS BELOW THIS LINE ---",
  ].join("\n");

  return comments + "\n" + template;
}
