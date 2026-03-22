/**
 * Recording: Create a Custom Deadline Schedule
 *
 * On /deadlines, click "Create Deadline" to open the new custom schedule
 * form, fill in details (name, description, date), add a reminder step,
 * and stop before saving.
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
  id: "create-custom-schedule",
  title: "Create a Custom Deadline Schedule",
  description:
    "Set up a custom recurring deadline with your own name, date, recurrence rule, and reminder steps.",
  tags: ["custom", "schedule", "create", "deadline", "recurring", "new"],
  category: "Deadlines",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/deadlines");

    // ─── Click Create Deadline button ───
    console.log("→ Clicking Create Deadline...");
    await cursorClick(page, 'a[href*="/deadlines/new/edit?type=custom"]');
    await page.waitForURL("**/deadlines/new/edit**");
    await page.waitForLoadState("networkidle");
    await wait(PAUSE.LONG);

    // ─── Fill in Basic Information ───
    console.log("→ Filling in deadline name...");
    await cursorType(page, "#name", "Annual PAYE Settlement Agreement", {
      delay: 30,
    });
    await wait(PAUSE.SHORT);

    console.log("→ Filling in description...");
    const descField = page.locator("#description, textarea[id='description']");
    if (await descField.isVisible()) {
      await cursorType(
        page,
        "#description, textarea[id='description']",
        "Annual PSA deadline for agreeing minor or irregular benefits and expenses with HMRC.",
        { delay: 25 }
      );
      await wait(PAUSE.SHORT);
    }

    // ─── Set a one-off date ───
    console.log("→ Setting deadline date...");
    const dateInput = page.locator('input[type="date"]').first();
    if (await dateInput.isVisible()) {
      await cursorClick(page, 'input[type="date"]', 0);
      await wait(PAUSE.SHORT);
      // Type a future date
      await dateInput.fill("2027-07-06");
      await wait(PAUSE.MEDIUM);
    }

    // ─── Scroll to Reminder Steps ───
    console.log("→ Scrolling to Reminder Steps...");
    const stepsHeading = page.locator('h2:has-text("Reminder Steps")');
    await stepsHeading.scrollIntoViewIfNeeded();
    await wait(PAUSE.MEDIUM);

    // ─── Add a reminder step ───
    console.log("→ Adding a reminder step...");
    await cursorClick(page, 'button:has-text("Add Step")');
    await wait(PAUSE.LONG);

    // ─── Configure the step delay ───
    console.log("→ Setting step to 14 days before...");
    // The new step's delay select — find the last one added
    const delaySelects = page.locator('label:has-text("Days before deadline") ~ div [data-slot="select-trigger"], label:has-text("Days before deadline") + div button[role="combobox"]');
    const selectCount = await delaySelects.count();
    if (selectCount > 0) {
      await cursorClick(
        page,
        'label:has-text("Days before deadline") ~ div [data-slot="select-trigger"], label:has-text("Days before deadline") + div button[role="combobox"]',
        selectCount - 1
      );
      await wait(PAUSE.SHORT);
      await cursorClick(page, '[role="option"]:has-text("14 days")');
      await wait(PAUSE.MEDIUM);
    }

    // ─── Scroll to Applies To section ───
    console.log("→ Scrolling to client selector...");
    const appliesToHeading = page.locator('h2:has-text("Applies To")');
    if (await appliesToHeading.isVisible()) {
      await appliesToHeading.scrollIntoViewIfNeeded();
      await wait(PAUSE.MEDIUM);

      // Select a couple of clients
      console.log("→ Selecting clients...");
      const clientRows = page.locator(".hover\\:bg-muted\\/50.cursor-pointer");
      const rowCount = await clientRows.count();
      if (rowCount > 0) {
        await cursorClick(page, ".hover\\:bg-muted\\/50.cursor-pointer", 0);
        await wait(PAUSE.SHORT);
      }
      if (rowCount > 1) {
        await cursorClick(page, ".hover\\:bg-muted\\/50.cursor-pointer", 1);
        await wait(PAUSE.SHORT);
      }
      if (rowCount > 2) {
        await cursorClick(page, ".hover\\:bg-muted\\/50.cursor-pointer", 2);
        await wait(PAUSE.MEDIUM);
      }
    }

    await wait(PAUSE.READ);
    console.log("→ Custom schedule creation demo complete (not saving).");
  },
};

export default demo;
