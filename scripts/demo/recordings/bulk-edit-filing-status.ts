/**
 * Recording: Edit Client Progress from the Deadlines Table
 *
 * Navigate to /clients, switch to the status/deadline view, enter
 * "Edit Progress" mode, toggle document checkboxes for several clients,
 * then exit edit mode.
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
  id: "edit-client-progress",
  title: "Edit Client Progress from the Deadlines Table",
  description:
    "Enter 'Edit Progress' mode on the client table to quickly toggle document checkboxes and track which records have been received across multiple clients.",
  tags: ["progress", "documents", "received", "edit", "clients", "deadlines"],
  category: "Clients",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/clients");

    // ---- Switch to the Status view ----
    console.log("-> Switching to Status view...");
    const statusToggle = page.locator('button:has-text("Status")');
    if (await statusToggle.isVisible()) {
      await cursorClick(page, 'button:has-text("Status")');
      await page.waitForLoadState("networkidle");
      await injectCursor(page);
      await wait(PAUSE.LONG);
    }

    // ---- Show the status columns with traffic light badges ----
    console.log("-> Reviewing filing status columns...");
    await cursorMove(page, "table thead");
    await wait(PAUSE.READ);

    // ---- Enter Edit Progress mode ----
    console.log("-> Entering Edit Progress mode...");
    const editProgressBtn = page.locator('button:has-text("Edit Progress")');
    await editProgressBtn.waitFor({ state: "visible", timeout: 5000 });
    await cursorClick(page, 'button:has-text("Edit Progress")');
    await wait(PAUSE.LONG);

    // ---- The table should now show document checkboxes ----
    console.log("-> Document checkboxes are now visible in the table...");
    await cursorMove(page, "table tbody");
    await wait(PAUSE.READ);

    // ---- Toggle a few document checkboxes for different clients ----
    console.log("-> Toggling document checkboxes for clients...");

    // Find all check buttons in the table body (document progress checkboxes)
    const checkButtons = page.locator("table tbody [role='checkbox']");
    const checkCount = await checkButtons.count();

    if (checkCount > 0) {
      // Toggle first checkbox
      await cursorClick(page, "table tbody [role='checkbox']", 0);
      await wait(PAUSE.MEDIUM);
    }

    if (checkCount > 2) {
      // Toggle another checkbox further down
      await cursorClick(page, "table tbody [role='checkbox']", 2);
      await wait(PAUSE.MEDIUM);
    }

    if (checkCount > 4) {
      // Toggle one more for demonstration
      await cursorClick(page, "table tbody [role='checkbox']", 4);
      await wait(PAUSE.MEDIUM);
    }

    // ---- Pause to show the updated state ----
    console.log("-> Showing updated progress state...");
    await wait(PAUSE.READ);

    // ---- Scroll down to show more clients with checkboxes ----
    console.log("-> Scrolling to show more clients...");
    const thirdRow = page.locator("table tbody tr").nth(3);
    if (await thirdRow.isVisible()) {
      await thirdRow.scrollIntoViewIfNeeded();
      await wait(PAUSE.MEDIUM);
    }

    // ---- Toggle another checkbox if visible ----
    if (checkCount > 6) {
      await cursorClick(page, "table tbody [role='checkbox']", 6);
      await wait(PAUSE.MEDIUM);
    }

    await wait(PAUSE.READ);

    // ---- Exit Edit Progress mode by clicking "Done" ----
    console.log("-> Exiting Edit Progress mode...");
    const doneBtn = page.locator('button:has-text("Done")');
    if (await doneBtn.isVisible()) {
      await cursorClick(page, 'button:has-text("Done")');
      await wait(PAUSE.LONG);
    }

    // ---- Show the table back in normal view ----
    console.log("-> Table returned to normal status view...");
    await wait(PAUSE.READ);

    console.log("-> Edit client progress demo complete.");
  },
};

export default demo;
