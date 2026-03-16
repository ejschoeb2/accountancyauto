import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/filing-types/[id]/document-settings
 * Returns the org-level document settings for a filing type.
 * Returns an array of { document_type_id, is_enabled }.
 * Missing rows mean the default (enabled) applies.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: filingTypeId } = await params
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = user.app_metadata?.org_id
    if (!orgId) {
      return NextResponse.json({ error: 'No organisation found' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('org_filing_document_settings')
      .select('document_type_id, is_enabled')
      .eq('org_id', orgId)
      .eq('filing_type_id', filingTypeId)

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
 * PUT /api/filing-types/[id]/document-settings
 * Saves org-level document settings for a filing type.
 * Body: { settings: Array<{ document_type_id: string; is_enabled: boolean }> }
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: filingTypeId } = await params
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = user.app_metadata?.org_id
    if (!orgId) {
      return NextResponse.json({ error: 'No organisation found' }, { status: 400 })
    }

    const body = await req.json()
    const settings: Array<{ document_type_id: string; is_enabled: boolean }> = body.settings ?? []

    // Upsert each setting
    for (const setting of settings) {
      const { error } = await supabase
        .from('org_filing_document_settings')
        .upsert(
          {
            org_id: orgId,
            filing_type_id: filingTypeId,
            document_type_id: setting.document_type_id,
            is_enabled: setting.is_enabled,
          },
          { onConflict: 'org_id,filing_type_id,document_type_id' }
        )

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
