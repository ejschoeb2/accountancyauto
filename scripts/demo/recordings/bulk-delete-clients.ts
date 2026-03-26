/**
 * Recording: Bulk Delete Clients
 *
 * Select multiple clients in the table, click Delete in the bulk
 * actions toolbar, show the confirmation dialog, and actually confirm.
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

    // ---- Select multiple clients using row checkboxes ----
    console.log("-> Selecting clients...");
    const checkboxes = page.locator('table [role="checkbox"]');
    const count = await checkboxes.count();

    // Skip the header "select all" checkbox (index 0), select individual rows
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
    if (await toolbar.isVisible().catch(() => false)) {
      await cursorMove(page, 'text="selected"');
      await wait(PAUSE.READ);
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

    // ---- Show warning text ----
    const description = page.locator('[role="dialog"] [data-slot="dialog-description"]');
    if (await description.isVisible().catch(() => false)) {
      await cursorMove(page, '[role="dialog"] [data-slot="dialog-description"]');
      await wait(PAUSE.READ);
    }

    // ---- Actually confirm the bulk delete ----
    console.log("-> Confirming bulk deletion...");
    const confirmDeleteBtn = page.locator('[role="dialog"] button:has-text("Delete")').last();
    if (await confirmDeleteBtn.isVisible().catch(() => false)) {
      await cursorClick(page, '[role="dialog"] button:has-text("Delete")');
      await wait(PAUSE.LONG);
    }

    // ---- Show the result ----
    console.log("-> Clients deleted — showing updated table...");
    await wait(PAUSE.LONG);

    // The table should now have fewer rows
    await cursorMove(page, "table");
    await wait(PAUSE.READ);

    console.log("-> Bulk delete demo complete.");
    await wait(PAUSE.SHORT);
  },
};

export default demo;
