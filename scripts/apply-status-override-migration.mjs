import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local
dotenv.config({ path: path.join(path.dirname(__dirname), '.env.local') });

// Get Supabase credentials from environment
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  // Read the migration file
  const migrationPath = path.join(path.dirname(__dirname), 'supabase', 'migrations', '20260214160000_add_client_filing_status_overrides.sql');
  const sql = fs.readFileSync(migrationPath, 'utf-8');

  console.log('Applying migration: add_client_filing_status_overrides');
  console.log('SQL:', sql);

  try {
    // Split the SQL into individual statements and execute each one
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.trim()) {
        console.log('\nExecuting statement:', statement.substring(0, 100) + '...');
        const { error } = await supabase.rpc('exec_sql', { sql_query: statement + ';' });

        if (error) {
          console.error('Statement failed:', error);
          // Continue with other statements
        } else {
          console.log('Statement executed successfully');
        }
      }
    }

    console.log('\nMigration completed!');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

applyMigration();
