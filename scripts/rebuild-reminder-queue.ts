import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { buildReminderQueue } from '../lib/reminders/queue-builder';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  REMINDER QUEUE CHECK & REBUILD');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Check current state of reminder_queue
  console.log('1️⃣  Checking current reminder_queue state...\n');

  const { data: existingReminders, error: checkError } = await supabase
    .from('reminder_queue')
    .select('id, client_id, filing_type_id, status, deadline_date')
    .order('deadline_date', { ascending: true });

  if (checkError) {
    console.error('❌ Error checking reminder_queue:', checkError);
    process.exit(1);
  }

  if (existingReminders && existingReminders.length > 0) {
    console.log(`📋 Found ${existingReminders.length} existing reminders in queue:\n`);

    // Group by status
    const byStatus = existingReminders.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(byStatus).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });
    console.log('');
  } else {
    console.log('📭 Reminder queue is currently empty\n');
  }

  // Check prerequisites
  console.log('2️⃣  Checking prerequisites...\n');

  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, company_name, year_end_date, vat_stagger_group')
    .limit(5);

  if (clientsError) {
    console.error('❌ Error fetching clients:', clientsError);
    process.exit(1);
  }

  console.log(`   ✅ Clients table: ${clients?.length || 0} clients found`);

  const { data: schedules, error: schedulesError } = await supabase
    .from('schedules')
    .select('id, name, filing_type_id')
    .eq('is_active', true);

  if (schedulesError) {
    console.error('❌ Error fetching schedules:', schedulesError);
    process.exit(1);
  }

  console.log(`   ✅ Schedules: ${schedules?.length || 0} active schedules found`);

  if (schedules && schedules.length > 0) {
    schedules.forEach(s => {
      console.log(`      • ${s.name} (${s.filing_type_id})`);
    });
  }

  const { data: assignments, error: assignmentsError } = await supabase
    .from('client_filing_assignments')
    .select('id')
    .eq('is_active', true);

  if (assignmentsError) {
    console.error('❌ Error fetching assignments:', assignmentsError);
    process.exit(1);
  }

  console.log(`   ✅ Filing assignments: ${assignments?.length || 0} active assignments found\n`);

  if (!schedules || schedules.length === 0) {
    console.log('⚠️  WARNING: No active schedules found!');
    console.log('   Run: npm run seed:schedules\n');
  }

  if (!assignments || assignments.length === 0) {
    console.log('⚠️  WARNING: No active filing assignments found!');
    console.log('   Clients need filing assignments before reminders can be built.\n');
  }

  // Rebuild queue
  console.log('3️⃣  Rebuilding reminder queue...\n');

  try {
    const result = await buildReminderQueue(supabase);

    console.log('✅ Queue rebuild complete!\n');
    console.log(`   📝 Created: ${result.created} new reminders`);
    console.log(`   ⏭️  Skipped: ${result.skipped} reminders (already exist or criteria not met)\n`);

    // Check final state
    const { data: finalReminders, error: finalError } = await supabase
      .from('reminder_queue')
      .select('id, status')
      .order('deadline_date', { ascending: true });

    if (!finalError && finalReminders) {
      console.log(`📊 Final queue state: ${finalReminders.length} total reminders\n`);

      const finalByStatus = finalReminders.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      Object.entries(finalByStatus).forEach(([status, count]) => {
        console.log(`   ${status}: ${count}`);
      });
    }

  } catch (error) {
    console.error('❌ Error rebuilding queue:', error);
    process.exit(1);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✨ Done!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(console.error);
