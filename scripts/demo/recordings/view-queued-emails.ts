/**
 * Recording: Preview & Manage Queued Emails
 *
 * Navigate to /activity, show queued view, click a queued email row
 * to open the preview modal with metadata sidebar and action buttons.
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
  id: "view-queued-emails",
  title: "Preview & Manage Queued Emails",
  description:
    "View emails scheduled to be sent, preview their content, and optionally cancel or reschedule them.",
  tags: [
    "queued",
    "scheduled",
    "preview",
    "cancel",
    "email",
    "pending",
  ],
  category: "Emails",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/activity");

    // ---- Ensure we are on Outbound / Queued ----
    console.log("-> Ensuring Queued Emails view...");
    await page.waitForLoadState("networkidle");
    await injectCursor(page);
    await wait(PAUSE.MEDIUM);

    // Click Queued Emails toggle if not already active
    const queuedBtn = page.locator('button:has-text("Queued Emails")').first();
    if (await queuedBtn.isVisible()) {
      await cursorClick(page, 'button:has-text("Queued Emails")');
      await page.waitForLoadState("networkidle");
      await injectCursor(page);
      await wait(PAUSE.LONG);
    }

    // ---- Browse queued rows ----
    console.log("-> Browsing queued email rows...");
    const rows = page.locator("table tbody tr");
    const rowCount = await rows.count();

    if (rowCount === 0) {
      console.log("-> No queued emails found, ending demo...");
      await wait(PAUSE.READ);
      return;
    }

    await cursorMove(page, "table tbody tr", 0);
    await wait(PAUSE.SHORT);

    if (rowCount > 1) {
      await cursorMove(page, "table tbody tr", 1);
      await wait(PAUSE.SHORT);
    }

    // ---- Click first queued email to open preview modal ----
    console.log("-> Opening queued email preview modal...");
    await cursorClick(page, "table tbody tr", 0);
    await wait(PAUSE.LONG);

    // ---- Wait for the preview modal ----
    const dialog = page.locator('[role="dialog"]');
    await dialog.waitFor({ state: "visible", timeout: 5000 });
    await wait(PAUSE.MEDIUM);

    // ---- Browse the preview content ----
    console.log("-> Viewing email preview and metadata...");
    await wait(PAUSE.READ);

    // ---- Show action buttons ----
    console.log("-> Highlighting action buttons...");
    const sendNowBtn = page
      .locator('[role="dialog"] button:has-text("Send Now")')
      .first();
    if (await sendNowBtn.isVisible()) {
      await cursorMove(page, '[role="dialog"] button:has-text("Send Now")');
      await wait(PAUSE.SHORT);
    }

    const cancelBtn = page
      .locator('[role="dialog"] button:has-text("Cancel")')
      .first();
    if (await cancelBtn.isVisible()) {
      await cursorMove(page, '[role="dialog"] button:has-text("Cancel")');
      await wait(PAUSE.SHORT);
    }

    const rescheduleBtn = page
      .locator('[role="dialog"] button:has-text("Reschedule")')
      .first();
    if (await rescheduleBtn.isVisible()) {
      await cursorMove(
        page,
        '[role="dialog"] button:has-text("Reschedule")'
      );
      await wait(PAUSE.SHORT);
    }

    // ---- Navigate to next email ----
    console.log("-> Navigating to next queued email...");
    const nextBtn = page
      .locator('[role="dialog"] button:has-text("Next")')
      .first();
    if (await nextBtn.isVisible()) {
      await cursorClick(page, '[role="dialog"] button:has-text("Next")');
      await wait(PAUSE.LONG);
    }

    console.log("-> Queued email preview complete -- pausing for viewer...");
    await wait(PAUSE.READ);

    // ---- Close modal ----
    const closeBtn = page
      .locator('[role="dialog"] button:has-text("Close")')
      .first();
    if (await closeBtn.isVisible()) {
      await cursorClick(page, '[role="dialog"] button:has-text("Close")');
    } else {
      await page.keyboard.press("Escape");
    }
    await wait(PAUSE.SHORT);

    console.log("-> Queued emails demo complete.");
  },
};

export default demo;
