import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { templateSchema } from "@/lib/validations/template";

/**
 * GET /api/templates/[id]
 * Fetch a single reminder template by ID
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reminder_templates")
    .select(`
      *,
      filing_types (
        id,
        name,
        description
      )
    `)
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching template:", error);

    if (error.code === "PGRST116") {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch template" },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}

/**
 * PUT /api/templates/[id]
 * Update an existing reminder template
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
  const validation = templateSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Validation failed", details: validation.error.format() },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("reminder_templates")
    .update({
      filing_type_id: validation.data.filing_type_id,
      name: validation.data.name,
      description: validation.data.description || null,
      steps: validation.data.steps,
      is_active: validation.data.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating template:", error);

    if (error.code === "PGRST116") {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update template" },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}

/**
 * DELETE /api/templates/[id]
 * Delete a reminder template
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = await createClient();

  const { error } = await supabase
    .from("reminder_templates")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting template:", error);

    if (error.code === "PGRST116") {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to delete template" },
      { status: 500 }
    );
  }

  return new NextResponse(null, { status: 204 });
}
