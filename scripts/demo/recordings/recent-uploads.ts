/**
 * Recording: Review Recent Document Uploads
 *
 * Login to the dashboard, scroll to the Recent Uploads section, show all
 * upload rows, paginate to next page and back, click a row to open the
 * document preview modal, accept/approve the document, navigate to the
 * next item in the modal, then close.
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
  id: "recent-uploads",
  title: "Review Recent Document Uploads",
  description:
    "Scroll through recent uploads, paginate between pages, open a document preview, accept it, navigate to the next item, and close.",
  tags: ["uploads", "documents", "recent", "dashboard", "review", "preview", "approve"],
  category: "Dashboard",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);

    // ---- Scroll to the Recent Uploads section ----
    console.log("-> Scrolling to Recent Uploads...");
    const uploadsHeader = page.locator('text=Recent Uploads').first();
    await uploadsHeader.scrollIntoViewIfNeeded();
    await injectCursor(page);
    await wait(PAUSE.MEDIUM);

    // ---- Highlight the section header ----
    await cursorMove(page, 'text=Recent Uploads');
    await wait(PAUSE.READ);

    // ---- Check for empty state ----
    const emptyState = page.locator('text=No documents uploaded yet');
    if (await emptyState.isVisible().catch(() => false)) {
      console.log("-> Empty state — no uploads yet.");
      await cursorMove(page, 'text=No documents uploaded yet');
      await wait(PAUSE.READ);
      return;
    }

    // ---- Scroll down to show all upload rows on the current page ----
    console.log("-> Scrolling down to show all uploads...");
    // Find the uploads card container
    const uploadsCard = page.locator('text=Recent Uploads').locator('xpath=ancestor::*[contains(@class,"card")]').first();

    // Hover over the last visible upload row to show the full list
    const uploadButtons = uploadsCard.locator('button[type="button"]');
    const uploadCount = await uploadButtons.count();

    if (uploadCount > 0) {
      // Hover over first upload
      console.log("-> Hovering over first upload...");
      await uploadButtons.first().scrollIntoViewIfNeeded();
      await injectCursor(page);
      await cursorMove(page, 'text=Recent Uploads', 0);
      await wait(PAUSE.SHORT);

      // Scroll the last visible item into view
      if (uploadCount > 3) {
        const lastBtn = uploadButtons.nth(uploadCount - 1);
        await lastBtn.scrollIntoViewIfNeeded();
        await injectCursor(page);
        await wait(PAUSE.MEDIUM);
      }
    }

    // ---- Paginate to next page ----
    console.log("-> Looking for pagination...");
    const paginationContainer = uploadsCard.locator('.flex.items-center.justify-end.gap-2');
    if (await paginationContainer.isVisible().catch(() => false)) {
      const paginationBtns = paginationContainer.locator("button");
      const btnCount = await paginationBtns.count();

      if (btnCount >= 2) {
        const nextBtn = paginationBtns.nth(1);
        const isNextDisabled = await nextBtn.isDisabled();

        if (!isNextDisabled) {
          console.log("-> Going to next page of uploads...");
          await paginationContainer.scrollIntoViewIfNeeded();
          await injectCursor(page);
          await nextBtn.click();
          await wait(PAUSE.READ);

          // Show items on second page
          await wait(PAUSE.MEDIUM);

          // Go back to first page
          console.log("-> Going back to first page...");
          const prevBtn = paginationBtns.nth(0);
          if (!(await prevBtn.isDisabled())) {
            await prevBtn.click();
            await wait(PAUSE.MEDIUM);
          }
        }
      }
    }

    // ---- Click a row to open the document preview modal ----
    if (uploadCount > 0) {
      console.log("-> Clicking an upload to open document preview...");
      // Scroll back to top of uploads
      await uploadsHeader.scrollIntoViewIfNeeded();
      await injectCursor(page);
      await wait(PAUSE.SHORT);

      // Click the first upload row
      await uploadButtons.first().click();
      await wait(PAUSE.LONG);

      // ---- Show the document preview modal ----
      console.log("-> Document preview modal open...");
      await wait(PAUSE.READ);

      // ---- Accept/approve the document ----
      // Look for "Pass Review" or "Mark Received" button
      const passBtn = page.locator('[role="dialog"] button:has-text("Pass Review")');
      const markReceivedBtn = page.locator('[role="dialog"] button:has-text("Mark Received")');

      if (await passBtn.isVisible().catch(() => false)) {
        console.log("-> Approving document (Pass Review)...");
        await cursorClick(page, '[role="dialog"] button:has-text("Pass Review")');
        await wait(PAUSE.LONG);
      } else if (await markReceivedBtn.isVisible().catch(() => false)) {
        console.log("-> Marking document as received...");
        await cursorClick(page, '[role="dialog"] button:has-text("Mark Received")');
        await wait(PAUSE.LONG);
      }

      // ---- Navigate to next item in the modal ----
      // The modal has prev/next navigation via ChevronRight button
      const nextItemBtn = page.locator('[role="dialog"] button:has(svg.lucide-chevron-right)').first();
      if (await nextItemBtn.isVisible().catch(() => false)) {
        const isDisabled = await nextItemBtn.isDisabled();
        if (!isDisabled) {
          console.log("-> Navigating to next document in modal...");
          await nextItemBtn.click();
          await wait(PAUSE.LONG);

          // Show the next document
          await wait(PAUSE.READ);
        }
      }

      // ---- Close the modal ----
      console.log("-> Closing document preview modal...");
      // Look for the X close button in the dialog
      const closeBtn = page.locator('[role="dialog"] button:has(svg.lucide-x)').first();
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click();
      } else {
        await page.keyboard.press("Escape");
      }
      await wait(PAUSE.MEDIUM);
    }

    console.log("-> Recent uploads demo complete.");
    await wait(PAUSE.READ);
  },
};

export default demo;
