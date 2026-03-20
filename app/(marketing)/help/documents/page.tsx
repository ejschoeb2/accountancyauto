import { Metadata } from "next";
import { DocumentsHelpContent } from "./documents-help-content";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Document Guide — Prompt",
  description:
    "A guide to every document your accountant may request — what it is, where to find it, and why it's needed.",
};

interface DocType {
  code: string;
  label: string;
  client_description: string | null;
}

interface FilingDocReq {
  filing_type_id: string;
  document_types: DocType | DocType[] | null;
}

// Filing types with document requirements, in display order
const FILING_DISPLAY_ORDER = [
  { id: "self_assessment", label: "Self Assessment" },
  { id: "ct600_filing", label: "CT600 (Corporation Tax Return)" },
  { id: "companies_house", label: "Companies House Accounts" },
  { id: "vat_return", label: "VAT Return" },
  { id: "confirmation_statement", label: "Confirmation Statement" },
  { id: "partnership_tax_return", label: "Partnership Tax Return" },
  { id: "mtd_quarterly_update", label: "MTD Quarterly Return" },
  { id: "trust_tax_return", label: "Trust Tax Return" },
  { id: "p11d_filing", label: "P11D (Benefits & Expenses)" },
  { id: "cis_monthly_return", label: "CIS Monthly Return" },
  { id: "payroll_year_end", label: "Payroll Year End" },
];

export default async function DocumentsHelpPage() {
  const supabase = createServiceClient();

  const { data: requirements } = await supabase
    .from("filing_document_requirements")
    .select("filing_type_id, sort_order, description_override, document_types(code, label, client_description)")
    .order("sort_order", { ascending: true });

  // Group by filing type
  const grouped: Record<string, Array<{ code: string; label: string; description: string }>> = {};

  for (const row of (requirements ?? []) as (FilingDocReq & { sort_order: number; description_override: string | null })[]) {
    const dt = Array.isArray(row.document_types) ? row.document_types[0] : row.document_types;
    if (!dt) continue;

    if (!grouped[row.filing_type_id]) grouped[row.filing_type_id] = [];
    grouped[row.filing_type_id].push({
      code: dt.code,
      label: dt.label,
      description: row.description_override ?? dt.client_description ?? "",
    });
  }

  // Build ordered sections (skip filing types with no documents)
  const sections = FILING_DISPLAY_ORDER
    .filter((ft) => (grouped[ft.id] ?? []).length > 0)
    .map((ft) => ({
      id: ft.id,
      label: ft.label,
      documents: grouped[ft.id],
    }));

  return <DocumentsHelpContent sections={sections} />;
}
