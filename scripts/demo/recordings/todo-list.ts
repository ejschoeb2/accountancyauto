/**
 * Recording: Manage Your To-Do List
 *
 * Login to the dashboard, interact with the To Do box:
 * 1. Click an email row (failed delivery) to open the email preview modal
 * 2. Click a document row (doc review) to open the document preview modal
 * 3. Paginate through to-do items
 * 4. Check off a records received item (violet status = "File ... with HMRC")
 * 5. Revert (undo) the check
 */

import {
  type DemoDefinition,
  login,
  cursorClick,
  cursorMove,
  injectCursor,
  wait,
  PAUSE,
} from "../helpers";

const demo: DemoDefinition = {
  id: "todo-list",
  title: "Manage Your To-Do List",
  description:
    "Open an email row to preview it, open a document row to preview it, paginate through items, check off a records received item, and revert.",
  tags: ["todo", "tasks", "checklist", "dashboard", "email", "documents"],
  category: "Dashboard",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);

    // ---- Highlight the To Do section header ----
    console.log("-> Highlighting To Do section...");
    const todoHeader = page.locator('text=To Do').first();
    if (await todoHeader.isVisible().catch(() => false)) {
      await todoHeader.scrollIntoViewIfNeeded();
      await injectCursor(page);
      await cursorMove(page, 'text=To Do');
      await wait(PAUSE.READ);
    }

    // ---- Check for empty state ----
    const emptyState = page.locator('text=All caught up');
    if (await emptyState.isVisible().catch(() => false)) {
      console.log("-> Empty state — no to-do items. Showing the message...");
      await cursorMove(page, 'text=All caught up');
      await wait(PAUSE.READ);
      console.log("-> To-Do list demo complete (empty state).");
      return;
    }

    // The To Do card contains rows. Each to-do row has a CTA button:
    // - doc-review rows: "Open file" button (opens DocumentPreviewModal)
    // - failed-delivery rows: "Open email" button (opens SentEmailDetailModal)
    // - client-action rows: "Take me there" button (navigates away)

    // ---- Step 1: Click an email row (failed delivery) CTA to open email modal ----
    const emailCta = page.locator('button:has-text("Open email")').first();
    if (await emailCta.isVisible().catch(() => false)) {
      console.log("-> Opening email preview modal...");
      await cursorClick(page, 'button:has-text("Open email")');
      await wait(PAUSE.LONG);

      // Pause so viewer can see the email modal content
      await wait(PAUSE.READ);

      // Close the modal (click the X button or press Escape)
      console.log("-> Closing email modal...");
      await page.keyboard.press("Escape");
      await wait(PAUSE.MEDIUM);
    } else {
      console.log("-> No failed delivery rows found, skipping email modal step.");
    }

    // ---- Step 2: Click a document row CTA to open document preview modal ----
    const docCta = page.locator('button:has-text("Open file")').first();
    if (await docCta.isVisible().catch(() => false)) {
      console.log("-> Opening document preview modal...");
      await cursorClick(page, 'button:has-text("Open file")');
      await wait(PAUSE.LONG);

      // Pause so viewer can see the document modal content
      await wait(PAUSE.READ);

      // Close the modal
      console.log("-> Closing document modal...");
      await page.keyboard.press("Escape");
      await wait(PAUSE.MEDIUM);
    } else {
      console.log("-> No document review rows found, skipping document modal step.");
    }

    // ---- Step 3: Paginate through to-do items ----
    // Pagination is in div.flex.items-center.justify-end.gap-2.pt-4 at the bottom
    // Contains two buttons: prev (ChevronLeft) and next (ChevronRight)
    console.log("-> Looking for pagination...");
    const paginationContainer = page.locator('.flex.items-center.justify-end.gap-2.pt-4').first();
    if (await paginationContainer.isVisible().catch(() => false)) {
      const paginationBtns = paginationContainer.locator("button");
      const paginationCount = await paginationBtns.count();

      if (paginationCount >= 2) {
        const nextBtn = paginationBtns.nth(1);
        const isDisabled = await nextBtn.isDisabled();
        if (!isDisabled) {
          console.log("-> Paginating to next page of to-do items...");
          // Scroll pagination into view first
          await paginationContainer.scrollIntoViewIfNeeded();
          await injectCursor(page);
          await cursorClick(page, '.flex.items-center.justify-end.gap-2.pt-4 >> button >> nth=1');
          await wait(PAUSE.READ);

          // Show items on second page
          await wait(PAUSE.MEDIUM);

          // Go back to first page
          const prevBtn = paginationBtns.nth(0);
          if (!(await prevBtn.isDisabled())) {
            console.log("-> Going back to first page...");
            await cursorClick(page, '.flex.items-center.justify-end.gap-2.pt-4 >> button >> nth=0');
            await wait(PAUSE.MEDIUM);
          }
        }
      }
    }

    // ---- Step 4: Check off a records received item ----
    // Records received items (violet status) have sentence starting with "File ... with HMRC"
    // Each item row has a CheckButton with aria-label="Mark as done"
    // We look for a row containing "File" and "HMRC" text, then click its checkbox
    const checkButtons = page.locator('[aria-label="Mark as done"]');
    const itemCount = await checkButtons.count();

    if (itemCount > 0) {
      // Try to find a "File ... with HMRC" item (records received / violet status)
      // These are the safest to check — they represent filings ready to submit
      let targetIndex = 0;

      // Look through visible items for a records-received one
      for (let i = 0; i < itemCount; i++) {
        const row = checkButtons.nth(i).locator('xpath=ancestor::div[contains(@class,"flex items-center gap-4")]');
        const text = await row.textContent().catch(() => '');
        if (text && text.includes('File') && text.includes('HMRC')) {
          targetIndex = i;
          break;
        }
      }

      console.log("-> Hovering over to-do item before checking...");
      await cursorMove(page, '[aria-label="Mark as done"]', targetIndex);
      await wait(PAUSE.MEDIUM);

      console.log("-> Checking off the to-do item...");
      await cursorClick(page, '[aria-label="Mark as done"]', targetIndex);
      await wait(PAUSE.LONG);

      // ---- Step 5: Show completed state and revert ----
      // After checking, the row shows strikethrough text with Revert and Roll over buttons
      const revertBtn = page.locator('button:has-text("Revert")').first();
      if (await revertBtn.isVisible().catch(() => false)) {
        console.log("-> Item marked complete — showing Revert and Roll over options...");
        await cursorMove(page, 'button:has-text("Revert")');
        await wait(PAUSE.MEDIUM);

        const rolloverBtn = page.locator('button:has-text("Roll over")').first();
        if (await rolloverBtn.isVisible().catch(() => false)) {
          await cursorMove(page, 'button:has-text("Roll over")');
          await wait(PAUSE.READ);
        }

        // Revert the completion to undo side effects
        console.log("-> Reverting the completion to undo...");
        await cursorClick(page, 'button:has-text("Revert")');
        await wait(PAUSE.LONG);
      }
    } else {
      console.log("-> No checkable to-do items found.");
    }

    console.log("-> To-Do list demo complete.");
    await wait(PAUSE.READ);
  },
};

export default demo;
