/**
 * Recording: Delete a Client
 *
 * On the client detail page, click Delete, show the confirmation dialog,
 * but stop before confirming (destructive demo — don't actually delete).
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
  id: "delete-client",
  title: "Delete a Client",
  description:
    "Delete a client from the system — shows the confirmation dialog and what data will be removed.",
  tags: ["delete", "remove", "client"],
  category: "Clients",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/clients");

    // ---- Navigate to a client detail page ----
    console.log("-> Clicking on a client row...");
    await cursorClick(page, "table tbody tr", 0);
    await page.waitForURL("**/clients/**", { timeout: 10000 });
    await page.waitForLoadState("networkidle");
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
    console.log("-> Reviewing the warning — this action cannot be undone...");
    await cursorMove(page, '[role="dialog"] [data-slot="dialog-description"]');
    await wait(PAUSE.READ);

    // ---- Show the cancel and delete buttons ----
    await cursorMove(page, '[role="dialog"] button:has-text("Delete Client")');
    await wait(PAUSE.MEDIUM);

    // ---- Cancel — do NOT confirm the delete ----
    console.log("-> Cancelling delete — stopping before confirmation...");
    await cursorClick(page, '[role="dialog"] button:has-text("Cancel")');
    await wait(PAUSE.MEDIUM);

    console.log("-> Delete client demo complete (no data was deleted).");
    await wait(PAUSE.SHORT);
  },
};

export default demo;
