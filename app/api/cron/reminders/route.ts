import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { processReminders } from '@/lib/reminders/scheduler';

// Allow 5 minutes for cron execution (Vercel Pro limit)
export const maxDuration = 300;

/**
 * GET /api/cron/reminders
 * Daily cron job to process reminders
 * Runs at 8am and 9am UTC (covers both GMT and BST for 9am UK time)
 * Validates CRON_SECRET header for security
 */
export async function GET(request: NextRequest) {
  try {
    // Verify CRON_SECRET
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

    if (authHeader !== expectedAuth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use admin client for service-role access
    const adminClient = createAdminClient();
    const result = await processReminders(adminClient);

    return NextResponse.json({
      success: true,
      queued: result.queued,
      rolled_over: result.rolled_over,
      errors: result.errors,
      skipped_wrong_hour: result.skipped_wrong_hour,
    });
  } catch (error) {
    console.error('Cron job failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
