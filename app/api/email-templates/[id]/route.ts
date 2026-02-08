import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { emailTemplateSchema } from "@/lib/validations/email-template";

/**
 * GET /api/email-templates/[id]
 * Fetch a single email template by ID
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("email_templates")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching email template:", error);

    if (error.code === "PGRST116") {
      return NextResponse.json(
        { error: "Email template not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch email template" },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}

/**
 * PUT /api/email-templates/[id]
 * Update an existing email template
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
  const validation = emailTemplateSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Validation failed", details: validation.error.format() },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("email_templates")
    .update({
      name: validation.data.name,
      subject: validation.data.subject,
      body_json: validation.data.body_json,
      is_active: validation.data.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating email template:", error);

    if (error.code === "PGRST116") {
      return NextResponse.json(
        { error: "Email template not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update email template" },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}

/**
 * DELETE /api/email-templates/[id]
 * Delete an email template
 * Returns 409 if template is referenced by schedule_steps (ON DELETE RESTRICT)
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = await createClient();

  const { error } = await supabase
    .from("email_templates")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting email template:", error);

    if (error.code === "PGRST116") {
      return NextResponse.json(
        { error: "Email template not found" },
        { status: 404 }
      );
    }

    // Handle FK constraint violation (ON DELETE RESTRICT from schedule_steps)
    if (error.code === "23503") {
      return NextResponse.json(
        { error: "Template is in use by a schedule and cannot be deleted" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to delete email template" },
      { status: 500 }
    );
  }

  return new NextResponse(null, { status: 204 });
}
