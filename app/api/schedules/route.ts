import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { scheduleSchema } from "@/lib/validations/schedule";

/**
 * GET /api/schedules
 * Fetch all schedules with step counts
 */
export async function GET() {
  const supabase = await createClient();

  // Fetch schedules
  const { data: schedules, error: schedulesError } = await supabase
    .from("schedules")
    .select("*")
    .order("created_at", { ascending: false });

  if (schedulesError) {
    console.error("Error fetching schedules:", schedulesError);
    return NextResponse.json(
      { error: "Failed to fetch schedules" },
      { status: 500 }
    );
  }

  // Fetch step counts separately (avoids FK join issues)
  const { data: steps, error: stepsError } = await supabase
    .from("schedule_steps")
    .select("schedule_id");

  if (stepsError) {
    console.error("Error fetching schedule steps:", stepsError);
    return NextResponse.json(
      { error: "Failed to fetch schedule steps" },
      { status: 500 }
    );
  }

  // Count steps per schedule
  const stepCounts = steps?.reduce((acc: Record<string, number>, step) => {
    acc[step.schedule_id] = (acc[step.schedule_id] || 0) + 1;
    return acc;
  }, {}) || {};

  // Attach step counts to schedules
  const schedulesWithCounts = schedules?.map(schedule => ({
    ...schedule,
    step_count: stepCounts[schedule.id] || 0,
  }));

  return NextResponse.json(schedulesWithCounts);
}

/**
 * POST /api/schedules
 * Create a new schedule
 */
export async function POST(request: Request) {
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

  // Insert schedule
  const { data: schedule, error: scheduleError } = await supabase
    .from("schedules")
    .insert({
      filing_type_id: validation.data.filing_type_id,
      name: validation.data.name,
      description: validation.data.description || null,
      is_active: validation.data.is_active,
    })
    .select()
    .single();

  if (scheduleError) {
    console.error("Error creating schedule:", scheduleError);

    // Check for unique constraint violation
    if (scheduleError.code === "23505") {
      return NextResponse.json(
        { error: "A schedule with this name already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create schedule" },
      { status: 500 }
    );
  }

  // Insert steps if provided
  if (validation.data.steps && validation.data.steps.length > 0) {
    const stepsToInsert = validation.data.steps.map((step, index) => ({
      schedule_id: schedule.id,
      email_template_id: step.email_template_id,
      step_number: index + 1, // 1-based indexing
      delay_days: step.delay_days,
    }));

    const { error: stepsError } = await supabase
      .from("schedule_steps")
      .insert(stepsToInsert);

    if (stepsError) {
      console.error("Error creating schedule steps:", stepsError);
      // Schedule created but steps failed - return error
      return NextResponse.json(
        { error: "Schedule created but failed to add steps" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(schedule, { status: 201 });
}
