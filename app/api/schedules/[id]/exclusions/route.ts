import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * GET /api/schedules/[id]/exclusions
 * Returns array of excluded client IDs for a schedule
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("schedule_client_exclusions")
    .select("client_id")
    .eq("schedule_id", id);

  if (error) {
    console.error("Error fetching exclusions:", error);
    return NextResponse.json(
      { error: "Failed to fetch exclusions" },
      { status: 500 }
    );
  }

  return NextResponse.json(data?.map((row) => row.client_id) ?? []);
}

/**
 * PUT /api/schedules/[id]/exclusions
 * Replaces the full list of excluded client IDs for a schedule.
 * Body: { excluded_client_ids: string[] }
 */
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = createServiceClient();

  let body: { excluded_client_ids: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!Array.isArray(body.excluded_client_ids)) {
    return NextResponse.json(
      { error: "excluded_client_ids must be an array" },
      { status: 400 }
    );
  }

  // Verify schedule exists
  const { data: schedule, error: scheduleError } = await supabase
    .from("schedules")
    .select("id")
    .eq("id", id)
    .single();

  if (scheduleError || !schedule) {
    return NextResponse.json(
      { error: "Schedule not found" },
      { status: 404 }
    );
  }

  // Delete all existing exclusions for this schedule
  const { error: deleteError } = await supabase
    .from("schedule_client_exclusions")
    .delete()
    .eq("schedule_id", id);

  if (deleteError) {
    console.error("Error deleting exclusions:", deleteError);
    return NextResponse.json(
      { error: `Failed to delete existing exclusions: ${deleteError.message}` },
      { status: 500 }
    );
  }

  // Insert new exclusions (if any)
  if (body.excluded_client_ids.length > 0) {
    const rows = body.excluded_client_ids.map((clientId) => ({
      schedule_id: id,
      client_id: clientId,
    }));

    const { error: insertError } = await supabase
      .from("schedule_client_exclusions")
      .insert(rows);

    if (insertError) {
      console.error("Error inserting exclusions:", insertError);
      return NextResponse.json(
        { error: `Failed to insert exclusions: ${insertError.message}` },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ excluded_client_ids: body.excluded_client_ids });
}
