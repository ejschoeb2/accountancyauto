/**
 * Recording: View Sent Email Activity
 *
 * Navigate to the Activity page, switch to Sent Emails view,
 * browse the table, open a sent email detail modal, and close.
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
  id: "view-email-activity",
  title: "View Sent Email Activity",
  description:
    "Browse all sent emails with delivery statuses — a complete history of every email Prompt has sent.",
  tags: [
    "activity",
    "email",
    "logs",
    "sent",
    "delivery",
    "status",
  ],
  category: "Emails",
  hasSideEffects: false,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/activity");

    // ---- Switch to Sent Emails ----
    console.log("-> Switching to Sent Emails view...");
    await page.waitForLoadState("networkidle");
    const sentToggle = page.locator('button:has-text("Sent Emails")');
    if (await sentToggle.isVisible()) {
      await cursorClick(page, 'button:has-text("Sent Emails")');
      await page.waitForLoadState("networkidle");
      await injectCursor(page);
      await wait(PAUSE.MEDIUM);
    }

    // ---- Browse the sent emails table ----
    console.log("-> Browsing sent email rows...");
    const sentRows = page.locator("table tbody tr");
    const rowCount = await sentRows.count();

    if (rowCount > 0) {
      await cursorMove(page, "table tbody tr", 0);
      await wait(PAUSE.SHORT);
      if (rowCount > 1) {
        await cursorMove(page, "table tbody tr", 1);
        await wait(PAUSE.SHORT);
      }
      if (rowCount > 2) {
        await cursorMove(page, "table tbody tr", 2);
        await wait(PAUSE.SHORT);
      }
    }
    await wait(PAUSE.MEDIUM);

    // ---- Click a sent email row to open detail modal ----
    console.log("-> Opening a sent email to view details...");
    if (rowCount > 0) {
      await cursorClick(page, "table tbody tr", 0);
      await wait(PAUSE.LONG);

      const dialog = page.locator('[role="dialog"]');
      if (await dialog.isVisible().catch(() => false)) {
        console.log("-> Viewing sent email details...");
        await wait(PAUSE.READ);

        // Close modal
        await page.keyboard.press("Escape");
        await wait(PAUSE.SHORT);
      }
    }

    console.log("-> Sent email activity demo complete.");
    await wait(PAUSE.SHORT);
  },
};

export default demo;
