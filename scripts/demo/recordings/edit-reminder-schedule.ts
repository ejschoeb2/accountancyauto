/**
 * Recording: Edit a Deadline's Reminder Schedule
 *
 * Click a filing type card on /deadlines to open the edit page,
 * change the required documents for a step, add a new reminder step
 * with a template, and save the changes.
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
    "Open a filing type's schedule editor to change required documents, add a new reminder step with an email template, and save the changes.",
  tags: [
    "schedule",
    "reminder",
    "edit",
    "steps",
    "timing",
    "deadline",
    "configure",
    "documents",
  ],
  category: "Deadlines",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/deadlines");

    // ─── Click the first active filing type card to open edit page ───
    console.log("-> Clicking first filing type card...");
    const firstCard = page.locator("a[href*='/deadlines/']").first();
    await firstCard.waitFor({ state: "visible", timeout: 5000 });
    await cursorClick(page, "a[href*='/deadlines/']", 0);
    await page.waitForURL("**/deadlines/**/edit**");
    await page.waitForLoadState("networkidle");
    await injectCursor(page);
    await wait(PAUSE.LONG);

    // ─── View the edit page header ───
    console.log("-> Viewing schedule edit page...");
    await wait(PAUSE.READ);

    // ─── Scroll down to view document requirements ───
    console.log("-> Reviewing document requirements...");
    const docSection = page.locator('h2:has-text("Document"), h2:has-text("Required Documents")').first();
    if (await docSection.isVisible()) {
      await docSection.scrollIntoViewIfNeeded();
      await wait(PAUSE.MEDIUM);

      // Toggle a document checkbox if available
      const docCheckbox = page.locator('[role="checkbox"]').first();
      if (await docCheckbox.isVisible()) {
        await cursorClick(page, '[role="checkbox"]', 0);
        await wait(PAUSE.MEDIUM);
      }
    }

    // ─── Scroll down to Reminder Steps section ───
    console.log("-> Scrolling to Reminder Steps section...");
    const stepsHeading = page.locator('h2:has-text("Reminder Steps")');
    if (await stepsHeading.isVisible()) {
      await stepsHeading.scrollIntoViewIfNeeded();
      await wait(PAUSE.MEDIUM);
    }

    // ─── Modify the template on the first step ───
    console.log("-> Changing email template on first step...");
    const templateSelect = page.locator('[id^="steps."][id$=".email_template_id"]').first();
    if (await templateSelect.isVisible()) {
      await cursorClick(page, '[id^="steps."][id$=".email_template_id"]', 0);
      await wait(PAUSE.SHORT);
      // Pick a template (skip "No template")
      const options = page.locator('[role="option"]');
      const optCount = await options.count();
      if (optCount > 1) {
        await cursorClick(page, '[role="option"]', 1);
      } else {
        await page.keyboard.press("Escape");
      }
      await wait(PAUSE.MEDIUM);
    }

    // ─── Add a new reminder step ───
    console.log("-> Adding a new reminder step...");
    const addStepBtn = page.locator('button:has-text("Add Step")').first();
    if (await addStepBtn.isVisible()) {
      await addStepBtn.scrollIntoViewIfNeeded();
      await wait(PAUSE.SHORT);
      await cursorClick(page, 'button:has-text("Add Step")');
      await wait(PAUSE.LONG);
    }

    // ─── Configure the new step ───
    console.log("-> Configuring new step delay...");
    // Find the last delay select (the newly added step)
    const delaySelects = page.locator('[data-slot="select-trigger"]');
    const selectCount = await delaySelects.count();
    if (selectCount > 0) {
      // The last select in the steps area should be the new step's delay
      const lastDelayIdx = selectCount - 1;
      await cursorClick(page, '[data-slot="select-trigger"]', lastDelayIdx);
      await wait(PAUSE.SHORT);

      const fourteenDays = page.locator('[role="option"]:has-text("14")').first();
      if (await fourteenDays.isVisible()) {
        await cursorClick(page, '[role="option"]:has-text("14")');
      } else {
        // Pick any option
        await cursorClick(page, '[role="option"]', 1);
      }
      await wait(PAUSE.MEDIUM);
    }

    // ─── Select a template for the new step ───
    console.log("-> Selecting template for new step...");
    const newTemplateSelect = page.locator('[id^="steps."][id$=".email_template_id"]').last();
    if (await newTemplateSelect.isVisible()) {
      await cursorClick(page, '[id^="steps."][id$=".email_template_id"]');
      await wait(PAUSE.SHORT);
      const templateOptions = page.locator('[role="option"]');
      const templateCount = await templateOptions.count();
      if (templateCount > 2) {
        // Pick the second real template
        await cursorClick(page, '[role="option"]', 2);
      } else if (templateCount > 1) {
        await cursorClick(page, '[role="option"]', 1);
      } else {
        await page.keyboard.press("Escape");
      }
      await wait(PAUSE.MEDIUM);
    }

    // ─── View the configured steps ───
    console.log("-> Viewing configured reminder steps...");
    await wait(PAUSE.READ);

    // ─── Scroll up and save changes ───
    console.log("-> Saving changes...");
    const saveBtn = page.locator('button:has-text("Save")').first();
    if (await saveBtn.isVisible()) {
      await saveBtn.scrollIntoViewIfNeeded();
      await wait(PAUSE.SHORT);
      await cursorClick(page, 'button:has-text("Save")');
      await wait(PAUSE.LONG);
    }

    await page.waitForLoadState("networkidle");
    await injectCursor(page);

    console.log("-> Schedule editing complete — changes saved.");
    await wait(PAUSE.READ);
  },
};

export default demo;
