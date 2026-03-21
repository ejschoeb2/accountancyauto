/**
 * Playwright screen recording: Ad-hoc email flow
 *
 * Records a walkthrough of selecting clients and sending an ad-hoc email.
 * Requires the dev server running at localhost:3000 with seeded test data.
 *
 * Usage:
 *   npx tsx scripts/record-demo.ts
 *
 * Prerequisites:
 *   1. Dev server running: npm run dev
 *   2. A test account with clients already set up
 *   3. DEMO_EMAIL + DEMO_PASSWORD in .env.local (or set as env vars)
 *
 * Output: out/demo-adhoc-email.webm
 */

import { chromium, Page } from "playwright";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

// Load .env.local so credentials don't need to be passed manually
dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });

const BASE_URL = process.env.DEMO_URL || "http://localhost:3000";
const EMAIL = process.env.DEMO_EMAIL || "test@example.com";
const PASSWORD = process.env.DEMO_PASSWORD || "password123";

// Timing helpers — generous pauses so viewers can follow
const PAUSE_SHORT = 800;
const PAUSE_MEDIUM = 1500;
const PAUSE_LONG = 2500;
const PAUSE_READ = 3000;

async function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Fake cursor ───────────────────────────────────────────────
// Playwright's video recorder doesn't capture the system cursor,
// so we inject a CSS cursor element and animate it to each click target.

const CURSOR_INJECT_SCRIPT = `
  (() => {
    if (document.getElementById('demo-cursor')) return;
    const cursor = document.createElement('div');
    cursor.id = 'demo-cursor';
    cursor.innerHTML = \`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 3L19 12L12 13L9 20L5 3Z" fill="black" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
    </svg>\`;
    Object.assign(cursor.style, {
      position: 'fixed',
      top: '0px',
      left: '0px',
      width: '24px',
      height: '24px',
      zIndex: '2147483647',
      pointerEvents: 'none',
      transition: 'top 0.4s cubic-bezier(0.22, 1, 0.36, 1), left 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
      filter: 'drop-shadow(1px 2px 2px rgba(0,0,0,0.3))',
    });
    document.body.appendChild(cursor);
  })();
`;

const CURSOR_CLICK_RIPPLE = `
  (() => {
    const cursor = document.getElementById('demo-cursor');
    if (!cursor) return;
    const ripple = document.createElement('div');
    Object.assign(ripple.style, {
      position: 'fixed',
      top: (parseFloat(cursor.style.top) + 4) + 'px',
      left: (parseFloat(cursor.style.left) + 4) + 'px',
      width: '16px',
      height: '16px',
      borderRadius: '50%',
      background: 'rgba(59, 130, 246, 0.4)',
      transform: 'scale(1)',
      transition: 'transform 0.35s ease-out, opacity 0.35s ease-out',
      pointerEvents: 'none',
      zIndex: '2147483646',
    });
    document.body.appendChild(ripple);
    requestAnimationFrame(() => {
      ripple.style.transform = 'scale(3)';
      ripple.style.opacity = '0';
    });
    setTimeout(() => ripple.remove(), 400);
  })();
`;

/** Move the fake cursor to an element, pause, then click with a ripple */
async function cursorClick(page: Page, selector: string, index = 0) {
  await page.evaluate(CURSOR_INJECT_SCRIPT);

  const locator = page.locator(selector).nth(index);
  const box = await locator.boundingBox();
  if (!box) throw new Error(`Element not found: ${selector} [${index}]`);

  // Move cursor to center of element
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.evaluate(
    ({ x, y }) => {
      const el = document.getElementById("demo-cursor");
      if (el) {
        el.style.top = y + "px";
        el.style.left = x + "px";
      }
    },
    { x, y }
  );

  // Let cursor animate to position
  await wait(450);
  // Show click ripple
  await page.evaluate(CURSOR_CLICK_RIPPLE);
  await wait(100);
  // Actual click
  await locator.click();
}

