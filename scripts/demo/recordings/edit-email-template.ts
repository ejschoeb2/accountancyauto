/**
 * Recording: Edit an Existing Email Template
 *
 * Navigate to /templates, click an existing template row to open the
 * editor modal, modify the subject and body, then stop before saving.
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
  id: "edit-email-template",
  title: "Edit an Existing Email Template",
  description:
    "Open a template in the editor, modify the subject and body, and use placeholder pills for dynamic content.",
  tags: [
    "template",
    "edit",
    "modify",
    "email",
    "placeholders",
    "editor",
  ],
  category: "Email Templates",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/templates");

    // ---- Wait for templates table to load ----
    console.log("-> Waiting for templates to load...");
    await page.waitForLoadState("networkidle");
    await wait(PAUSE.MEDIUM);

    // ---- Click on the first template row ----
    console.log("-> Clicking on an existing template...");
    const templateRows = page.locator("table tbody tr, .border-b.cursor-pointer");
    const rowCount = await templateRows.count();

    if (rowCount === 0) {
      console.log("-> No templates found, ending demo...");
      await wait(PAUSE.READ);
      return;
    }

    // Click on the first clickable template row (skip header)
    await cursorClick(page, "table tbody tr, tbody tr.cursor-pointer", 0);
    await wait(PAUSE.LONG);

    // ---- Wait for editor modal ----
    console.log("-> Template editor modal opened...");
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await wait(PAUSE.MEDIUM);

    // ---- Show the Edit Template title ----
    const editTitle = page
      .locator('[role="dialog"] h2:has-text("Edit Template")')
      .first();
    if (await editTitle.isVisible()) {
      await cursorMove(
        page,
        '[role="dialog"] h2:has-text("Edit Template")'
      );
      await wait(PAUSE.SHORT);
    }

    // ---- Show the "Used in" info ----
    console.log("-> Showing usage info...");
    const usedInText = page
      .locator('[role="dialog"] span:has-text("Used in")')
      .first();
    if (await usedInText.isVisible()) {
      await cursorMove(
        page,
        '[role="dialog"] span:has-text("Used in")'
      );
      await wait(PAUSE.SHORT);
    }

    // ---- Modify the subject line ----
    console.log("-> Modifying subject line...");
    const subjectInput = page.locator(
      '[role="dialog"] input[placeholder*="Subject"]'
    );
    if (await subjectInput.isVisible()) {
      await cursorClick(
        page,
        '[role="dialog"] input[placeholder*="Subject"]'
      );
      await wait(PAUSE.SHORT);

      // Select all and append text
      await page.keyboard.press("End");
      await cursorType(
        page,
        '[role="dialog"] input[placeholder*="Subject"]',
        " - Updated",
        { delay: 30 }
      );
      await wait(PAUSE.MEDIUM);
    }

    // ---- Edit the body ----
    console.log("-> Editing email body...");
    const editorDiv = page
      .locator(
        '[role="dialog"] .tiptap, [role="dialog"] [contenteditable="true"]'
      )
      .first();
    if (await editorDiv.isVisible()) {
      await cursorClick(
        page,
        '[role="dialog"] .tiptap, [role="dialog"] [contenteditable="true"]'
      );
      await wait(PAUSE.SHORT);

      // Move to end and add text
      await page.keyboard.press("End");
      await page.keyboard.press("Enter");
      await page.keyboard.press("Enter");
      await page.keyboard.type(
        "P.S. We have extended office hours this month for your convenience.",
        { delay: 20 }
      );
      await wait(PAUSE.MEDIUM);
    }

    // ---- Highlight the toolbar ----
    console.log("-> Showing editor toolbar...");
    const toolbar = page
      .locator('[role="dialog"] button:has-text("Insert Variable")')
      .first();
    if (await toolbar.isVisible()) {
      await cursorMove(
        page,
        '[role="dialog"] button:has-text("Insert Variable")'
      );
      await wait(PAUSE.SHORT);
    }

    const portalLinkBtn = page
      .locator('[role="dialog"] button:has-text("Insert Portal Link")')
      .first();
    if (await portalLinkBtn.isVisible()) {
      await cursorMove(
        page,
        '[role="dialog"] button:has-text("Insert Portal Link")'
      );
      await wait(PAUSE.SHORT);
    }

    // ---- Show the Save button (don't click) ----
    console.log("-> Showing Save button (not clicking)...");
    const saveBtn = page
      .locator('[role="dialog"] button:has-text("Save")')
      .first();
    if (await saveBtn.isVisible()) {
      await cursorMove(page, '[role="dialog"] button:has-text("Save")');
      await wait(PAUSE.MEDIUM);
    }

    console.log(
      "-> Template editing demo complete -- pausing for viewer..."
    );
    await wait(PAUSE.READ);
  },
};

export default demo;
