import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// Validation schema for PUT body
const putDeadlineSchema = z.object({
  filing_type_id: z.string(),
  override_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
  reason: z.string().optional(),
});

/**
 * GET /api/clients/[id]/deadlines
 * Fetch all deadline overrides for this client
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('client_deadline_overrides')
      .select('*')
      .eq('client_id', clientId);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch deadline overrides', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ overrides: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error', details: message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/clients/[id]/deadlines
 * Upsert a deadline override for a specific filing type
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params;
    const body = await request.json();

    // Validate request body
    const validation = putDeadlineSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { filing_type_id, override_date, reason } = validation.data;
    const supabase = await createClient();

    // Upsert override (UNIQUE on client_id + filing_type_id)
    const { data, error } = await supabase
      .from('client_deadline_overrides')
      .upsert(
        {
          client_id: clientId,
          filing_type_id,
          override_date,
          reason: reason || null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'client_id,filing_type_id',
        }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to save deadline override', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ override: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error', details: message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/clients/[id]/deadlines?filing_type_id=xxx
 * Remove a deadline override
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params;
    const { searchParams } = new URL(request.url);
    const filingTypeId = searchParams.get('filing_type_id');

    if (!filingTypeId) {
      return NextResponse.json(
        { error: 'filing_type_id query parameter required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from('client_deadline_overrides')
      .delete()
      .eq('client_id', clientId)
      .eq('filing_type_id', filingTypeId);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to delete deadline override', details: error.message },
        { status: 500 }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error', details: message },
      { status: 500 }
    );
  }
}
