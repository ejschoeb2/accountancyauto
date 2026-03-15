"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/auth/org-context";
import type { FilingType } from "@/lib/types/database";

// --- Org Filing Type Selections ---

export interface OrgFilingTypeSelectionRow {
  filing_type_id: string;
  is_active: boolean;
}

/**
 * Get the current org's filing type selection rows.
 * RLS ensures only the current org's rows are returned.
 * Returns an empty array if no selections exist yet (org uses backfill defaults).
 */
export async function getOrgFilingTypeSelections(): Promise<OrgFilingTypeSelectionRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("org_filing_type_selections")
    .select("filing_type_id, is_active");

  if (error) {
    console.error("getOrgFilingTypeSelections error:", error);
    return [];
  }

  return data ?? [];
}

/**
 * Get all 14 filing types ordered by sort_order.
 * Global reference table — readable by all authenticated users.
 */
export async function getAllFilingTypes(): Promise<FilingType[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("filing_types")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("getAllFilingTypes error:", error);
    return [];
  }

  return (data as FilingType[]) ?? [];
}

/**
 * Update the org's filing type selections.
 * Admin only. Upserts a row for every filing type — active if in activeTypeIds, inactive otherwise.
 * Revalidates /deadlines after save.
 */
export async function updateOrgFilingTypeSelections(
  activeTypeIds: string[]
): Promise<{ error?: string }> {
  const { orgId, orgRole } = await getOrgContext();

  if (orgRole !== "admin") {
    return { error: "Only admins can manage filing type selections." };
  }

  // Fetch all filing types via admin client
  const admin = createAdminClient();
  const { data: allTypes, error: fetchError } = await admin
    .from("filing_types")
    .select("id");

  if (fetchError) {
    return { error: fetchError.message };
  }

  const rows = (allTypes ?? []).map((ft: { id: string }) => ({
    org_id: orgId,
    filing_type_id: ft.id,
    is_active: activeTypeIds.includes(ft.id),
    activated_at: new Date().toISOString(),
  }));

  const { error: upsertError } = await admin
    .from("org_filing_type_selections")
    .upsert(rows, { onConflict: "org_id,filing_type_id" });

  if (upsertError) {
    return { error: upsertError.message };
  }

  revalidatePath("/deadlines");
  return {};
}
