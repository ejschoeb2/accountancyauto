/**
 * Recording: Change the Email Send Hour
 *
 * Navigate to /settings, switch to the Email tab, find the send hour picker,
 * open the dropdown and select a different hour.
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
  id: "change-send-hour",
  title: "Change the Email Send Hour",
  description: "Adjust what time of day automated reminder emails are sent out.",
  tags: ["send hour", "time", "schedule", "settings", "email"],
  category: "Settings",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/settings");

    // ─── Switch to Email tab ───
    console.log("→ Switching to Email tab...");
    await cursorClick(page, '[data-slot="tabs-trigger"]:has-text("Email")');
    await wait(PAUSE.MEDIUM);

    // ─── Locate the Send Hour Picker card ───
    console.log("→ Hovering over Reminder Timing card...");
    await cursorMove(page, 'text="Reminder Timing"');
    await wait(PAUSE.SHORT);

    // ─── Open the select dropdown ───
    console.log("→ Opening send hour dropdown...");
    // The SelectTrigger has a fixed width of 140px inside the SendHourPicker card
    await cursorClick(page, '.w-\\[140px\\][role="combobox"]');
    await wait(PAUSE.MEDIUM);

    // ─── Select a different hour (e.g. 10:00 AM) ───
    console.log("→ Selecting 10:00 AM...");
    const option = page.locator('[role="option"]', { hasText: "10:00 AM" });
    if (await option.isVisible()) {
      await cursorClick(page, '[role="option"]:has-text("10:00 AM")');
    } else {
      // Fallback: pick the 3rd option
      await cursorClick(page, '[role="option"]', 2);
    }
    await wait(PAUSE.MEDIUM);

    // ─── Show saved confirmation ───
    console.log("→ Waiting for save confirmation...");
    await wait(PAUSE.READ);

    console.log("→ Done — send hour changed.");
  },
};

export default demo;
