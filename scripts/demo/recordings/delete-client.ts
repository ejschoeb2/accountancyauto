/**
 * Recording: Delete a Client
 *
 * On the client detail page, click Delete, show the confirmation dialog,
 * and actually confirm the deletion.
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
  id: "delete-client",
  title: "Delete a Client",
  description:
    "Delete a client from the system — shows the confirmation dialog and completes the deletion.",
  tags: ["delete", "remove", "client"],
  category: "Clients",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/clients");

    // ---- Navigate to a client detail page (use last row to pick a less important client) ----
    console.log("-> Clicking on a client row...");
    const rows = page.locator('table tbody tr');
    const rowCount = await rows.count();
    // Click the last row to avoid deleting an important client for other demos
    const targetRow = rowCount > 1 ? rowCount - 1 : 0;
    await cursorClick(page, "table tbody tr", targetRow);
    await page.waitForURL("**/clients/**", { timeout: 10000 });
    await page.waitForLoadState("networkidle");
    await injectCursor(page);
    await wait(PAUSE.LONG);

    // ---- Click Delete button in the header ----
    console.log("-> Clicking Delete button...");
    await cursorClick(page, 'button:has-text("Delete")');
    await wait(PAUSE.MEDIUM);

    // ---- Show the confirmation dialog ----
    console.log("-> Delete confirmation dialog shown...");
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await cursorMove(page, '[role="dialog"]');
    await wait(PAUSE.READ);

    // ---- Highlight the warning text ----
    const description = page.locator('[role="dialog"] [data-slot="dialog-description"]');
    if (await description.isVisible().catch(() => false)) {
      console.log("-> Reviewing the warning — this action cannot be undone...");
      await cursorMove(page, '[role="dialog"] [data-slot="dialog-description"]');
      await wait(PAUSE.READ);
    }

    // ---- Show the Delete Client button ----
    console.log("-> Showing Delete Client confirmation button...");
    await cursorMove(page, '[role="dialog"] button:has-text("Delete Client")');
    await wait(PAUSE.READ);

    // ---- Actually confirm the delete ----
    console.log("-> Confirming deletion...");
    await cursorClick(page, '[role="dialog"] button:has-text("Delete Client")');
    await wait(PAUSE.LONG);

    // ---- Should redirect back to /clients ----
    try {
      await page.waitForURL("**/clients", { timeout: 10000 });
      console.log("-> Client deleted — redirected to clients list.");
    } catch {
      console.log("-> Waiting for redirect after deletion...");
    }
    await wait(PAUSE.READ);

    console.log("-> Delete client demo complete.");
    await wait(PAUSE.SHORT);
  },
};

export default demo;
