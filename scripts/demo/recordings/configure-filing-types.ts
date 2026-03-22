/**
 * Recording: Choose Active Filing Types
 *
 * Navigate to /deadlines, toggle between active/inactive views,
 * deactivate a filing type, switch to inactive view, and re-activate it.
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
  id: "configure-filing-types",
  title: "Choose Active Filing Types",
  description:
    "Select which filing types your practice handles — Corporation Tax, CT600, Companies House, VAT, Self Assessment, and custom schedules.",
  tags: ["filing types", "configure", "select", "deadlines", "setup"],
  category: "Deadlines",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/deadlines");

    // ─── View active deadlines ───
    console.log("→ Viewing active deadlines...");
    await wait(PAUSE.READ);

    // Hover over first filing type card to show layout
    console.log("→ Hovering over first filing type card...");
    const firstCard = page.locator(".grid a").first();
    if (await firstCard.isVisible()) {
      await cursorMove(page, ".grid a", 0);
      await wait(PAUSE.MEDIUM);
    }

    // ─── Deactivate a filing type ───
    console.log("→ Deactivating a filing type...");
    const deactivateBtn = page.locator('button:has-text("Deactivate")').first();
    await deactivateBtn.waitFor({ state: "visible", timeout: 5000 });
    await cursorClick(page, 'button:has-text("Deactivate")', 0);
    await wait(PAUSE.LONG);

    // ─── Switch to inactive view ───
    console.log("→ Switching to Inactive Deadlines view...");
    await cursorClick(page, 'button:has-text("Inactive Deadlines")');
    await wait(PAUSE.LONG);

    // Pause to show the inactive filing types
    console.log("→ Viewing inactive deadlines...");
    await wait(PAUSE.READ);

    // ─── Re-activate it via the Activate button ───
    console.log("→ Re-activating a filing type...");
    const activateBtn = page.locator('button:has-text("Activate")').first();
    if (await activateBtn.isVisible()) {
      await cursorClick(page, 'button:has-text("Activate")', 0);
      await wait(PAUSE.MEDIUM);

      // The activate modal opens — click Next to proceed through client step
      console.log("→ Activate modal opened — clicking Next...");
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
      await wait(PAUSE.MEDIUM);

      // Click Next to skip client selection
      await cursorClick(page, '[role="dialog"] button:has-text("Next")');
      await wait(PAUSE.MEDIUM);

      // On confirm step, dismiss the dialog instead of clicking Activate behind overlay
      console.log("→ Dismissing activate dialog...");
      await page.keyboard.press('Escape');
      await wait(PAUSE.LONG);
    }

    // ─── Switch back to active view ───
    console.log("→ Switching back to Active Deadlines...");
    await cursorClick(page, 'button:has-text("Active Deadlines")');
    await wait(PAUSE.READ);

    console.log("→ Filing types configured — done.");
  },
};

export default demo;
