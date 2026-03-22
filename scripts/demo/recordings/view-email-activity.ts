/**
 * Recording: View Email Activity & Delivery Logs
 *
 * Navigate to the Activity page, show the outbound tab with sent emails,
 * browse the delivery log table, and explore filters.
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
  id: "view-email-activity",
  title: "View Email Activity & Delivery Logs",
  description:
    "Navigate to the Activity page and browse sent emails, queued emails, and delivery statuses.",
  tags: [
    "activity",
    "email",
    "logs",
    "sent",
    "queued",
    "delivery",
    "status",
  ],
  category: "Emails",
  hasSideEffects: false,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/activity");

    // ---- Page loads on Outbound / Queued by default ----
    console.log("-> Viewing Activity page (Outbound / Queued)...");
    await page.waitForLoadState("networkidle");
    await wait(PAUSE.LONG);

    // ---- Show the Outbound toggle is active ----
    console.log("-> Highlighting Outbound toggle...");
    await cursorMove(page, 'button:has-text("Outbound")');
    await wait(PAUSE.SHORT);

    // ---- Switch to Sent Emails ----
    console.log("-> Switching to Sent Emails view...");
    await cursorClick(page, 'button:has-text("Sent Emails")');
    await wait(PAUSE.LONG);

    // ---- Browse the sent emails table ----
    console.log("-> Browsing sent email rows...");
    const sentRows = page.locator("table tbody tr");
    const rowCount = await sentRows.count();

    if (rowCount > 0) {
      await cursorMove(page, "table tbody tr", 0);
      await wait(PAUSE.SHORT);
      await cursorMove(page, "table tbody tr", Math.min(1, rowCount - 1));
      await wait(PAUSE.SHORT);
      if (rowCount > 2) {
        await cursorMove(page, "table tbody tr", 2);
        await wait(PAUSE.SHORT);
      }
    }

    await wait(PAUSE.READ);

    // ---- Open filters panel ----
    console.log("-> Opening filters...");
    const filterBtn = page
      .locator('button:has-text("Filter")')
      .first();
    if (await filterBtn.isVisible()) {
      await cursorClick(page, 'button:has-text("Filter")');
      await wait(PAUSE.MEDIUM);

      // Hover over a deadline type filter chip
      const deadlineChip = page
        .locator('button:has-text("Corp Tax")')
        .first();
      if (await deadlineChip.isVisible()) {
        await cursorMove(page, 'button:has-text("Corp Tax")');
        await wait(PAUSE.SHORT);
      }
    }

    await wait(PAUSE.READ);

    // ---- Switch back to Queued Emails briefly ----
    console.log("-> Switching to Queued Emails view...");
    await cursorClick(page, 'button:has-text("Queued Emails")');
    await wait(PAUSE.LONG);

    console.log("-> Activity overview complete -- pausing for viewer...");
    await wait(PAUSE.READ);
  },
};

export default demo;
