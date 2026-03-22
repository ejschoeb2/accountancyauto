/**
 * Recording: Remove a Team Member
 *
 * Navigate to Settings, view the team card on the General tab,
 * find a team member, click Remove, show the confirmation dialog,
 * then cancel without actually removing.
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
  id: "remove-team-member",
  title: "Remove a Team Member",
  description:
    "Remove a team member from your organisation — shows the confirmation and what happens to their data.",
  tags: ["team", "members", "remove", "delete", "settings"],
  category: "Settings",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/settings");

    // General tab is the default — Team card should be visible
    // Wait for the team card to load (members list appears)
    console.log("-> Waiting for team card to load...");
    await page.waitForSelector('button:has-text("Remove")', {
      timeout: 15000,
    });
    await wait(PAUSE.MEDIUM);

    // Scroll the team card into view
    const teamHeading = page.locator('h2:has-text("Team")');
    if (await teamHeading.isVisible()) {
      await teamHeading.scrollIntoViewIfNeeded();
      await injectCursor(page);
      await wait(PAUSE.SHORT);
    }

    // Hover over the members list to draw attention
    console.log("-> Viewing team members...");
    await cursorMove(page, 'p:has-text("Members")');
    await wait(PAUSE.MEDIUM);

    // Find "Remove" buttons — there should be at least one if >1 active member
    const removeBtns = page.locator('button:has-text("Remove")');
    const btnCount = await removeBtns.count();

    if (btnCount === 0) {
      console.log(
        "-> Only one team member — Remove buttons are disabled or absent. Ending early."
      );
      await wait(PAUSE.READ);
      return;
    }

    // Hover over the member row to show intent, then click Remove
    console.log("-> Clicking Remove on a team member...");
    await cursorClick(page, 'button:has-text("Remove")', 0);
    await wait(PAUSE.MEDIUM);

    // Wait for the remove confirmation dialog to appear
    console.log("-> Remove confirmation dialog opened...");
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await wait(PAUSE.MEDIUM);

    // Read the dialog content — hover over the description to let user read it
    const dialogDesc = page.locator('[role="dialog"] [data-description]');
    if (await dialogDesc.isVisible()) {
      await cursorMove(page, '[role="dialog"] [data-description]');
    } else {
      // Fallback: hover over dialog title
      await cursorMove(page, '[role="dialog"] h2');
    }
    await wait(PAUSE.READ);

    // Show the Remove button in the dialog but do NOT click it — cancel instead
    console.log("-> Showing the Remove button (will cancel instead)...");
    await cursorMove(page, '[role="dialog"] button:has-text("Remove")');
    await wait(PAUSE.LONG);

    // Click the Close / Cancel button to dismiss the dialog without removing
    console.log("-> Cancelling — closing the dialog...");
    // The DialogFooter has showCloseButton which renders a Close button
    const closeBtn = page.locator(
      '[role="dialog"] button:has-text("Close"), [role="dialog"] button:has-text("Cancel")'
    );
    if (await closeBtn.first().isVisible()) {
      await cursorClick(
        page,
        '[role="dialog"] button:has-text("Close"), [role="dialog"] button:has-text("Cancel")'
      );
    } else {
      // Fallback: press Escape to close the dialog
      await page.keyboard.press("Escape");
    }
    await wait(PAUSE.MEDIUM);

    console.log("-> Dialog dismissed — member NOT removed. Pausing for viewer...");
    await wait(PAUSE.READ);
  },
};

export default demo;
