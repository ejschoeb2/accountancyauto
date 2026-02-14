import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { bulkStatusUpdateSchema } from "@/lib/validations/client";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();

  const validation = bulkStatusUpdateSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Validation failed", details: validation.error.issues },
      { status: 400 }
    );
  }

  const { client_ids, filing_type_id, override_status, reason } = validation.data;

  if (override_status === null) {
    // Delete overrides for all selected clients
    const { error } = await supabase
      .from('client_filing_status_overrides')
      .delete()
      .in('client_id', client_ids)
      .eq('filing_type_id', filing_type_id);

    if (error) {
      return NextResponse.json(
        { error: "Failed to clear status overrides", details: error.message },
        { status: 500 }
      );
    }
  } else {
    // Upsert overrides for all selected clients
    const records = client_ids.map((client_id) => ({
      client_id,
      filing_type_id,
      override_status,
      reason: reason || null,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('client_filing_status_overrides')
      .upsert(records, {
        onConflict: 'client_id,filing_type_id',
      });

    if (error) {
      return NextResponse.json(
        { error: "Failed to bulk update status overrides", details: error.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    success: true,
    message: `Updated ${client_ids.length} client(s)`,
  });
}
