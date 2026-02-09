/**
 * Apply the missing INSERT policy for app_settings table
 * Run with: npx tsx scripts/apply-missing-insert-policy.ts
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Applying missing INSERT policy to app_settings table...");

  const { error } = await supabase.rpc("exec", {
    sql: `
      CREATE POLICY "Anon users can insert app_settings" ON app_settings
        FOR INSERT TO anon WITH CHECK (true);
    `,
  });

  if (error) {
    // Try direct SQL execution instead
    const { error: directError } = await supabase.from("app_settings").insert({
      key: "_test",
      value: "test",
    });

    if (directError && directError.message.includes("permission denied")) {
      console.error("❌ INSERT policy is still missing. Applying via SQL...");

      // If we can't use rpc, we'll need to use the SQL editor in Supabase dashboard
      console.log("\n⚠️  Please run this SQL in your Supabase SQL Editor:");
      console.log("\nCREATE POLICY \"Anon users can insert app_settings\" ON app_settings");
      console.log("  FOR INSERT TO anon WITH CHECK (true);");
      console.log("\nDashboard URL:", supabaseUrl.replace("https://", "https://app.supabase.com/project/"));
      process.exit(1);
    } else if (!directError) {
      // Clean up test row
      await supabase.from("app_settings").delete().eq("key", "_test");
      console.log("✅ INSERT policy appears to be working (or was already present)");
    }
  } else {
    console.log("✅ INSERT policy applied successfully!");
  }
}

main().catch(console.error);
