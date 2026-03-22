/**
 * Recording: Change a Team Member's Role
 *
 * Navigate to Settings, view the team card on the General tab,
 * find a team member, and change their role (e.g. member -> admin).
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
  id: "change-member-role",
  title: "Change a Team Member's Role",
  description:
    "View team members and change a member's role between admin and member.",
  tags: ["team", "members", "role", "admin", "member", "change", "settings"],
  category: "Settings",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/settings");

    // General tab is the default — Team card should be visible
    // Wait for the team card to load (members list appears)
    console.log("-> Waiting for team card to load...");
    await page.waitForSelector('button:has-text("Change role")', {
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

    // Find "Change role" buttons — there should be at least one if >1 active member
    const changeRoleBtns = page.locator('button:has-text("Change role")');
    const btnCount = await changeRoleBtns.count();

    if (btnCount === 0) {
      console.log(
        "-> Only one team member — Change role buttons are disabled or absent. Ending early."
      );
      await wait(PAUSE.READ);
      return;
    }

    // Click "Change role" on the first available member
    console.log("-> Clicking Change role on a team member...");
    await cursorClick(page, 'button:has-text("Change role")', 0);
    await wait(PAUSE.MEDIUM);

    // Wait for the role change dialog to appear
    console.log("-> Role change dialog opened...");
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await wait(PAUSE.MEDIUM);

    // Click the role selector inside the dialog to show the options
    console.log("-> Opening role selector...");
    await cursorClick(page, '[role="dialog"] [role="combobox"]');
    await wait(PAUSE.SHORT);

    // Wait for dropdown options to appear and select one
    await page.waitForSelector('[role="option"]', { timeout: 5000 });
    await wait(PAUSE.SHORT);

    // Pick the first option (the opposite of the current role)
    const options = page.locator('[role="option"]');
    const optionCount = await options.count();

    if (optionCount > 0) {
      // Click the first option to select a role
      await cursorClick(page, '[role="option"]', 0);
      await wait(PAUSE.MEDIUM);
    }

    // Show the Confirm button but click it to demonstrate the change
    console.log("-> Confirming role change...");
    await cursorClick(
      page,
      '[role="dialog"] button:has-text("Confirm")'
    );
    await wait(PAUSE.READ);

    // The dialog should close and the member list refreshes
    console.log("-> Role changed successfully — pausing for viewer...");
    await wait(PAUSE.READ);
  },
};

export default demo;
