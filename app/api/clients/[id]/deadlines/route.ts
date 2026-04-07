import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrgId } from '@/lib/auth/org-context';
import { rebuildQueueForClient } from '@/lib/reminders/queue-builder';
import { requireWriteAccess } from '@/lib/billing/read-only-mode';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const putDeadlineSchema = z.object({
  filing_type_id: z.string(),
  override_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  reason: z.string().optional(),
});

/**
 * PUT /api/clients/[id]/deadlines
 * Create or update a deadline override for a specific filing type.
 * Triggers reminder queue rebuild so queued emails reflect the new deadline.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params;
    const body = await request.json();

    const validation = putDeadlineSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { filing_type_id, override_date, reason } = validation.data;
    const supabase = await createClient();
    const orgId = await getOrgId();

    try {
      await requireWriteAccess(orgId);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Subscription inactive' },
        { status: 403 }
      );
    }

    // Verify client exists and belongs to this org
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    // Upsert the deadline override
    const { data: override, error: upsertError } = await supabase
      .from('client_deadline_overrides')
      .upsert(
        {
          org_id: orgId,
          client_id: clientId,
          filing_type_id,
          override_date,
          reason: reason || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'client_id,filing_type_id' }
      )
      .select()
      .single();

    if (upsertError) {
      return NextResponse.json(
        { error: 'Failed to save deadline override', details: upsertError.message },
        { status: 500 }
      );
    }

    // Rebuild reminder queue so queued emails reflect the new deadline
    try {
      const adminClient = createAdminClient();
      await rebuildQueueForClient(adminClient, clientId);
    } catch (rebuildErr) {
      logger.error('[deadlines route] Non-fatal: failed to rebuild reminder queue:', { error: (rebuildErr as any)?.message ?? String(rebuildErr) });
    }

    return NextResponse.json({ override });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error', details: message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/clients/[id]/deadlines?filing_type_id=...
 * Remove a deadline override, reverting to the calculated deadline.
 * Triggers reminder queue rebuild so queued emails reflect the original deadline.
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
        { error: 'filing_type_id query parameter is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const orgId = await getOrgId();

    try {
      await requireWriteAccess(orgId);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Subscription inactive' },
        { status: 403 }
      );
    }

    // Delete the override
    const { error: deleteError } = await supabase
      .from('client_deadline_overrides')
      .delete()
      .eq('client_id', clientId)
      .eq('filing_type_id', filingTypeId);

    if (deleteError) {
      return NextResponse.json(
        { error: 'Failed to remove deadline override', details: deleteError.message },
        { status: 500 }
      );
    }

    // Rebuild reminder queue so queued emails revert to calculated deadlines
    try {
      const adminClient = createAdminClient();
      await rebuildQueueForClient(adminClient, clientId);
    } catch (rebuildErr) {
      logger.error('[deadlines route] Non-fatal: failed to rebuild reminder queue:', { error: (rebuildErr as any)?.message ?? String(rebuildErr) });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error', details: message },
      { status: 500 }
    );
  }
}
