import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { emailTemplateSchema } from "@/lib/validations/email-template";
import type { EmailTemplate } from "@/lib/types/database";

/**
 * GET /api/email-templates
 * Fetch all email templates ordered by created_at descending
 */
export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("email_templates")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching email templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch email templates" },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}

/**
 * POST /api/email-templates
 * Create a new email template
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
  const validation = emailTemplateSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Validation failed", details: validation.error.format() },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("email_templates")
    .insert({
      name: validation.data.name,
      subject: validation.data.subject,
      body_json: validation.data.body_json,
      is_active: validation.data.is_active,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating email template:", error);

    // Check for unique constraint violation
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "A template with this name already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create email template" },
      { status: 500 }
    );
  }

  return NextResponse.json(data, { status: 201 });
}
