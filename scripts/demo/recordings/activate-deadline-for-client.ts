/**
 * Recording: Activate a Deadline for Specific Clients
 *
 * On /deadlines, switch to Inactive view, click the Activate button
 * on a filing type to open the client selector modal, exclude a client,
 * step through documents, then stop before confirming.
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
  id: "activate-deadline-for-client",
  title: "Activate a Deadline for Specific Clients",
  description:
    "Use the 'Activate for clients' modal to assign a filing type to individual clients and preview their calculated deadlines.",
  tags: ["activate", "deadline", "client", "assign", "filing type"],
  category: "Deadlines",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/deadlines");

    // ─── Switch to inactive deadlines ───
    console.log("→ Switching to Inactive Deadlines...");
    await cursorClick(page, 'button:has-text("Inactive Deadlines")');
    await wait(PAUSE.LONG);

    // ─── Click Activate on the first inactive filing type ───
    console.log("→ Clicking Activate on a filing type...");
    const activateBtn = page.locator('button:has-text("Activate")').first();
    await activateBtn.waitFor({ state: "visible", timeout: 5000 });
    await cursorClick(page, 'button:has-text("Activate")', 0);
    await wait(PAUSE.MEDIUM);

    // ─── Modal opens — Step 1: Client selection ───
    console.log("→ Activate modal opened — client selection step...");
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await wait(PAUSE.LONG);

    // Search for a client
    console.log("→ Searching for a client...");
    const searchInput = page.locator('[role="dialog"] input[placeholder="Search clients..."]');
    if (await searchInput.isVisible()) {
      await cursorType(page, '[role="dialog"] input[placeholder="Search clients..."]', "Smith", { delay: 40 });
      await wait(PAUSE.MEDIUM);

      // Clear search to see all
      await searchInput.fill("");
      await wait(PAUSE.SHORT);
    }

    // Exclude a client by clicking on a row (toggles the checkbox)
    console.log("→ Excluding a client...");
    const clientRows = page.locator('[role="dialog"] .hover\\:bg-muted\\/50');
    const rowCount = await clientRows.count();
    if (rowCount > 1) {
      await cursorClick(page, '[role="dialog"] .hover\\:bg-muted\\/50', 1);
      await wait(PAUSE.MEDIUM);
    }

    // Pause to show the exclusion state
    await wait(PAUSE.READ);

    // ─── Click Next to proceed ───
    console.log("→ Clicking Next...");
    await cursorClick(page, '[role="dialog"] button:has-text("Next")');
    await wait(PAUSE.LONG);

    // ─── Step 2 or Confirm step ───
    // If there are document requirements, we see a documents step first
    const docStep = page.locator('[role="dialog"]:has-text("documents clients need to provide")');
    if (await docStep.isVisible()) {
      console.log("→ Document settings step — reviewing...");
      await wait(PAUSE.READ);

      // Click Next to confirm step
      await cursorClick(page, '[role="dialog"] button:has-text("Next")');
      await wait(PAUSE.LONG);
    }

    // ─── Confirm step — show summary but don't activate ───
    console.log("→ Confirm step — reviewing summary...");
    await wait(PAUSE.READ);

    // Close without activating
    console.log("→ Closing modal without activating (demo)...");
    await page.keyboard.press('Escape');
    await wait(PAUSE.MEDIUM);

    console.log("→ Activate deadline demo complete.");
  },
};

export default demo;
