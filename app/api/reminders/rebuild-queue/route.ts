import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildReminderQueue } from '@/lib/reminders/queue-builder';

/**
 * POST /api/reminders/rebuild-queue
 * Triggers full queue rebuild from templates and deadlines
 * Useful for initial setup and debugging
 */
export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use admin client for queue operations (service-role needed)
    const adminClient = createAdminClient();
    const result = await buildReminderQueue(adminClient);

    return NextResponse.json({
      success: true,
      created: result.created,
      skipped: result.skipped,
    });
  } catch (error) {
    console.error('Failed to rebuild queue:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
