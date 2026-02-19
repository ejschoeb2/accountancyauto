import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildReminderQueue } from '@/lib/reminders/queue-builder';

/**
 * POST /api/reminders/rebuild-queue
 * Triggers full queue rebuild from templates and deadlines
 * Useful for initial setup and debugging
 * Org-scoped: rebuilds queue for the user's organisation only
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

    // Resolve the user's org from user_organisations
    // PostgREST FK workaround: fetch org separately to avoid join cache issues
    const { data: userOrg, error: orgError } = await adminClient
      .from('user_organisations')
      .select('org_id')
      .eq('user_id', user.id)
      .single();

    if (orgError || !userOrg) {
      return NextResponse.json({ error: 'No organisation found for user' }, { status: 403 });
    }

    const { data: orgData, error: orgFetchError } = await adminClient
      .from('organisations')
      .select('id, name')
      .eq('id', userOrg.org_id)
      .single();

    if (orgFetchError || !orgData) {
      return NextResponse.json({ error: 'Organisation not found' }, { status: 403 });
    }

    const org = orgData;
    const result = await buildReminderQueue(adminClient, org);

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
