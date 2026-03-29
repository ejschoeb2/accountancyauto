/**
 * Recording: Enable the Client Portal
 *
 * Navigate to /settings, stay on the General tab, find the Client Portal card,
 * and toggle it from Disabled to Enabled.
 */

import {
  type DemoDefinition,
  login,
  navigateTo,
  cursorClick,
  cursorMove,
  wait,
  PAUSE,
} from "../helpers";

const demo: DemoDefinition = {
  id: "enable-client-portal",
  title: "Enable the Client Portal",
  description: "Turn on the client upload portal so clients can submit documents through a secure link.",
  tags: ["portal", "client", "enable", "upload", "settings"],
  category: "Settings",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/settings");

    // ─── General tab is the default ───
    console.log("→ Viewing Client Portal card...");
    await cursorMove(page, 'h2:has-text("Client Portal")');
    await wait(PAUSE.SHORT);

    // ─── Open the select dropdown ───
    console.log("→ Opening portal toggle dropdown...");
    await cursorClick(page, '.w-56[role="combobox"]', 0);
    await wait(PAUSE.SHORT);

    // ─── Select "Enabled" ───
    console.log("→ Selecting Enabled...");
    const enabledOption = page.locator('[role="option"]:has-text("Enabled")');
    if (await enabledOption.isVisible()) {
      await cursorClick(page, '[role="option"]:has-text("Enabled")');
    } else {
      await cursorClick(page, '[role="option"]', 0);
    }
    await wait(PAUSE.SHORT);

    // ─── Show saved confirmation ───
    console.log("→ Waiting for save confirmation...");
    await wait(PAUSE.MEDIUM);

    console.log("→ Done — client portal enabled.");
  },
};

export default demo;
