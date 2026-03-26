/**
 * Recording: Activate a Deadline from a Client's Detail Page
 *
 * Navigate to a client detail page that has an inactive deadline,
 * find the inactive filing card, toggle it to active, and show
 * the updated state.
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
  id: "activate-deadline-for-client",
  title: "Activate a Deadline from a Client's Detail Page",
  description:
    "Go to a client's detail page, find an inactive deadline in the Filing Management section, and activate it by toggling the Active checkbox.",
  tags: ["activate", "deadline", "client", "filing", "detail page"],
  category: "Deadlines",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/clients");

    // ---- Find a client that likely has an inactive deadline ----
    // Sarah Mitchell is an Individual — she won't have Corp Tax / CT600 / Companies House
    // Those will show as inactive filings on her page
    console.log("-> Looking for Sarah Mitchell (Individual client)...");
    const sarahRow = page.locator('table tbody tr:has-text("Sarah Mitchell")').first();
    if (await sarahRow.isVisible()) {
      await cursorClick(page, 'table tbody tr:has-text("Sarah Mitchell") td', 1);
    } else {
      // Fallback: click any client
      await cursorClick(page, "table tbody tr td", 1);
    }

    await page.waitForURL("**/clients/**", { timeout: 10000 });
    await page.waitForLoadState("networkidle");
    await injectCursor(page);
    await wait(PAUSE.LONG);

    // ---- View the client detail page ----
    console.log("-> On client detail page...");
    await wait(PAUSE.READ);

    // ---- Scroll down to Filing Management section ----
    console.log("-> Scrolling to Filing Management section...");
    const filingSection = page.locator('h2:has-text("Filing Management")').first();
    if (await filingSection.isVisible()) {
      await filingSection.scrollIntoViewIfNeeded();
      await wait(PAUSE.MEDIUM);
    }

    // ---- Find an inactive filing card ----
    // Inactive filings have an "Active" checkbox label with the checkbox unchecked
    // They appear with opacity-60 styling
    console.log("-> Looking for an inactive deadline...");
    await wait(PAUSE.MEDIUM);

    // The filing cards have "Active" labels next to CheckButton toggles
    // Look for a card that has an unchecked Active toggle (the filing is inactive)
    const activeLabels = page.locator('label:has-text("Active")');
    const labelCount = await activeLabels.count();

    let activatedOne = false;
    for (let i = 0; i < labelCount; i++) {
      // Find the checkbox associated with this "Active" label
      const labelEl = activeLabels.nth(i);
      const parentDiv = labelEl.locator(".."); // parent element
      const checkbox = parentDiv.locator('[role="checkbox"]').first();

      if (await checkbox.isVisible()) {
        const isChecked = await checkbox.getAttribute("data-state");
        if (isChecked === "unchecked") {
          console.log("-> Found an inactive deadline — activating...");

          // Scroll this card into view
          await labelEl.scrollIntoViewIfNeeded();
          await wait(PAUSE.SHORT);

          // Show the inactive state
          await cursorMove(page, 'label:has-text("Active")', i);
          await wait(PAUSE.READ);

          // Click the checkbox to activate
          await cursorClick(page, 'label:has-text("Active")', i);
          await wait(PAUSE.LONG);

          activatedOne = true;
          break;
        }
      }
    }

    if (!activatedOne) {
      // If all filings are already active, just hover over one to show the toggle
      console.log("-> All filings are already active — showing Active toggle...");
      if (labelCount > 0) {
        await cursorMove(page, 'label:has-text("Active")', 0);
        await wait(PAUSE.READ);
      }
    }

    // ---- Show the result — the filing card is now active ----
    console.log("-> Deadline is now active for this client...");
    await wait(PAUSE.READ);

    // ---- Scroll up to show the page title ----
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await wait(PAUSE.MEDIUM);

    console.log("-> Activate deadline from client page demo complete.");
    await wait(PAUSE.SHORT);
  },
};

export default demo;
