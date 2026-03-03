/**
 * Admin utility: delete orphaned Postmark servers and clean up DB state.
 *
 * Usage:
 *   npx tsx scripts/cleanup-postmark-servers.ts [--dry-run]
 *
 * What it does:
 *   1. Lists all servers in the Postmark account
 *   2. Deletes servers whose names match the TARGET_SERVER_NAMES list
 *   3. Deletes the Postmark domain for servers that have one recorded in the DB
 *   4. Clears postmark_server_id / postmark_server_token / postmark_sender_domain /
 *      postmark_domain_id on the corresponding DB org rows
 *
 * Run with --dry-run first to preview what would be deleted without making changes.
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

const DRY_RUN = process.argv.includes("--dry-run");
const POSTMARK_API = "https://api.postmarkapp.com";

// ── Target server names to delete ────────────────────────────────────────────

const TARGET_SERVER_NAMES = [
  "ace (ace)",
  "Peninsula Accounting (peninsula-accounting)",
  "Peninsula Accounting Ltd (peninsula-accounting-ltd)",
];

// ── Supabase admin client ─────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ── Postmark helpers ──────────────────────────────────────────────────────────

const postmarkHeaders = {
  Accept: "application/json",
  "Content-Type": "application/json",
  "X-Postmark-Account-Token": process.env.POSTMARK_ACCOUNT_TOKEN ?? "",
};

async function listPostmarkServers(): Promise<{ ID: number; Name: string }[]> {
  const res = await fetch(`${POSTMARK_API}/servers?count=500&offset=0`, {
    headers: postmarkHeaders,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Postmark GET /servers failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  return data.Servers ?? [];
}

async function deletePostmarkServer(serverId: number, name: string): Promise<void> {
  if (DRY_RUN) {
    console.log(`  [dry-run] Would delete Postmark server ${serverId} (${name})`);
    return;
  }
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
      console.warn(`  ⚠️  Server ${serverId} (${name}) must be deleted manually from the Postmark dashboard (API deletion not permitted on this account).`);
      return;
    }
    throw new Error(`Postmark DELETE /servers/${serverId} failed (${res.status}): ${body}`);
  }
  console.log(`  ✓ Deleted Postmark server ${serverId} (${name})`);
}

async function deletePostmarkDomain(domainId: number): Promise<void> {
  if (DRY_RUN) {
    console.log(`  [dry-run] Would delete Postmark domain ${domainId}`);
    return;
  }
  const res = await fetch(`${POSTMARK_API}/domains/${domainId}`, {
    method: "DELETE",
    headers: postmarkHeaders,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Postmark DELETE /domains/${domainId} failed (${res.status}): ${body}`);
  }
  console.log(`  ✓ Deleted Postmark domain ${domainId}`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  if (DRY_RUN) {
    console.log("\n⚠️  DRY RUN — no changes will be made.\n");
  } else {
    console.log("\n🗑️  Cleaning up orphaned Postmark servers...\n");
  }

  // 1. List all servers in the account
  console.log("Fetching Postmark server list...");
  const servers = await listPostmarkServers();
  console.log(`  Found ${servers.length} server(s) in account.\n`);

  // 2. Find servers matching our target names
  const targets = servers.filter((s) => TARGET_SERVER_NAMES.includes(s.Name));

  if (targets.length === 0) {
    console.log("No matching servers found — nothing to delete.");
    return;
  }

  const notFound = TARGET_SERVER_NAMES.filter(
    (name) => !targets.find((s) => s.Name === name)
  );
  if (notFound.length > 0) {
    console.log(`  Note: these target names were not found in Postmark (already deleted?):`);
    notFound.forEach((n) => console.log(`    - ${n}`));
    console.log();
  }

  // 3. For each target server, look up the DB org and clean up
  for (const server of targets) {
    console.log(`Processing: ${server.Name} (server ID: ${server.ID})`);

    // Slug is the part in parentheses: "ace (ace)" → "ace"
    const slugMatch = server.Name.match(/\(([^)]+)\)$/);
    const slug = slugMatch?.[1];

    if (slug) {
      const { data: org } = await supabase
        .from("organisations")
        .select("id, name, slug, postmark_server_id, postmark_domain_id")
        .eq("slug", slug)
        .maybeSingle();

      if (org) {
        console.log(`  Found DB org: ${org.name} (${org.id})`);

        // Delete Postmark domain if one is recorded
        if (org.postmark_domain_id) {
          console.log(`  Deleting Postmark domain ${org.postmark_domain_id}...`);
          await deletePostmarkDomain(org.postmark_domain_id);
        }

        // Clear Postmark fields in DB
        if (DRY_RUN) {
          console.log(`  [dry-run] Would clear Postmark fields on org ${org.id}`);
        } else {
          const { error } = await supabase
            .from("organisations")
            .update({
              postmark_server_id: null,
              postmark_server_token: null,
              postmark_sender_domain: null,
              postmark_domain_id: null,
            })
            .eq("id", org.id);

          if (error) {
            console.error(`  ✗ Failed to clear DB fields: ${error.message}`);
          } else {
            console.log(`  ✓ Cleared Postmark fields on org ${org.id}`);
          }
        }
      } else {
        console.log(`  No DB org found for slug "${slug}" — server is orphaned in Postmark.`);
      }
    }

    // Delete the Postmark server
    await deletePostmarkServer(server.ID, server.Name);
    console.log();
  }

  console.log(DRY_RUN ? "\nDry run complete.\n" : "\nDone.\n");
}

run().catch((err) => {
  console.error("\nError:", err.message);
  process.exit(1);
});
