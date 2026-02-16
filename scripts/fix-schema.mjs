import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

async function checkAndFixSchema() {
  console.log("Checking clients table schema...\n");

  // Check if columns exist
  const { data: columns, error: checkError } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'clients'
      AND column_name IN ('completed_for', 'records_received_for')
      ORDER BY column_name;
    `
  });

  if (checkError) {
    console.error("Error checking schema:", checkError.message);
    console.log("\nTrying direct query instead...");

    // Try direct approach
    const { data, error } = await supabase
      .from('clients')
      .select('completed_for, records_received_for')
      .limit(1);

    if (error && error.message.includes('completed_for')) {
      console.log("✗ completed_for column is MISSING");
      console.log("\nApplying migration...\n");
      await applyMigration();
    } else if (error) {
      console.error("Error:", error.message);
    } else {
      console.log("✓ Both columns exist!");
      console.log("\nReloading PostgREST schema cache...");
      await reloadSchema();
    }
    return;
  }

  console.log("Current columns:", columns);

  if (!columns || columns.length === 0) {
    console.log("Columns not found in schema, applying migration...");
    await applyMigration();
  } else {
    console.log("Columns exist, reloading schema cache...");
    await reloadSchema();
  }
}

async function applyMigration() {
  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      ALTER TABLE clients ADD COLUMN IF NOT EXISTS completed_for JSONB DEFAULT '[]';
      COMMENT ON COLUMN clients.completed_for IS 'Array of filing_type_id strings for which the accountant has completed processing.';
    `
  });

  if (error) {
    console.error("Migration failed:", error.message);
    console.log("\n⚠️ You may need to run this SQL manually in Supabase dashboard:");
    console.log("\nALTER TABLE clients ADD COLUMN IF NOT EXISTS completed_for JSONB DEFAULT '[]';");
  } else {
    console.log("✓ Migration applied successfully!");
    await reloadSchema();
  }
}

async function reloadSchema() {
  const { error } = await supabase.rpc('exec_sql', {
    sql: "NOTIFY pgrst, 'reload schema';"
  });

  if (error) {
    console.error("Failed to reload schema:", error.message);
    console.log("\n⚠️ Run this in Supabase SQL Editor: NOTIFY pgrst, 'reload schema';");
  } else {
    console.log("✓ PostgREST schema cache reloaded!");
  }
}

checkAndFixSchema().catch(console.error);
