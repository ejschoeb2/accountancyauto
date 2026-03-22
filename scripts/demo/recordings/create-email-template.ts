/**
 * Recording: Create a Custom Email Template
 *
 * Navigate to /templates, click Create Template, fill in the name,
 * subject line with a placeholder, body with placeholder pills,
 * then stop before saving.
 */

import {
  type DemoDefinition,
  login,
  navigateTo,
  cursorClick,
  cursorType,
  cursorMove,
  wait,
  PAUSE,
} from "../helpers";

const demo: DemoDefinition = {
  id: "create-email-template",
  title: "Create a Custom Email Template",
  description:
    "Create a new email template with subject line, body content, and dynamic placeholders like {{client_name}}.",
  tags: [
    "template",
    "create",
    "new",
    "email",
    "custom",
    "placeholders",
  ],
  category: "Email Templates",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/templates");

    // ---- Click Create Template button ----
    console.log("-> Clicking Create Template button...");
    const createBtn = page
      .locator('button:has-text("Create Template")')
      .first();
    await createBtn.waitFor({ state: "visible", timeout: 5000 });
    await cursorClick(page, 'button:has-text("Create Template")');
    await wait(PAUSE.MEDIUM);

    // ---- Wait for modal ----
    console.log("-> Template editor modal opened...");
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await wait(PAUSE.MEDIUM);

    // ---- Type template name ----
    console.log("-> Entering template name...");
    await cursorType(page, '[role="dialog"] #modal-name', "Monthly VAT Reminder", {
      delay: 30,
    });
    await wait(PAUSE.MEDIUM);

    // ---- Type subject line ----
    console.log("-> Entering subject line...");
    const subjectInput = page.locator(
      '[role="dialog"] input[placeholder*="Subject"]'
    );
    await subjectInput.waitFor({ state: "visible", timeout: 5000 });
    await cursorType(
      page,
      '[role="dialog"] input[placeholder*="Subject"]',
      "VAT Return Reminder - {{filing_type}} due {{deadline}}",
      { delay: 25 }
    );
    await wait(PAUSE.MEDIUM);

    // ---- Click Insert Variable dropdown ----
    console.log("-> Opening Insert Variable dropdown...");
    const insertVarBtn = page
      .locator('[role="dialog"] button:has-text("Insert Variable")')
      .first();
    if (await insertVarBtn.isVisible()) {
      await cursorClick(
        page,
        '[role="dialog"] button:has-text("Insert Variable")'
      );
      await wait(PAUSE.SHORT);

      // Select client_name from the dropdown
      const clientNameItem = page
        .locator('[role="menuitem"]:has-text("Client Name")')
        .first();
      if (await clientNameItem.isVisible()) {
        await cursorClick(
          page,
          '[role="menuitem"]:has-text("Client Name")'
        );
        await wait(PAUSE.MEDIUM);
      } else {
        await page.keyboard.press("Escape");
        await wait(PAUSE.SHORT);
      }
    }

    // ---- Type body content in the editor ----
    console.log("-> Typing email body...");
    const editorDiv = page
      .locator(
        '[role="dialog"] .tiptap, [role="dialog"] [contenteditable="true"]'
      )
      .first();
    if (await editorDiv.isVisible()) {
      await cursorType(
        page,
        '[role="dialog"] .tiptap, [role="dialog"] [contenteditable="true"]',
        "\n\nThis is a friendly reminder that your VAT return is due soon. Please ensure all records are submitted before the deadline.\n\nIf you have any questions, please do not hesitate to contact us.\n\nKind regards,\nYour Accounting Team",
        { delay: 15 }
      );
      await wait(PAUSE.MEDIUM);
    }

    // ---- Insert another placeholder via dropdown ----
    console.log("-> Inserting deadline placeholder via dropdown...");
    const insertVarBtn2 = page
      .locator('[role="dialog"] button:has-text("Insert Variable")')
      .first();
    if (await insertVarBtn2.isVisible()) {
      await cursorClick(
        page,
        '[role="dialog"] button:has-text("Insert Variable")'
      );
      await wait(PAUSE.SHORT);

      const deadlineItem = page
        .locator('[role="menuitem"]:has-text("Deadline")')
        .first();
      if (await deadlineItem.isVisible()) {
        await cursorClick(
          page,
          '[role="menuitem"]:has-text("Deadline")'
        );
        await wait(PAUSE.MEDIUM);
      } else {
        await page.keyboard.press("Escape");
        await wait(PAUSE.SHORT);
      }
    }

    await wait(PAUSE.READ);

    // ---- Show the portal link info banner ----
    console.log("-> Highlighting portal link info...");
    const portalInfo = page
      .locator('[role="dialog"] .bg-amber-500\\/10')
      .first();
    if (await portalInfo.isVisible()) {
      await cursorMove(
        page,
        '[role="dialog"] .bg-amber-500\\/10'
      );
      await wait(PAUSE.SHORT);
    }

    // ---- Hover over Create button (don't click) ----
    console.log("-> Showing Create button (not clicking)...");
    const createSaveBtn = page
      .locator('[role="dialog"] button:has-text("Create")')
      .last();
    if (await createSaveBtn.isVisible()) {
      await cursorMove(page, '[role="dialog"] button:has-text("Create")');
      await wait(PAUSE.MEDIUM);
    }

    console.log("-> Template creation demo complete -- pausing for viewer...");
    await wait(PAUSE.READ);
  },
};

export default demo;
