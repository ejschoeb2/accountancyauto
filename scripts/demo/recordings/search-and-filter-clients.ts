/**
 * Recording: Search & Filter the Client Table
 *
 * Login, navigate to /clients, switch to the Data view, then use
 * search bar, status filter, client type filter, and sort options.
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
    "Use the search bar, status filter, and filing type filter to find specific clients in the table.",
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

    // ---- Use search bar ----
    console.log("-> Typing in search bar...");
    await cursorType(page, 'input[placeholder="Search by client name..."]', "Acme", {
      delay: 60,
    });
    await wait(PAUSE.LONG);

    // ---- Clear search ----
    console.log("-> Clearing search...");
    // The clear X button is a sibling Button inside the same relative container
    const clearBtn = page.locator('input[placeholder="Search by client name..."] ~ button').first();
    if (await clearBtn.isVisible()) {
      await cursorClick(page, 'input[placeholder="Search by client name..."] ~ button');
    } else {
      // Fallback: clear via fill
      await page.locator('input[placeholder="Search by client name..."]').fill("");
    }
    await wait(PAUSE.MEDIUM);

    // ---- Open filters panel ----
    console.log("-> Opening filters...");
    await page.locator('button:has-text("Filter")').first().waitFor({ state: "visible", timeout: 5000 });
    await cursorClick(page, 'button:has-text("Filter")');
    await wait(PAUSE.MEDIUM);

    // ---- Click a status filter (Overdue) ----
    console.log("-> Filtering by Overdue status...");
    await cursorClick(page, 'button:has-text("Overdue")');
    await wait(PAUSE.LONG);

    // ---- Click another status filter (Approaching) ----
    console.log("-> Adding Approaching status filter...");
    await cursorClick(page, 'button:has-text("Approaching")');
    await wait(PAUSE.LONG);

    // ---- Click a client type filter (Limited Company) ----
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

    // ---- Close filters panel ----
    console.log("-> Closing filters...");
    // After clearing, the button text becomes "Close Filters" since showFilters is still true
    await cursorClick(page, 'button:has-text("Close Filters")');
    await wait(PAUSE.MEDIUM);

    // ---- Change sort order ----
    console.log("-> Opening sort selector...");
    // The sort Select trigger is next to the "Sort by:" label
    await cursorClick(page, '[class*="min-w-[180px]"]');
    await wait(PAUSE.SHORT);

    console.log("-> Selecting Name (A-Z) sort...");
    await cursorClick(page, '[role="option"]:has-text("Name (A-Z)")');
    await wait(PAUSE.LONG);

    // ---- Show sorted results ----
    console.log("-> Reviewing sorted results...");
    await cursorMove(page, "table");
    await wait(PAUSE.READ);

    console.log("-> Search and filter demo complete.");
    await wait(PAUSE.SHORT);
  },
};

export default demo;
