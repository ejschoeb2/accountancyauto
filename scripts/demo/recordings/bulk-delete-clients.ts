/**
 * Recording: Bulk Delete Clients
 *
 * Select multiple clients in the table, click Delete in the bulk
 * actions toolbar, show the confirmation dialog but stop before confirming.
 */

import {
  type DemoDefinition,
  login,
  navigateTo,
  cursorClick,
  cursorMove,
  wait,
  PAUSE,
} from "../helpers";

const demo: DemoDefinition = {
  id: "bulk-delete-clients",
  title: "Bulk Delete Clients",
  description:
    "Select multiple clients from the table and delete them all at once using the bulk actions toolbar.",
  tags: ["bulk", "delete", "multiple", "clients", "toolbar"],
  category: "Clients",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/clients");

    // ---- Select multiple clients ----
    console.log("-> Selecting clients...");
    const checkboxes = page.locator('table [role="checkbox"]');
    const count = await checkboxes.count();

    if (count > 1) {
      await cursorClick(page, 'table [role="checkbox"]', 1);
      await wait(PAUSE.SHORT);
    }
    if (count > 2) {
      await cursorClick(page, 'table [role="checkbox"]', 2);
      await wait(PAUSE.SHORT);
    }
    if (count > 3) {
      await cursorClick(page, 'table [role="checkbox"]', 3);
      await wait(PAUSE.MEDIUM);
    }

    // ---- Show the bulk actions toolbar ----
    console.log("-> Bulk actions toolbar visible...");
    const toolbar = page.locator('text="selected"').first();
    if (await toolbar.isVisible()) {
      await cursorMove(page, 'text="selected"');
      await wait(PAUSE.MEDIUM);
    }

    // ---- Click Delete Clients button in toolbar ----
    console.log("-> Clicking Delete Clients in toolbar...");
    const deleteBtn = page.locator('button:has-text("Delete Client")').first();
    await deleteBtn.waitFor({ state: "visible", timeout: 5000 });
    await cursorClick(page, 'button:has-text("Delete Client")');
    await wait(PAUSE.MEDIUM);

    // ---- Show the confirmation dialog ----
    console.log("-> Delete confirmation dialog shown...");
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await cursorMove(page, '[role="dialog"]');
    await wait(PAUSE.READ);

    // ---- Cancel — do NOT confirm ----
    console.log("-> Cancelling — stopping before confirmation...");
    await cursorClick(page, '[role="dialog"] button:has-text("Cancel")');
    await wait(PAUSE.MEDIUM);

    // ---- Clear selection ----
    console.log("-> Clearing selection...");
    const closeBtn = page.locator('button:has-text("Close")').first();
    if (await closeBtn.isVisible()) {
      await cursorClick(page, 'button:has-text("Close")');
      await wait(PAUSE.SHORT);
    }

    console.log("-> Bulk delete demo complete (no data was deleted).");
    await wait(PAUSE.SHORT);
  },
};

export default demo;
