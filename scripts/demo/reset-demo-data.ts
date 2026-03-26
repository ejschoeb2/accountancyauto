/**
 * Reset demo data — wipes ALL data for the demo org so seed can start fresh.
 *
 * Deletes in dependency order (children first, then parents).
 * Does NOT delete the demo user or organisation — just their data.
 *
 * Usage: npx tsx scripts/demo/reset-demo-data.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DEMO_EMAIL = process.env.DEMO_EMAIL || "test@example.com";

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function reset() {
  console.log("=== Resetting Demo Data ===\n");

  // ── Find demo user and org ──
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const demoUser = existingUsers?.users?.find((u) => u.email === DEMO_EMAIL);
  if (!demoUser) {
    console.error(`Demo user ${DEMO_EMAIL} not found. Nothing to reset.`);
    process.exit(1);
  }
  const userId = demoUser.id;
  console.log(`Found demo user: ${DEMO_EMAIL} (${userId})`);

  // Find the demo org by slug (the seed creates "thornton-associates")
  const DEMO_ORG_SLUG = "thornton-associates";
  const { data: org } = await supabase
    .from("organisations")
    .select("id, name")
    .eq("slug", DEMO_ORG_SLUG)
    .maybeSingle();

  if (!org) {
    console.error(`Demo org "${DEMO_ORG_SLUG}" not found. Nothing to reset.`);
    process.exit(1);
  }
  const orgId = org.id;
  console.log(`Found organisation: ${org.name} (${orgId})\n`);

  // ── Delete in dependency order ──
  const tables = [
    // Deepest children first
    "upload_portal_tokens",
    "client_documents",
    "document_access_log",
    "client_deadline_overrides",
    "client_filing_assignments",
    "reminder_queue",
    "email_log",
    "schedule_steps",
    "schedules",
    "email_templates",
    "app_settings",
    "org_filing_type_selections",
    "audit_log",
    // Clients last (parent of many above)
    "clients",
  ];

  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .delete({ count: "exact" })
        .eq("org_id", orgId);

      if (error) {
        // Some tables might not have org_id or might have FK constraints
        console.log(`  ⚠ ${table}: ${error.message}`);
      } else {
        console.log(`  ✓ ${table}: deleted ${count ?? 0} rows`);
      }
    } catch (err) {
      console.log(`  ⚠ ${table}: ${err instanceof Error ? err.message : err}`);
    }
  }

  // ── Delete team member users (not the demo user) ──
  console.log("\nRemoving team member users...");
  const { data: teamLinks } = await supabase
    .from("user_organisations")
    .select("user_id")
    .eq("org_id", orgId)
    .neq("user_id", userId);

  if (teamLinks && teamLinks.length > 0) {
    for (const link of teamLinks) {
      // Remove org link
      await supabase
        .from("user_organisations")
        .delete()
        .eq("user_id", link.user_id)
        .eq("org_id", orgId);

      // Delete the auth user
      const { error } = await supabase.auth.admin.deleteUser(link.user_id);
      if (error) {
        console.log(`  ⚠ Could not delete user ${link.user_id}: ${error.message}`);
      } else {
        console.log(`  ✓ Deleted team member: ${link.user_id}`);
      }
    }
  } else {
    console.log("  No team members to remove.");
  }

  console.log("\n=== Reset Complete ===");
  console.log("Run 'npx tsx scripts/demo/seed-demo-data.ts' to re-seed.");
}

reset().catch((err) => {
  console.error("Fatal error during reset:", err);
  process.exit(1);
});
