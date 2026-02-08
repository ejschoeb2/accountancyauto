import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/schedules/[id]/duplicate
 * Duplicate a schedule with "(Copy)" suffix
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = await createClient();

  // Fetch original schedule
  const { data: original, error: scheduleError } = await supabase
    .from("schedules")
    .select("*")
    .eq("id", id)
    .single();

  if (scheduleError) {
    console.error("Error fetching schedule to duplicate:", scheduleError);
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

  // Fetch original steps
  const { data: originalSteps, error: stepsError } = await supabase
    .from("schedule_steps")
    .select("*")
    .eq("schedule_id", id)
    .order("step_number", { ascending: true });

  if (stepsError) {
    console.error("Error fetching schedule steps to duplicate:", stepsError);
    return NextResponse.json(
      { error: "Failed to fetch schedule steps" },
      { status: 500 }
    );
  }

  // Create new schedule with "(Copy)" suffix
  const { data: newSchedule, error: createError } = await supabase
    .from("schedules")
    .insert({
      filing_type_id: original.filing_type_id,
      name: `${original.name} (Copy)`,
      description: original.description,
      is_active: false, // Duplicates start inactive per user decision
    })
    .select()
    .single();

  if (createError) {
    console.error("Error creating duplicate schedule:", createError);
    if (createError.code === "23505") {
      return NextResponse.json(
        { error: "A schedule with this name already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create duplicate schedule" },
      { status: 500 }
    );
  }

  // Copy steps to new schedule
  if (originalSteps && originalSteps.length > 0) {
    const stepsToInsert = originalSteps.map(step => ({
      schedule_id: newSchedule.id,
      email_template_id: step.email_template_id,
      step_number: step.step_number,
      delay_days: step.delay_days,
      urgency_level: step.urgency_level,
    }));

    const { error: insertError } = await supabase
      .from("schedule_steps")
      .insert(stepsToInsert);

    if (insertError) {
      console.error("Error copying schedule steps:", insertError);
      return NextResponse.json(
        { error: "Duplicate created but failed to copy steps" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(newSchedule, { status: 201 });
}
