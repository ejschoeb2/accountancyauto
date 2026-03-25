/**
 * Record the hero shortlist videos, trim login sequences, and
 * concatenate into a seamless looping video for the marketing hero.
 *
 * Usage:
 *   npm run record:shortlist
 *
 * Prerequisites:
 *   1. Dev server running: npm run dev
 *   2. DEMO_EMAIL + DEMO_PASSWORD in .env.local
 *   3. Seeded test data: npx tsx scripts/demo/seed-demo-data.ts
 *   4. ffmpeg available on PATH
 *
 * Output:
 *   out/shortlist/           — individual trimmed MP4 clips
 *   public/hero-loop.mp4    — final concatenated seamless loop
 */

import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import { startRecording, stopRecording } from "./helpers";

const SHORTLIST_IDS = [
  "upcoming-deadlines-widget",
  "workload-forecast",
  "todo-list",
  "send-now-email",
  "check-client-deadlines",
];

// Seconds to trim from the start of each recording (login sequence)
const TRIM_SECONDS = 10;

const ROOT = path.resolve(__dirname, "..", "..");
const OUT_DIR = path.join(ROOT, "out");
const SHORTLIST_DIR = path.join(OUT_DIR, "shortlist");
const PUBLIC_DIR = path.join(ROOT, "public");

async function main() {
  // Ensure output directories
  if (!fs.existsSync(SHORTLIST_DIR)) fs.mkdirSync(SHORTLIST_DIR, { recursive: true });

  const args = process.argv.slice(2);
  const skipRecord = args.includes("--stitch-only");
  const skipStitch = args.includes("--record-only");

  const trimmedFiles: string[] = [];

  if (!skipRecord) {
    console.log(`\n━━━ Recording ${SHORTLIST_IDS.length} shortlist videos ━━━\n`);

    for (let i = 0; i < SHORTLIST_IDS.length; i++) {
      const id = SHORTLIST_IDS[i];
      console.log(`\n[${i + 1}/${SHORTLIST_IDS.length}] Recording: ${id}`);

      try {
        const mod = await import(`./shortlist/${id}`);
        if (!mod.default?.record) {
          console.log(`  ⏭ Skipped — no record function in shortlist/${id}.ts`);
          continue;
        }

        const session = await startRecording();
        try {
          await mod.default.record(session);
          console.log("  ✓ Recording complete");
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`  ✗ Recording failed: ${msg}`);
        } finally {
          // Save raw WebM to out/ (standard flow converts to MP4 too)
          await stopRecording(session, `shortlist-${id}.webm`);
        }

        // The stopRecording helper converts to MP4 and deletes the WebM.
        // Move the MP4 into shortlist/ subfolder.
        const rawMp4 = path.join(OUT_DIR, `shortlist-${id}.mp4`);
        const trimmedMp4 = path.join(SHORTLIST_DIR, `${id}.mp4`);

        if (fs.existsSync(rawMp4)) {
          // Trim the first N seconds (login sequence)
          console.log(`  → Trimming first ${TRIM_SECONDS}s...`);
          try {
            if (fs.existsSync(trimmedMp4)) fs.unlinkSync(trimmedMp4);
            execSync(
              `ffmpeg -i "${rawMp4}" -ss ${TRIM_SECONDS} -c:v libx264 -crf 16 -preset slow -pix_fmt yuv420p -movflags +faststart -an "${trimmedMp4}"`,
              { stdio: "pipe" }
            );
            console.log(`  ✓ Trimmed: out/shortlist/${id}.mp4`);
            // Clean up the raw file
            fs.unlinkSync(rawMp4);
          } catch (err) {
            console.error(`  ✗ Trim failed — keeping raw file at out/shortlist-${id}.mp4`);
            // If trim fails, just move the raw file
            if (!fs.existsSync(trimmedMp4)) {
              fs.renameSync(rawMp4, trimmedMp4);
            }
          }
        }
      } catch (err) {
        console.log(`  ⏭ Skipped — could not load shortlist/${id}.ts`);
      }
    }
  }

  // Collect all trimmed files that exist
  for (const id of SHORTLIST_IDS) {
    const trimmedMp4 = path.join(SHORTLIST_DIR, `${id}.mp4`);
    if (fs.existsSync(trimmedMp4)) {
      trimmedFiles.push(trimmedMp4);
    }
  }

  if (skipStitch) {
    console.log(`\n━━━ Recording complete (--record-only) ━━━`);
    console.log(`  ${trimmedFiles.length} trimmed clips in out/shortlist/`);
    return;
  }

  // ---- Concatenate into seamless loop ----
  if (trimmedFiles.length === 0) {
    console.error("\n✗ No trimmed clips found to concatenate.");
    console.error("  Run without --stitch-only first, or check out/shortlist/ for MP4 files.");
    return;
  }

  console.log(`\n━━━ Concatenating ${trimmedFiles.length} clips into hero-loop.mp4 ━━━\n`);

  // Create ffmpeg concat list file
  const concatListPath = path.join(SHORTLIST_DIR, "concat-list.txt");
  const concatContent = trimmedFiles.map((f) => `file '${f.replace(/\\/g, "/")}'`).join("\n");
  fs.writeFileSync(concatListPath, concatContent);

  const outputPath = path.join(PUBLIC_DIR, "hero-loop.mp4");
  if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

  try {
    // Two-pass approach: first re-encode all clips to identical specs,
    // then concat. Using the concat demuxer with re-encode ensures
    // seamless transitions even if clips have slightly different durations
    // or codec parameters.
    execSync(
      `ffmpeg -f concat -safe 0 -i "${concatListPath}" -c:v libx264 -crf 16 -preset slow -pix_fmt yuv420p -movflags +faststart -an "${outputPath}"`,
      { stdio: "inherit" }
    );
    console.log(`\n✓ Hero loop saved: public/hero-loop.mp4`);
    console.log(`  ${trimmedFiles.length} clips concatenated into seamless loop`);
  } catch {
    console.error("\n✗ Concatenation failed. Check that ffmpeg is on PATH.");
    console.error(`  Concat list at: ${concatListPath}`);
  }

  // Clean up concat list
  if (fs.existsSync(concatListPath)) fs.unlinkSync(concatListPath);

  console.log("\n━━━ Done ━━━");
}

main();
