/**
 * Recording: Edit Client Details Inline
 *
 * Login, navigate to /clients, switch to the Data view, enter edit mode,
 * then click on an editable year-end date cell to change it.
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
    "Click on a client field in the table to edit it directly — change email, year end, or company number without opening the detail page.",
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

    // ---- Show the table before edit mode ----
    console.log("-> Showing client table in read-only mode...");
    await cursorMove(page, "table");
    await wait(PAUSE.MEDIUM);

    // ---- Enter edit mode ----
    // The Edit button is an IconButtonWithText with text "Edit" in data view
    console.log("-> Entering edit mode...");
    await cursorClick(page, 'button:has-text("Edit")');
    await wait(PAUSE.MEDIUM);

    // ---- Show that cells are now editable ----
    console.log("-> Table is now in edit mode — cells are editable...");
    await cursorMove(page, "table tbody tr:first-child");
    await wait(PAUSE.MEDIUM);

    // ---- Click on a year-end date cell to edit it ----
    // EditableCell renders an input[type="date"] for year_end_date when isEditMode is true
    console.log("-> Editing year end date for first client...");
    const dateInput = page.locator('table tbody tr input[type="date"]').first();
    if (await dateInput.isVisible()) {
      await cursorClick(page, 'table tbody tr input[type="date"]');
      await wait(PAUSE.SHORT);
      await dateInput.fill("2026-06-30");
      await wait(PAUSE.MEDIUM);
      // Click away to trigger the onBlur save
      await cursorClick(page, "table thead");
      await wait(PAUSE.LONG);
    } else {
      // Fallback: hover over the editable cell area
      console.log("-> Hovering over editable cells...");
      await cursorMove(page, "table tbody tr:first-child td:nth-child(3)");
      await wait(PAUSE.LONG);
    }

    // ---- Show the saved result ----
    console.log("-> Value saved — reviewing updated table...");
    await cursorMove(page, "table tbody tr:first-child");
    await wait(PAUSE.READ);

    // ---- Exit edit mode ----
    // When in edit mode, the button text changes to "Done"
    console.log("-> Exiting edit mode...");
    await cursorClick(page, 'button:has-text("Done")');
    await wait(PAUSE.MEDIUM);

    console.log("-> Inline edit demo complete.");
    await wait(PAUSE.SHORT);
  },
};

export default demo;
