/**
 * Recording: Edit Client Details Inline
 *
 * Login, navigate to /clients, switch to Data view, enter edit mode,
 * change a year-end date and an email address, save, then exit edit mode.
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
  id: "edit-client-inline",
  title: "Edit Client Details Inline",
  description:
    "Enter edit mode on the client table and change fields directly — update a year-end date and email without leaving the page.",
  tags: ["edit", "inline", "client", "table", "update", "quick edit"],
  category: "Clients",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/clients");

    // ---- Switch to Data view ----
    console.log("-> Switching to Client Data view...");
    await cursorClick(page, 'button:has-text("Client Data")');
    await wait(PAUSE.MEDIUM);

    // ---- Show the table in read-only mode ----
    console.log("-> Showing client table in read-only mode...");
    await cursorMove(page, "table");
    await wait(PAUSE.READ);

    // ---- Enter edit mode ----
    console.log("-> Entering edit mode...");
    await cursorClick(page, 'button:has-text("Edit")');
    await wait(PAUSE.MEDIUM);

    // ---- Show that cells are now editable ----
    console.log("-> Table is now in edit mode — cells are editable...");
    await cursorMove(page, "table tbody tr:first-child");
    await wait(PAUSE.READ);

    // ---- Edit a year-end date ----
    console.log("-> Editing year end date for first client...");
    const dateInput = page.locator('table tbody tr input[type="date"]').first();
    if (await dateInput.isVisible().catch(() => false)) {
      await cursorClick(page, 'table tbody tr input[type="date"]');
      await wait(PAUSE.SHORT);

      // Change the date
      await dateInput.fill("2026-09-30");
      await wait(PAUSE.MEDIUM);

      // Click away to trigger the onBlur save
      console.log("-> Clicking away to save year-end change...");
      await cursorClick(page, "table thead");
      await wait(PAUSE.LONG);
    }

    // ---- Edit an email address ----
    console.log("-> Editing email address for first client...");
    const emailInput = page.locator('table tbody tr input[type="email"], table tbody tr input[type="text"]').first();
    if (await emailInput.isVisible().catch(() => false)) {
      await cursorClick(page, 'table tbody tr input[type="email"], table tbody tr input[type="text"]');
      await wait(PAUSE.SHORT);

      // Select all and type new email
      await emailInput.fill("newemail@example.co.uk");
      await wait(PAUSE.MEDIUM);

      // Click away to save
      console.log("-> Clicking away to save email change...");
      await cursorClick(page, "table thead");
      await wait(PAUSE.LONG);
    } else {
      // If no email input visible, try clicking on an email cell in the table
      console.log("-> Looking for email cell to edit...");
      const emailCells = page.locator('table tbody td').filter({ hasText: '@' });
      if (await emailCells.count() > 0) {
        await emailCells.first().click();
        await wait(PAUSE.SHORT);

        // Type new value if an input appears
        const activeInput = page.locator('table tbody td input:focus');
        if (await activeInput.isVisible().catch(() => false)) {
          await activeInput.fill("newemail@example.co.uk");
          await wait(PAUSE.MEDIUM);
          await cursorClick(page, "table thead");
          await wait(PAUSE.LONG);
        }
      }
    }

    // ---- Show the saved results ----
    console.log("-> Values saved — reviewing updated table...");
    await cursorMove(page, "table tbody tr:first-child");
    await wait(PAUSE.READ);

    // ---- Exit edit mode ----
    console.log("-> Exiting edit mode...");
    await cursorClick(page, 'button:has-text("Done")');
    await wait(PAUSE.MEDIUM);

    console.log("-> Inline edit demo complete.");
    await wait(PAUSE.SHORT);
  },
};

export default demo;
