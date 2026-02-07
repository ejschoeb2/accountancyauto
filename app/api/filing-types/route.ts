import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/filing-types
 * Fetch all filing types sorted by name
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('filing_types')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch filing types', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ filing_types: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error', details: message },
      { status: 500 }
    );
  }
}
