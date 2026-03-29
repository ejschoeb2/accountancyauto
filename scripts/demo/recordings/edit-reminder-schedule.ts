/**
 * Recording: Edit a Deadline's Reminder Schedule
 *
 * Navigate to /deadlines, click on an existing active deadline card to
 * open its schedule edit page, modify a reminder step's timing, add a new
 * reminder step with a template, and save.
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
  id: "edit-reminder-schedule",
  title: "Edit a Deadline's Reminder Schedule",
  description:
    "Open an existing deadline's schedule editor to adjust step timing, change email templates, add new reminder steps, and save changes.",
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

    // ─── Click an active deadline card that has reminders configured ───
    // The grid contains filing type cards as <a> links. Active cards with
    // schedules have href like /deadlines/{uuid}/edit. We want to click one
    // that shows "Reminders:" (i.e. has a schedule configured).
    console.log("-> Looking for a deadline card with reminders...");
    await page.waitForLoadState("networkidle");
    await wait(PAUSE.MEDIUM);

    // Look for cards that have reminder text (indicating they have a schedule)
    const cardWithReminders = page.locator('.grid a:has-text("Reminders:")').first();
    if (await cardWithReminders.isVisible().catch(() => false)) {
      await cursorMove(page, '.grid a:has-text("Reminders:")');
      await wait(PAUSE.MEDIUM);
      await cursorClick(page, '.grid a:has-text("Reminders:")');
    } else {
      // Fallback: click first card in the grid (skip the Create Deadline button)
      await cursorClick(page, ".grid a", 0);
    }

    await page.waitForURL("**/deadlines/**/edit**");
    await page.waitForLoadState("networkidle");
    await injectCursor(page);
    await wait(PAUSE.LONG);

    // ─── View the page heading ───
    console.log("-> Viewing schedule edit page...");
    await cursorMove(page, "h1");
    await wait(PAUSE.MEDIUM);

    // ─── Scroll to Reminder Steps section ───
    console.log("-> Scrolling to Reminder Steps...");
    const stepsHeading = page.locator('h2:has-text("Reminder Steps")');
    if (await stepsHeading.isVisible()) {
      await stepsHeading.scrollIntoViewIfNeeded();
      await injectCursor(page);
      await wait(PAUSE.MEDIUM);
    }

    // ─── View the existing steps ───
    console.log("-> Viewing existing reminder steps...");
    await cursorMove(page, 'h2:has-text("Reminder Steps")');
    await wait(PAUSE.READ);

    // ─── Change the delay on the first step ───
    // Steps use a Select with options: 7 days, 14 days, 30 days, Custom
    // Scope selects to the Reminder Steps card to avoid the disabled filing_type_id dropdown
    console.log("-> Changing timing on first step...");
    const stepsCard = page.locator('h2:has-text("Reminder Steps")').locator('xpath=ancestor::*[contains(@class,"card")]').first();
    const stepSelects = stepsCard.locator('[data-slot="select-trigger"]');
    const firstStepDelay = stepSelects.first();
    if (await firstStepDelay.isVisible().catch(() => false)) {
      await firstStepDelay.scrollIntoViewIfNeeded();
      await injectCursor(page);
      await firstStepDelay.click();
      await wait(PAUSE.SHORT);

      // Pick 14 days
      const fourteenDays = page.locator('[role="option"]:has-text("14")').first();
      if (await fourteenDays.isVisible()) {
        await cursorClick(page, '[role="option"]:has-text("14")');
      } else {
        await cursorClick(page, '[role="option"]', 1);
      }
      await wait(PAUSE.MEDIUM);
    }

    // ─── Add a new reminder step ───
    console.log("-> Adding a new reminder step...");
    const addStepBtn = page.locator('button:has-text("Add Step")').first();
    if (await addStepBtn.isVisible()) {
      await addStepBtn.scrollIntoViewIfNeeded();
      await injectCursor(page);
      await wait(PAUSE.SHORT);
      await cursorClick(page, 'button:has-text("Add Step")');
      await wait(PAUSE.MEDIUM);
    }

    // ─── Configure the new step's delay to 7 days ───
    console.log("-> Setting new step to 7 days...");
    // Re-query after adding a step
    const updatedStepSelects = stepsCard.locator('[data-slot="select-trigger"]');
    const updatedSelectCount = await updatedStepSelects.count();
    if (updatedSelectCount > 0) {
      // Each step has 2 selects (delay + template). New step's delay is second-to-last.
      const lastDelayIdx = updatedSelectCount - 2;
      if (lastDelayIdx >= 0) {
        const newDelaySelect = updatedStepSelects.nth(lastDelayIdx);
        await newDelaySelect.scrollIntoViewIfNeeded();
        await injectCursor(page);
        await newDelaySelect.click();
        await wait(PAUSE.SHORT);

        const sevenDays = page.locator('[role="option"]:has-text("7")').first();
        if (await sevenDays.isVisible()) {
          await cursorClick(page, '[role="option"]:has-text("7")');
        } else {
          await cursorClick(page, '[role="option"]', 0);
        }
        await wait(PAUSE.MEDIUM);
      }
    }

    // ─── Select a template for the new step ───
    console.log("-> Selecting template for new step...");
    const templateSelects = page.locator('[id^="steps."][id$=".email_template_id"]');
    const templateCount = await templateSelects.count();
    if (templateCount > 0) {
      const lastTemplate = templateSelects.last();
      await lastTemplate.scrollIntoViewIfNeeded();
      await injectCursor(page);
      await cursorClick(page, '[id^="steps."][id$=".email_template_id"]', templateCount - 1);
      await wait(PAUSE.SHORT);

      // Pick "Urgent Final Notice" if visible, otherwise second option
      const urgentOption = page.locator('[role="option"]:has-text("Urgent Final Notice")').first();
      if (await urgentOption.isVisible()) {
        await cursorClick(page, '[role="option"]:has-text("Urgent Final Notice")');
      } else {
        const options = page.locator('[role="option"]');
        const optCount = await options.count();
        if (optCount > 1) {
          await cursorClick(page, '[role="option"]', 1);
        } else if (optCount > 0) {
          await cursorClick(page, '[role="option"]', 0);
        } else {
          await page.keyboard.press("Escape");
        }
      }
      await wait(PAUSE.MEDIUM);
    }

    // ─── View the final configuration ───
    console.log("-> Viewing final configuration...");
    await wait(PAUSE.READ);

    // ─── Save changes ───
    console.log("-> Saving changes...");
    const saveBtn = page.locator('button:has-text("Save")').first();
    if (await saveBtn.isVisible()) {
      await saveBtn.scrollIntoViewIfNeeded();
      await injectCursor(page);
      await wait(PAUSE.SHORT);
      await cursorClick(page, 'button:has-text("Save")');
      await wait(PAUSE.LONG);
    }

    await page.waitForLoadState("networkidle");
    await injectCursor(page);

    console.log("-> Schedule editing complete — changes saved.");
    await wait(PAUSE.MEDIUM);
  },
};

export default demo;
