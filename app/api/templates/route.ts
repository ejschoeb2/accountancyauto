import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { templateSchema } from "@/lib/validations/template";
import type { ReminderTemplate } from "@/lib/types/database";

/**
 * GET /api/templates
 * Fetch all reminder templates with filing type details
 */
export async function GET() {
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
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}

/**
 * POST /api/templates
 * Create a new reminder template
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
  const validation = templateSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Validation failed", details: validation.error.format() },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("reminder_templates")
    .insert({
      filing_type_id: validation.data.filing_type_id,
      name: validation.data.name,
      description: validation.data.description || null,
      steps: validation.data.steps,
      is_active: validation.data.is_active,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating template:", error);

    // Check for unique constraint violation
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "A template with this name already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }

  return NextResponse.json(data, { status: 201 });
}
