/**
 * Recording: Choose Active Filing Types
 *
 * Navigate to /deadlines, start by deactivating an active filing type,
 * then switch to the inactive view and activate a filing type through
 * the full wizard (client selection, confirmation).
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
    await wait(PAUSE.SHORT);

    // Hover over filing type cards briefly
    const firstCard = page.locator("a[href*='/deadlines/']").first();
    if (await firstCard.isVisible()) {
      await cursorMove(page, "a[href*='/deadlines/']", 0);
      await wait(PAUSE.SHORT);
    }

    // ─── Deactivate a filing type first ───
    // Click the "..." or menu button on the last active card to deactivate it
    console.log("-> Deactivating a filing type...");
    const deactivateBtn = page.locator('button:has-text("Deactivate")').first();

    // Some cards may have a Deactivate button directly visible, or it may be behind a menu
    if (await deactivateBtn.isVisible().catch(() => false)) {
      await cursorClick(page, 'button:has-text("Deactivate")');
      await wait(PAUSE.SHORT);

      // Confirm deactivation if a dialog appears
      const confirmDeactivate = page.locator('[role="dialog"] button:has-text("Deactivate"), [role="alertdialog"] button:has-text("Deactivate")');
      if (await confirmDeactivate.isVisible().catch(() => false)) {
        await cursorClick(page, '[role="dialog"] button:has-text("Deactivate"), [role="alertdialog"] button:has-text("Deactivate")');
        await wait(PAUSE.MEDIUM);
      }
    } else {
      // Try clicking a card's dropdown/menu button to find Deactivate
      const menuBtns = page.locator("a[href*='/deadlines/']").locator('button[aria-label], button:has(svg)');
      if (await menuBtns.first().isVisible().catch(() => false)) {
        await cursorClick(page, "a[href*='/deadlines/'] button[aria-label]", 0);
        await wait(PAUSE.SHORT);

        const deactivateMenuItem = page.locator('[role="menuitem"]:has-text("Deactivate")');
        if (await deactivateMenuItem.isVisible().catch(() => false)) {
          await cursorClick(page, '[role="menuitem"]:has-text("Deactivate")');
          await wait(PAUSE.SHORT);

          // Confirm deactivation
          const confirmBtn = page.locator('[role="dialog"] button:has-text("Deactivate"), [role="alertdialog"] button:has-text("Deactivate")');
          if (await confirmBtn.isVisible().catch(() => false)) {
            await cursorClick(page, '[role="dialog"] button:has-text("Deactivate"), [role="alertdialog"] button:has-text("Deactivate")');
            await wait(PAUSE.MEDIUM);
          }
        }
      }
    }

    await page.waitForLoadState("networkidle");
    await injectCursor(page);
    await wait(PAUSE.SHORT);

    // ─── Switch to inactive view ───
    console.log("-> Switching to Inactive Deadlines view...");
    const inactiveToggle = page.locator('button:text-is("Inactive Deadlines")');
    if (await inactiveToggle.isVisible()) {
      await cursorClick(page, 'button:text-is("Inactive Deadlines")');
      await wait(PAUSE.MEDIUM);
    }

    // Show the inactive filing types
    console.log("-> Viewing inactive deadlines...");
    await wait(PAUSE.SHORT);

    // ─── Activate a filing type via the Activate button ───
    console.log("-> Activating a filing type...");
    const activateBtn = page.locator('button:has-text("Activate")').first();
    if (await activateBtn.isVisible()) {
      await cursorClick(page, 'button:has-text("Activate")', 0);
      await wait(PAUSE.SHORT);

      // ─── Activate modal — Step 1: Client selection ───
      console.log("-> Activate modal — client selection step...");
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
      await wait(PAUSE.MEDIUM);

      // All clients selected by default
      console.log("-> All clients selected by default...");
      await wait(PAUSE.SHORT);

      // ─── Click Next ───
      console.log("-> Clicking Next...");
      const nextBtn = page.locator('[role="dialog"] button:has-text("Next")').first();
      if (await nextBtn.isVisible()) {
        await cursorClick(page, '[role="dialog"] button:has-text("Next")');
        await wait(PAUSE.MEDIUM);
      }

      // ─── Confirm — click Activate ───
      console.log("-> Confirming activation...");
      const activateConfirmBtn = page.locator('[role="dialog"] button:has-text("Activate")').first();
      if (await activateConfirmBtn.isVisible()) {
        await cursorClick(page, '[role="dialog"] button:has-text("Activate")');
        await wait(PAUSE.MEDIUM);
      } else {
        // May have a document settings step — click through it
        const nextBtn2 = page.locator('[role="dialog"] button:has-text("Next")').first();
        if (await nextBtn2.isVisible()) {
          await cursorClick(page, '[role="dialog"] button:has-text("Next")');
          await wait(PAUSE.SHORT);
          const finalActivate = page.locator('[role="dialog"] button:has-text("Activate")').first();
          if (await finalActivate.isVisible()) {
            await cursorClick(page, '[role="dialog"] button:has-text("Activate")');
            await wait(PAUSE.MEDIUM);
          }
        }
      }

      await page.waitForLoadState("networkidle");
      await injectCursor(page);
      await wait(PAUSE.SHORT);
    }

    // ─── Switch back to active view ───
    console.log("-> Switching back to Active Deadlines...");
    const activeToggle = page.locator('button:text-is("Active Deadlines")');
    if (await activeToggle.isVisible()) {
      await cursorClick(page, 'button:text-is("Active Deadlines")');
      await wait(PAUSE.MEDIUM);
    }

    console.log("-> Filing types configured — done.");
    await wait(PAUSE.SHORT);
  },
};

export default demo;
