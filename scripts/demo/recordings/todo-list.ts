/**
 * Recording: Manage Your To-Do List
 *
 * Login to the dashboard, interact with the To Do box — hover over items,
 * check off an item to mark it complete (shows the "completed" state with
 * Revert and Roll over buttons), and use pagination. Stops before rolling
 * over since that has permanent side effects.
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
    "Add, check off, and manage to-do items from the dashboard.",
  tags: ["todo", "tasks", "checklist", "dashboard"],
  category: "Dashboard",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);

    // ---- Highlight the To Do section header ----
    console.log("-> Highlighting To Do section...");
    const todoHeader = page.locator('text=To Do').first();
    if (await todoHeader.isVisible().catch(() => false)) {
      await cursorMove(page, 'text=To Do');
      await wait(PAUSE.READ);
    }

    // ---- Check if there are any to-do items ----
    const emptyState = page.locator('text=All caught up');
    if (await emptyState.isVisible().catch(() => false)) {
      console.log("-> Empty state — no to-do items. Showing the message...");
      await cursorMove(page, 'text=All caught up');
      await wait(PAUSE.READ);
      console.log("-> To-Do list demo complete (empty state).");
      return;
    }

    // ---- Show onboarding steps if present ----
    const getStartedBadge = page.locator('text=Get started').first();
    if (await getStartedBadge.isVisible().catch(() => false)) {
      console.log("-> Showing onboarding to-do items...");
      await cursorMove(page, 'text=Get started');
      await wait(PAUSE.MEDIUM);

      // Hover over the first onboarding item description
      const onboardingItems = page.locator('text=Review client progress').first();
      if (await onboardingItems.isVisible().catch(() => false)) {
        await cursorMove(page, 'text=Review client progress');
        await wait(PAUSE.MEDIUM);
      }
    }

    // ---- Hover over client action items ----
    // Each item row has: CheckButton, sentence text, badge area, CTA button
    const checkButtons = page.locator('[aria-label="Mark as done"]');
    const itemCount = await checkButtons.count();

    if (itemCount > 0) {
      console.log("-> Hovering over first to-do item...");
      await cursorMove(page, '[aria-label="Mark as done"]', 0);
      await wait(PAUSE.MEDIUM);

      // Show the CTA "Take me there" button
      const ctaButtons = page.locator('button:has-text("Take me there")');
      if (await ctaButtons.first().isVisible().catch(() => false)) {
        console.log("-> Highlighting 'Take me there' button...");
        await cursorMove(page, 'button:has-text("Take me there")');
        await wait(PAUSE.MEDIUM);
      }

      // ---- Check off the first item ----
      console.log("-> Checking off the first to-do item...");
      await cursorClick(page, '[aria-label="Mark as done"]', 0);
      await wait(PAUSE.LONG);

      // ---- Show the completed state ----
      // After checking, the row should show strikethrough text and Revert/Roll over buttons
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

        // ---- Revert it back (undo the check) ----
        console.log("-> Reverting the completion to undo side effects...");
        await cursorClick(page, 'button:has-text("Revert")');
        await wait(PAUSE.LONG);
      }

      // ---- Show second item if available ----
      if (itemCount > 1) {
        console.log("-> Hovering over second to-do item...");
        await cursorMove(page, '[aria-label="Mark as done"]', 1);
        await wait(PAUSE.MEDIUM);
      }
    }

    // ---- Show pagination ----
    // Pagination buttons are the last two buttons (prev/next) at the bottom of the To Do card
    const paginationContainer = page.locator('.flex.items-center.justify-end.gap-2.pt-4').first();
    if (await paginationContainer.isVisible().catch(() => false)) {
      const paginationBtns = paginationContainer.locator("button");
      const paginationCount = await paginationBtns.count();

      if (paginationCount >= 2) {
        const nextBtn = paginationBtns.last();
        const isDisabled = await nextBtn.isDisabled();
        if (!isDisabled) {
          console.log("-> Paginating to next page of to-do items...");
          await nextBtn.click();
          await wait(PAUSE.READ);

          // Go back
          const prevBtn = paginationBtns.first();
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
