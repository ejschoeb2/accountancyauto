/**
 * Recording: Search & Filter the Client Table
 *
 * Login, navigate to /clients, switch to Data view, use the search bar
 * to find actual seeded clients, apply status and type filters, sort
 * by different columns. Full table width is shown.
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
  id: "search-and-filter-clients",
  title: "Search & Filter the Client Table",
  description:
    "Use the search bar to find clients by name, apply status and type filters, and sort by different columns.",
  tags: ["search", "filter", "find", "clients", "table", "sort"],
  category: "Clients",
  hasSideEffects: false,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/clients");

    // ---- Switch to Data view ----
    console.log("-> Switching to Client Data view...");
    await cursorClick(page, 'button:has-text("Client Data")');
    await wait(PAUSE.MEDIUM);

    // ---- Show the full table ----
    console.log("-> Showing client table...");
    await cursorMove(page, "table");
    await wait(PAUSE.READ);

    // ---- Search for "Hartley" (seeded client) ----
    console.log("-> Searching for 'Hartley'...");
    await cursorType(page, 'input[placeholder="Search by client name..."]', "Hartley", {
      delay: 60,
    });
    await wait(PAUSE.LONG);

    // Show the filtered result
    await cursorMove(page, "table");
    await wait(PAUSE.READ);

    // ---- Clear search ----
    console.log("-> Clearing search...");
    const searchInput = page.locator('input[placeholder="Search by client name..."]');
    await searchInput.fill("");
    await wait(PAUSE.MEDIUM);

    // ---- Search for "Brighton" (seeded client) ----
    console.log("-> Searching for 'Brighton'...");
    await cursorType(page, 'input[placeholder="Search by client name..."]', "Brighton", {
      delay: 60,
    });
    await wait(PAUSE.LONG);
    await cursorMove(page, "table");
    await wait(PAUSE.MEDIUM);

    // ---- Clear search ----
    console.log("-> Clearing search...");
    await searchInput.fill("");
    await wait(PAUSE.MEDIUM);

    // ---- Search for "Thames" (seeded client) ----
    console.log("-> Searching for 'Thames'...");
    await cursorType(page, 'input[placeholder="Search by client name..."]', "Thames", {
      delay: 60,
    });
    await wait(PAUSE.LONG);
    await cursorMove(page, "table");
    await wait(PAUSE.MEDIUM);

    // ---- Clear search ----
    console.log("-> Clearing search...");
    await searchInput.fill("");
    await wait(PAUSE.MEDIUM);

    // ---- Open filters panel ----
    console.log("-> Opening filters...");
    await page.locator('button:has-text("Filter")').first().waitFor({ state: "visible", timeout: 5000 });
    await cursorClick(page, 'button:has-text("Filter")');
    await wait(PAUSE.MEDIUM);

    // ---- Click Overdue status filter ----
    console.log("-> Filtering by Overdue status...");
    await cursorClick(page, 'button:has-text("Overdue")');
    await wait(PAUSE.LONG);

    // Show filtered results
    await cursorMove(page, "table");
    await wait(PAUSE.READ);

    // ---- Add Approaching status filter ----
    console.log("-> Adding Approaching status filter...");
    await cursorClick(page, 'button:has-text("Approaching")');
    await wait(PAUSE.LONG);

    // Show combined filter results
    await cursorMove(page, "table");
    await wait(PAUSE.MEDIUM);

    // ---- Apply Limited Company type filter ----
    console.log("-> Filtering by Limited Company type...");
    await cursorClick(page, 'button:has-text("Limited Company")');
    await wait(PAUSE.LONG);

    // Show results
    await cursorMove(page, "table");
    await wait(PAUSE.READ);

    // ---- Clear all filters ----
    console.log("-> Clearing all filters...");
    await cursorClick(page, 'button:has-text("Clear all filters")');
    await wait(PAUSE.MEDIUM);

    // ---- Close filters panel ----
    console.log("-> Closing filters...");
    await cursorClick(page, 'button:has-text("Close Filters")');
    await wait(PAUSE.MEDIUM);

    // ---- Sort by Name (A-Z) ----
    console.log("-> Opening sort selector...");
    // The sort Select trigger has min-w-[180px] class
    const sortTrigger = page.locator('button[role="combobox"]').filter({ has: page.locator('text=Deadline') }).first();
    // Fallback: find the SelectTrigger near "Sort by:"
    const sortContainer = page.locator('text=Sort by:').locator('xpath=following-sibling::*').first();
    try {
      await sortContainer.click();
      await wait(PAUSE.SHORT);
    } catch {
      // Try clicking the select trigger directly
      const triggers = page.locator('.min-w-\\[180px\\]');
      if (await triggers.count() > 0) {
        await triggers.first().click();
        await wait(PAUSE.SHORT);
      }
    }

    console.log("-> Selecting Name (A-Z) sort...");
    const nameAzOption = page.locator('[role="option"]:has-text("Name (A-Z)")');
    if (await nameAzOption.isVisible().catch(() => false)) {
      await cursorClick(page, '[role="option"]:has-text("Name (A-Z)")');
      await wait(PAUSE.LONG);
    }

    // ---- Show sorted results ----
    console.log("-> Reviewing sorted results...");
    await cursorMove(page, "table");
    await wait(PAUSE.READ);

    // ---- Sort by Deadline (Earliest) ----
    console.log("-> Sorting by Deadline (Earliest)...");
    try {
      await sortContainer.click();
      await wait(PAUSE.SHORT);
    } catch {
      const triggers = page.locator('.min-w-\\[180px\\]');
      if (await triggers.count() > 0) {
        await triggers.first().click();
        await wait(PAUSE.SHORT);
      }
    }

    const deadlineOption = page.locator('[role="option"]:has-text("Deadline (Earliest)")');
    if (await deadlineOption.isVisible().catch(() => false)) {
      await cursorClick(page, '[role="option"]:has-text("Deadline (Earliest)")');
      await wait(PAUSE.LONG);
    }

    await cursorMove(page, "table");
    await wait(PAUSE.READ);

    console.log("-> Search and filter demo complete.");
    await wait(PAUSE.SHORT);
  },
};

export default demo;
