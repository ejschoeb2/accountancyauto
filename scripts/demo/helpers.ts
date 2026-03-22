/**
 * Shared helpers for demo screen recordings.
 *
 * Provides a fake animated cursor, click ripple effects, timing helpers,
 * and browser lifecycle management for Playwright-based demo recordings.
 */

import { chromium, Browser, BrowserContext, Page } from "playwright";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

// Load .env.local so credentials don't need to be passed manually
dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env.local") });

// ─── Config ──────────────────────────────────────────────────────
export const BASE_URL = process.env.DEMO_URL || "http://localhost:3000";
export const EMAIL = process.env.DEMO_EMAIL || "test@example.com";
export const PASSWORD = process.env.DEMO_PASSWORD || "password123";

// ─── Timing ──────────────────────────────────────────────────────
export const PAUSE = {
  SHORT: 800,
  MEDIUM: 1500,
  LONG: 2500,
  READ: 3000,
} as const;

export async function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Fake cursor scripts ─────────────────────────────────────────
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

/** Ensure the fake cursor is injected on the page */
export async function injectCursor(page: Page) {
  await page.evaluate(CURSOR_INJECT_SCRIPT);
}

/** Move the fake cursor to an element, pause, then click with a ripple */
export async function cursorClick(page: Page, selector: string, index = 0) {
  await injectCursor(page);

  const locator = page.locator(selector).nth(index);
  const box = await locator.boundingBox();
  if (!box) throw new Error(`Element not found: ${selector} [${index}]`);

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

  await wait(450);
  await page.evaluate(CURSOR_CLICK_RIPPLE);
  await wait(100);
  await locator.click();
}

/** Move cursor to element and type into it */
export async function cursorType(
  page: Page,
  selector: string,
  text: string,
  opts?: { delay?: number; index?: number }
) {
  await injectCursor(page);

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

/** Move cursor to element without clicking (for hover effects / visual emphasis) */
export async function cursorMove(page: Page, selector: string, index = 0) {
  await injectCursor(page);

  const locator = page.locator(selector).nth(index);
  const box = await locator.boundingBox();
  if (!box) return;

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

// ─── Browser lifecycle ───────────────────────────────────────────

export interface DemoSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  outDir: string;
}

/** Launch browser, create recording context, and set up the page */
export async function startRecording(): Promise<DemoSession> {
  const outDir = path.resolve(__dirname, "..", "..", "out");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
    recordVideo: {
      dir: outDir,
      size: { width: 1920, height: 1080 },
    },
  });

  const page = await context.newPage();

  // Hide the real system cursor
  await page.addStyleTag({
    content: "html { cursor: none !important; } * { cursor: none !important; }",
  });

  return { browser, context, page, outDir };
}

/** Close browser and rename the recorded video to the target filename */
export async function stopRecording(session: DemoSession, outputName: string) {
  // Get the video path BEFORE closing — Playwright knows which file belongs to this page
  const videoPath = await session.page.video()?.path();

  await session.context.close();
  await session.browser.close();

  if (videoPath && fs.existsSync(videoPath)) {
    const dest = path.join(session.outDir, outputName);
    if (fs.existsSync(dest)) fs.unlinkSync(dest);
    fs.renameSync(videoPath, dest);
    console.log(`\n✓ Video saved: out/${outputName}`);

    // Auto-convert to high-quality MP4 if ffmpeg is available
    const mp4Name = outputName.replace(".webm", ".mp4");
    const mp4Path = path.join(session.outDir, mp4Name);
    try {
      if (fs.existsSync(mp4Path)) fs.unlinkSync(mp4Path);
      execSync(
        `ffmpeg -i "${dest}" -c:v libx264 -crf 16 -preset slow -pix_fmt yuv420p -movflags +faststart "${mp4Path}"`,
        { stdio: "pipe" }
      );
      console.log(`✓ Converted to mp4: out/${mp4Name}`);
      // Remove the webm source after successful conversion
      fs.unlinkSync(dest);
    } catch {
      console.log(
        `  Convert manually: ffmpeg -i out/${outputName} -c:v libx264 -crf 16 -preset slow -pix_fmt yuv420p -movflags +faststart out/${mp4Name}`
      );
    }
  } else {
    console.log(`\n⚠ No video file found to rename`);
  }
}

/** Log in to the app and navigate to the dashboard */
export async function login(page: Page) {
  console.log("→ Logging in...");
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState("networkidle");
  await injectCursor(page);
  await wait(PAUSE.SHORT);

  await cursorType(page, 'input[type="email"]', EMAIL, { delay: 25 });
  await wait(300);
  await cursorType(page, 'input[type="password"]', PASSWORD, { delay: 25 });
  await wait(PAUSE.SHORT);
  await cursorClick(page, 'button[type="submit"]');

  await page.waitForURL("**/dashboard**", { timeout: 15000 });
  await injectCursor(page);
  await wait(PAUSE.LONG);
}

/** Navigate to a page via sidebar link */
export async function navigateTo(page: Page, href: string) {
  console.log(`→ Navigating to ${href}...`);
  await cursorClick(page, `a[href*="${href}"], [data-sidebar-item="${href.replace("/", "")}"]`);
  await page.waitForURL(`**${href}**`);
  await page.waitForLoadState("networkidle");
  await injectCursor(page);
  await wait(PAUSE.LONG);
}

// ─── Demo definition types ───────────────────────────────────────

export interface DemoDefinition {
  /** Unique identifier, used as filename: demo-{id}.webm */
  id: string;
  /** Human-readable title shown in help page */
  title: string;
  /** Short description of what the video shows */
  description: string;
  /** Search keywords / tags */
  tags: string[];
  /** Category for grouping in help page */
  category: string;
  /** Whether this demo has side effects (emails, data changes) */
  hasSideEffects: boolean;
  /** The recording function */
  record: (session: DemoSession) => Promise<void>;
}

/** Run a demo definition end-to-end */
export async function runDemo(demo: DemoDefinition) {
  console.log(`\n━━━ Recording: ${demo.title} ━━━\n`);
  const session = await startRecording();
  try {
    await demo.record(session);
    console.log("→ Recording complete!");
  } catch (err) {
    console.error("Recording failed:", err);
  } finally {
    await stopRecording(session, `demo-${demo.id}.webm`);
  }
}
