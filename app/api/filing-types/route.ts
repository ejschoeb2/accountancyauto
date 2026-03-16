import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/filing-types
 * Fetch all filing types sorted by name
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const [{ data: filingTypes, error }, { data: requirements }] = await Promise.all([
      supabase.from('filing_types').select('*').order('name', { ascending: true }),
      supabase
        .from('filing_document_requirements')
        .select('filing_type_id, is_mandatory, document_types(id, label)')
    ]);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch filing types', details: error.message },
        { status: 500 }
      );
    }

    // Group document requirements by filing_type_id
    const reqsByFilingType: Record<string, { document_type_id: string; label: string; is_mandatory: boolean }[]> = {};
    for (const req of requirements ?? []) {
      const ft = req.filing_type_id as string;
      if (!reqsByFilingType[ft]) reqsByFilingType[ft] = [];
      const dt = req.document_types as unknown as { id: string; label: string } | null;
      if (dt) {
        reqsByFilingType[ft].push({ document_type_id: dt.id, label: dt.label, is_mandatory: req.is_mandatory });
      }
    }

    const result = (filingTypes ?? []).map(ft => ({
      ...ft,
      document_requirements: reqsByFilingType[ft.id] ?? [],
    }));

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error', details: message },
      { status: 500 }
    );
  }
}
