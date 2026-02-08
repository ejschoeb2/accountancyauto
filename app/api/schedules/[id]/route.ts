import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { scheduleSchema } from "@/lib/validations/schedule";

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
    console.error("Error fetching schedule:", scheduleError);
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
    console.error("Error fetching schedule steps:", stepsError);
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
    console.error("Error fetching email templates:", templatesError);
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

  // Update schedule
  const { data: schedule, error: scheduleError } = await supabase
    .from("schedules")
    .update({
      filing_type_id: validation.data.filing_type_id,
      name: validation.data.name,
      description: validation.data.description || null,
      is_active: validation.data.is_active,
    })
    .eq("id", id)
    .select()
    .single();

  if (scheduleError) {
    console.error("Error updating schedule:", scheduleError);
    if (scheduleError.code === "PGRST116") {
      return NextResponse.json(
        { error: "Schedule not found" },
        { status: 404 }
      );
    }
    if (scheduleError.code === "23505") {
      return NextResponse.json(
        { error: "A schedule with this name already exists" },
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
    console.error("Error deleting old schedule steps:", deleteError);
    return NextResponse.json(
      { error: "Failed to update schedule steps" },
      { status: 500 }
    );
  }

  // Insert new steps if provided
  if (validation.data.steps && validation.data.steps.length > 0) {
    const stepsToInsert = validation.data.steps.map((step, index) => ({
      schedule_id: id,
      email_template_id: step.email_template_id,
      step_number: index + 1, // 1-based indexing
      delay_days: step.delay_days,
    }));

    const { error: insertError } = await supabase
      .from("schedule_steps")
      .insert(stepsToInsert);

    if (insertError) {
      console.error("Error inserting new schedule steps:", insertError);
      return NextResponse.json(
        { error: "Failed to update schedule steps" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(schedule);
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
    console.error("Error deleting schedule:", error);
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
