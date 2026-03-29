/**
 * Recording: Manage Your To-Do List
 *
 * Login to the dashboard, interact with the To Do box:
 * 1. Show the ordering: failed emails first, then documents needing review, then client actions
 * 2. Open a failed email and show resend option
 * 3. Open a document and show accept/reject options
 * 4. Show the "Take me there" button for HMRC filing
 * 5. Navigate between pages of items
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
    "See the prioritised to-do list: failed emails first, then documents needing review, then client actions. Open an email, review a document, and navigate to HMRC filing.",
  tags: ["todo", "tasks", "checklist", "dashboard", "email", "documents", "priority"],
  category: "Dashboard",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);

    // ---- Scroll to and highlight the To Do section ----
    console.log("-> Highlighting To Do section...");
    const todoHeader = page.locator('text=To Do').first();
    await todoHeader.scrollIntoViewIfNeeded();
    await injectCursor(page);
    await wait(PAUSE.SHORT);
    await cursorMove(page, 'text=To Do');
    await wait(PAUSE.READ);

    // ---- Check for empty state ----
    const emptyState = page.locator('text=All caught up');
    if (await emptyState.isVisible().catch(() => false)) {
      console.log("-> Empty state — no to-do items.");
      await cursorMove(page, 'text=All caught up');
      await wait(PAUSE.READ);
      return;
    }

    // ---- Show the ordering: hover over items to demonstrate priority order ----
    // Failed deliveries come first (red "Failed"/"Bounced" badge)
    // Then doc reviews (amber "Needs Review" badge)
    // Then client actions (traffic light badges)
    console.log("-> Showing the to-do item ordering...");

    // Hover over the first item to show it's the highest priority
    const firstItem = page.locator('[aria-label="Mark as done"]').first();
    if (await firstItem.isVisible().catch(() => false)) {
      await cursorMove(page, '[aria-label="Mark as done"]', 0);
      await wait(PAUSE.READ);
    }

    // ---- Step 1: Open a failed email and show resend option ----
    const emailCta = page.locator('button:has-text("Open email")').first();
    if (await emailCta.isVisible().catch(() => false)) {
      console.log("-> Opening failed email to show resend option...");
      await cursorClick(page, 'button:has-text("Open email")');
      await wait(PAUSE.LONG);

      // Show the email detail modal — it contains resend button
      await wait(PAUSE.READ);

      // Click resend to demonstrate auto-removal from todo list
      const resendBtn = page.locator('[role="dialog"] button:has-text("Resend")');
      if (await resendBtn.isVisible().catch(() => false)) {
        console.log("-> Clicking Resend to fix the failed delivery...");
        await cursorClick(page, '[role="dialog"] button:has-text("Resend")');
        await wait(PAUSE.LONG);

        // Modal closes automatically after resend — item removed from todo
        console.log("-> Email resent — item removed from to-do list.");
        await wait(PAUSE.READ);
      } else {
        // Close the modal if no resend button
        console.log("-> Closing email modal...");
        await page.keyboard.press("Escape");
        await wait(PAUSE.MEDIUM);
      }
    } else {
      console.log("-> No failed delivery rows found, skipping email modal.");
    }

    // ---- Step 2: Open a document and show accept/reject options ----
    const docCta = page.locator('button:has-text("Open file")').first();
    if (await docCta.isVisible().catch(() => false)) {
      console.log("-> Opening document for review...");
      await docCta.scrollIntoViewIfNeeded();
      await injectCursor(page);
      await cursorClick(page, 'button:has-text("Open file")');
      await wait(PAUSE.LONG);

      // Show the document preview modal content
      await wait(PAUSE.READ);

      // Click Pass Review to demonstrate auto-removal from todo list
      const passBtn = page.locator('[role="dialog"] button:has-text("Pass Review")');
      if (await passBtn.isVisible().catch(() => false)) {
        console.log("-> Clicking Pass Review to approve the document...");
        await cursorClick(page, '[role="dialog"] button:has-text("Pass Review")');
        await wait(PAUSE.LONG);

        // Item is removed from todo list after review passes
        console.log("-> Document reviewed — item removed from to-do list.");
        await wait(PAUSE.READ);
      }

      // Close the modal
      console.log("-> Closing document modal...");
      await page.keyboard.press("Escape");
      await wait(PAUSE.MEDIUM);
    } else {
      console.log("-> No document review rows found, skipping document modal.");
    }

    // ---- Step 3: Show the "Take me there" button for HMRC filing ----
    const takeMeBtn = page.locator('button:has-text("Take me there")').first();
    if (await takeMeBtn.isVisible().catch(() => false)) {
      console.log("-> Showing 'Take me there' button for HMRC filing...");
      await takeMeBtn.scrollIntoViewIfNeeded();
      await injectCursor(page);
      await cursorMove(page, 'button:has-text("Take me there")');
      await wait(PAUSE.READ);
    }

    // ---- Step 4: Navigate between pages ----
    console.log("-> Looking for pagination...");
    // Pagination: two icon buttons at the bottom of the To Do card
    const paginationContainer = page.locator('.flex.items-center.justify-end.gap-2.pt-4').first();
    if (await paginationContainer.isVisible().catch(() => false)) {
      const paginationBtns = paginationContainer.locator("button");
      const paginationCount = await paginationBtns.count();

      if (paginationCount >= 2) {
        const nextBtn = paginationBtns.nth(1);
        const isDisabled = await nextBtn.isDisabled();
        if (!isDisabled) {
          console.log("-> Going to next page of to-do items...");
          await paginationContainer.scrollIntoViewIfNeeded();
          await injectCursor(page);
          // Click via the locator directly since nested selectors can be fragile
          await cursorMove(page, '.flex.items-center.justify-end.gap-2.pt-4');
          await wait(PAUSE.SHORT);
          await nextBtn.click();
          await wait(PAUSE.READ);

          // Show items on second page
          await wait(PAUSE.MEDIUM);

          // Go back to first page
          const prevBtn = paginationBtns.nth(0);
          if (!(await prevBtn.isDisabled())) {
            console.log("-> Going back to first page...");
            await prevBtn.click();
            await wait(PAUSE.MEDIUM);
          }
        }
      }
    }

    console.log("-> To-Do list demo complete.");
    await wait(PAUSE.READ);
  },
};

export default demo;
