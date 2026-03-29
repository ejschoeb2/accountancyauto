/**
 * Recording: Activate a Deadline from a Client's Detail Page
 *
 * Navigate to Thames Valley Consulting's detail page, scroll to Filing
 * Management, find the Companies House filing card, deactivate it to
 * show the inactive state, then re-activate it with the cursor guiding
 * the viewer through each step.
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
    "From a client's detail page, activate an inactive deadline for that client. Prompt calculates the deadline date and begins scheduling reminders automatically.",
  tags: ["activate", "deadline", "client", "assign", "filing type"],
  category: "Deadlines",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/clients");

    // ---- Search for Thames Valley Consulting ----
    console.log("-> Searching for Thames Valley Consulting...");
    const searchInput = page.locator('input[placeholder="Search by client name..."]');
    await searchInput.waitFor({ state: "visible", timeout: 15000 });
    await searchInput.fill("Thames Valley");
    await wait(PAUSE.LONG);

    // ---- Click on the client name ----
    console.log("-> Clicking on Thames Valley Consulting...");
    const clientNameCell = page.locator('td:has(> span.text-muted-foreground)').first();
    await clientNameCell.waitFor({ state: "visible", timeout: 5000 });
    await cursorClick(page, 'td:has(> span.text-muted-foreground)', 0);
    await page.waitForURL("**/clients/**", { timeout: 10000 });
    await page.waitForLoadState("networkidle");
    await injectCursor(page);
    await wait(PAUSE.LONG);

    // ---- Show the client name ----
    console.log("-> On Thames Valley Consulting detail page...");
    await cursorMove(page, "h1");
    await wait(PAUSE.MEDIUM);

    // ---- Scroll to Filing Management ----
    console.log("-> Scrolling to Filing Management...");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await injectCursor(page);
    await wait(PAUSE.SHORT);
    const filingSection = page.locator('h2:has-text("Filing Management")');
    await filingSection.waitFor({ state: "visible", timeout: 10000 });
    await filingSection.scrollIntoViewIfNeeded();
    await injectCursor(page);
    await wait(PAUSE.MEDIUM);

    // Wait for filing cards
    await page.locator('[id^="filing-"]').first().waitFor({ state: "visible", timeout: 10000 });

    // ---- Find the Companies House filing card ----
    console.log("-> Looking for Companies House filing card...");
    const companiesHouseCard = page.locator('#filing-companies_house');
    const activeToggle = companiesHouseCard.locator('[role="checkbox"][aria-label*="active"]');

    if (await companiesHouseCard.isVisible().catch(() => false)) {
      await companiesHouseCard.scrollIntoViewIfNeeded();
      await injectCursor(page);

      // ---- Move cursor to the Active toggle to highlight it ----
      console.log("-> Pointing to the Active toggle on Companies House...");
      await cursorMove(page, '#filing-companies_house [role="checkbox"][aria-label*="active"]');
      await wait(PAUSE.READ);

      // ---- Check if it's currently active ----
      const isChecked = await activeToggle.getAttribute("data-state");

      if (isChecked === "checked") {
        // Deactivate first to show the inactive state
        console.log("-> Deactivating Companies House to show inactive state...");
        await cursorClick(page, '#filing-companies_house [role="checkbox"][aria-label*="active"]');
        await page.waitForLoadState("networkidle");
        await injectCursor(page);
        await wait(PAUSE.LONG);

        // Show the inactive state — the card should look dimmed/greyed
        console.log("-> Companies House is now inactive...");
        await cursorMove(page, '#filing-companies_house');
        await wait(PAUSE.READ);
      }

      // ---- Now activate it — this is the main demo action ----
      console.log("-> Activating Companies House deadline...");
      await cursorMove(page, '#filing-companies_house [role="checkbox"][aria-label*="active"]');
      await wait(PAUSE.MEDIUM);
      await cursorClick(page, '#filing-companies_house [role="checkbox"][aria-label*="active"]');
      await page.waitForLoadState("networkidle");
      await injectCursor(page);
      await wait(PAUSE.LONG);

      // ---- Show the activated state ----
      console.log("-> Companies House deadline is now active...");
      await cursorMove(page, '#filing-companies_house');
      await wait(PAUSE.READ);
    } else {
      // Fallback: use whatever filing card is available
      console.log("-> Companies House card not found, using first filing card...");
      const firstToggle = page.locator('[role="checkbox"][aria-label*="active"]').first();
      if (await firstToggle.isVisible().catch(() => false)) {
        await cursorMove(page, '[role="checkbox"][aria-label*="active"]');
        await wait(PAUSE.READ);
        await cursorClick(page, '[role="checkbox"][aria-label*="active"]');
        await wait(PAUSE.LONG);
      }
    }

    console.log("-> Activate deadline demo complete.");
    await wait(PAUSE.SHORT);
  },
};

export default demo;
