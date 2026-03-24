/**
 * Capture screenshots for guide article cards.
 *
 * Usage:
 *   npm run capture:guide-screenshots
 *
 * Prerequisites:
 *   1. Dev server running: npm run dev
 *   2. DEMO_EMAIL + DEMO_PASSWORD in .env.local
 *   3. Seeded test data: npx tsx scripts/demo/seed-demo-data.ts
 *
 * Output:
 *   public/guides/screenshots/<id>.png
 */

import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env.local") });

const BASE_URL = process.env.DEMO_URL || "http://localhost:3000";
const EMAIL = process.env.DEMO_EMAIL || "test@example.com";
const PASSWORD = process.env.DEMO_PASSWORD || "password123";

const ROOT = path.resolve(__dirname, "..", "..");
const OUT_DIR = path.join(ROOT, "public", "guides", "screenshots");

// Hide Next.js dev overlays and scrollbar for clean screenshots
const HIDE_CSS = [
  "nextjs-portal { display: none !important; }",
  "#__vercel_toolbar { display: none !important; }",
  "#vercel-toolbar { display: none !important; }",
  "#__nextjs-toast-errors-parent { display: none !important; }",
  ".__vercel_toolbar_container { display: none !important; }",
  // Hide scrollbar for clean shots
  "::-webkit-scrollbar { display: none !important; }",
  "* { scrollbar-width: none !important; }",
].join(" ");

interface ScreenshotDef {
  id: string;
  title: string;
  /** URL path to navigate to (after login) */
  navigate: string;
  /** If true, navigate here without login (public page) */
  public?: boolean;
  /** Actions to perform before taking the screenshot */
  setup?: (ctx: { page: import("playwright").Page }) => Promise<void>;
  /** CSS selector to clip the screenshot to (otherwise full page viewport) */
  clip?: string;
}

const screenshots: ScreenshotDef[] = [
  // 1. Dashboard overview
  {
    id: "getting-started-with-prompt",
    title: "Getting Started with Prompt",
    navigate: "/dashboard",
    setup: async ({ page }) => {
      // Scroll to top to get the metrics + welcome area
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(500);
    },
  },

  // 2. Client detail page showing all fields
  {
    id: "understanding-client-fields",
    title: "Understanding Client Fields",
    navigate: "/clients",
    setup: async ({ page }) => {
      // Click the first client row to go to their detail page
      const firstLink = page.locator("table tbody tr a, table tbody tr td a, [data-testid='client-row'] a").first();
      if (await firstLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await firstLink.click();
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(1000);
      } else {
        // Fallback: try clicking any row in the client table
        const row = page.locator("table tbody tr").first();
        await row.click();
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(1000);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(300);
    },
  },

  // 3. Client detail — Documents tab with checklist
  {
    id: "managing-portal-documents-and-checklists",
    title: "Managing Portal Documents & Checklists",
    navigate: "/clients",
    setup: async ({ page }) => {
      const firstLink = page.locator("table tbody tr a, table tbody tr td a, [data-testid='client-row'] a").first();
      if (await firstLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await firstLink.click();
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(1000);
      }

      // Click the Documents tab if it exists
      const docsTab = page.locator('button:has-text("Documents"), [role="tab"]:has-text("Documents")').first();
      if (await docsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await docsTab.click();
        await page.waitForTimeout(1000);
      }

      // Scroll to the documents section
      const docsSection = page.locator('text=Documents').first();
      if (await docsSection.isVisible().catch(() => false)) {
        await docsSection.evaluate((el) =>
          el.scrollIntoView({ behavior: "instant", block: "start" })
        );
        await page.waitForTimeout(500);
      }
    },
  },

  // 4. Settings — Team section
  {
    id: "managing-your-team-and-settings",
    title: "Managing Your Team & Settings",
    navigate: "/settings",
    setup: async ({ page }) => {
      await page.waitForTimeout(1500);

      // Scroll to the Team card
      const teamHeading = page.locator('text=Team').first();
      if (await teamHeading.isVisible({ timeout: 5000 }).catch(() => false)) {
        await teamHeading.evaluate((el) =>
          el.scrollIntoView({ behavior: "instant", block: "start" })
        );
      }
      await page.waitForTimeout(500);
    },
  },

];

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log(`\n━━━ Capturing ${screenshots.length} guide screenshots ━━━\n`);
  console.log(`  Base URL: ${BASE_URL}`);
  console.log(`  Output:   public/guides/screenshots/\n`);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
  });

  // Hide dev overlays
  await context.addInitScript((css: string) => {
    const inject = () => {
      const s = document.createElement("style");
      s.textContent = css;
      (document.head || document.documentElement).appendChild(s);
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", inject);
    } else {
      inject();
    }
  }, HIDE_CSS);

  const page = await context.newPage();
  await page.addStyleTag({ content: HIDE_CSS });

  // ── Login ──────────────────────────────────────────────
  console.log("→ Logging in...");
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);

  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();

  await page.waitForURL("**/dashboard**", { timeout: 15000 });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
  console.log("  ✓ Logged in\n");

  // ── Capture each screenshot ────────────────────────────
  for (let i = 0; i < screenshots.length; i++) {
    const def = screenshots[i];
    const outPath = path.join(OUT_DIR, `${def.id}.png`);

    console.log(`[${i + 1}/${screenshots.length}] ${def.title}`);
    console.log(`  → Navigating to ${def.navigate}...`);

    try {
      await page.goto(`${BASE_URL}${def.navigate}`);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1000);

      if (def.setup) {
        console.log("  → Running setup...");
        await def.setup({ page });
      }

      // Take the screenshot
      if (def.clip) {
        const el = page.locator(def.clip).first();
        await el.screenshot({ path: outPath });
      } else {
        await page.screenshot({ path: outPath });
      }

      console.log(`  ✓ Saved: ${def.id}.png`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ Failed: ${msg}`);
    }

    console.log();
  }

  await context.close();
  await browser.close();

  // Print summary
  const captured = screenshots
    .map((s) => s.id)
    .filter((id) => fs.existsSync(path.join(OUT_DIR, `${id}.png`)));

  console.log(`━━━ Done ━━━`);
  console.log(`  ${captured.length}/${screenshots.length} screenshots captured`);
  if (captured.length < screenshots.length) {
    const missing = screenshots
      .map((s) => s.id)
      .filter((id) => !captured.includes(id));
    console.log(`  Missing: ${missing.join(", ")}`);
  }
  console.log(`  Output: public/guides/screenshots/\n`);
}

main();
