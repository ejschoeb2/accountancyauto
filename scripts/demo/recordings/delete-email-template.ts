/**
 * Recording: Delete an Email Template
 *
 * Navigate to /templates, find the "Monthly VAT Reminder" custom template
 * (created by the create-email-template recording), open the editor,
 * click Delete, confirm, and show the result.
 *
 * Requires: create-email-template recording to have run first to create
 * the "Monthly VAT Reminder" template.
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
  id: "delete-email-template",
  title: "Delete an Email Template",
  description:
    "Remove a custom email template that is no longer needed.",
  tags: ["template", "delete", "remove", "email"],
  category: "Email Templates",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/templates");

    // ---- Wait for templates to load ----
    console.log("-> Waiting for templates to load...");
    await page.waitForLoadState("networkidle");
    await wait(PAUSE.MEDIUM);

    // ---- Find the "Monthly VAT Reminder" template ----
    console.log("-> Looking for Monthly VAT Reminder template...");
    const vatRow = page.locator('table tbody tr:has-text("Monthly VAT Reminder"), tbody tr.cursor-pointer:has-text("Monthly VAT Reminder")').first();
    let targetRow;

    if (await vatRow.isVisible().catch(() => false)) {
      console.log("-> Found Monthly VAT Reminder template.");
      targetRow = vatRow;
    } else {
      // Fallback: pick the last custom template (custom templates are usually at the bottom)
      console.log("-> Monthly VAT Reminder not found — selecting last template...");
      const allRows = page.locator("table tbody tr, tbody tr.cursor-pointer");
      const rowCount = await allRows.count();
      if (rowCount === 0) {
        console.log("-> No templates found, ending demo...");
        await wait(PAUSE.READ);
        return;
      }
      targetRow = allRows.nth(rowCount - 1);
    }

    // ---- Hover over the template row ----
    console.log("-> Hovering over template row...");
    const box = await targetRow.boundingBox();
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

    // ---- Open the template editor ----
    console.log("-> Opening template editor...");
    await targetRow.click();
    await wait(PAUSE.MEDIUM);

    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await wait(PAUSE.MEDIUM);

    // ---- Click the Delete button in the editor modal ----
    console.log("-> Clicking Delete button in template editor...");
    const deleteBtn = page
      .locator('[role="dialog"] button:has-text("Delete")')
      .first();
    if (await deleteBtn.isVisible()) {
      await cursorClick(page, '[role="dialog"] button:has-text("Delete")');
      await wait(PAUSE.MEDIUM);

      // ---- Wait for the delete confirmation dialog ----
      console.log("-> Delete confirmation dialog shown...");
      const confirmDialog = page.locator('[role="dialog"]:has-text("Delete Template")');
      await confirmDialog.waitFor({ state: "visible", timeout: 5000 });
      await wait(PAUSE.MEDIUM);

      // ---- Show the confirmation message ----
      const confirmText = page
        .locator(
          '[role="dialog"] p:has-text("Are you sure"), [role="dialog"]:has-text("cannot be undone")'
        )
        .first();
      if (await confirmText.isVisible()) {
        await cursorMove(
          page,
          '[role="dialog"] p:has-text("Are you sure"), [role="dialog"]:has-text("cannot be undone")'
        );
        await wait(PAUSE.READ);
      }

      // ---- Click Delete to actually confirm the deletion ----
      console.log("-> Confirming template deletion...");
      const confirmDeleteBtn = page
        .locator('[role="dialog"]:has-text("cannot be undone") button:has-text("Delete")')
        .first();
      if (await confirmDeleteBtn.isVisible().catch(() => false)) {
        await cursorClick(
          page,
          '[role="dialog"]:has-text("cannot be undone") button:has-text("Delete")'
        );
        await wait(PAUSE.LONG);
      }
    }

    // ---- Show the result — template should be removed from the list ----
    console.log("-> Template deleted — showing updated list...");
    await page.waitForLoadState("networkidle");
    await injectCursor(page);
    await wait(PAUSE.READ);

    console.log("-> Delete email template demo complete.");
  },
};

export default demo;
