/**
 * Recording: Override a Filing Deadline
 *
 * On the client detail page, click Override Deadline on a filing card,
 * enter a new date and reason in the dialog, and save.
 */

import {
  type DemoDefinition,
  login,
  navigateTo,
  cursorClick,
  cursorType,
  cursorMove,
  wait,
  PAUSE,
} from "../helpers";

const demo: DemoDefinition = {
  id: "override-deadline",
  title: "Override a Filing Deadline",
  description:
    "Set a custom deadline date for a specific filing, overriding the auto-calculated date.",
  tags: ["deadline", "override", "custom date", "filing", "client"],
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

    // ---- Click Override Deadline button on a filing card ----
    console.log("-> Clicking Override Deadline...");
    const overrideBtn = page.locator('button:has-text("Override Deadline")').first();
    if (await overrideBtn.isVisible()) {
      await overrideBtn.scrollIntoViewIfNeeded();
      await cursorClick(page, 'button:has-text("Override Deadline")');
    } else {
      // If no Override Deadline button is visible, look for any filing action button
      console.log("-> No Override Deadline button found — showing filing card...");
      await cursorMove(page, '[id^="filing-"]');
    }
    await wait(PAUSE.MEDIUM);

    // ---- Fill in the override dialog ----
    const dialog = page.locator('[role="dialog"]');
    if (await dialog.isVisible()) {
      console.log("-> Override dialog open — entering new deadline...");
      await wait(PAUSE.SHORT);

      // Enter override date
      const dateInput = dialog.locator('input[type="date"]');
      if (await dateInput.isVisible()) {
        await cursorClick(page, '[role="dialog"] input[type="date"]');
        await dateInput.fill("2026-09-30");
        await wait(PAUSE.MEDIUM);
      }

      // Enter reason
      const reasonInput = dialog.locator('input[type="text"], textarea');
      if (await reasonInput.isVisible()) {
        await cursorType(
          page,
          '[role="dialog"] input[type="text"], [role="dialog"] textarea',
          "Client requested extension due to audit",
          { delay: 25 }
        );
        await wait(PAUSE.MEDIUM);
      }

      // ---- Review and save ----
      console.log("-> Saving deadline override...");
      await cursorMove(page, '[role="dialog"]');
      await wait(PAUSE.READ);

      const saveBtn = dialog.locator('button:has-text("Save"), button:has-text("Override")');
      if (await saveBtn.isVisible()) {
        await cursorClick(
          page,
          '[role="dialog"] button:has-text("Save"), [role="dialog"] button:has-text("Override")'
        );
        await wait(PAUSE.LONG);
      }
    }

    console.log("-> Deadline override demo complete.");
    await wait(PAUSE.READ);
  },
};

export default demo;
