/**
 * Upload tutorial and hero videos to Supabase Storage.
 *
 * Usage:
 *   npx tsx scripts/upload-videos.ts
 *
 * Creates a public "videos" bucket if it doesn't exist, then uploads:
 *   public/tutorials/*.mp4  →  videos/tutorials/*.mp4
 *   public/hero-loop.mp4    →  videos/hero-loop.mp4
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUCKET = "videos";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === BUCKET);
  if (!exists) {
    const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
    if (error) throw new Error(`Failed to create bucket: ${error.message}`);
    console.log(`✓ Created public bucket: ${BUCKET}`);
  } else {
    console.log(`✓ Bucket exists: ${BUCKET}`);
  }
}

async function uploadFile(localPath: string, storagePath: string) {
  const buffer = fs.readFileSync(localPath);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: "video/mp4",
      upsert: true,
    });
  if (error) {
    console.error(`  ✗ ${storagePath}: ${error.message}`);
  } else {
    console.log(`  ✓ ${storagePath}`);
  }
}

async function main() {
  await ensureBucket();

  const ROOT = path.resolve(__dirname, "..");

  // Upload hero loop
  const heroPath = path.join(ROOT, "public", "hero-loop.mp4");
  if (fs.existsSync(heroPath)) {
    console.log("\nUploading hero video...");
    await uploadFile(heroPath, "hero-loop.mp4");
  } else {
    console.log("\n⚠ public/hero-loop.mp4 not found — skipping");
  }

  // Upload tutorial videos
  const tutorialsDir = path.join(ROOT, "public", "tutorials");
  if (fs.existsSync(tutorialsDir)) {
    const files = fs.readdirSync(tutorialsDir).filter((f) => f.endsWith(".mp4"));
    console.log(`\nUploading ${files.length} tutorial videos...`);
    for (const file of files) {
      await uploadFile(path.join(tutorialsDir, file), `tutorials/${file}`);
    }
  } else {
    console.log("\n⚠ public/tutorials/ not found — skipping");
  }

  console.log("\n━━━ Done ━━━");
  console.log(`Storage base URL: ${SUPABASE_URL}/storage/v1/object/public/${BUCKET}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
