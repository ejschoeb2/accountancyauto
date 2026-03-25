/**
 * Re-record only the send-now-email clip, then re-stitch hero-loop.mp4.
 *
 * Usage:
 *   npm run record:send-now-email
 *
 * Prerequisites:
 *   1. Dev server running: npm run dev
 *   2. DEMO_EMAIL + DEMO_PASSWORD in .env.local
 *   3. ffmpeg available on PATH
 */

import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import { startRecording, stopRecording } from "./helpers";

const CLIP_ID = "send-now-email";
const TRIM_SECONDS = 9;

const SHORTLIST_IDS = [
  "upcoming-deadlines-widget",
  "workload-forecast",
  "todo-list",
  "send-now-email",
  "check-client-deadlines",
];

const ROOT = path.resolve(__dirname, "..", "..");
const OUT_DIR = path.join(ROOT, "out");
const SHORTLIST_DIR = path.join(OUT_DIR, "shortlist");
const PUBLIC_DIR = path.join(ROOT, "public");

async function main() {
  if (!fs.existsSync(SHORTLIST_DIR)) fs.mkdirSync(SHORTLIST_DIR, { recursive: true });

  // ── Delete old clip ──────────────────────────────────────────────────────
  const trimmedMp4 = path.join(SHORTLIST_DIR, `${CLIP_ID}.mp4`);
  if (fs.existsSync(trimmedMp4)) {
    fs.unlinkSync(trimmedMp4);
    console.log(`✓ Deleted old: out/shortlist/${CLIP_ID}.mp4`);
  }

  // ── Record fresh clip ────────────────────────────────────────────────────
  console.log(`\n━━━ Recording: ${CLIP_ID} ━━━\n`);

  const mod = await import(`./shortlist/${CLIP_ID}`);
  if (!mod.default?.record) {
    console.error(`✗ No record function in shortlist/${CLIP_ID}.ts`);
    process.exit(1);
  }

  const session = await startRecording();
  try {
    await mod.default.record(session);
    console.log("✓ Recording complete");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`✗ Recording failed: ${msg}`);
    process.exit(1);
  } finally {
    await stopRecording(session, `shortlist-${CLIP_ID}.webm`);
  }

  const rawMp4 = path.join(OUT_DIR, `shortlist-${CLIP_ID}.mp4`);
  if (!fs.existsSync(rawMp4)) {
    console.error(`✗ Raw MP4 not found at out/shortlist-${CLIP_ID}.mp4`);
    process.exit(1);
  }

  console.log(`→ Trimming first ${TRIM_SECONDS}s...`);
  execSync(
    `ffmpeg -i "${rawMp4}" -ss ${TRIM_SECONDS} -c:v libx264 -crf 16 -preset slow -pix_fmt yuv420p -movflags +faststart -an "${trimmedMp4}"`,
    { stdio: "pipe" }
  );
  fs.unlinkSync(rawMp4);
  console.log(`✓ Trimmed: out/shortlist/${CLIP_ID}.mp4`);

  // ── Re-stitch hero-loop.mp4 ──────────────────────────────────────────────
  const trimmedFiles: string[] = [];
  for (const id of SHORTLIST_IDS) {
    const f = path.join(SHORTLIST_DIR, `${id}.mp4`);
    if (fs.existsSync(f)) {
      trimmedFiles.push(f);
    } else {
      console.warn(`  ⚠ Missing clip: out/shortlist/${id}.mp4 — skipping`);
    }
  }

  if (trimmedFiles.length === 0) {
    console.error("✗ No clips found to concatenate.");
    process.exit(1);
  }

  console.log(`\n━━━ Concatenating ${trimmedFiles.length} clips into hero-loop.mp4 ━━━\n`);

  const concatListPath = path.join(SHORTLIST_DIR, "concat-list.txt");
  const concatContent = trimmedFiles.map((f) => `file '${f.replace(/\\/g, "/")}'`).join("\n");
  fs.writeFileSync(concatListPath, concatContent);

  const outputPath = path.join(PUBLIC_DIR, "hero-loop.mp4");
  if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

  execSync(
    `ffmpeg -f concat -safe 0 -i "${concatListPath}" -c:v libx264 -crf 16 -preset slow -pix_fmt yuv420p -movflags +faststart -an "${outputPath}"`,
    { stdio: "inherit" }
  );

  if (fs.existsSync(concatListPath)) fs.unlinkSync(concatListPath);

  console.log(`\n✓ Hero loop saved: public/hero-loop.mp4`);
  console.log(`  ${trimmedFiles.length} clips concatenated`);
  console.log("\n━━━ Done ━━━");
}

main();
