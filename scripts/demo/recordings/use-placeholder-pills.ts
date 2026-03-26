/**
 * Recording: Use Placeholder Pills in Templates
 *
 * Open an existing template, demonstrate inserting multiple placeholder
 * pills from the Insert Variable dropdown into natural positions within
 * the email body and subject line. Shows how pills render inline.
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
  injectCursor,
} from "../helpers";

const demo: DemoDefinition = {
  id: "use-placeholder-pills",
  title: "Use Placeholder Pills in Templates",
  description:
    "Insert dynamic placeholders like Client Name, Deadline, Filing Type, and Days Until Deadline into an email template. Shows how Insert Variable adds inline placeholder pills.",
  tags: [
    "placeholders",
    "pills",
    "dynamic",
    "template",
    "merge fields",
    "variables",
  ],
  category: "Email Templates",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/templates");

    // ---- Open the "Year-End Pack Request" custom template for editing ----
    console.log("-> Opening template editor...");
    const yearEndRow = page.locator('tr:has-text("Year-End Pack Request")').first();
    if (await yearEndRow.isVisible()) {
      await cursorClick(page, 'tr:has-text("Year-End Pack Request")');
    } else {
      // Fallback: click any custom template or first row
      const firstRow = page.locator("table tbody tr").first();
      if (await firstRow.isVisible()) {
        await cursorClick(page, "table tbody tr", 0);
      }
    }

    await wait(PAUSE.LONG);
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await wait(PAUSE.MEDIUM);

    // ---- Show the existing template content ----
    console.log("-> Viewing existing template content...");
    await wait(PAUSE.READ);

    // ---- Focus the subject line and add a variable ----
    console.log("-> Adding Filing Type variable to subject line...");
    const subjectInput = page.locator('[role="dialog"] input[placeholder*="ubject"]');
    if (await subjectInput.isVisible()) {
      await cursorClick(page, '[role="dialog"] input[placeholder*="ubject"]');
      await wait(PAUSE.SHORT);

      // Go to end and type
      await page.keyboard.press("End");
      await page.keyboard.type(" — ", { delay: 30 });
      await wait(PAUSE.SHORT);
    }

    // ---- Insert Filing Type variable into subject ----
    console.log("-> Using Insert Variable for Filing Type...");
    await cursorClick(page, '[role="dialog"] button:has-text("Insert Variable")');
    await wait(PAUSE.SHORT);

    const filingTypeItem = page.locator('[role="menuitem"]:has-text("Filing Type")').first();
    if (await filingTypeItem.isVisible()) {
      await cursorClick(page, '[role="menuitem"]:has-text("Filing Type")');
      await wait(PAUSE.MEDIUM);
    } else {
      await page.keyboard.press("Escape");
    }

    // ---- Show the subject with the pill ----
    console.log("-> Subject line now contains {{filing_type}} pill...");
    await wait(PAUSE.READ);

    // ---- Focus the body editor ----
    console.log("-> Moving to body editor...");
    const editorDiv = page.locator('[role="dialog"] .tiptap, [role="dialog"] [contenteditable="true"]').first();
    if (await editorDiv.isVisible()) {
      await cursorClick(page, '[role="dialog"] .tiptap, [role="dialog"] [contenteditable="true"]');
      await wait(PAUSE.SHORT);

      // Move to the end of the content
      await page.keyboard.press("Control+End");
      await page.keyboard.press("Enter");
      await page.keyboard.press("Enter");
      await page.keyboard.type("Your ", { delay: 30 });
      await wait(PAUSE.SHORT);
    }

    // ---- Insert Filing Type variable into body ----
    console.log("-> Inserting Filing Type variable into body...");
    await cursorClick(page, '[role="dialog"] button:has-text("Insert Variable")');
    await wait(PAUSE.SHORT);

    const filingTypeItem2 = page.locator('[role="menuitem"]:has-text("Filing Type")').first();
    if (await filingTypeItem2.isVisible()) {
      await cursorClick(page, '[role="menuitem"]:has-text("Filing Type")');
      await wait(PAUSE.MEDIUM);
    } else {
      await page.keyboard.press("Escape");
    }

    // ---- Continue typing around the pill ----
    if (await editorDiv.isVisible()) {
      await page.keyboard.type(" deadline is ", { delay: 30 });
      await wait(PAUSE.SHORT);
    }

    // ---- Insert Deadline variable ----
    console.log("-> Inserting Deadline variable...");
    await cursorClick(page, '[role="dialog"] button:has-text("Insert Variable")');
    await wait(PAUSE.SHORT);

    const deadlineItem = page.locator('[role="menuitem"]:has-text("Deadline")').first();
    if (await deadlineItem.isVisible()) {
      await cursorClick(page, '[role="menuitem"]:has-text("Deadline")');
      await wait(PAUSE.MEDIUM);
    } else {
      await page.keyboard.press("Escape");
    }

    // ---- Add days until deadline ----
    if (await editorDiv.isVisible()) {
      await page.keyboard.type(" (", { delay: 30 });
      await wait(PAUSE.SHORT);
    }

    console.log("-> Inserting Days Until Deadline variable...");
    await cursorClick(page, '[role="dialog"] button:has-text("Insert Variable")');
    await wait(PAUSE.SHORT);

    const daysItem = page.locator('[role="menuitem"]:has-text("Days Until Deadline")').first();
    if (await daysItem.isVisible()) {
      await cursorClick(page, '[role="menuitem"]:has-text("Days Until Deadline")');
      await wait(PAUSE.MEDIUM);
    } else {
      await page.keyboard.press("Escape");
    }

    if (await editorDiv.isVisible()) {
      await page.keyboard.type(" days remaining).", { delay: 20 });
      await wait(PAUSE.SHORT);
    }

    // ---- Show the final result with multiple pills visible ----
    console.log("-> Showing final template with all placeholder pills...");
    await wait(PAUSE.READ);

    // ---- Hover over the editor to emphasise the pills ----
    if (await editorDiv.isVisible()) {
      await cursorMove(page, '[role="dialog"] .tiptap, [role="dialog"] [contenteditable="true"]');
      await wait(PAUSE.READ);
    }

    // ---- Save the changes ----
    console.log("-> Saving template with placeholder pills...");
    const saveBtn = page.locator('[role="dialog"] button:has-text("Save")').first();
    if (await saveBtn.isVisible()) {
      await cursorClick(page, '[role="dialog"] button:has-text("Save")');
      await wait(PAUSE.LONG);
    }

    console.log("-> Placeholder pills demo complete.");
    await wait(PAUSE.SHORT);
  },
};

export default demo;
