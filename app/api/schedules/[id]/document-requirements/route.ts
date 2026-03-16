import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/schedules/[id]/document-requirements
 * Returns document requirements for a custom schedule.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: scheduleId } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('schedule_document_requirements')
      .select('document_type_id, is_mandatory')
      .eq('schedule_id', scheduleId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * PUT /api/schedules/[id]/document-requirements
 * Replaces all document requirements for a custom schedule.
 * Body: { requirements: Array<{ document_type_id: string; is_mandatory: boolean }> }
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: scheduleId } = await params
    const supabase = await createClient()
    const body = await req.json()
    const requirements: Array<{ document_type_id: string; is_mandatory: boolean }> = body.requirements ?? []

    // Delete existing requirements
    const { error: deleteError } = await supabase
      .from('schedule_document_requirements')
      .delete()
      .eq('schedule_id', scheduleId)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    // Insert new requirements
    if (requirements.length > 0) {
      const rows = requirements.map(r => ({
        schedule_id: scheduleId,
        document_type_id: r.document_type_id,
        is_mandatory: r.is_mandatory,
      }))

      const { error: insertError } = await supabase
        .from('schedule_document_requirements')
        .insert(rows)

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
