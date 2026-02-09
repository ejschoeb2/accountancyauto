import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClientSchema } from "@/lib/validations/client";

/**
 * GET /api/clients
 * Returns all clients (id, company_name, client_type) for selection lists
 */
export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clients")
    .select("id, company_name, client_type")
    .order("company_name");

  if (error) {
    console.error("Error fetching clients:", error);
    return NextResponse.json(
      { error: "Failed to fetch clients" },
      { status: 500 }
    );
  }

  return NextResponse.json(data ?? []);
}

/**
 * POST /api/clients
 * Creates a new client row (used by the demo client creation dialog)
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  // Validate with Zod schema
  const result = createClientSchema.safeParse(body);
  if (!result.success) {
    const messages = result.error.issues.map((issue) => issue.message).join(", ");
    return NextResponse.json(
      { error: messages },
      { status: 400 }
    );
  }

  const { company_name, primary_email, client_type, year_end_date, vat_registered, display_name } = result.data;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clients")
    .insert({
      company_name,
      primary_email,
      client_type,
      year_end_date: year_end_date ?? null,
      vat_registered,
      display_name: display_name ?? null,
      quickbooks_id: `DEMO-${Date.now()}`,
      active: true,
      reminders_paused: false,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating client:", error);
    return NextResponse.json(
      { error: `Failed to create client: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json(data, { status: 201 });
}
