/**
 * Recording: Exclude Clients from a Deadline
 *
 * Open a filing type's schedule editor, scroll to the "Applies To"
 * (Client Exclusions) section, and untick several clients to exclude
 * them from receiving reminders for this deadline.
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
  id: "exclude-clients-from-deadline",
  title: "Exclude Clients from a Deadline",
  description:
    "Remove specific clients from a filing type so they don't receive reminders for it.",
  tags: [
    "exclude",
    "client",
    "deadline",
    "remove",
    "filing type",
    "exemption",
  ],
  category: "Deadlines",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/deadlines");

    // ─── Open an active filing type with reminders ───
    console.log("→ Opening a filing type schedule...");
    const cardWithReminders = page.locator('.grid a:has-text("Reminders:")').first();
    if (await cardWithReminders.isVisible().catch(() => false)) {
      await cursorClick(page, '.grid a:has-text("Reminders:")');
    } else {
      await cursorClick(page, ".grid a", 0);
    }
    await page.waitForURL("**/deadlines/**/edit**");
    await page.waitForLoadState("networkidle");
    await injectCursor(page);
    await wait(PAUSE.LONG);

    // ─── Scroll down to the Applies To / Client Exclusions section ───
    // Must scroll past Reminder Steps and any Document Requirements sections
    console.log("→ Scrolling to Applies To section...");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await injectCursor(page);
    await wait(PAUSE.SHORT);

    // Find the last "Applies To" heading (the exclusions one, not the client selector)
    const appliesToHeadings = page.locator('h2:has-text("Applies To")');
    const headingCount = await appliesToHeadings.count();
    const appliesToHeading = appliesToHeadings.nth(headingCount - 1);
    await appliesToHeading.scrollIntoViewIfNeeded();
    await injectCursor(page);
    await wait(PAUSE.MEDIUM);

    // ─── View the exclusions list ───
    console.log("→ Viewing client exclusions list...");
    await cursorMove(page, 'h2:has-text("Applies To")');
    await wait(PAUSE.READ);

    // ─── Scope to the Applies To card to avoid clicking document rows ───
    const appliesToCard = appliesToHeading.locator('xpath=ancestor::*[contains(@class,"card")]').first();
    const clientRows = appliesToCard.locator('.cursor-pointer');

    // ─── Exclude clients by unticking them ───
    const count = await clientRows.count();

    // Exclude the first client
    if (count > 0) {
      console.log("→ Excluding first client...");
      await clientRows.nth(0).scrollIntoViewIfNeeded();
      await injectCursor(page);
      await cursorClick(page, `h2:has-text("Applies To") >> xpath=ancestor::*[contains(@class,"card")] >> .cursor-pointer >> nth=0`);
      await wait(PAUSE.MEDIUM);
    }

    // Exclude the second client
    if (count > 1) {
      console.log("→ Excluding second client...");
      await clientRows.nth(1).scrollIntoViewIfNeeded();
      await injectCursor(page);
      await clientRows.nth(1).click();
      await wait(PAUSE.MEDIUM);
    }

    // Exclude the third client
    if (count > 2) {
      console.log("→ Excluding third client...");
      await clientRows.nth(2).scrollIntoViewIfNeeded();
      await injectCursor(page);
      await clientRows.nth(2).click();
      await wait(PAUSE.MEDIUM);
    }

    // Exclude a fourth client
    if (count > 3) {
      console.log("→ Excluding fourth client...");
      await clientRows.nth(3).scrollIntoViewIfNeeded();
      await injectCursor(page);
      await clientRows.nth(3).click();
      await wait(PAUSE.MEDIUM);
    }

    // Scroll down to exclude one more further down the list
    if (count > 6) {
      console.log("→ Scrolling down to exclude another client...");
      await clientRows.nth(6).scrollIntoViewIfNeeded();
      await injectCursor(page);
      await wait(PAUSE.SHORT);
      await clientRows.nth(6).click();
      await wait(PAUSE.MEDIUM);
    }

    // ─── Show the exclusion summary ───
    console.log("→ Viewing exclusion summary...");
    await appliesToHeading.scrollIntoViewIfNeeded();
    await injectCursor(page);
    await wait(PAUSE.READ);

    // ─── Re-include one client to show toggling works both ways ───
    console.log("→ Re-including a client...");
    if (count > 0) {
      await clientRows.nth(0).scrollIntoViewIfNeeded();
      await injectCursor(page);
      await clientRows.nth(0).click();
      await wait(PAUSE.MEDIUM);
    }

    await wait(PAUSE.READ);
    console.log("→ Client exclusions demo complete.");
  },
};

export default demo;
