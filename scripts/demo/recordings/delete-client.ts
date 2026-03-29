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

    // ---- Navigate to a client detail page ----
    // Use the last row to pick a less important client for deletion
    console.log("-> Selecting a client to delete...");
    const rows = page.locator("table tbody tr");
    await rows.first().waitFor({ state: "visible", timeout: 10000 });
    const rowCount = await rows.count();
    const targetIdx = rowCount > 1 ? rowCount - 1 : 0;

    // Pause to let the viewer see the client list first
    await wait(PAUSE.MEDIUM);

    // Get the target row and its name cell (second td, after checkbox)
    const targetRow = rows.nth(targetIdx);
    const nameCell = targetRow.locator("td").nth(1);

    // Hover over the client name before clicking
    console.log("-> Hovering over client name...");
    const box = await nameCell.boundingBox();
    if (box) {
      await injectCursor(page);
      await page.evaluate(
        ({ x, y }) => {
          const el = document.getElementById("demo-cursor");
          if (el) { el.style.top = y + "px"; el.style.left = x + "px"; }
        },
        { x: box.x + box.width / 2, y: box.y + box.height / 2 }
      );
      await wait(PAUSE.MEDIUM);
    }

    // Click the client name cell
    console.log("-> Clicking on client name...");
    await nameCell.click();
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
