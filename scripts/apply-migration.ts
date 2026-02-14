import { createAdminClient } from '@/lib/supabase/admin';
import fs from 'fs';
import path from 'path';

async function applyMigration() {
  const supabase = createAdminClient();

  // Read the migration file
  const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '20260214000001_add_records_received_status.sql');
  const sql = fs.readFileSync(migrationPath, 'utf-8');

  console.log('Applying migration: add_records_received_status');
  console.log('SQL:', sql);

  try {
    // Execute the SQL
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.error('Migration failed:', error);
      process.exit(1);
    }

    console.log('Migration applied successfully!');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

applyMigration();
