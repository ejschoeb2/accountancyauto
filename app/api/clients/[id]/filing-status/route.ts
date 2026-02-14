import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { statusOverrideSchema } from "@/lib/validations/client";

// PUT - Create or update status override
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params;
  const supabase = await createClient();
  const body = await request.json();

  // Validate
  const validation = statusOverrideSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Validation failed", details: validation.error.issues },
      { status: 400 }
    );
  }

  const { filing_type_id, override_status, reason } = validation.data;

  // Upsert override
  const { data, error } = await supabase
    .from('client_filing_status_overrides')
    .upsert({
      client_id: clientId,
      filing_type_id,
      override_status,
      reason: reason || null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'client_id,filing_type_id',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to update status override", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data });
}

// DELETE - Remove status override
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params;
  const { searchParams } = new URL(request.url);
  const filingTypeId = searchParams.get('filing_type_id');

  if (!filingTypeId) {
    return NextResponse.json(
      { error: "filing_type_id query parameter required" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('client_filing_status_overrides')
    .delete()
    .eq('client_id', clientId)
    .eq('filing_type_id', filingTypeId);

  if (error) {
    return NextResponse.json(
      { error: "Failed to delete status override", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
