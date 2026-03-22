/**
 * Recording: Edit a Deadline's Reminder Schedule
 *
 * Click a filing type card on /deadlines to open the edit page,
 * modify reminder step timing and template selection, add a new step.
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
  id: "edit-reminder-schedule",
  title: "Edit a Deadline's Reminder Schedule",
  description:
    "Open a filing type's schedule editor to configure which email templates are sent and how many days before the deadline.",
  tags: [
    "schedule",
    "reminder",
    "edit",
    "steps",
    "timing",
    "deadline",
    "configure",
  ],
  category: "Deadlines",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/deadlines");

    // ─── Click the first active filing type card to open edit page ───
    console.log("→ Clicking first filing type card...");
    const firstCard = page.locator(".grid a").first();
    await firstCard.waitFor({ state: "visible", timeout: 5000 });
    await cursorClick(page, ".grid a", 0);
    await page.waitForURL("**/deadlines/**/edit**");
    await page.waitForLoadState("networkidle");
    await wait(PAUSE.LONG);

    // ─── View the edit page header ───
    console.log("→ Viewing schedule edit page...");
    await wait(PAUSE.READ);

    // ─── Scroll down to Reminder Steps section ───
    console.log("→ Scrolling to Reminder Steps section...");
    const stepsHeading = page.locator('h2:has-text("Reminder Steps")');
    await stepsHeading.scrollIntoViewIfNeeded();
    await wait(PAUSE.MEDIUM);

    // ─── Modify the delay days on the first step ───
    console.log("→ Modifying delay days on first step...");
    const delaySelect = page
      .locator('label:has-text("Days before deadline")')
      .first()
      .locator("..")
      .locator("button[role='combobox'], [data-slot='select-trigger']")
      .first();
    if (await delaySelect.isVisible()) {
      await cursorClick(
        page,
        'label:has-text("Days before deadline") + div button, label:has-text("Days before deadline") ~ div [data-slot="select-trigger"]',
        0
      );
      await wait(PAUSE.SHORT);
      // Select 30 days
      await cursorClick(page, '[role="option"]:has-text("30 days")');
      await wait(PAUSE.MEDIUM);
    }

    // ─── Change the email template on the first step ───
    console.log("→ Changing email template...");
    const templateSelect = page
      .locator('[id^="steps."][id$=".email_template_id"]')
      .first();
    if (await templateSelect.isVisible()) {
      await cursorClick(
        page,
        '[id^="steps."][id$=".email_template_id"]',
        0
      );
      await wait(PAUSE.SHORT);
      // Pick the second template option (first is "No template")
      const options = page.locator('[role="option"]');
      const count = await options.count();
      if (count > 1) {
        await cursorClick(page, '[role="option"]', 1);
      } else {
        await page.keyboard.press("Escape");
      }
      await wait(PAUSE.MEDIUM);
    }

    // ─── Add a new reminder step ───
    console.log("→ Adding a new reminder step...");
    const addStepBtn = page.locator('button:has-text("Add Step")').first();
    await addStepBtn.scrollIntoViewIfNeeded();
    await wait(PAUSE.SHORT);
    await cursorClick(page, 'button:has-text("Add Step")');
    await wait(PAUSE.LONG);

    // ─── View the new step ───
    console.log("→ Viewing newly added step...");
    await wait(PAUSE.READ);

    // Do not save — this is a demo
    console.log("→ Schedule editing demo complete (not saving).");
  },
};

export default demo;
