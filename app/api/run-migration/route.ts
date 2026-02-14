import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST() {
  const supabase = createAdminClient();

  const sql = `
    -- Add 'records_received' status to reminder_queue
    -- Drop the existing constraint
    ALTER TABLE reminder_queue DROP CONSTRAINT IF EXISTS reminder_queue_status_check;

    -- Add the new constraint with 'records_received' included
    ALTER TABLE reminder_queue ADD CONSTRAINT reminder_queue_status_check
      CHECK (status IN ('scheduled', 'pending', 'sent', 'cancelled', 'failed', 'records_received'));
  `;

  try {
    // Use raw SQL query
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      // Try direct query if RPC doesn't work
      const { error: directError } = await (supabase as any).from('_').select('*').sql(sql);

      if (directError) {
        return NextResponse.json({
          success: false,
          error: error.message,
          directError: directError.message
        }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, message: 'Migration applied successfully' });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error'
    }, { status: 500 });
  }
}
