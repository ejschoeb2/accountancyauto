/**
 * Recording: Mark a Filing as Complete
 *
 * On the client detail page, find a filing card and click the
 * Completed checkbox to mark it as done for the current period.
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
  id: "mark-filing-complete",
  title: "Mark a Filing as Complete",
  description:
    "On the client detail page, click the 'Complete' button on a filing to mark it as done for the current period.",
  tags: ["filing", "complete", "done", "mark", "status", "client"],
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

    // ---- Scroll to Filing Management ----
    console.log("-> Scrolling to Filing Management...");
    const filingSection = page.locator('h2:has-text("Filing Management")');
    await filingSection.scrollIntoViewIfNeeded();
    await wait(PAUSE.MEDIUM);

    // ---- Find a filing card and show it ----
    console.log("-> Locating a filing card...");
    const filingCard = page.locator('[id^="filing-"]').first();
    await filingCard.scrollIntoViewIfNeeded();
    await cursorMove(page, '[id^="filing-"]');
    await wait(PAUSE.MEDIUM);

    // ---- Click the Completed checkbox ----
    // The Completed checkbox is accompanied by a "Completed" label
    console.log("-> Clicking the Completed checkbox...");
    const completedLabel = page.locator('[id^="filing-"] label:has-text("Completed")').first();
    if (await completedLabel.isVisible()) {
      await cursorClick(page, '[id^="filing-"] label:has-text("Completed")');
    } else {
      // Fallback: click the checkbox via aria-label
      await cursorClick(
        page,
        '[id^="filing-"] [aria-label*="completed"], [id^="filing-"] [aria-label*="Completed"]'
      );
    }
    await wait(PAUSE.LONG);

    // ---- Show the result ----
    console.log("-> Filing marked as complete — reviewing result...");
    await cursorMove(page, '[id^="filing-"]');
    await wait(PAUSE.READ);

    console.log("-> Mark filing complete demo finished.");
    await wait(PAUSE.SHORT);
  },
};

export default demo;
