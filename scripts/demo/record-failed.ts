/**
 * Re-record only the 12 previously-failing demo scripts.
 *
 * Usage:
 *   npx tsx scripts/demo/record-failed.ts              # Record + upload
 *   npx tsx scripts/demo/record-failed.ts --no-upload   # Record only, skip Supabase upload
 *
 * Prerequisites:
 *   1. Dev server running: npm run dev
 *   2. DEMO_EMAIL + DEMO_PASSWORD in .env.local
 *   3. Seeded test data covering all features
 *   4. ffmpeg available on PATH
 */

import path from "path";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env.local") });

const args = process.argv.slice(2);
const skipUpload = args.includes("--no-upload");

// The 12 demos that were previously failing
const FAILED_IDS = [
  "add-client-manually",
  "mark-filing-complete",
  "mark-records-received",
  "override-deadline",
  "pause-resume-client",
  "delete-email-template",
  "configure-filing-types",
  "setup-custom-domain",
  "change-member-role",
  "remove-team-member",
  "configure-upload-checks",
  "client-portal-upload",
];

// ─── Supabase config ────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUCKET = "videos";

const ROOT = path.resolve(__dirname, "..", "..");
const OUT_DIR = path.join(ROOT, "out");

function getSupabase() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — skipping upload");
    return null;
  }
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
}

async function uploadToSupabase(localPath: string, storagePath: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  const buffer = fs.readFileSync(localPath);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: "video/mp4",
      upsert: true,
    });

  if (error) {
    console.error(`  ✗ Upload failed: ${error.message}`);
    return false;
  }
  console.log(`  ↑ Uploaded to Supabase: ${storagePath}`);
  return true;
}

async function ensureBucket() {
  const supabase = getSupabase();
  if (!supabase) return;

  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === BUCKET);
  if (!exists) {
    const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
    if (error) {
      console.error(`Failed to create bucket: ${error.message}`);
    } else {
      console.log(`✓ Created public bucket: ${BUCKET}`);
    }
  }
}

// ─── Main ───────────────────────────────────────────────────────────────

async function main() {
  if (!skipUpload) {
    await ensureBucket();
  }

  console.log(`\n━━━ Re-recording ${FAILED_IDS.length} previously-failing demos ━━━\n`);

  const results: { id: string; status: "ok" | "fail"; error?: string }[] = [];

  for (let i = 0; i < FAILED_IDS.length; i++) {
    const id = FAILED_IDS[i];
    console.log(`\n[${i + 1}/${FAILED_IDS.length}] ${id}`);

    try {
      const mod = await import(`./recordings/${id}`);
      if (!mod.default?.record) {
        console.log(`  ⏭ Skipped — no recording script found at recordings/${id}.ts`);
        results.push({ id, status: "fail", error: "no recording script" });
        continue;
      }

      const { startRecording, stopRecording } = await import("./helpers");
      const session = await startRecording();
      try {
        await mod.default.record(session);
        console.log("  ✓ Complete");
        results.push({ id, status: "ok" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  ✗ Failed: ${msg}`);
        results.push({ id, status: "fail", error: msg });
      } finally {
        await stopRecording(session, `demo-${id}.webm`);
      }

      // ── Upload to Supabase ──
      if (!skipUpload) {
        const mp4Path = path.join(OUT_DIR, `demo-${id}.mp4`);
        if (fs.existsSync(mp4Path)) {
          await uploadToSupabase(mp4Path, `tutorials/${id}.mp4`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ✗ Import error: ${msg}`);
      results.push({ id, status: "fail", error: msg });
    }
  }

  // Summary
  const ok = results.filter((r) => r.status === "ok").length;
  const failed = results.filter((r) => r.status === "fail").length;

  console.log(`\n━━━ Results ━━━`);
  console.log(`  ✓ Recorded: ${ok}`);
  console.log(`  ✗ Failed:   ${failed}`);

  if (failed > 0) {
    console.log(`\nStill failing:`);
    for (const r of results.filter((r) => r.status === "fail")) {
      console.log(`  - ${r.id}: ${r.error}`);
    }
  }

  if (!skipUpload) {
    console.log(`\nVideos available at: ${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/tutorials/`);
  }
}

main();
