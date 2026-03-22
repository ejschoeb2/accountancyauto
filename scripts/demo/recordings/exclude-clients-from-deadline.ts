/**
 * Recording: Exclude Clients from a Deadline
 *
 * Open a filing type's schedule editor, scroll to the "Applies To"
 * (Client Exclusions) section, search for clients, and toggle
 * exclusions on/off.
 */

import {
  type DemoDefinition,
  login,
  navigateTo,
  cursorClick,
  cursorMove,
  cursorType,
  wait,
  PAUSE,
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

    // ─── Open the first filing type edit page ───
    console.log("→ Opening first filing type schedule...");
    const firstCard = page.locator(".grid a").first();
    await firstCard.waitFor({ state: "visible", timeout: 5000 });
    await cursorClick(page, ".grid a", 0);
    await page.waitForURL("**/deadlines/**/edit**");
    await page.waitForLoadState("networkidle");
    await wait(PAUSE.LONG);

    // ─── Scroll to the Applies To / Client Exclusions section ───
    console.log("→ Scrolling to Applies To section...");
    const appliesToHeading = page.locator('h2:has-text("Applies To")');
    await appliesToHeading.scrollIntoViewIfNeeded();
    await wait(PAUSE.LONG);

    // ─── View the exclusions list ───
    console.log("→ Viewing client exclusions list...");
    await wait(PAUSE.READ);

    // ─── Search for a specific client ───
    console.log("→ Searching for a client to exclude...");
    const searchInput = page
      .locator('h2:has-text("Applies To")')
      .locator("~ div input[placeholder='Search clients...'], .. .. input[placeholder='Search clients...']")
      .last();

    // Use a broader selector that finds the search within the Applies To card
    const exclusionSearch = page.locator("input[placeholder='Search clients...']").last();
    if (await exclusionSearch.isVisible()) {
      await cursorType(page, "input[placeholder='Search clients...']", "Ltd", {
        delay: 40,
        index: (await page.locator("input[placeholder='Search clients...']").count()) - 1,
      });
      await wait(PAUSE.MEDIUM);
    }

    // ─── Toggle exclusion on the first visible client ───
    console.log("→ Excluding a client...");
    const clientRow = page.locator(".hover\\:bg-muted\\/50.cursor-pointer").last();
    if (await clientRow.isVisible()) {
      // Click to exclude (toggle off)
      const allRows = page.locator(".hover\\:bg-muted\\/50.cursor-pointer");
      const count = await allRows.count();
      if (count > 0) {
        await cursorClick(page, ".hover\\:bg-muted\\/50.cursor-pointer", count - 1);
        await wait(PAUSE.MEDIUM);
      }
    }

    // ─── Toggle another client ───
    console.log("→ Excluding another client...");
    const allRows2 = page.locator(".hover\\:bg-muted\\/50.cursor-pointer");
    const count2 = await allRows2.count();
    if (count2 > 1) {
      await cursorClick(page, ".hover\\:bg-muted\\/50.cursor-pointer", count2 - 2);
      await wait(PAUSE.MEDIUM);
    }

    // ─── Show the excluded count text ───
    console.log("→ Viewing exclusion summary...");
    await wait(PAUSE.READ);

    // ─── Clear search and re-include one client ───
    console.log("→ Clearing search...");
    if (await exclusionSearch.isVisible()) {
      await exclusionSearch.fill("");
      await wait(PAUSE.MEDIUM);
    }

    // Re-include the first excluded client
    console.log("→ Re-including a client...");
    const allRows3 = page.locator(".hover\\:bg-muted\\/50.cursor-pointer");
    const count3 = await allRows3.count();
    if (count3 > 0) {
      await cursorClick(page, ".hover\\:bg-muted\\/50.cursor-pointer", count3 - 1);
      await wait(PAUSE.MEDIUM);
    }

    await wait(PAUSE.READ);
    console.log("→ Client exclusions demo complete.");
  },
};

export default demo;
