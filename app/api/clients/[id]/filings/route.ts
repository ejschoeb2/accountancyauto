import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateDeadline } from '@/lib/deadlines/calculators';
import { z } from 'zod';
import type { FilingType, FilingTypeId } from '@/lib/types/database';

// Validation schema for PUT body
const putFilingsSchema = z.object({
  assignments: z.array(
    z.object({
      filing_type_id: z.string(),
      is_active: z.boolean(),
    })
  ),
});

interface FilingAssignmentResponse {
  filing_type: FilingType;
  is_active: boolean;
  calculated_deadline: string | null;
  override_deadline: string | null;
  override_reason: string | null;
}

/**
 * GET /api/clients/[id]/filings
 * Fetch client's filing assignments with calculated deadlines and overrides.
 * Auto-assigns filing types based on client type if no assignments exist.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params;
    const supabase = await createClient();

    // Fetch client record for metadata
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('client_type, year_end_date, vat_stagger_group, vat_registered')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        { error: 'Client not found', details: clientError?.message },
        { status: 404 }
      );
    }

    // Check if client has any filing assignments
    const { data: existingAssignments, error: assignmentsError } = await supabase
      .from('client_filing_assignments')
      .select('id')
      .eq('client_id', clientId)
      .limit(1);

    if (assignmentsError) {
      return NextResponse.json(
        { error: 'Failed to check assignments', details: assignmentsError.message },
        { status: 500 }
      );
    }

    // Auto-assign filing types if none exist
    if (!existingAssignments || existingAssignments.length === 0) {
      // Fetch all filing types
      const { data: filingTypes, error: filingTypesError } = await supabase
        .from('filing_types')
        .select('*');

      if (filingTypesError) {
        return NextResponse.json(
          { error: 'Failed to fetch filing types', details: filingTypesError.message },
          { status: 500 }
        );
      }

      // Filter applicable filing types based on client type
      const applicableFilings = (filingTypes || []).filter((ft) => {
        // Check if client type matches
        if (client.client_type && ft.applicable_client_types.includes(client.client_type)) {
          // For VAT, only assign if client is VAT registered
          if (ft.id === 'vat_return') {
            return client.vat_registered === true;
          }
          return true;
        }
        return false;
      });

      // Insert auto-assignments
      if (applicableFilings.length > 0) {
        const assignmentsToInsert = applicableFilings.map((ft) => ({
          client_id: clientId,
          filing_type_id: ft.id,
          is_active: true,
        }));

        const { error: insertError } = await supabase
          .from('client_filing_assignments')
          .insert(assignmentsToInsert);

        if (insertError) {
          return NextResponse.json(
            { error: 'Failed to auto-assign filing types', details: insertError.message },
            { status: 500 }
          );
        }
      }
    }

    // Fetch filing assignments with filing types joined
    const { data: assignments, error: fetchError } = await supabase
      .from('client_filing_assignments')
      .select('*, filing_types(*)')
      .eq('client_id', clientId);

    if (fetchError) {
      return NextResponse.json(
        { error: 'Failed to fetch assignments', details: fetchError.message },
        { status: 500 }
      );
    }

    // Fetch deadline overrides
    const { data: overrides, error: overridesError } = await supabase
      .from('client_deadline_overrides')
      .select('*')
      .eq('client_id', clientId);

    if (overridesError) {
      return NextResponse.json(
        { error: 'Failed to fetch overrides', details: overridesError.message },
        { status: 500 }
      );
    }

    // Create override map for quick lookup
    const overrideMap = new Map(
      (overrides || []).map((o) => [o.filing_type_id, o])
    );

    // Build response with calculated deadlines
    const filings: FilingAssignmentResponse[] = (assignments || []).map((assignment) => {
      const filingType = assignment.filing_types as unknown as FilingType;

      // Calculate deadline using calculator functions
      const calculatedDate = calculateDeadline(filingType.id, {
        year_end_date: client.year_end_date || undefined,
        vat_stagger_group: client.vat_stagger_group || undefined,
      });

      // Check for override
      const override = overrideMap.get(filingType.id);

      return {
        filing_type: filingType,
        is_active: assignment.is_active,
        calculated_deadline: calculatedDate ? calculatedDate.toISOString().split('T')[0] : null,
        override_deadline: override?.override_date || null,
        override_reason: override?.reason || null,
      };
    });

    return NextResponse.json({ filings });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error', details: message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/clients/[id]/filings
 * Upsert filing assignments (toggle is_active)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params;
    const body = await request.json();

    // Validate request body
    const validation = putFilingsSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { assignments } = validation.data;
    const supabase = await createClient();

    // Upsert assignments (insert on conflict update is_active)
    const assignmentsToUpsert = assignments.map((a) => ({
      client_id: clientId,
      filing_type_id: a.filing_type_id,
      is_active: a.is_active,
    }));

    const { data, error } = await supabase
      .from('client_filing_assignments')
      .upsert(assignmentsToUpsert, {
        onConflict: 'client_id,filing_type_id',
      })
      .select();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to update assignments', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ assignments: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error', details: message },
      { status: 500 }
    );
  }
}
