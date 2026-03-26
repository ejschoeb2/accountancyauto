/**
 * Batch runner — records all demo videos sequentially, then uploads to Supabase.
 *
 * Usage:
 *   npx tsx scripts/demo/record-all.ts              # Record all demos
 *   npx tsx scripts/demo/record-all.ts --safe        # Skip demos with side effects
 *   npx tsx scripts/demo/record-all.ts --only email  # Only record demos matching "email"
 *   npx tsx scripts/demo/record-all.ts --category Clients  # Only a specific category
 *   npx tsx scripts/demo/record-all.ts --list        # Just print the manifest, don't record
 *   npx tsx scripts/demo/record-all.ts --clean       # Delete old videos (local + Supabase) before recording
 *   npx tsx scripts/demo/record-all.ts --no-upload   # Skip Supabase upload after recording
 *   npx tsx scripts/demo/record-all.ts --from 34     # Start recording from the 34th demo (1-indexed)
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
import { demos, getCategories, type DemoEntry } from "./manifest";

dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env.local") });

const args = process.argv.slice(2);
const safeOnly = args.includes("--safe");
const listOnly = args.includes("--list");
const cleanFirst = args.includes("--clean");
const skipUpload = args.includes("--no-upload");

const onlyIdx = args.indexOf("--only");
const onlyFilter = onlyIdx !== -1 ? args[onlyIdx + 1]?.toLowerCase() : null;

const catIdx = args.indexOf("--category");
const catFilter = catIdx !== -1 ? args[catIdx + 1] : null;

const fromIdx = args.indexOf("--from");
const fromNumber = fromIdx !== -1 ? parseInt(args[fromIdx + 1], 10) : 1;

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

function matchesFilter(demo: DemoEntry): boolean {
  if (safeOnly && demo.hasSideEffects) return false;
  if (catFilter && demo.category !== catFilter) return false;
  if (onlyFilter) {
    const haystack = `${demo.id} ${demo.title} ${demo.tags.join(" ")}`.toLowerCase();
    return haystack.includes(onlyFilter);
  }
  return true;
}

// ─── Clean old videos ───────────────────────────────────────────────────

async function cleanLocalVideos() {
  console.log("\n🧹 Cleaning local video files...");
  let count = 0;

  // Clean out/ directory (demo-*.mp4 and demo-*.webm)
  if (fs.existsSync(OUT_DIR)) {
    for (const file of fs.readdirSync(OUT_DIR)) {
      if (file.startsWith("demo-") && (file.endsWith(".mp4") || file.endsWith(".webm"))) {
        fs.unlinkSync(path.join(OUT_DIR, file));
        count++;
      }
    }
  }

  // Clean public/tutorials/ directory
  const tutorialsDir = path.join(ROOT, "public", "tutorials");
  if (fs.existsSync(tutorialsDir)) {
    for (const file of fs.readdirSync(tutorialsDir)) {
      if (file.endsWith(".mp4")) {
        fs.unlinkSync(path.join(tutorialsDir, file));
        count++;
      }
    }
  }

  console.log(`  Deleted ${count} local video files`);
}

async function cleanSupabaseVideos() {
  const supabase = getSupabase();
  if (!supabase) return;

  console.log("\n🧹 Cleaning Supabase storage videos...");

  // List and delete all files in tutorials/ folder
  const { data: files, error } = await supabase.storage.from(BUCKET).list("tutorials", { limit: 500 });
  if (error) {
    console.error(`  Failed to list Supabase files: ${error.message}`);
    return;
  }

  if (!files || files.length === 0) {
    console.log("  No files found in Supabase tutorials/ folder");
    return;
  }

  const paths = files.map((f) => `tutorials/${f.name}`);
  const { error: deleteError } = await supabase.storage.from(BUCKET).remove(paths);
  if (deleteError) {
    console.error(`  Failed to delete Supabase files: ${deleteError.message}`);
  } else {
    console.log(`  Deleted ${paths.length} files from Supabase tutorials/`);
  }
}

// ─── Upload to Supabase ─────────────────────────────────────────────────

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
  const filtered = demos.filter(matchesFilter);

  if (listOnly) {
    console.log(`\n📋 Demo manifest — ${filtered.length} videos\n`);
    for (const cat of getCategories()) {
      const catDemos = filtered.filter((d) => d.category === cat);
      if (catDemos.length === 0) continue;
      console.log(`\n  ${cat}`);
      console.log("  " + "─".repeat(40));
      for (const d of catDemos) {
        const fx = d.hasSideEffects ? " [side effects]" : "";
        console.log(`    ${d.id.padEnd(35)} ${d.title}${fx}`);
      }
    }
    console.log(`\n  Total: ${filtered.length} demos`);
    if (safeOnly) console.log(`  (filtered: safe-only mode, skipped ${demos.length - filtered.length} with side effects)`);
    return;
  }

  // ── Clean old videos if requested ──
  if (cleanFirst) {
    await cleanLocalVideos();
    await cleanSupabaseVideos();
  }

  // ── Ensure Supabase bucket exists ──
  if (!skipUpload) {
    await ensureBucket();
  }

  const startFrom = Math.max(1, fromNumber);
  if (startFrom > 1) {
    console.log(`\n━━━ Recording ${filtered.length} demos (starting from #${startFrom}) ━━━\n`);
  } else {
    console.log(`\n━━━ Recording ${filtered.length} of ${demos.length} demos ━━━\n`);
  }

  const results: { id: string; status: "ok" | "skip" | "fail"; error?: string }[] = [];

  for (let i = 0; i < filtered.length; i++) {
    const demo = filtered[i];
    const num = i + 1;

    if (num < startFrom) {
      console.log(`\n[${num}/${filtered.length}] ${demo.title} — skipped (before --from ${startFrom})`);
      results.push({ id: demo.id, status: "skip" });
      continue;
    }

    console.log(`\n[${num}/${filtered.length}] ${demo.title} (${demo.id})`);

    // Try to load the recording script
    try {
      const mod = await import(`./recordings/${demo.id}`);
      if (!mod.default?.record) {
        console.log(`  ⏭ Skipped — no recording script found at recordings/${demo.id}.ts`);
        results.push({ id: demo.id, status: "skip" });
        continue;
      }

      // Import helpers and run
      const { startRecording, stopRecording } = await import("./helpers");
      const session = await startRecording();
      try {
        await mod.default.record(session);
        console.log("  ✓ Complete");
        results.push({ id: demo.id, status: "ok" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  ✗ Failed: ${msg}`);
        results.push({ id: demo.id, status: "fail", error: msg });
      } finally {
        await stopRecording(session, `demo-${demo.id}.webm`);
      }

      // ── Upload to Supabase ──
      if (!skipUpload) {
        const mp4Path = path.join(OUT_DIR, `demo-${demo.id}.mp4`);
        if (fs.existsSync(mp4Path)) {
          await uploadToSupabase(mp4Path, `tutorials/${demo.id}.mp4`);
        }
      }
    } catch {
      console.log(`  ⏭ Skipped — no recording script at recordings/${demo.id}.ts`);
      results.push({ id: demo.id, status: "skip" });
    }
  }

  // Summary
  const ok = results.filter((r) => r.status === "ok").length;
  const skipped = results.filter((r) => r.status === "skip").length;
  const failed = results.filter((r) => r.status === "fail").length;

  console.log(`\n━━━ Results ━━━`);
  console.log(`  ✓ Recorded: ${ok}`);
  console.log(`  ⏭ Skipped:  ${skipped}`);
  console.log(`  ✗ Failed:   ${failed}`);

  if (failed > 0) {
    console.log(`\nFailed demos:`);
    for (const r of results.filter((r) => r.status === "fail")) {
      console.log(`  - ${r.id}: ${r.error}`);
    }
  }

  if (!skipUpload) {
    console.log(`\nVideos available at: ${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/tutorials/`);
  }
}

main();
