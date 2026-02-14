import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('Applying migration: Add records_received status to reminder_queue...\n');

  const sql = `
    -- Drop the existing constraint
    ALTER TABLE reminder_queue DROP CONSTRAINT IF EXISTS reminder_queue_status_check;

    -- Add the new constraint with 'records_received' included
    ALTER TABLE reminder_queue ADD CONSTRAINT reminder_queue_status_check
      CHECK (status IN ('scheduled', 'pending', 'sent', 'cancelled', 'failed', 'records_received'));
  `;

  try {
    // Execute raw SQL
    const { error } = await supabase.rpc('exec', { sql });

    if (error) {
      console.error('Error:', error);
      process.exit(1);
    }

    console.log('✓ Migration applied successfully!');
    console.log('✓ The "records_received" status is now valid for reminder_queue.status');
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

applyMigration();
