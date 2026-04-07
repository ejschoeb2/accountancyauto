import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/auth/org-context";
import { scheduleSchema } from "@/lib/validations/schedule";
import { logger } from '@/lib/logger';

/**
 * GET /api/schedules/[id]
 * Fetch a single schedule with steps and template names
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = await createClient();

  // Fetch schedule
  const { data: schedule, error: scheduleError } = await supabase
    .from("schedules")
    .select("*")
    .eq("id", id)
    .single();

  if (scheduleError) {
    logger.error("Error fetching schedule:", { error: (scheduleError as any)?.message ?? String(scheduleError) });
    if (scheduleError.code === "PGRST116") {
      return NextResponse.json(
        { error: "Schedule not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to fetch schedule" },
      { status: 500 }
    );
  }

  // Fetch steps
  const { data: steps, error: stepsError } = await supabase
    .from("schedule_steps")
    .select("*")
    .eq("schedule_id", id)
    .order("step_number", { ascending: true });

  if (stepsError) {
    logger.error("Error fetching schedule steps:", { error: (stepsError as any)?.message ?? String(stepsError) });
    return NextResponse.json(
      { error: "Failed to fetch schedule steps" },
      { status: 500 }
    );
  }

  // Fetch email templates for name lookup
  const { data: templates, error: templatesError } = await supabase
    .from("email_templates")
    .select("id, name");

  if (templatesError) {
    logger.error("Error fetching email templates:", { error: (templatesError as any)?.message ?? String(templatesError) });
    return NextResponse.json(
      { error: "Failed to fetch email templates" },
      { status: 500 }
    );
  }

  // Create template lookup map
  const templateMap = new Map(templates?.map(t => [t.id, t.name]) || []);

  // Attach template names to steps
  const stepsWithNames = steps?.map(step => ({
    ...step,
    template_name: templateMap.get(step.email_template_id) || "Unknown Template",
  }));

  return NextResponse.json({
    ...schedule,
    steps: stepsWithNames,
  });
}

/**
 * PUT /api/schedules/[id]
 * Update a schedule using delete-and-recreate pattern for steps
 */
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = await createClient();

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  // Validate input
  const validation = scheduleSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Validation failed", details: validation.error.format() },
      { status: 400 }
    );
  }

  const data = validation.data;

  // Fetch existing schedule to prevent schedule_type changes
  const { data: existing, error: existingError } = await supabase
    .from("schedules")
    .select("schedule_type")
    .eq("id", id)
    .single();

  if (existingError) {
    if (existingError.code === "PGRST116") {
      return NextResponse.json(
        { error: "Schedule not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to fetch schedule" },
      { status: 500 }
    );
  }

  // Prevent schedule_type change
  const existingType = existing.schedule_type || 'filing'; // default for pre-migration rows
  if (data.schedule_type !== existingType) {
    return NextResponse.json(
      { error: "Cannot change schedule type after creation" },
      { status: 400 }
    );
  }

  // Update schedule
  const { data: schedule, error: scheduleError } = await supabase
    .from("schedules")
    .update({
      schedule_type: data.schedule_type,
      filing_type_id: data.schedule_type === 'filing' ? data.filing_type_id : null,
      name: data.name,
      description: data.description || null,
      is_active: data.is_active,
      custom_date: data.schedule_type === 'custom' ? (data.custom_date || null) : null,
      recurrence_rule: data.schedule_type === 'custom' ? (data.recurrence_rule || null) : null,
      recurrence_anchor: data.schedule_type === 'custom' ? (data.recurrence_anchor || null) : null,
      send_hour: data.schedule_type === 'custom' ? (data.send_hour ?? null) : null,
    })
    .eq("id", id)
    .select()
    .single();

  if (scheduleError) {
    logger.error("Error updating schedule:", { error: (scheduleError as any)?.message ?? String(scheduleError) });
    if (scheduleError.code === "PGRST116") {
      return NextResponse.json(
        { error: "Schedule not found" },
        { status: 404 }
      );
    }
    if (scheduleError.code === "23505") {
      return NextResponse.json(
        { error: "A schedule already exists for this filing type" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update schedule" },
      { status: 500 }
    );
  }

  // Delete-and-recreate pattern for steps
  const { error: deleteError } = await supabase
    .from("schedule_steps")
    .delete()
    .eq("schedule_id", id);

  if (deleteError) {
    logger.error("Error deleting old schedule steps:", { error: (deleteError as any)?.message ?? String(deleteError) });
    return NextResponse.json(
      { error: "Failed to update schedule steps" },
      { status: 500 }
    );
  }

  // Insert new steps if provided
  if (data.steps && data.steps.length > 0) {
    const orgId = await getOrgId();
    const { data: { user } } = await supabase.auth.getUser();
    const stepsToInsert = data.steps.map((step, index) => ({
      org_id: orgId,
      owner_id: user!.id,
      schedule_id: id,
      email_template_id: step.email_template_id,
      step_number: index + 1, // 1-based indexing
      delay_days: step.delay_days,
    }));

    const { error: insertError } = await supabase
      .from("schedule_steps")
      .insert(stepsToInsert);

    if (insertError) {
      logger.error("Error inserting new schedule steps:", { error: (insertError as any)?.message ?? String(insertError) });
      return NextResponse.json(
        { error: "Failed to update schedule steps" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(schedule);
}

/**
 * PATCH /api/schedules/[id]
 * Partial update — currently only supports toggling is_active.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = await createClient();

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.is_active !== "boolean") {
    return NextResponse.json(
      { error: "is_active must be a boolean" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("schedules")
    .update({ is_active: body.is_active })
    .eq("id", id);

  if (error) {
    logger.error("Error patching schedule:", { error: (error as any)?.message ?? String(error) });
    if (error.code === "PGRST116") {
      return NextResponse.json(
        { error: "Schedule not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update schedule" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/schedules/[id]
 * Delete a schedule (CASCADE removes steps automatically)
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = await createClient();

  const { error } = await supabase
    .from("schedules")
    .delete()
    .eq("id", id);

  if (error) {
    logger.error("Error deleting schedule:", { error: (error as any)?.message ?? String(error) });
    if (error.code === "PGRST116") {
      return NextResponse.json(
        { error: "Schedule not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to delete schedule" },
      { status: 500 }
    );
  }

  return new NextResponse(null, { status: 204 });
}
