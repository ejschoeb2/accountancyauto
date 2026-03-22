/**
 * Recording: Search & Filter the Client Table
 *
 * On /clients, use the search bar, open filters, click a status filter
 * and a client type filter to narrow down results.
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
  id: "search-and-filter-clients",
  title: "Search & Filter the Client Table",
  description:
    "Use the search bar, status filter, and filing type filter to find specific clients in the table.",
  tags: ["search", "filter", "find", "clients", "table", "sort"],
  category: "Clients",
  hasSideEffects: false,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/clients");

    // ---- Use search bar ----
    console.log("-> Typing in search bar...");
    await cursorType(page, 'input[placeholder="Search by client name..."]', "Acme", {
      delay: 60,
    });
    await wait(PAUSE.LONG);

    // ---- Clear search ----
    console.log("-> Clearing search...");
    // Click the clear (X) button inside the search input
    const clearBtn = page.locator('input[placeholder="Search by client name..."] ~ button').first();
    if (await clearBtn.isVisible()) {
      await cursorClick(page, 'input[placeholder="Search by client name..."] ~ button');
    } else {
      // Fallback: triple-click and delete
      await page.locator('input[placeholder="Search by client name..."]').fill("");
    }
    await wait(PAUSE.MEDIUM);

    // ---- Open filters panel ----
    console.log("-> Opening filters...");
    await page.locator('button:has-text("Filter")').first().waitFor({ state: "visible", timeout: 5000 });
    await cursorClick(page, 'button:has-text("Filter")');
    await wait(PAUSE.MEDIUM);

    // ---- Click a status filter (e.g. "Overdue") ----
    console.log("-> Filtering by Overdue status...");
    await cursorClick(page, 'button:has-text("Overdue")');
    await wait(PAUSE.LONG);

    // ---- Click another status filter (e.g. "Approaching") ----
    console.log("-> Adding Approaching status filter...");
    await cursorClick(page, 'button:has-text("Approaching")');
    await wait(PAUSE.LONG);

    // ---- Click a client type filter ----
    console.log("-> Filtering by Limited Company type...");
    await cursorClick(page, 'button:has-text("Limited Company")');
    await wait(PAUSE.LONG);

    // ---- Show filtered results ----
    console.log("-> Reviewing filtered results...");
    await cursorMove(page, "table");
    await wait(PAUSE.READ);

    // ---- Clear all filters ----
    console.log("-> Clearing all filters...");
    await cursorClick(page, 'button:has-text("Clear all filters")');
    await wait(PAUSE.MEDIUM);

    // ---- Close filters ----
    console.log("-> Closing filters...");
    await cursorClick(page, 'button:has-text("Close Filters")');
    await wait(PAUSE.MEDIUM);

    console.log("-> Search and filter demo complete.");
    await wait(PAUSE.SHORT);
  },
};

export default demo;
