/**
 * Admin utility: delete a user and their Postmark server/domain.
 *
 * Usage:
 *   npx tsx scripts/delete-user.ts user@example.com
 *
 * What it does (in order):
 *   1. Looks up the user by email in Supabase Auth
 *   2. Finds their org via user_organisations
 *   3. Deletes their Postmark domain (if one was created)
 *   4. Deletes their Postmark server (if one was created)
 *   5. Deletes the Supabase Auth user (cascades to user_organisations)
 *
 * The organisations row is left in place. If you want it gone too,
 * uncomment the org deletion block at the bottom.
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

const POSTMARK_API = "https://api.postmarkapp.com";

// ── Args ─────────────────────────────────────────────────────────────────────

const email = process.argv[2]?.trim();
if (!email) {
  console.error("Usage: npx tsx scripts/delete-user.ts <email>");
  process.exit(1);
}

// ── Supabase admin client ─────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ── Postmark helpers ─────────────────────────────────────────────────────────

const postmarkHeaders = {
  Accept: "application/json",
  "X-Postmark-Account-Token": process.env.POSTMARK_ACCOUNT_TOKEN ?? "",
};

async function deletePostmarkDomain(domainId: number): Promise<void> {
  const res = await fetch(`${POSTMARK_API}/domains/${domainId}`, {
    method: "DELETE",
    headers: postmarkHeaders,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Postmark DELETE /domains/${domainId} failed (${res.status}): ${body}`);
  }
  console.log(`  ✓ Postmark domain ${domainId} deleted`);
}

async function deletePostmarkServer(serverId: number): Promise<void> {
  const res = await fetch(`${POSTMARK_API}/servers/${serverId}`, {
    method: "DELETE",
    headers: postmarkHeaders,
  });
  if (!res.ok) {
    const body = await res.text();
    const parsed = JSON.parse(body).ErrorCode;
    if (parsed === 604) {
      // Postmark account does not allow API-based server deletion.
      // Delete manually: Postmark dashboard → Servers → (server name) → Delete
      console.warn(`  ⚠️  Postmark server ${serverId} must be deleted manually from the Postmark dashboard (API deletion not permitted on this account).`);
      return;
    }
    throw new Error(`Postmark DELETE /servers/${serverId} failed (${res.status}): ${body}`);
  }
  console.log(`  ✓ Postmark server ${serverId} deleted`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log(`\nDeleting user: ${email}\n`);

  // 1. Find user in Supabase Auth by email
  const { data: listData, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) throw new Error(`Failed to list users: ${listError.message}`);

  const user = listData.users.find((u) => u.email === email);
  if (!user) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }
  console.log(`  Found user: ${user.id}`);

  // 2. Find their org
  const { data: membership } = await supabase
    .from("user_organisations")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership?.org_id) {
    console.log("  No org found — skipping Postmark cleanup.");
  } else {
    const orgId = membership.org_id;
    console.log(`  Found org: ${orgId}`);

    const { data: org } = await supabase
      .from("organisations")
      .select("postmark_server_id, postmark_domain_id")
      .eq("id", orgId)
      .single();

    // 3. Delete Postmark domain
    if (org?.postmark_domain_id) {
      console.log(`  Deleting Postmark domain ${org.postmark_domain_id}...`);
      await deletePostmarkDomain(org.postmark_domain_id);
    } else {
      console.log("  No Postmark domain to delete.");
    }

    // 4. Delete Postmark server
    if (org?.postmark_server_id) {
      console.log(`  Deleting Postmark server ${org.postmark_server_id}...`);
      await deletePostmarkServer(org.postmark_server_id);
    } else {
      console.log("  No Postmark server to delete.");
    }

    // Uncomment to also delete the org row and all its data:
    // console.log("  Deleting org row...");
    // await supabase.from("organisations").delete().eq("id", orgId);
    // console.log("  ✓ Org deleted");
  }

  // 5. Delete the Supabase Auth user (cascades to user_organisations)
  console.log("  Deleting Supabase auth user...");
  const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
  if (deleteError) throw new Error(`Failed to delete auth user: ${deleteError.message}`);
  console.log(`  ✓ Auth user deleted`);

  console.log("\nDone.\n");
}

run().catch((err) => {
  console.error("\nError:", err.message);
  process.exit(1);
});