/** Move cursor to element and type into it */
async function cursorType(page: Page, selector: string, text: string, opts?: { delay?: number; index?: number }) {
  await page.evaluate(CURSOR_INJECT_SCRIPT);

  const locator = page.locator(selector).nth(opts?.index ?? 0);
  const box = await locator.boundingBox();
  if (box) {
    await page.evaluate(
      ({ x, y }) => {
        const el = document.getElementById("demo-cursor");
        if (el) {
          el.style.top = y + "px";
          el.style.left = x + "px";
        }
      },
      { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    );
    await wait(450);
  }

  await page.evaluate(CURSOR_CLICK_RIPPLE);
  await wait(100);
  await locator.click();
  await locator.type(text, { delay: opts?.delay ?? 30 });
}

async function main() {
  // Ensure output dir exists
  const outDir = path.resolve(__dirname, "..", "out");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({
    headless: false,
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: outDir,
      size: { width: 1920, height: 1080 },
    },
  });

  const page = await context.newPage();

  // Hide the real system cursor inside the browser viewport
  await page.addStyleTag({
    content: "html { cursor: none !important; } * { cursor: none !important; }",
  });

  try {
    // ─── Step 1: Log in ───
    console.log("→ Logging in...");
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState("networkidle");
    await page.evaluate(CURSOR_INJECT_SCRIPT);
    await wait(PAUSE_SHORT);

    await cursorType(page, 'input[type="email"]', EMAIL, { delay: 25 });
    await wait(300);
    await cursorType(page, 'input[type="password"]', PASSWORD, { delay: 25 });
    await wait(PAUSE_SHORT);
    await cursorClick(page, 'button[type="submit"]');

    // Wait for dashboard to load
    await page.waitForURL("**/dashboard**", { timeout: 15000 });
    await page.evaluate(CURSOR_INJECT_SCRIPT);
    await wait(PAUSE_LONG);

    // ─── Step 2: Navigate to clients ───
    console.log("→ Navigating to clients...");
    await cursorClick(page, 'a[href*="clients"], [data-sidebar-item="clients"]');
    await page.waitForURL("**/clients**");
    await page.waitForLoadState("networkidle");
    await page.evaluate(CURSOR_INJECT_SCRIPT);
    await wait(PAUSE_LONG);

    // ─── Step 3: Select clients ───
    console.log("→ Selecting clients...");
    const checkboxes = page.locator('table [role="checkbox"]');
    const count = await checkboxes.count();

    if (count < 2) {
      console.warn("⚠ Less than 2 clients found — selecting what's available");
    }

    // Select first client (nth(0) is usually "select all")
    await cursorClick(page, 'table [role="checkbox"]', 1);
    await wait(PAUSE_SHORT);

    if (count > 2) {
      await cursorClick(page, 'table [role="checkbox"]', 2);
      await wait(PAUSE_SHORT);
    }

    if (count > 3) {
      await cursorClick(page, 'table [role="checkbox"]', 3);
      await wait(PAUSE_MEDIUM);
    }

    // ─── Step 4: Click Send Email in bulk toolbar ───
    console.log("→ Opening Send Email modal...");
    const sendEmailBtn = page.locator('button:has-text("Send Email")').first();
    await sendEmailBtn.waitFor({ state: "visible", timeout: 5000 });
    await wait(PAUSE_SHORT);
    await cursorClick(page, 'button:has-text("Send Email")');
    await wait(PAUSE_MEDIUM);

    // ─── Step 5: Configure the email ───
    console.log("→ Configuring email...");
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await wait(PAUSE_MEDIUM);

    // 5a: Select a filing type
    console.log("  → Selecting filing type...");
    await cursorClick(page, '[role="dialog"] [role="combobox"]', 0);
    await wait(PAUSE_SHORT);
    const filingOption = page.locator('[role="option"]').nth(1);
    await filingOption.waitFor({ state: "visible", timeout: 5000 });
    await cursorClick(page, '[role="option"]', 1);
    await wait(PAUSE_MEDIUM);

    // 5b: Select an email template
    console.log("  → Selecting template...");
    await cursorClick(page, '[role="dialog"] [role="combobox"]', 1);
    await wait(PAUSE_SHORT);
    const templateOption = page.locator('[role="option"]').nth(1);
    if ((await templateOption.count()) > 0 && (await templateOption.isVisible())) {
      await cursorClick(page, '[role="option"]', 1);
      await wait(PAUSE_LONG);
    } else {
      await page.keyboard.press("Escape");
      await wait(PAUSE_SHORT);
    }

    // 5c: If subject is still empty, type one manually
    const subjectInput = page.locator(
      '[role="dialog"] input[placeholder*="Subject"], [role="dialog"] input[placeholder*="subject"]'
    );
    if (await subjectInput.isVisible()) {
      const subjectValue = await subjectInput.inputValue();
      if (!subjectValue) {
        console.log("  → Typing subject line...");
        await cursorType(
          page,
          '[role="dialog"] input[placeholder*="Subject"], [role="dialog"] input[placeholder*="subject"]',
          "Important update regarding your upcoming filing deadline",
          { delay: 30 }
        );
        await wait(PAUSE_MEDIUM);
      }
    }

    // 5d: If body is still empty, type into the TipTap editor
    const editorDiv = page
      .locator('[role="dialog"] .tiptap, [role="dialog"] [contenteditable="true"]')
      .first();
    if (await editorDiv.isVisible()) {
      const bodyText = await editorDiv.textContent();
      if (!bodyText || bodyText.trim().length === 0) {
        console.log("  → Typing email body...");
        await cursorType(
          page,
          '[role="dialog"] .tiptap, [role="dialog"] [contenteditable="true"]',
          "Dear {{client_name}},\n\nThis is a friendly reminder about your upcoming {{filing_type}} deadline on {{deadline}}.\n\nPlease let us know if you have any questions.\n\nKind regards",
          { delay: 20 }
        );
        await wait(PAUSE_MEDIUM);
      }
    }

    // Let the viewer read the composed email
    await wait(PAUSE_READ);

    // ─── Step 6: Click Next to preview ───
    console.log("→ Previewing email...");
    await cursorClick(page, '[role="dialog"] button:has-text("Next")');
    await wait(PAUSE_READ);

    // ─── Step 7: Pause on the confirm screen (don't actually send) ───
    console.log("→ On confirm screen — pausing for viewer...");
    await wait(PAUSE_READ);

    // NOTE: We stop here intentionally — we don't click "Send" to avoid
    // actually sending emails. If you want the full flow with a test
    // Postmark server, uncomment below:
    //
    // await cursorClick(page, 'button:has-text("Send to")');
    // await wait(PAUSE_LONG);
    // await page.locator('text="Send Complete"').waitFor({ timeout: 30000 });
    // await wait(PAUSE_READ);

    console.log("→ Recording complete!");
  } catch (err) {
    console.error("Recording failed:", err);
  } finally {
    // Close context to save the video
    await context.close();
    await browser.close();

    // Find the recorded video and rename it
    const files = fs.readdirSync(outDir).filter((f) => f.endsWith(".webm"));
    if (files.length > 0) {
      const latest = files.sort().pop()!;
      const src = path.join(outDir, latest);
      const dest = path.join(outDir, "demo-adhoc-email.webm");
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      fs.renameSync(src, dest);
      console.log(`\n✓ Video saved: out/demo-adhoc-email.webm`);
      console.log(
        `  Convert to mp4: ffmpeg -i out/demo-adhoc-email.webm -c:v libx264 -crf 18 -preset slow -pix_fmt yuv420p out/demo-adhoc-email.mp4`
      );
    }
  }
}

main();
