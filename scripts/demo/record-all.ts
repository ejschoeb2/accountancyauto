/**
 * Batch runner — records all demo videos sequentially.
 *
 * Usage:
 *   npx tsx scripts/demo/record-all.ts              # Record all demos
 *   npx tsx scripts/demo/record-all.ts --safe        # Skip demos with side effects
 *   npx tsx scripts/demo/record-all.ts --only email  # Only record demos matching "email"
 *   npx tsx scripts/demo/record-all.ts --category Clients  # Only a specific category
 *   npx tsx scripts/demo/record-all.ts --list        # Just print the manifest, don't record
 *
 * Prerequisites:
 *   1. Dev server running: npm run dev
 *   2. DEMO_EMAIL + DEMO_PASSWORD in .env.local
 *   3. Seeded test data covering all features
 */

import { demos, getCategories, getDemosByCategory, type DemoEntry } from "./manifest";

const args = process.argv.slice(2);
const safeOnly = args.includes("--safe");
const listOnly = args.includes("--list");

const onlyIdx = args.indexOf("--only");
const onlyFilter = onlyIdx !== -1 ? args[onlyIdx + 1]?.toLowerCase() : null;

const catIdx = args.indexOf("--category");
const catFilter = catIdx !== -1 ? args[catIdx + 1] : null;

function matchesFilter(demo: DemoEntry): boolean {
  if (safeOnly && demo.hasSideEffects) return false;
  if (catFilter && demo.category !== catFilter) return false;
  if (onlyFilter) {
    const haystack = `${demo.id} ${demo.title} ${demo.tags.join(" ")}`.toLowerCase();
    return haystack.includes(onlyFilter);
  }
  return true;
}

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

  console.log(`\n━━━ Recording ${filtered.length} of ${demos.length} demos ━━━\n`);

  const results: { id: string; status: "ok" | "skip" | "fail"; error?: string }[] = [];

  for (let i = 0; i < filtered.length; i++) {
    const demo = filtered[i];
    console.log(`\n[${i + 1}/${filtered.length}] ${demo.title} (${demo.id})`);

    // Try to load the recording script
    try {
      const mod = await import(`./recordings/${demo.id}`);
      if (!mod.default?.record) {
        console.log(`  ⏭ Skipped — no recording script found at recordings/${demo.id}.ts`);
        results.push({ id: demo.id, status: "skip" });
        continue;
      }

      // Import helpers and run
      const { startRecording, stopRecording, login } = await import("./helpers");
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
}

main();
