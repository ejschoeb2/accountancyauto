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

  console.log('Applying migration: Create client_filing_status_overrides table...\n');

  try {
    // Create table
    await sql`
      CREATE TABLE IF NOT EXISTS client_filing_status_overrides (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        filing_type_id TEXT NOT NULL REFERENCES filing_types(id) ON DELETE CASCADE,
        override_status TEXT NOT NULL CHECK (override_status IN ('green', 'amber', 'red')),
        reason TEXT,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE(client_id, filing_type_id)
      )
    `;
    console.log('✓ Created client_filing_status_overrides table');

    // Create index
    await sql`
      CREATE INDEX IF NOT EXISTS idx_client_filing_status_overrides_client
        ON client_filing_status_overrides(client_id)
    `;
    console.log('✓ Created index on client_id');

    // Enable RLS
    await sql`ALTER TABLE client_filing_status_overrides ENABLE ROW LEVEL SECURITY`;
    console.log('✓ Enabled row level security');

    // Drop existing policies if they exist (idempotent)
    await sql`DROP POLICY IF EXISTS "Authenticated users can manage status overrides" ON client_filing_status_overrides`;
    await sql`DROP POLICY IF EXISTS "Service role full access to status overrides" ON client_filing_status_overrides`;
    console.log('✓ Dropped existing policies');

    // Create policies
    await sql`
      CREATE POLICY "Authenticated users can manage status overrides"
        ON client_filing_status_overrides FOR ALL TO authenticated
        USING (true) WITH CHECK (true)
    `;
    console.log('✓ Created policy for authenticated users');

    await sql`
      CREATE POLICY "Service role full access to status overrides"
        ON client_filing_status_overrides FOR ALL TO service_role
        USING (true) WITH CHECK (true)
    `;
    console.log('✓ Created policy for service role');

    console.log('\n✅ Migration applied successfully!');
    console.log('The client_filing_status_overrides table is now ready to use\n');

    await sql.end();
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err);
    await sql.end();
    process.exit(1);
  }
}

applyMigration();
