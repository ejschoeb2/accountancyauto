/**
 * Recording: Create a Custom Deadline Schedule
 *
 * On /deadlines, click "Create Deadline" to open the new custom schedule
 * form, fill in details (name, description, date), add two reminder
 * steps with templates, select clients, scroll up and create it.
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
  injectCursor,
} from "../helpers";

const demo: DemoDefinition = {
  id: "create-custom-schedule",
  title: "Create a Custom Deadline Schedule",
  description:
    "Set up a custom recurring deadline with your own name, date, recurrence rule, reminder steps with email templates, and client assignments.",
  tags: ["custom", "schedule", "create", "deadline", "recurring", "new"],
  category: "Deadlines",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/deadlines");

    // ─── Click Create Deadline button ───
    console.log("-> Clicking Create Deadline...");
    await cursorClick(page, 'a[href*="/deadlines/new/edit?type=custom"]');
    await page.waitForURL("**/deadlines/new/edit**");
    await page.waitForLoadState("networkidle");
    await injectCursor(page);
    await wait(PAUSE.LONG);

    // ─── Fill in Basic Information ───
    console.log("-> Filling in deadline name...");
    await cursorType(page, "#name", "Annual PAYE Settlement Agreement", {
      delay: 30,
    });
    await wait(PAUSE.SHORT);

    console.log("-> Filling in description...");
    const descField = page.locator("#description, textarea[id='description']");
    if (await descField.isVisible()) {
      await cursorType(
        page,
        "#description, textarea[id='description']",
        "Annual PSA deadline for agreeing minor or irregular benefits and expenses with HMRC.",
        { delay: 20 }
      );
      await wait(PAUSE.SHORT);
    }

    // ─── Set a one-off date ───
    console.log("-> Setting deadline date...");
    const dateInput = page.locator('input[type="date"]').first();
    if (await dateInput.isVisible()) {
      await cursorClick(page, 'input[type="date"]', 0);
      await wait(PAUSE.SHORT);
      await dateInput.fill("2027-07-06");
      await wait(PAUSE.MEDIUM);
    }

    // ─── Scroll to Reminder Steps ───
    console.log("-> Scrolling to Reminder Steps...");
    const stepsHeading = page.locator('h2:has-text("Reminder Steps")');
    if (await stepsHeading.isVisible()) {
      await stepsHeading.scrollIntoViewIfNeeded();
      await wait(PAUSE.MEDIUM);
    }

    // ─── Add first reminder step ───
    console.log("-> Adding first reminder step...");
    await cursorClick(page, 'button:has-text("Add Step")');
    await wait(PAUSE.LONG);

    // ─── Configure the first step — 30 days before ───
    console.log("-> Setting first step to 30 days before...");
    const delaySelects = page.locator('[data-slot="select-trigger"]');
    let selectIdx = (await delaySelects.count()) - 1;
    if (selectIdx >= 0) {
      await cursorClick(page, '[data-slot="select-trigger"]', selectIdx);
      await wait(PAUSE.SHORT);
      const thirtyDays = page.locator('[role="option"]:has-text("30")').first();
      if (await thirtyDays.isVisible()) {
        await cursorClick(page, '[role="option"]:has-text("30")');
      } else {
        await cursorClick(page, '[role="option"]', 2);
      }
      await wait(PAUSE.MEDIUM);
    }

    // ─── Choose email template for first step ───
    console.log("-> Selecting template for first step...");
    const firstTemplateSelect = page.locator('[id^="steps."][id$=".email_template_id"]').first();
    if (await firstTemplateSelect.isVisible()) {
      await cursorClick(page, '[id^="steps."][id$=".email_template_id"]', 0);
      await wait(PAUSE.SHORT);
      // Select "Friendly First Reminder"
      const friendlyOption = page.locator('[role="option"]:has-text("Friendly First Reminder")').first();
      if (await friendlyOption.isVisible()) {
        await cursorClick(page, '[role="option"]:has-text("Friendly First Reminder")');
      } else {
        const options = page.locator('[role="option"]');
        if ((await options.count()) > 1) {
          await cursorClick(page, '[role="option"]', 1);
        } else {
          await page.keyboard.press("Escape");
        }
      }
      await wait(PAUSE.MEDIUM);
    }

    // ─── Add a second reminder step ───
    console.log("-> Adding second reminder step...");
    const addStepBtn = page.locator('button:has-text("Add Step")').first();
    if (await addStepBtn.isVisible()) {
      await addStepBtn.scrollIntoViewIfNeeded();
      await wait(PAUSE.SHORT);
      await cursorClick(page, 'button:has-text("Add Step")');
      await wait(PAUSE.LONG);
    }

    // ─── Configure the second step — 7 days before ───
    console.log("-> Setting second step to 7 days before...");
    const allDelaySelects = page.locator('[data-slot="select-trigger"]');
    selectIdx = (await allDelaySelects.count()) - 1;
    if (selectIdx >= 0) {
      await cursorClick(page, '[data-slot="select-trigger"]', selectIdx);
      await wait(PAUSE.SHORT);
      const sevenDays = page.locator('[role="option"]:has-text("7")').first();
      if (await sevenDays.isVisible()) {
        await cursorClick(page, '[role="option"]:has-text("7")');
      } else {
        await cursorClick(page, '[role="option"]', 0);
      }
      await wait(PAUSE.MEDIUM);
    }

    // ─── Choose template for second step ───
    console.log("-> Selecting template for second step...");
    const secondTemplateSelect = page.locator('[id^="steps."][id$=".email_template_id"]').last();
    if (await secondTemplateSelect.isVisible()) {
      await cursorClick(page, '[id^="steps."][id$=".email_template_id"]');
      await wait(PAUSE.SHORT);
      // Select "Follow-Up Reminder"
      const followUpOption = page.locator('[role="option"]:has-text("Follow-Up Reminder")').first();
      if (await followUpOption.isVisible()) {
        await cursorClick(page, '[role="option"]:has-text("Follow-Up Reminder")');
      } else {
        const options = page.locator('[role="option"]');
        if ((await options.count()) > 2) {
          await cursorClick(page, '[role="option"]', 2);
        } else {
          await page.keyboard.press("Escape");
        }
      }
      await wait(PAUSE.MEDIUM);
    }

    // ─── Scroll to Applies To section and select clients ───
    console.log("-> Scrolling to client selector...");
    const appliesToHeading = page.locator('h2:has-text("Applies To")');
    if (await appliesToHeading.isVisible()) {
      await appliesToHeading.scrollIntoViewIfNeeded();
      await wait(PAUSE.MEDIUM);

      // Select a few clients
      console.log("-> Selecting clients...");
      const clientCheckboxes = page.locator('[role="checkbox"]');
      const checkCount = await clientCheckboxes.count();

      // Find checkboxes in the Applies To section (after the heading)
      const clientRows = page.locator(".hover\\:bg-muted\\/50.cursor-pointer, table tbody tr");
      const rowCount = await clientRows.count();
      if (rowCount > 0) {
        await cursorClick(page, ".hover\\:bg-muted\\/50.cursor-pointer, table tbody tr", 0);
        await wait(PAUSE.SHORT);
      }
      if (rowCount > 1) {
        await cursorClick(page, ".hover\\:bg-muted\\/50.cursor-pointer, table tbody tr", 1);
        await wait(PAUSE.SHORT);
      }
      if (rowCount > 2) {
        await cursorClick(page, ".hover\\:bg-muted\\/50.cursor-pointer, table tbody tr", 2);
        await wait(PAUSE.MEDIUM);
      }
    }

    await wait(PAUSE.READ);

    // ─── Scroll up and create the schedule ───
    console.log("-> Scrolling up to create...");
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await wait(PAUSE.MEDIUM);

    const createBtn = page.locator('button:has-text("Create")').first();
    if (await createBtn.isVisible()) {
      await cursorClick(page, 'button:has-text("Create")');
      await wait(PAUSE.LONG);
    }

    await page.waitForLoadState("networkidle");
    await injectCursor(page);

    console.log("-> Custom schedule created.");
    await wait(PAUSE.READ);
  },
};

export default demo;
