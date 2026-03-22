/**
 * Recording: Use the Upcoming Deadlines Widget
 *
 * Login, scroll to the Upcoming Deadlines section on the dashboard,
 * use next/previous pagination buttons, hover over some rows,
 * and click a client to jump to their detail page.
 */

import {
  type DemoDefinition,
  login,
  cursorClick,
  cursorMove,
  injectCursor,
  wait,
  PAUSE,
} from "../helpers";

const demo: DemoDefinition = {
  id: "upcoming-deadlines-widget",
  title: "Use the Upcoming Deadlines Widget",
  description:
    "View the upcoming deadlines timeline, use next/previous buttons to paginate, and click to jump to a client.",
  tags: ["deadlines", "upcoming", "timeline", "dashboard", "widget", "navigate"],
  category: "Dashboard",
  hasSideEffects: false,

  async record({ page }) {
    await login(page);

    // ---- Scroll to Upcoming Deadlines ----
    console.log("-> Scrolling to Upcoming Deadlines section...");
    const deadlinesHeader = page.locator('text=Upcoming Deadlines').first();
    await deadlinesHeader.scrollIntoViewIfNeeded();
    await injectCursor(page);
    await wait(PAUSE.MEDIUM);

    // ---- Highlight the section header ----
    console.log("-> Highlighting Upcoming Deadlines header...");
    await cursorMove(page, 'text=Upcoming Deadlines');
    await wait(PAUSE.READ);

    // The card wraps everything — find client rows (Links) inside it
    const cardSelector = 'text=Upcoming Deadlines >> xpath=ancestor::*[contains(@class,"card")]';
    const clientLinks = page.locator(`${cardSelector} >> a`);
    const linkCount = await clientLinks.count();

    if (linkCount === 0) {
      console.log("-> No upcoming deadlines — showing empty state...");
      await cursorMove(page, 'text=No upcoming deadlines');
      await wait(PAUSE.READ);
    } else {
      // ---- Hover over the first few rows ----
      console.log("-> Hovering over deadline rows...");
      await cursorMove(page, `${cardSelector} >> a`, 0);
      await wait(PAUSE.READ);

      if (linkCount > 1) {
        await cursorMove(page, `${cardSelector} >> a`, 1);
        await wait(PAUSE.MEDIUM);
      }

      if (linkCount > 2) {
        await cursorMove(page, `${cardSelector} >> a`, 2);
        await wait(PAUSE.MEDIUM);
      }

      // ---- Paginate using next/previous buttons ----
      // Pagination is inside div.flex.items-center.justify-end.gap-2.pt-4
      // Two buttons: prev (ChevronLeft) then next (ChevronRight)
      const paginationContainer = page.locator(`${cardSelector} >> .flex.items-center.justify-end.gap-2.pt-4`).first();
      const paginationVisible = await paginationContainer.isVisible().catch(() => false);

      if (paginationVisible) {
        const paginationBtns = paginationContainer.locator("button");
        const btnCount = await paginationBtns.count();

        if (btnCount >= 2) {
          const nextBtn = paginationBtns.nth(1);
          const nextDisabled = await nextBtn.isDisabled();

          if (!nextDisabled) {
            console.log("-> Clicking next page...");
            await cursorClick(page, `${cardSelector} >> .flex.items-center.justify-end.gap-2.pt-4 >> button >> nth=1`);
            await wait(PAUSE.READ);

            // Hover a row on the second page
            const newLinks = await clientLinks.count();
            if (newLinks > 0) {
              await cursorMove(page, `${cardSelector} >> a`, 0);
              await wait(PAUSE.MEDIUM);
            }

            // Click next again if available
            const stillNextDisabled = await nextBtn.isDisabled();
            if (!stillNextDisabled) {
              console.log("-> Clicking next page again...");
              await cursorClick(page, `${cardSelector} >> .flex.items-center.justify-end.gap-2.pt-4 >> button >> nth=1`);
              await wait(PAUSE.READ);
            }

            // Go back to first page using previous button
            console.log("-> Clicking previous page to go back...");
            const prevBtn = paginationBtns.nth(0);
            if (!(await prevBtn.isDisabled())) {
              await cursorClick(page, `${cardSelector} >> .flex.items-center.justify-end.gap-2.pt-4 >> button >> nth=0`);
              await wait(PAUSE.MEDIUM);
            }

            // Go back again if needed
            if (!(await prevBtn.isDisabled())) {
              await cursorClick(page, `${cardSelector} >> .flex.items-center.justify-end.gap-2.pt-4 >> button >> nth=0`);
              await wait(PAUSE.MEDIUM);
            }
          }
        }
      }

      // ---- Click a client row to navigate to detail page ----
      console.log("-> Clicking a client to navigate to detail page...");
      await cursorClick(page, `${cardSelector} >> a`, 0);
      await page.waitForLoadState("networkidle");
      await injectCursor(page);
      await wait(PAUSE.READ);

      // Show we arrived at the client detail page
      console.log("-> Arrived at client detail page.");
      await wait(PAUSE.READ);
    }

    console.log("-> Upcoming Deadlines widget demo complete.");
  },
};

export default demo;
