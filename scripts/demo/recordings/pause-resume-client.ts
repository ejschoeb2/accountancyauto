/**
 * Recording: Pause & Resume a Client's Reminders
 *
 * On the client detail page, click Pause Reminders, show the paused state,
 * then click Resume Reminders.
 */

import {
  type DemoDefinition,
  login,
  navigateTo,
  cursorClick,
  cursorMove,
  wait,
  PAUSE,
} from "../helpers";

const demo: DemoDefinition = {
  id: "pause-resume-client",
  title: "Pause & Resume a Client's Reminders",
  description:
    "Pause all automated reminders for a client, then resume them later.",
  tags: ["pause", "resume", "reminders", "stop", "client", "inactive"],
  category: "Clients",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/clients");

    // ---- Navigate to a client detail page ----
    console.log("-> Clicking on a client row...");
    await cursorClick(page, "table tbody tr", 0);
    await page.waitForURL("**/clients/**", { timeout: 10000 });
    await page.waitForLoadState("networkidle");
    await wait(PAUSE.LONG);

    // ---- Click Pause Reminders ----
    console.log("-> Clicking Pause Reminders...");
    // Wait for either button to appear (client data loads asynchronously)
    await page.locator('button:has-text("Pause Reminders"), button:has-text("Resume Reminders")').first().waitFor({ state: "visible", timeout: 10000 });
    const pauseBtn = page.locator('button:has-text("Pause Reminders")');
    const resumeBtn = page.locator('button:has-text("Resume Reminders")');

    if (await pauseBtn.isVisible()) {
      await cursorClick(page, 'button:has-text("Pause Reminders")');
      await wait(PAUSE.LONG);

      // ---- Show the paused state ----
      console.log("-> Reminders paused — showing paused state...");
      await cursorMove(page, "h1");
      await wait(PAUSE.READ);

      // ---- Click Resume Reminders ----
      console.log("-> Clicking Resume Reminders...");
      await cursorClick(page, 'button:has-text("Resume Reminders")');
      await wait(PAUSE.LONG);

      console.log("-> Reminders resumed.");
    } else if (await resumeBtn.isVisible()) {
      // Client is already paused — resume first, then pause+resume
      console.log("-> Client is already paused — clicking Resume Reminders...");
      await cursorClick(page, 'button:has-text("Resume Reminders")');
      await wait(PAUSE.LONG);

      console.log("-> Now pausing again to show the flow...");
      await cursorClick(page, 'button:has-text("Pause Reminders")');
      await wait(PAUSE.LONG);

      console.log("-> And resuming...");
      await cursorClick(page, 'button:has-text("Resume Reminders")');
      await wait(PAUSE.LONG);
    }

    await wait(PAUSE.READ);
    console.log("-> Pause/resume demo complete.");
  },
};

export default demo;
