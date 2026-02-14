import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env.local') });

const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!databaseUrl) {
  console.error('Missing DATABASE_URL environment variable!');
  console.error('Please add DATABASE_URL to your .env.local file');
  process.exit(1);
}

async function applyMigration() {
  const sql = postgres(databaseUrl);

  console.log('Applying migration: Add records_received status to reminder_queue...\n');

  try {
    // Drop the existing constraint
    await sql`ALTER TABLE reminder_queue DROP CONSTRAINT IF EXISTS reminder_queue_status_check`;
    console.log('✓ Dropped existing constraint');

    // Add the new constraint
    await sql`
      ALTER TABLE reminder_queue ADD CONSTRAINT reminder_queue_status_check
        CHECK (status IN ('scheduled', 'pending', 'sent', 'cancelled', 'failed', 'records_received'))
    `;
    console.log('✓ Added new constraint with records_received status');

    console.log('\n✅ Migration applied successfully!');
    console.log('The "records_received" status is now valid for reminder_queue.status\n');

    await sql.end();
  } catch (err) {
    console.error('❌ Error:', err.message);
    await sql.end();
    process.exit(1);
  }
}

applyMigration();
