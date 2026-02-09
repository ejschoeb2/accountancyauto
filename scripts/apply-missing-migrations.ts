import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'fs';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkColumnExists(table: string, column: string): Promise<boolean> {
  const { data, error } = await supabase
    .from(table)
    .select(column)
    .limit(1);

  return !error || !error.message.includes('does not exist');
}

async function applyMigration(path: string, description: string) {
  console.log(`\n📝 Applying: ${description}`);

  const sql = readFileSync(path, 'utf-8');

  // Use raw SQL query
  const { error } = await supabase.rpc('exec_sql', { sql_string: sql }).single();

  if (error) {
    // Try alternative: split by semicolon and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      const { error: stmtError } = await supabase.rpc('exec_sql', { sql_string: statement });
      if (stmtError) {
        console.error(`   ❌ Error: ${stmtError.message}`);
        return false;
      }
    }
  }

  console.log('   ✅ Applied successfully');
  return true;
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  MIGRATION CHECK & APPLY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Check if schedule_type column exists
  console.log('🔍 Checking if schedule_type column exists...');

  const hasScheduleType = await checkColumnExists('schedules', 'schedule_type');

  if (hasScheduleType) {
    console.log('✅ schedule_type column already exists!');
    console.log('\n✨ All migrations are up to date.\n');
    return;
  }

  console.log('❌ schedule_type column is missing\n');
  console.log('This migration needs to be applied manually through Supabase Studio:');
  console.log('\n1. Go to https://supabase.com/dashboard');
  console.log('2. Select your project');
  console.log('3. Go to SQL Editor');
  console.log('4. Run the following SQL:\n');
  console.log('─'.repeat(60));

  const migrationPath = resolve(process.cwd(), 'supabase/migrations/20260209200000_add_custom_schedules.sql');
  const sql = readFileSync(migrationPath, 'utf-8');
  console.log(sql);
  console.log('─'.repeat(60));

  console.log('\n💡 Alternatively, you can:');
  console.log('   - Install Supabase CLI: npm install -g supabase');
  console.log('   - Link your project: supabase link');
  console.log('   - Push migrations: supabase db push\n');
}

main().catch(console.error);
