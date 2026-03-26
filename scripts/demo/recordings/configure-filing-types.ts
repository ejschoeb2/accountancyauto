/**
 * Recording: Choose Active Filing Types
 *
 * Navigate to /deadlines, show the active deadlines grid, switch to
 * the inactive view, activate a filing type through the full wizard
 * (client selection, confirmation), then switch back to active view.
 *
 * Note: Filing types are initially configured during the setup wizard
 * but can be edited anytime on the Deadlines page.
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
  id: "configure-filing-types",
  title: "Choose Active Filing Types",
  description:
    "Select which filing types your practice handles. Initially configured during the setup wizard, but can be edited anytime on the Deadlines page.",
  tags: ["filing types", "configure", "select", "deadlines", "setup", "wizard"],
  category: "Deadlines",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/deadlines");

    // ─── View active deadlines ───
    console.log("-> Viewing active deadlines...");
    await wait(PAUSE.READ);

    // Hover over filing type cards to show layout
    console.log("-> Hovering over filing type cards...");
    const firstCard = page.locator("a[href*='/deadlines/']").first();
    if (await firstCard.isVisible()) {
      await cursorMove(page, "a[href*='/deadlines/']", 0);
      await wait(PAUSE.MEDIUM);
    }

    const secondCard = page.locator("a[href*='/deadlines/']").nth(1);
    if (await secondCard.isVisible()) {
      await cursorMove(page, "a[href*='/deadlines/']", 1);
      await wait(PAUSE.SHORT);
    }

    // ─── Switch to inactive view ───
    console.log("-> Switching to Inactive Deadlines view...");
    const inactiveToggle = page.locator('button:text-is("Inactive Deadlines")');
    if (await inactiveToggle.isVisible()) {
      await inactiveToggle.click();
      await wait(PAUSE.LONG);
    }

    // Pause to show the inactive filing types
    console.log("-> Viewing inactive deadlines...");
    await wait(PAUSE.READ);

    // ─── Activate a filing type via the Activate button ───
    console.log("-> Activating a filing type...");
    const activateBtn = page.locator('button:has-text("Activate")').first();
    if (await activateBtn.isVisible()) {
      await cursorClick(page, 'button:has-text("Activate")', 0);
      await wait(PAUSE.MEDIUM);

      // ─── Activate modal opens — Step 1: Client selection ───
      console.log("-> Activate modal opened — client selection step...");
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
      await wait(PAUSE.LONG);

      // Show the client list (all clients selected by default)
      console.log("-> All clients are selected by default...");
      await wait(PAUSE.READ);

      // ─── Click Next to proceed to confirmation ───
      console.log("-> Clicking Next...");
      const nextBtn = page.locator('[role="dialog"] button:has-text("Next")').first();
      if (await nextBtn.isVisible()) {
        await cursorClick(page, '[role="dialog"] button:has-text("Next")');
        await wait(PAUSE.LONG);
      }

      // ─── Confirm step — click Activate to actually activate ───
      console.log("-> Confirming activation...");
      const activateConfirmBtn = page.locator('[role="dialog"] button:has-text("Activate")').first();
      if (await activateConfirmBtn.isVisible()) {
        await cursorClick(page, '[role="dialog"] button:has-text("Activate")');
        await wait(PAUSE.LONG);
      } else {
        // If there's a document settings step, click through it
        const nextBtn2 = page.locator('[role="dialog"] button:has-text("Next")').first();
        if (await nextBtn2.isVisible()) {
          await cursorClick(page, '[role="dialog"] button:has-text("Next")');
          await wait(PAUSE.MEDIUM);
          // Now click Activate
          const finalActivate = page.locator('[role="dialog"] button:has-text("Activate")').first();
          if (await finalActivate.isVisible()) {
            await cursorClick(page, '[role="dialog"] button:has-text("Activate")');
            await wait(PAUSE.LONG);
          }
        }
      }

      await page.waitForLoadState("networkidle");
      await injectCursor(page);
      await wait(PAUSE.MEDIUM);
    }

    // ─── Switch back to active view to show the newly activated type ───
    console.log("-> Switching back to Active Deadlines...");
    const activeToggle = page.locator('button:text-is("Active Deadlines")');
    if (await activeToggle.isVisible()) {
      await activeToggle.click();
      await wait(PAUSE.LONG);
    }

    console.log("-> Filing types configured — done.");
    await wait(PAUSE.READ);
  },
};

export default demo;
