// Script to apply migration via Supabase
// Note: This requires the exec_sql function to be enabled in Supabase
// If not available, apply the migration manually through the Supabase SQL Editor

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function applyMigration() {
  const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', 'create_phase1_schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  console.log('Applying migration...');

  // Try to execute via exec_sql RPC if available
  const { error } = await supabase.rpc('exec_sql', { sql });

  if (error) {
    console.log('Note: exec_sql function not available or error occurred.');
    console.log('Please apply the migration manually through the Supabase SQL Editor:');
    console.log(`  1. Go to ${supabaseUrl.replace('.co', '.co/project')}/database/sql`);
    console.log(`  2. Copy and paste the contents of ${sqlPath}`);
    console.log(`  3. Run the SQL`);
    console.log('\nMigration file location:', sqlPath);
    process.exit(0);
  }

  console.log('Migration applied successfully!');
}

applyMigration().catch(console.error);
