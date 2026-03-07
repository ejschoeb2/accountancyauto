import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrgId } from '@/lib/auth/org-context';
import { requireWriteAccess } from '@/lib/billing/read-only-mode';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { updates } = body;

    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json(
        { error: 'Invalid request: updates array required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const orgId = await getOrgId();
    try {
      await requireWriteAccess(orgId);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Subscription inactive" },
        { status: 403 }
      );
    }

    // Update each reminder's status and/or send_date
    const updatePromises = updates.map(async ({ id, status, send_date }: { id: string; status?: string; send_date?: string }) => {
      const updateData: { status?: string; send_date?: string } = {};

      if (status !== undefined) {
        updateData.status = status;
      }

      if (send_date !== undefined) {
        updateData.send_date = send_date;
      }

      const { error } = await supabase
        .from('reminder_queue')
        .update(updateData)
        .eq('id', id);

      if (error) {
        console.error(`Error updating reminder ${id}:`, error);
        throw error;
      }
    });

    await Promise.all(updatePromises);

    return NextResponse.json({
      success: true,
      message: `Updated ${updates.length} reminder(s)`,
    });
  } catch (error) {
    console.error('Error updating reminder statuses:', error);
    return NextResponse.json(
      { error: 'Failed to update reminder statuses' },
      { status: 500 }
    );
  }
}
