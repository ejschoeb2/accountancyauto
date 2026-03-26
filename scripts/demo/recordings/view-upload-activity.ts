/**
 * Recording: View Upload Activity Log
 *
 * Navigate to /activity, switch to the Uploads tab, search by client
 * name, apply filters (filing type, verdict), change sort order, and
 * browse the uploads table.
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
  id: "view-upload-activity",
  title: "View Upload Activity Log",
  description:
    "Switch to the Uploads tab on the Activity page, search by client name, filter by filing type and validation verdict, and change the sort order.",
  tags: ["uploads", "activity", "log", "documents", "validation", "status", "filter", "sort", "search"],
  category: "Documents",
  hasSideEffects: false,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/activity");

    // ─── View the Activity page header ───
    console.log("-> Viewing Activity page...");
    await wait(PAUSE.MEDIUM);

    // ─── Switch to Uploads tab ───
    console.log("-> Switching to Uploads tab...");
    await cursorClick(page, 'button:has-text("Uploads")');
    await page.waitForLoadState("networkidle");
    await injectCursor(page);
    await wait(PAUSE.LONG);

    // ─── Wait for table to load ───
    const uploadsTable = page.locator("table");
    await uploadsTable.waitFor({ state: "visible", timeout: 10000 });

    // Check for empty state
    const emptyState = page.locator('text="No portal uploads yet"');
    if (await emptyState.isVisible()) {
      console.log("-> No uploads available — showing empty state.");
      await wait(PAUSE.READ);
      return;
    }

    // ─── Browse the table ───
    console.log("-> Browsing uploads table...");
    await cursorMove(page, "table tbody tr", 0);
    await wait(PAUSE.MEDIUM);

    if ((await page.locator("table tbody tr").count()) > 1) {
      await cursorMove(page, "table tbody tr", 1);
      await wait(PAUSE.SHORT);
    }
    await wait(PAUSE.MEDIUM);

    // ─── Search by client name ───
    console.log("-> Searching by client name...");
    const searchInput = page.locator('input[placeholder="Search by client name..."]');
    if (await searchInput.isVisible()) {
      await cursorType(
        page,
        'input[placeholder="Search by client name..."]',
        "Coastal",
        { delay: 40 }
      );
      await wait(PAUSE.LONG);

      // View search results
      console.log("-> Viewing search results for 'Coastal'...");
      await wait(PAUSE.READ);

      // Clear search
      console.log("-> Clearing search...");
      const clearBtn = page.locator('input[placeholder="Search by client name..."] ~ button').first();
      if (await clearBtn.isVisible()) {
        await cursorClick(page, 'input[placeholder="Search by client name..."] ~ button');
      } else {
        await searchInput.fill("");
      }
      await wait(PAUSE.MEDIUM);
    }

    // ─── Open filters panel ───
    console.log("-> Opening filters panel...");
    const filterBtn = page.locator('button:has-text("Filter")').first();
    if (await filterBtn.isVisible()) {
      await cursorClick(page, 'button:has-text("Filter")');
      await wait(PAUSE.LONG);
    }

    // ─── Filter by filing type — Corp Tax ───
    console.log("-> Filtering by filing type (Corp Tax)...");
    const corpTaxChip = page.locator('button:has-text("Corp Tax")').first();
    if (await corpTaxChip.isVisible()) {
      await cursorClick(page, 'button:has-text("Corp Tax")');
      await wait(PAUSE.MEDIUM);
    }

    // ─── View filtered results ───
    console.log("-> Viewing filtered results...");
    await wait(PAUSE.READ);

    // ─── Also filter by verdict — Review needed ───
    console.log("-> Also filtering by verdict (Review needed)...");
    const reviewChip = page.locator('button:has-text("Review needed")').first();
    if (await reviewChip.isVisible()) {
      await cursorClick(page, 'button:has-text("Review needed")');
      await wait(PAUSE.MEDIUM);
    }

    // ─── View combined filter results ───
    await wait(PAUSE.READ);

    // ─── Clear all filters ───
    console.log("-> Clearing all filters...");
    const clearAll = page.locator('button:has-text("Clear all")').first();
    if (await clearAll.isVisible()) {
      await cursorClick(page, 'button:has-text("Clear all")');
      await wait(PAUSE.MEDIUM);
    }

    // ─── Close filters ───
    console.log("-> Closing filters panel...");
    const closeFilters = page.locator('button:has-text("Close Filters")').first();
    if (await closeFilters.isVisible()) {
      await cursorClick(page, 'button:has-text("Close Filters")');
      await wait(PAUSE.MEDIUM);
    }

    // ─── Change sort order ───
    console.log("-> Changing sort order to Client Name (A-Z)...");
    const sortSelect = page.locator('[data-slot="select-trigger"]').last();
    if (await sortSelect.isVisible()) {
      await cursorClick(page, '[data-slot="select-trigger"]');
      await wait(PAUSE.SHORT);

      const clientAZ = page.locator('[role="option"]:has-text("Client Name (A-Z)")').first();
      if (await clientAZ.isVisible()) {
        await cursorClick(page, '[role="option"]:has-text("Client Name (A-Z)")');
      } else {
        await page.keyboard.press("Escape");
      }
      await wait(PAUSE.LONG);
    }

    // ─── View sorted results ───
    console.log("-> Viewing sorted results...");
    await wait(PAUSE.READ);

    // ─── Change sort to Received (Earliest) to show oldest uploads ───
    console.log("-> Changing sort to Received (Earliest)...");
    const sortSelect2 = page.locator('[data-slot="select-trigger"]').last();
    if (await sortSelect2.isVisible()) {
      await cursorClick(page, '[data-slot="select-trigger"]');
      await wait(PAUSE.SHORT);

      const receivedEarliest = page.locator('[role="option"]:has-text("Received (Earliest)")').first();
      if (await receivedEarliest.isVisible()) {
        await cursorClick(page, '[role="option"]:has-text("Received (Earliest)")');
      } else {
        await page.keyboard.press("Escape");
      }
      await wait(PAUSE.MEDIUM);
    }

    await wait(PAUSE.READ);
    console.log("-> Upload activity log demo complete.");
  },
};

export default demo;
