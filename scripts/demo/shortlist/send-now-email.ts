/**
 * Shortlist recording: Send Now Email
 *
 * Navigate to Activity, scroll down, go to next page, open an email,
 * press "Send Now", then navigate back to dashboard.
 */

import {
  type DemoDefinition,
  login,
  navigateTo,
  cursorClick,
  cursorMove,
  injectCursor,
  wait,
  PAUSE,
} from "../helpers";

const demo: DemoDefinition = {
  id: "shortlist-send-now-email",
  title: "Send Now Email",
  description: "Open a scheduled email from the queue and send it immediately.",
  tags: ["email", "send", "activity", "queued"],
  category: "Emails",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/activity");

    // ── Wait for table to load then scroll down ────────────────────────────
    await page.waitForLoadState("networkidle");
    await injectCursor(page);
    await wait(PAUSE.MEDIUM);

    // Scroll down to show the table content
    await page.evaluate(() => window.scrollBy({ top: 300, behavior: "smooth" }));
    await wait(PAUSE.LONG);

    // ── Go to next page ────────────────────────────────────────────────────
    const tableRows = page.locator("table tbody tr");
    const rowCount = await tableRows.count();

    // Hover over a couple of rows first
    if (rowCount > 0) {
      await cursorMove(page, "table tbody tr", 0);
      await wait(PAUSE.MEDIUM);
      if (rowCount > 1) {
        await cursorMove(page, "table tbody tr", 1);
        await wait(PAUSE.MEDIUM);
      }
    }

    // Find pagination and click next page
    const paginationContainer = page.locator('.flex.items-center.justify-end.gap-2.pt-4').first();
    const hasPagination = await paginationContainer.isVisible().catch(() => false);
    if (hasPagination) {
      const paginationBtns = paginationContainer.locator('button');
      const nextBtn = paginationBtns.nth(1);
      if (!(await nextBtn.isDisabled())) {
        await cursorClick(page, '.flex.items-center.justify-end.gap-2.pt-4 >> button >> nth=1');
        await wait(PAUSE.LONG);
        await injectCursor(page);
      }
    }

    // ── Open email preview modal ───────────────────────────────────────────
    console.log("-> Opening email preview modal...");
    const updatedRowCount = await tableRows.count();
    if (updatedRowCount > 0) {
      await cursorClick(page, "table tbody tr", 0);
      await wait(PAUSE.LONG);
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 }).catch(() => {});
      await injectCursor(page);
      await wait(PAUSE.READ);

      // ── Click "Send Now" ───────────────────────────────────────────────
      console.log("-> Clicking Send Now...");
      const sendNowBtn = page.locator('[role="dialog"] button:has-text("Send Now")').first();
      if (await sendNowBtn.isVisible().catch(() => false)) {
        await cursorClick(page, '[role="dialog"] button:has-text("Send Now")');
        await wait(PAUSE.LONG);

        // Confirm if a confirmation dialog appears
        const confirmBtn = page.locator('[role="alertdialog"] button:has-text("Send"), [role="dialog"] button:has-text("Confirm")').first();
        if (await confirmBtn.isVisible().catch(() => false)) {
          await cursorClick(page, '[role="alertdialog"] button:has-text("Send"), [role="dialog"] button:has-text("Confirm")');
          await wait(PAUSE.LONG);
        }
      }

      // ── Close the modal ────────────────────────────────────────────────
      await page.keyboard.press("Escape");
      await wait(PAUSE.MEDIUM);

      const dialogStillOpen = await page.locator('[role="dialog"]').isVisible().catch(() => false);
      if (dialogStillOpen) {
        const closeBtn = page.locator('[role="dialog"] button:has-text("Close")').first();
        if (await closeBtn.isVisible().catch(() => false)) {
          await cursorClick(page, '[role="dialog"] button:has-text("Close")');
          await wait(PAUSE.MEDIUM);
        }
      }
    }

    // ── Navigate back to dashboard ─────────────────────────────────────────
    console.log("-> Navigating back to dashboard...");
    await navigateTo(page, "/dashboard");
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await wait(PAUSE.MEDIUM);
  },
};

export default demo;
