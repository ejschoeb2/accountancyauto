"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/auth/org-context";
import { DEFAULT_SCHEDULES } from "@/lib/onboarding/seed-defaults";
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
 * Get all filing types ordered by sort_order.
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
 * For newly activated types, auto-creates a default schedule with generic templates.
 * Revalidates /deadlines after save.
 */
export async function updateOrgFilingTypeSelections(
  activeTypeIds: string[]
): Promise<{ error?: string }> {
  const { orgId, orgRole } = await getOrgContext();

  if (orgRole !== "admin") {
    return { error: "Only admins can manage filing type selections." };
  }

  const admin = createAdminClient();

  // Get current user ID for schedule ownership
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id ?? "";

  // Fetch current selections to detect newly activated types
  const { data: currentSelections } = await admin
    .from("org_filing_type_selections")
    .select("filing_type_id, is_active")
    .eq("org_id", orgId);

  const previouslyActive = new Set(
    (currentSelections ?? [])
      .filter((s) => s.is_active)
      .map((s) => s.filing_type_id)
  );

  const newlyActivated = activeTypeIds.filter((id) => !previouslyActive.has(id));

  // Fetch all filing types
  const { data: allTypes, error: fetchError } = await admin
    .from("filing_types")
    .select("id");

  if (fetchError) {
    return { error: fetchError.message };
  }

  // Upsert all selections
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

  // Auto-create default schedules for newly activated types
  if (newlyActivated.length > 0) {
    await seedSchedulesForFilingTypes(orgId, userId, admin, newlyActivated);
  }

  revalidatePath("/deadlines");
  return {};
}

/**
 * Creates default schedules for newly activated filing types.
 * Looks up existing templates by name to wire schedule steps.
 * Non-fatal — failures are logged but don't block the activation.
 */
async function seedSchedulesForFilingTypes(
  orgId: string,
  ownerId: string,
  admin: ReturnType<typeof createAdminClient>,
  filingTypeIds: string[]
): Promise<void> {
  // Build template name -> id map for this org
  const { data: templates } = await admin
    .from("email_templates")
    .select("id, name")
    .eq("org_id", orgId);

  const byName: Record<string, string> = {};
  for (const t of templates ?? []) {
    // First match wins — avoids duplicates overwriting
    if (!byName[t.name]) byName[t.name] = t.id;
  }

  // Check which filing types already have schedules (avoid duplicates)
  const { data: existingSchedules } = await admin
    .from("schedules")
    .select("filing_type_id")
    .eq("org_id", orgId)
    .in("filing_type_id", filingTypeIds);

  const alreadyHasSchedule = new Set(
    (existingSchedules ?? []).map((s) => s.filing_type_id)
  );

  for (const filingTypeId of filingTypeIds) {
    if (alreadyHasSchedule.has(filingTypeId)) continue;

    const schedDef = DEFAULT_SCHEDULES.find(
      (s) => s.filing_type_id === filingTypeId
    );
    if (!schedDef) continue;

    // Create schedule
    const { data: schedule, error: sErr } = await admin
      .from("schedules")
      .insert({
        org_id: orgId,
        owner_id: ownerId,
        name: schedDef.name,
        description: schedDef.description,
        filing_type_id: schedDef.filing_type_id,
        schedule_type: "filing",
        is_active: true,
      })
      .select("id")
      .single();

    if (sErr || !schedule) {
      console.error(
        `[seedSchedulesForFilingTypes] Failed to create schedule for ${filingTypeId}:`,
        sErr
      );
      continue;
    }

    // Create steps
    const steps = schedDef.steps
      .map(([templateName, delayDays], i) => {
        const templateId = byName[templateName];
        if (!templateId) {
          console.warn(
            `[seedSchedulesForFilingTypes] Template "${templateName}" not found for org ${orgId}`
          );
          return null;
        }
        return {
          schedule_id: schedule.id,
          email_template_id: templateId,
          step_number: i + 1,
          delay_days: delayDays,
          org_id: orgId,
          owner_id: ownerId,
        };
      })
      .filter(Boolean);

    if (steps.length > 0) {
      const { error: stErr } = await admin
        .from("schedule_steps")
        .insert(steps);

      if (stErr) {
        console.error(
          `[seedSchedulesForFilingTypes] Failed to insert steps for ${filingTypeId}:`,
          stErr
        );
      }
    }
  }
}
