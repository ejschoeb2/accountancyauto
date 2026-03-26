/**
 * Recording: Pause & Resume a Client's Reminders
 *
 * Navigate to a specific client's detail page (not the first row),
 * click Pause Reminders, show the paused state, then Resume Reminders.
 * Simple flow: clients page -> click client name -> pause -> resume.
 */

import {
  type DemoDefinition,
  login,
  navigateTo,
  cursorClick,
  cursorMove,
  wait,
  PAUSE,
  injectCursor,
} from "../helpers";

const demo: DemoDefinition = {
  id: "pause-resume-client",
  title: "Pause & Resume a Client's Reminders",
  description:
    "Pause all automated reminders for a client from their detail page, then resume them.",
  tags: ["pause", "resume", "reminders", "stop", "client", "inactive"],
  category: "Clients",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/clients");

    // ---- Search for Thames Valley Consulting (on track, not paused) ----
    console.log("-> Searching for Thames Valley Consulting...");
    const searchInput = page.locator('input[placeholder="Search by client name..."]');
    await searchInput.waitFor({ state: "visible", timeout: 5000 });
    await searchInput.fill("Thames Valley");
    await wait(PAUSE.LONG);

    // ---- Click on the client name to go to detail page ----
    console.log("-> Clicking on Thames Valley Consulting to open detail page...");
    const clientRow = page.locator('table tbody tr').first();
    await clientRow.waitFor({ state: "visible", timeout: 5000 });
    await cursorClick(page, "table tbody tr", 0);
    await page.waitForURL(/\/clients\/[a-f0-9-]+/, { timeout: 15000 });
    await page.waitForLoadState("networkidle");
    await injectCursor(page);
    await wait(PAUSE.LONG);

    // ---- Show the client header and action buttons ----
    console.log("-> Showing client detail page...");
    await cursorMove(page, "h1");
    await wait(PAUSE.READ);

    // ---- Wait for Pause/Resume button to appear ----
    await page.locator('button:has-text("Pause Reminders"), button:has-text("Resume Reminders")').first().waitFor({ state: "visible", timeout: 10000 });

    const pauseBtn = page.locator('button:has-text("Pause Reminders")');
    const resumeBtn = page.locator('button:has-text("Resume Reminders")');

    if (await pauseBtn.isVisible().catch(() => false)) {
      // Client is active — pause it first
      console.log("-> Clicking Pause Reminders...");
      await cursorClick(page, 'button:has-text("Pause Reminders")');
      await page.waitForLoadState("networkidle");
      await wait(PAUSE.LONG);

      // ---- Show the paused state ----
      console.log("-> Reminders paused — showing paused indicator...");
      await cursorMove(page, "h1");
      await wait(PAUSE.READ);

      // The button should now say "Resume Reminders"
      await page.locator('button:has-text("Resume Reminders")').waitFor({ state: "visible", timeout: 10000 });

      // Show the Resume button
      console.log("-> Showing Resume Reminders button...");
      await cursorMove(page, 'button:has-text("Resume Reminders")');
      await wait(PAUSE.READ);

      // ---- Click Resume Reminders ----
      console.log("-> Clicking Resume Reminders...");
      await cursorClick(page, 'button:has-text("Resume Reminders")');
      await page.waitForLoadState("networkidle");
      await wait(PAUSE.LONG);

      // Show the resumed state
      console.log("-> Reminders resumed.");
      await wait(PAUSE.MEDIUM);

      // Verify the Pause button is back
      await page.locator('button:has-text("Pause Reminders")').waitFor({ state: "visible", timeout: 10000 });
      await cursorMove(page, 'button:has-text("Pause Reminders")');
      await wait(PAUSE.READ);
    } else if (await resumeBtn.isVisible().catch(() => false)) {
      // Client is already paused — resume first, then pause and resume
      console.log("-> Client is already paused — clicking Resume Reminders...");
      await cursorClick(page, 'button:has-text("Resume Reminders")');
      await page.waitForLoadState("networkidle");
      await wait(PAUSE.LONG);

      // Now pause it
      console.log("-> Now pausing to demonstrate the flow...");
      await page.locator('button:has-text("Pause Reminders")').waitFor({ state: "visible", timeout: 10000 });
      await cursorClick(page, 'button:has-text("Pause Reminders")');
      await page.waitForLoadState("networkidle");
      await wait(PAUSE.LONG);

      // Show paused state
      console.log("-> Showing paused state...");
      await cursorMove(page, "h1");
      await wait(PAUSE.READ);

      // Resume
      console.log("-> Resuming reminders...");
      await page.locator('button:has-text("Resume Reminders")').waitFor({ state: "visible", timeout: 10000 });
      await cursorClick(page, 'button:has-text("Resume Reminders")');
      await wait(PAUSE.LONG);
    }

    console.log("-> Pause/resume demo complete.");
    await wait(PAUSE.READ);
  },
};

export default demo;
