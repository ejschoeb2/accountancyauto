/**
 * Recording: Use Placeholder Pills in Templates
 *
 * Open the template editor, demonstrate inserting multiple placeholder
 * pills from the Insert Variable dropdown into the email body and
 * subject line.
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
  id: "use-placeholder-pills",
  title: "Use Placeholder Pills in Templates",
  description:
    "Insert dynamic placeholders like {{client_name}}, {{deadline}}, and {{filing_type}} into an email template body.",
  tags: [
    "placeholders",
    "pills",
    "dynamic",
    "template",
    "merge fields",
    "variables",
  ],
  category: "Email Templates",
  hasSideEffects: false,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/templates");

    // ---- Open template editor (create new or edit existing) ----
    console.log("-> Opening template editor...");
    const templateRows = page.locator("table tbody tr, tbody tr.cursor-pointer");
    const rowCount = await templateRows.count();

    if (rowCount > 0) {
      // Edit existing template
      await cursorClick(page, "table tbody tr, tbody tr.cursor-pointer", 0);
    } else {
      // Create new template
      await cursorClick(page, 'button:has-text("Create Template")');
    }

    await wait(PAUSE.MEDIUM);
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await wait(PAUSE.MEDIUM);

    // ---- Focus the subject line first ----
    console.log("-> Focusing subject line...");
    const subjectInput = page.locator(
      '[role="dialog"] input[placeholder*="Subject"]'
    );
    if (await subjectInput.isVisible()) {
      await cursorClick(
        page,
        '[role="dialog"] input[placeholder*="Subject"]'
      );
      await wait(PAUSE.SHORT);

      // Type some text before inserting a placeholder
      await page.keyboard.type("Reminder for ", { delay: 30 });
      await wait(PAUSE.SHORT);
    }

    // ---- Insert client_name placeholder into subject via dropdown ----
    console.log("-> Inserting client_name placeholder into subject...");
    const insertVarBtn = page
      .locator('[role="dialog"] button:has-text("Insert Variable")')
      .first();
    await insertVarBtn.waitFor({ state: "visible", timeout: 5000 });
    await cursorClick(
      page,
      '[role="dialog"] button:has-text("Insert Variable")'
    );
    await wait(PAUSE.SHORT);

    // Click Client Name from dropdown
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

    // ---- Show the placeholder rendered in the subject line ----
    console.log("-> Placeholder inserted into subject line...");
    await cursorMove(
      page,
      '[role="dialog"] input[placeholder*="Subject"]'
    );
    await wait(PAUSE.READ);

    // ---- Focus the body editor ----
    console.log("-> Focusing body editor...");
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

      // Type some text
      await page.keyboard.type("Dear ", { delay: 30 });
      await wait(PAUSE.SHORT);
    }

    // ---- Insert client_name placeholder into body ----
    console.log("-> Inserting client_name placeholder into body...");
    await cursorClick(
      page,
      '[role="dialog"] button:has-text("Insert Variable")'
    );
    await wait(PAUSE.SHORT);

    const clientNameItem2 = page
      .locator('[role="menuitem"]:has-text("Client Name")')
      .first();
    if (await clientNameItem2.isVisible()) {
      await cursorClick(
        page,
        '[role="menuitem"]:has-text("Client Name")'
      );
      await wait(PAUSE.MEDIUM);
    } else {
      await page.keyboard.press("Escape");
    }

    // ---- Type more body text ----
    if (await editorDiv.isVisible()) {
      await page.keyboard.type(
        ",\n\nYour ",
        { delay: 30 }
      );
      await wait(PAUSE.SHORT);
    }

    // ---- Insert filing_type placeholder ----
    console.log("-> Inserting filing_type placeholder...");
    await cursorClick(
      page,
      '[role="dialog"] button:has-text("Insert Variable")'
    );
    await wait(PAUSE.SHORT);

    const filingTypeItem = page
      .locator('[role="menuitem"]:has-text("Filing Type")')
      .first();
    if (await filingTypeItem.isVisible()) {
      await cursorClick(
        page,
        '[role="menuitem"]:has-text("Filing Type")'
      );
      await wait(PAUSE.MEDIUM);
    } else {
      await page.keyboard.press("Escape");
    }

    // ---- Type more and insert deadline ----
    if (await editorDiv.isVisible()) {
      await page.keyboard.type(" deadline is ", { delay: 30 });
      await wait(PAUSE.SHORT);
    }

    console.log("-> Inserting deadline placeholder...");
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
    }

    // ---- Insert portal link ----
    console.log("-> Inserting portal link placeholder...");
    if (await editorDiv.isVisible()) {
      await page.keyboard.type(
        ".\n\nPlease upload your documents here: ",
        { delay: 20 }
      );
      await wait(PAUSE.SHORT);
    }

    const portalLinkBtn = page
      .locator('[role="dialog"] button:has-text("Insert Portal Link")')
      .first();
    if (await portalLinkBtn.isVisible()) {
      await cursorClick(
        page,
        '[role="dialog"] button:has-text("Insert Portal Link")'
      );
      await wait(PAUSE.MEDIUM);
    }

    // ---- Show the final result with all pills ----
    console.log("-> Showing final template with placeholder pills...");
    await wait(PAUSE.READ);

    // ---- Hover over the editor to show pills are visible ----
    if (await editorDiv.isVisible()) {
      await cursorMove(
        page,
        '[role="dialog"] .tiptap, [role="dialog"] [contenteditable="true"]'
      );
      await wait(PAUSE.READ);
    }

    console.log(
      "-> Placeholder pills demo complete -- pausing for viewer..."
    );
    await wait(PAUSE.READ);
  },
};

export default demo;
