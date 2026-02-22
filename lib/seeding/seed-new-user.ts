import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Seed a new user's defaults by cloning the org admin's templates, schedules,
 * and schedule steps. This gives new members a fully working reminder setup
 * from day one without needing to create everything from scratch.
 *
 * Called after a new member successfully accepts an invite and is inserted
 * into user_organisations. This is non-fatal — if seeding fails, the user
 * is still in the org and can configure manually.
 *
 * Cloning strategy:
 * - email_templates: cloned one-by-one to capture returned IDs for FK remapping
 * - schedules: cloned one-by-one to capture returned IDs for FK remapping
 * - schedule_steps: cloned in bulk with remapped schedule_id and email_template_id
 * - schedule_client_exclusions: NOT cloned (new user has no clients assigned yet)
 * - app_settings: NOT cloned (user starts with org defaults via fallback pattern)
 */
export async function seedNewUserDefaults(
  userId: string,
  orgId: string
): Promise<void> {
  try {
    // Admin client (service-role) — new user has no org_id in JWT yet, so RLS
    // would block reads from email_templates, schedules, schedule_steps.
    const admin = createAdminClient();

    // Find the org's earliest admin to clone from
    const { data: adminMembership } = await admin
      .from("user_organisations")
      .select("user_id")
      .eq("org_id", orgId)
      .eq("role", "admin")
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    if (!adminMembership) {
      console.warn(
        `[seed-new-user] No admin found for org ${orgId}, skipping seeding`
      );
      return;
    }
    const adminId = adminMembership.user_id;

    // --- Clone email_templates ---
    const { data: adminTemplates } = await admin
      .from("email_templates")
      .select("*")
      .eq("org_id", orgId)
      .eq("owner_id", adminId);

    // Build old_id -> new_id mapping for schedule_steps FK remapping
    const templateIdMap = new Map<string, string>();

    if (adminTemplates && adminTemplates.length > 0) {
      for (const template of adminTemplates) {
        const { id: oldId, created_at, updated_at, ...rest } = template;
        const { data: inserted, error } = await admin
          .from("email_templates")
          .insert({ ...rest, owner_id: userId })
          .select("id")
          .single();

        if (inserted) {
          templateIdMap.set(oldId, inserted.id);
        } else if (error) {
          console.warn(
            `[seed-new-user] Failed to clone template ${oldId}:`,
            error.message
          );
        }
      }
    }

    // --- Clone schedules ---
    const { data: adminSchedules } = await admin
      .from("schedules")
      .select("*")
      .eq("org_id", orgId)
      .eq("owner_id", adminId);

    const scheduleIdMap = new Map<string, string>();

    if (adminSchedules && adminSchedules.length > 0) {
      for (const schedule of adminSchedules) {
        const { id: oldId, created_at, updated_at, ...rest } = schedule;
        const { data: inserted, error } = await admin
          .from("schedules")
          .insert({ ...rest, owner_id: userId })
          .select("id")
          .single();

        if (inserted) {
          scheduleIdMap.set(oldId, inserted.id);
        } else if (error) {
          console.warn(
            `[seed-new-user] Failed to clone schedule ${oldId}:`,
            error.message
          );
        }
      }
    }

    // --- Clone schedule_steps with remapped FKs ---
    const { data: adminSteps } = await admin
      .from("schedule_steps")
      .select("*")
      .eq("org_id", orgId)
      .eq("owner_id", adminId);

    if (adminSteps && adminSteps.length > 0) {
      const newSteps = adminSteps
        .map(({ id, created_at, updated_at, ...step }) => {
          const newScheduleId = scheduleIdMap.get(step.schedule_id);
          const newTemplateId = templateIdMap.get(step.email_template_id);

          // Skip if either FK couldn't be remapped (parent clone failed)
          if (!newScheduleId || !newTemplateId) {
            console.warn(
              `[seed-new-user] Skipping step ${id}: missing FK remap (schedule: ${!!newScheduleId}, template: ${!!newTemplateId})`
            );
            return null;
          }

          return {
            ...step,
            owner_id: userId,
            schedule_id: newScheduleId,
            email_template_id: newTemplateId,
          };
        })
        .filter(Boolean);

      if (newSteps.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await admin
          .from("schedule_steps")
          .insert(newSteps as any[]);

        if (error) {
          console.warn(
            `[seed-new-user] Failed to clone schedule steps:`,
            error.message
          );
        }
      }
    }

    // NOTE: schedule_client_exclusions are NOT cloned — new user has no clients
    // assigned yet. Exclusions are per-client and set up after client assignment.
    //
    // NOTE: app_settings are NOT cloned — the settings fallback pattern reads
    // user-specific row first, falls back to org default (user_id IS NULL).
    // New user automatically uses org defaults until they change their settings.
  } catch (error) {
    console.error(
      `[seed-new-user] Failed to seed defaults for user ${userId} in org ${orgId}:`,
      error instanceof Error ? error.message : error
    );
    // Non-fatal — user is already in the org. They can configure manually.
  }
}
