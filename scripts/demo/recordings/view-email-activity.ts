/**
 * Recording: View Sent Email Activity & Delivery Logs
 *
 * Navigate to the Activity page, switch to Sent Emails, search for
 * specific emails, apply filters (deadline type, delivery status),
 * change sorting, and browse the sent email table.
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
  injectCursor,
} from "../helpers";

const demo: DemoDefinition = {
  id: "view-email-activity",
  title: "View Sent Email Activity & Delivery Logs",
  description:
    "Navigate to the Activity page, switch to sent emails, search by client name, filter by deadline type and delivery status, and change sorting.",
  tags: [
    "activity",
    "email",
    "logs",
    "sent",
    "delivery",
    "status",
    "filter",
    "search",
    "sort",
  ],
  category: "Emails",
  hasSideEffects: false,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/activity");

    // ---- Page loads on Outbound / Queued by default ----
    console.log("-> Viewing Activity page...");
    await page.waitForLoadState("networkidle");
    await wait(PAUSE.LONG);

    // ---- Switch to Sent Emails ----
    console.log("-> Switching to Sent Emails view...");
    const sentToggle = page.locator('button:has-text("Sent Emails")');
    if (await sentToggle.isVisible()) {
      await cursorClick(page, 'button:has-text("Sent Emails")');
      await page.waitForLoadState("networkidle");
      await injectCursor(page);
      await wait(PAUSE.LONG);
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
    }
    await wait(PAUSE.MEDIUM);

    // ---- Search for a specific client ----
    console.log("-> Searching for a client by name...");
    const searchInput = page.locator('input[placeholder="Search by client name..."]');
    if (await searchInput.isVisible()) {
      await cursorType(
        page,
        'input[placeholder="Search by client name..."]',
        "Hartley",
        { delay: 40 }
      );
      await wait(PAUSE.LONG);

      // View filtered results
      console.log("-> Viewing search results...");
      await wait(PAUSE.READ);

      // Clear search
      console.log("-> Clearing search...");
      const clearSearchBtn = page.locator('input[placeholder="Search by client name..."] ~ button').first();
      if (await clearSearchBtn.isVisible()) {
        await cursorClick(page, 'input[placeholder="Search by client name..."] ~ button');
      } else {
        await searchInput.fill("");
      }
      await wait(PAUSE.MEDIUM);
    }

    // ---- Open filters panel ----
    console.log("-> Opening filters panel...");
    const filterBtn = page.locator('button:has-text("Filter")').first();
    if (await filterBtn.isVisible()) {
      await cursorClick(page, 'button:has-text("Filter")');
      await wait(PAUSE.LONG);
    }

    // ---- Filter by delivery status — click "Delivered" ----
    console.log("-> Filtering by delivery status...");
    const deliveredChip = page.locator('button:has-text("Delivered")').first();
    if (await deliveredChip.isVisible()) {
      await cursorClick(page, 'button:has-text("Delivered")');
      await wait(PAUSE.MEDIUM);
    }

    // View filtered results
    console.log("-> Viewing delivered emails...");
    await wait(PAUSE.READ);

    // ---- Add a deadline type filter ----
    console.log("-> Also filtering by deadline type...");
    const corpTaxChip = page.locator('button:has-text("Corp Tax")').first();
    if (await corpTaxChip.isVisible()) {
      await cursorClick(page, 'button:has-text("Corp Tax")');
      await wait(PAUSE.MEDIUM);
    }

    // View combined filter results
    await wait(PAUSE.READ);

    // ---- Clear all filters ----
    console.log("-> Clearing all filters...");
    const clearAllBtn = page.locator('button:has-text("Clear all")').first();
    if (await clearAllBtn.isVisible()) {
      await cursorClick(page, 'button:has-text("Clear all")');
      await wait(PAUSE.MEDIUM);
    }

    // ---- Close filter panel ----
    console.log("-> Closing filters...");
    const closeFiltersBtn = page.locator('button:has-text("Close Filters")').first();
    if (await closeFiltersBtn.isVisible()) {
      await cursorClick(page, 'button:has-text("Close Filters")');
      await wait(PAUSE.MEDIUM);
    }

    // ---- Change sort order ----
    console.log("-> Changing sort order...");
    const sortSelect = page.locator('[data-slot="select-trigger"]').last();
    if (await sortSelect.isVisible()) {
      await cursorClick(page, '[data-slot="select-trigger"]');
      await wait(PAUSE.SHORT);

      const clientNameSort = page.locator('[role="option"]:has-text("Client Name (A-Z)")').first();
      if (await clientNameSort.isVisible()) {
        await cursorClick(page, '[role="option"]:has-text("Client Name (A-Z)")');
      } else {
        await page.keyboard.press("Escape");
      }
      await wait(PAUSE.LONG);
    }

    // ---- View sorted results ----
    console.log("-> Viewing sorted results...");
    await wait(PAUSE.READ);

    // ---- Click a sent email row to open detail modal ----
    console.log("-> Clicking on a sent email to view details...");
    const firstSentRow = page.locator("table tbody tr").first();
    if (await firstSentRow.isVisible()) {
      await cursorClick(page, "table tbody tr", 0);
      await wait(PAUSE.LONG);

      // If a detail modal/panel opens, view it
      const dialog = page.locator('[role="dialog"]');
      if (await dialog.isVisible()) {
        console.log("-> Viewing sent email details...");
        await wait(PAUSE.READ);
        await page.keyboard.press("Escape");
        await wait(PAUSE.MEDIUM);
      }
    }

    console.log("-> Sent email activity demo complete.");
    await wait(PAUSE.SHORT);
  },
};

export default demo;
