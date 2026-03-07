import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { bulkUpdateClients, BulkUpdateFields } from "@/app/actions/clients";
import { getOrgId } from "@/lib/auth/org-context";
import { requireWriteAccess } from "@/lib/billing/read-only-mode";

// Validation schema for bulk update request
const bulkUpdateRequestSchema = z.object({
  clientIds: z.array(z.string().uuid()),
  updates: z.object({
    year_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    vat_registered: z.boolean().optional(),
    vat_stagger_group: z.number().int().min(1).max(3).optional().nullable(),
  }),
});

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate the request body
    const validationResult = bulkUpdateRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { clientIds, updates } = validationResult.data;

    const orgId = await getOrgId();
    try {
      await requireWriteAccess(orgId);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Subscription inactive" },
        { status: 403 }
      );
    }

    // Call the bulk update action
    const result = await bulkUpdateClients(clientIds, updates as BulkUpdateFields);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
