/**
 * Recording: Roll Over a Completed Filing
 *
 * Navigate to "Greenfield Architects Ltd" which has completed filings
 * (corporation_tax_payment, ct600_filing, companies_house). Find the
 * Roll Over button on a completed filing card and complete the rollover.
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
  id: "rollover-filing",
  title: "Roll Over a Completed Filing",
  description:
    "After marking a filing complete, roll it over to start tracking the next period's deadline.",
  tags: ["rollover", "filing", "next period", "reset", "client"],
  category: "Clients",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/clients");

    // ---- Search for Greenfield Architects (has completed filings) ----
    console.log("-> Searching for Greenfield Architects...");
    const searchInput = page.locator('input[placeholder="Search by client name..."]');
    await searchInput.waitFor({ state: "visible", timeout: 5000 });
    await searchInput.fill("Greenfield");
    await wait(PAUSE.LONG);

    // ---- Navigate to client detail page ----
    console.log("-> Clicking on Greenfield Architects...");
    const clientRow = page.locator('table tbody tr').first();
    await clientRow.waitFor({ state: "visible", timeout: 5000 });
    await cursorClick(page, "table tbody tr", 0);
    await page.waitForURL("**/clients/**", { timeout: 10000 });
    await page.waitForLoadState("networkidle");
    await injectCursor(page);
    await wait(PAUSE.LONG);

    // ---- Scroll to Filing Management ----
    console.log("-> Scrolling to Filing Management...");
    const filingSection = page.locator('h2:has-text("Filing Management")');
    await filingSection.waitFor({ state: "visible", timeout: 10000 });
    await filingSection.scrollIntoViewIfNeeded();
    await injectCursor(page);
    await wait(PAUSE.MEDIUM);

    // ---- Wait for filing cards to load ----
    await page.locator('[id^="filing-"]').first().waitFor({ state: "visible", timeout: 10000 });
    await wait(PAUSE.MEDIUM);

    // ---- Find a Roll Over button (appears on completed filings) ----
    console.log("-> Looking for a Roll Over button on a completed filing...");
    const rollOverBtn = page.locator('button:has-text("Roll Over")').first();

    if (await rollOverBtn.isVisible().catch(() => false)) {
      // Scroll to the Roll Over button
      await rollOverBtn.scrollIntoViewIfNeeded();
      await injectCursor(page);
      await wait(PAUSE.MEDIUM);

      // Show the completed filing card
      console.log("-> Showing completed filing with Roll Over option...");
      await cursorMove(page, 'button:has-text("Roll Over")');
      await wait(PAUSE.READ);

      // ---- Click Roll Over ----
      console.log("-> Clicking Roll Over...");
      await rollOverBtn.click();
      await wait(PAUSE.MEDIUM);

      // ---- Handle the confirmation dialog ----
      const dialog = page.locator('[role="dialog"]');
      await dialog.waitFor({ state: "visible", timeout: 5000 });
      console.log("-> Rollover confirmation dialog — reviewing...");
      await cursorMove(page, '[role="dialog"]');
      await wait(PAUSE.READ);

      // Show what will happen (the bullet points in the dialog)
      const description = dialog.locator('[data-slot="dialog-description"]');
      if (await description.isVisible().catch(() => false)) {
        await cursorMove(page, '[role="dialog"] [data-slot="dialog-description"]');
        await wait(PAUSE.READ);
      }

      // ---- Click Roll Over in the dialog to confirm ----
      console.log("-> Confirming rollover...");
      const confirmBtn = dialog.locator('button:has-text("Roll Over")');
      if (await confirmBtn.isVisible().catch(() => false)) {
        await cursorClick(page, '[role="dialog"] button:has-text("Roll Over")');
        await wait(PAUSE.LONG);
      } else {
        // Fallback: Confirm button
        const altConfirmBtn = dialog.locator('button:has-text("Confirm")');
        if (await altConfirmBtn.isVisible().catch(() => false)) {
          await cursorClick(page, '[role="dialog"] button:has-text("Confirm")');
          await wait(PAUSE.LONG);
        }
      }

      // ---- Show the result — filing rolled over to next cycle ----
      console.log("-> Filing rolled over — reviewing result...");
      await wait(PAUSE.MEDIUM);

      // The filing card should now show the new deadline (next year)
      await filingSection.scrollIntoViewIfNeeded();
      await injectCursor(page);
      await wait(PAUSE.READ);
    } else {
      // Try searching through all filing cards for a Roll Over button
      console.log("-> Checking all filing cards for Roll Over button...");
      const allCards = page.locator('[id^="filing-"]');
      const count = await allCards.count();
      let found = false;
      for (let i = 0; i < count; i++) {
        const card = allCards.nth(i);
        const cardRollOver = card.locator('button:has-text("Roll Over")');
        if (await cardRollOver.isVisible().catch(() => false)) {
          await cardRollOver.scrollIntoViewIfNeeded();
          await injectCursor(page);
          await cursorMove(page, `[id^="filing-"] >> nth=${i}`);
          await wait(PAUSE.READ);

          await cardRollOver.click();
          await wait(PAUSE.MEDIUM);

          const dialog = page.locator('[role="dialog"]');
          if (await dialog.isVisible().catch(() => false)) {
            await cursorMove(page, '[role="dialog"]');
            await wait(PAUSE.READ);

            const confirmBtn = dialog.locator('button:has-text("Roll Over")');
            if (await confirmBtn.isVisible().catch(() => false)) {
              await confirmBtn.click();
              await wait(PAUSE.LONG);
            }
          }

          found = true;
          break;
        }
      }

      if (!found) {
        console.log("-> No Roll Over button found — filings may not be completed.");
        await cursorMove(page, '[id^="filing-"]');
        await wait(PAUSE.READ);
      }
    }

    console.log("-> Rollover filing demo complete.");
    await wait(PAUSE.READ);
  },
};

export default demo;
