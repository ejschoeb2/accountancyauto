/**
 * Recording: Invite a Team Member
 *
 * Navigate to /settings, stay on General tab, scroll to Team card,
 * fill in the invite email and role, and click Invite.
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
  id: "invite-team-member",
  title: "Invite a Team Member",
  description: "Send an email invitation for a colleague to join your organisation, choosing their role (admin or member).",
  tags: ["invite", "team", "member", "add", "colleague", "organisation"],
  category: "Settings",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/settings");

    // ─── General tab is the default ───
    console.log("→ Scrolling to Team card...");
    const teamHeading = page.locator('h2:has-text("Team")');
    await teamHeading.scrollIntoViewIfNeeded();
    await wait(PAUSE.SHORT);

    await cursorMove(page, 'h2:has-text("Team")');
    await wait(PAUSE.MEDIUM);

    // ─── Locate the invite form ───
    console.log("→ Viewing invite form...");
    await cursorMove(page, 'text="Invite a team member"');
    await wait(PAUSE.SHORT);

    // ─── Enter colleague's email ───
    console.log("→ Entering colleague email...");
    await cursorType(
      page,
      'input[placeholder="colleague@example.com"]',
      "jane@smithaccounting.co.uk",
      { delay: 25 }
    );
    await wait(PAUSE.SHORT);

    // ─── Select role ───
    console.log("→ Selecting role...");
    // The invite role Select has a 130px width trigger
    await cursorClick(page, '.w-\\[130px\\][role="combobox"]');
    await wait(PAUSE.SHORT);

    const adminOption = page.locator('[role="option"]:has-text("Admin")');
    if (await adminOption.isVisible()) {
      await cursorClick(page, '[role="option"]:has-text("Admin")');
    } else {
      await cursorClick(page, '[role="option"]', 1);
    }
    await wait(PAUSE.MEDIUM);

    // ─── Click Invite ───
    console.log("→ Clicking Invite button...");
    await cursorClick(page, 'button:has-text("Invite")');
    await wait(PAUSE.READ);

    console.log("→ Done — team member invited.");
  },
};

export default demo;
