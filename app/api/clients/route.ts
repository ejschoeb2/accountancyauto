import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgId } from "@/lib/auth/org-context";
import { createClientSchema } from "@/lib/validations/client";
import { requireWriteAccess } from "@/lib/billing/read-only-mode";
import { checkClientLimit } from "@/lib/billing/usage-limits";
import { rebuildQueueForClient } from "@/lib/reminders/queue-builder";
import { logger } from '@/lib/logger';
import { DEFAULT_PAGE_SIZE } from "@/lib/config/limits";

/**
 * GET /api/clients
 * Returns clients (id, company_name, client_type) with optional pagination.
 * Query params: limit (default 500), offset (default 0)
 * Response header X-Total-Count contains the total number of clients.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || String(DEFAULT_PAGE_SIZE), 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  const supabase = await createClient();

  const { data, error, count } = await supabase
    .from("clients")
    .select("id, company_name, client_type", { count: 'exact' })
    .order("company_name")
    .range(offset, offset + limit - 1);

  if (error) {
    logger.error("Error fetching clients:", { error: (error as any)?.message ?? String(error) });
    return NextResponse.json(
      { error: "Failed to fetch clients" },
      { status: 500 }
    );
  }

  const response = NextResponse.json(data ?? []);
  response.headers.set('X-Total-Count', String(count ?? 0));
  return response;
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

  const { company_name, primary_email, client_type, year_end_date, vat_registered, vat_stagger_group, vat_scheme, display_name, filing_type_ids } = result.data;

  const supabase = await createClient();

  // Get the current user's ID for owner_id
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;

  if (!userId) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  const orgId = await getOrgId();

  // Enforce billing: block mutations when subscription is inactive
  try {
    await requireWriteAccess(orgId);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Subscription inactive" },
      { status: 403 }
    );
  }

  // Enforce plan limit: block creation when at client limit
  const limitResult = await checkClientLimit(orgId);
  if (!limitResult.allowed) {
    return NextResponse.json(
      {
        error: limitResult.message,
        code: "CLIENT_LIMIT_REACHED",
        currentCount: limitResult.currentCount,
        limit: limitResult.limit,
      },
      { status: 403 }
    );
  }

  const { data, error } = await supabase
    .from("clients")
    .insert({
      org_id: orgId,
      owner_id: userId,
      company_name,
      primary_email,
      client_type,
      year_end_date: year_end_date ?? null,
      vat_registered,
      vat_stagger_group: vat_stagger_group ?? null,
      vat_scheme: vat_scheme ?? null,
      display_name: display_name ?? null,
      active: true,
      reminders_paused: false,
    })
    .select()
    .single();

  if (error) {
    logger.error("Failed to create client", { error: error.message });
    return NextResponse.json(
      { error: 'An internal error occurred' },
      { status: 500 }
    );
  }

  // Create filing assignments — use explicit list if provided, else auto-assign by client_type
  if (data && client_type) {
    if (filing_type_ids && filing_type_ids.length > 0) {
      // Use the explicitly selected filing types from the dialog
      const assignmentsToInsert = filing_type_ids.map((ftId) => ({
        org_id: orgId,
        client_id: data.id,
        filing_type_id: ftId,
        is_active: true,
      }));

      const { error: assignError } = await supabase
        .from("client_filing_assignments")
        .insert(assignmentsToInsert);

      if (assignError) {
        logger.error("Failed to assign filing types:", { error: assignError.message });
      }
    } else {
      // Fallback: auto-assign based on client_type (e.g. CSV import)
      const { data: filingTypes } = await supabase
        .from("filing_types")
        .select("id, applicable_client_types");

      if (filingTypes && filingTypes.length > 0) {
        const applicable = filingTypes.filter((ft) => {
          if (!ft.applicable_client_types.includes(client_type)) return false;
          if (ft.id === "vat_return") return vat_registered === true;
          return true;
        });

        if (applicable.length > 0) {
          const assignmentsToInsert = applicable.map((ft) => ({
            org_id: orgId,
            client_id: data.id,
            filing_type_id: ft.id,
            is_active: true,
          }));

          const { error: assignError } = await supabase
            .from("client_filing_assignments")
            .insert(assignmentsToInsert);

          if (assignError) {
            logger.error("Failed to auto-assign filing types:", { error: assignError.message });
          }
        }
      }
    }
  }

  // Reactively build reminder queue for the new client (non-fatal)
  if (data) {
    try {
      const adminClient = createAdminClient();
      await rebuildQueueForClient(adminClient, data.id, orgId);
    } catch (rebuildErr) {
      logger.error("[clients route] Non-fatal: failed to build reminder queue for new client:", { error: (rebuildErr as any)?.message ?? String(rebuildErr) });
    }
  }

  return NextResponse.json(data, { status: 201 });
}
