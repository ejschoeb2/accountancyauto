/**
 * Recording: View Upload Activity Log
 *
 * Navigate to /activity, switch to the Uploads tab, browse the uploads
 * table, open filters, filter by filing type and verdict, then clear filters.
 */

import {
  type DemoDefinition,
  login,
  navigateTo,
  cursorClick,
  cursorMove,
  cursorType,
  wait,
  PAUSE,
  injectCursor,
} from "../helpers";

const demo: DemoDefinition = {
  id: "view-upload-activity",
  title: "View Upload Activity Log",
  description:
    "Switch to the 'Uploads' tab on the Activity page to see all document uploads with their validation status.",
  tags: ["uploads", "activity", "log", "documents", "validation", "status"],
  category: "Documents",
  hasSideEffects: false,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/activity");

    // ─── View the Activity page header ───
    console.log("→ Viewing Activity page...");
    await wait(PAUSE.MEDIUM);

    // ─── Switch to Uploads tab ───
    console.log("→ Switching to Uploads tab...");
    await cursorClick(page, 'button:has-text("Uploads")');
    await page.waitForLoadState("networkidle");
    await injectCursor(page);
    await wait(PAUSE.LONG);

    // ─── Wait for table to load ───
    const uploadsTable = page.locator("table");
    await uploadsTable.waitFor({ state: "visible", timeout: 10000 });

    // Check for empty state
    const emptyState = page.locator("text=No portal uploads yet");
    if (await emptyState.isVisible()) {
      console.log("→ No uploads available — showing empty state.");
      await wait(PAUSE.READ);
      return;
    }

    // ─── Browse the table ───
    console.log("→ Browsing uploads table...");
    await cursorMove(page, "table tbody tr", 0);
    await wait(PAUSE.MEDIUM);

    if ((await page.locator("table tbody tr").count()) > 1) {
      await cursorMove(page, "table tbody tr", 1);
      await wait(PAUSE.SHORT);
    }
    if ((await page.locator("table tbody tr").count()) > 2) {
      await cursorMove(page, "table tbody tr", 2);
      await wait(PAUSE.SHORT);
    }
    await wait(PAUSE.MEDIUM);

    // ─── Search by client name ───
    console.log("→ Searching by client name...");
    await cursorType(
      page,
      'input[placeholder="Search by client name..."]',
      "Smith",
      { delay: 40 }
    );
    await wait(PAUSE.LONG);

    // Clear search
    const clearBtn = page.locator('input[placeholder="Search by client name..."] ~ button').first();
    if (await clearBtn.isVisible()) {
      await cursorClick(page, 'input[placeholder="Search by client name..."] ~ button');
    } else {
      const searchInput = page.locator('input[placeholder="Search by client name..."]');
      await searchInput.fill("");
    }
    await wait(PAUSE.MEDIUM);

    // ─── Open filters panel ───
    console.log("→ Opening filters...");
    await cursorClick(page, 'button:has-text("Filter")');
    await wait(PAUSE.LONG);

    // ─── Click a filing type filter chip ───
    console.log("→ Filtering by filing type...");
    const filingChip = page.locator('button:has-text("Corp Tax")');
    if (await filingChip.isVisible()) {
      await cursorClick(page, 'button:has-text("Corp Tax")');
      await wait(PAUSE.MEDIUM);
    }

    // ─── Click a verdict filter chip ───
    console.log("→ Filtering by verdict...");
    const verdictChip = page.locator('button:has-text("Review needed")');
    if (await verdictChip.isVisible()) {
      await cursorClick(page, 'button:has-text("Review needed")');
      await wait(PAUSE.MEDIUM);
    }

    // ─── View filtered results ───
    console.log("→ Viewing filtered results...");
    await wait(PAUSE.READ);

    // ─── Clear all filters ───
    console.log("→ Clearing all filters...");
    const clearAll = page.locator('button:has-text("Clear all filters")');
    if (await clearAll.isVisible()) {
      await cursorClick(page, 'button:has-text("Clear all filters")');
      await wait(PAUSE.MEDIUM);
    }

    // ─── Close filters ───
    console.log("→ Closing filters panel...");
    await cursorClick(page, 'button:has-text("Close Filters")');
    await wait(PAUSE.MEDIUM);

    // ─── Change sort order ───
    console.log("→ Changing sort order...");
    const sortTrigger = page.locator('span:has-text("Sort by:") + div [data-slot="select-trigger"], span:has-text("Sort by:") ~ [data-slot="select-trigger"]').first();
    // Use a broader approach — find the sort select near the Sort by label
    const sortSelect = page.locator('[data-slot="select-trigger"]').last();
    if (await sortSelect.isVisible()) {
      await cursorClick(page, '[data-slot="select-trigger"]');
      await wait(PAUSE.SHORT);
      const clientOption = page.locator('[role="option"]:has-text("Client Name (A-Z)")');
      if (await clientOption.isVisible()) {
        await cursorClick(page, '[role="option"]:has-text("Client Name (A-Z)")');
      } else {
        await page.keyboard.press("Escape");
      }
      await wait(PAUSE.MEDIUM);
    }

    await wait(PAUSE.READ);
    console.log("→ Upload activity log demo complete.");
  },
};

export default demo;
