import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/auth/org-context";
import { emailTemplateSchema } from "@/lib/validations/email-template";
import { requireWriteAccess } from "@/lib/billing/read-only-mode";
import type { EmailTemplate } from "@/lib/types/database";

/**
 * GET /api/email-templates
 * Fetch all email templates ordered by created_at descending.
 * Enriches each template with the filing_type_id it is associated with
 * (via schedule_steps → schedules), so consumers can filter dedicated
 * templates by filing type.
 */
export async function GET() {
  const supabase = await createClient();

  const [templatesResult, stepsResult, schedulesResult] = await Promise.all([
    supabase
      .from("email_templates")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("schedule_steps")
      .select("email_template_id, schedule_id"),
    supabase
      .from("schedules")
      .select("id, filing_type_id")
      .not("filing_type_id", "is", null),
  ]);

  if (templatesResult.error) {
    console.error("Error fetching email templates:", templatesResult.error);
    return NextResponse.json(
      { error: "Failed to fetch email templates" },
      { status: 500 }
    );
  }

  // Build template → filing_type_id mapping
  const scheduleFilingMap = new Map<string, string>();
  if (schedulesResult.data) {
    for (const s of schedulesResult.data) {
      if (s.filing_type_id) scheduleFilingMap.set(s.id, s.filing_type_id);
    }
  }

  const templateFilingMap = new Map<string, string>();
  if (stepsResult.data) {
    for (const step of stepsResult.data) {
      const filingTypeId = scheduleFilingMap.get(step.schedule_id);
      if (filingTypeId && !templateFilingMap.has(step.email_template_id)) {
        templateFilingMap.set(step.email_template_id, filingTypeId);
      }
    }
  }

  // Enrich templates with filing_type_id
  const enriched = templatesResult.data.map((t: any) => ({
    ...t,
    filing_type_id: templateFilingMap.get(t.id) ?? null,
  }));

  return NextResponse.json(enriched);
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

  const orgId = await getOrgId();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await requireWriteAccess(orgId);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Subscription inactive" },
      { status: 403 }
    );
  }

  const { data, error } = await supabase
    .from("email_templates")
    .insert({
      org_id: orgId,
      owner_id: user.id,
      name: validation.data.name,
      subject: validation.data.subject,
      body_json: validation.data.body_json,
      is_active: validation.data.is_active,
      is_custom: true, // Mark as custom since created via UI
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
