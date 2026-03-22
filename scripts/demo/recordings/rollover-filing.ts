/**
 * Recording: Roll Over a Completed Filing
 *
 * On the client detail page, find a completed filing and click the
 * Roll Over button to start tracking the next period's deadline.
 */

import {
  type DemoDefinition,
  login,
  navigateTo,
  cursorClick,
  cursorMove,
  wait,
  PAUSE,
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

    // ---- Navigate to a client detail page ----
    console.log("-> Clicking on a client row...");
    await cursorClick(page, "table tbody tr", 0);
    await page.waitForURL("**/clients/**", { timeout: 10000 });
    await page.waitForLoadState("networkidle");
    await wait(PAUSE.LONG);

    // ---- Scroll to Filing Management ----
    console.log("-> Scrolling to Filing Management...");
    const filingSection = page.locator('h2:has-text("Filing Management")');
    await filingSection.scrollIntoViewIfNeeded();
    await wait(PAUSE.MEDIUM);

    // ---- Find the Roll Over button on a completed filing ----
    console.log("-> Looking for a Roll Over button...");
    const rollOverBtn = page.locator('button:has-text("Roll Over")').first();

    if (await rollOverBtn.isVisible()) {
      await rollOverBtn.scrollIntoViewIfNeeded();
      await cursorMove(page, 'button:has-text("Roll Over")');
      await wait(PAUSE.MEDIUM);

      // ---- Click Roll Over ----
      console.log("-> Clicking Roll Over...");
      await cursorClick(page, 'button:has-text("Roll Over")');
      await wait(PAUSE.MEDIUM);

      // ---- Handle the confirmation dialog ----
      const dialog = page.locator('[role="dialog"]');
      if (await dialog.isVisible()) {
        console.log("-> Rollover confirmation dialog — reviewing...");
        await cursorMove(page, '[role="dialog"]');
        await wait(PAUSE.READ);

        // Click Confirm/Roll Over in the dialog
        const confirmBtn = dialog.locator(
          'button:has-text("Confirm"), button:has-text("Roll Over")'
        );
        if (await confirmBtn.isVisible()) {
          await cursorClick(
            page,
            '[role="dialog"] button:has-text("Confirm"), [role="dialog"] button:has-text("Roll Over")'
          );
          await wait(PAUSE.LONG);
        }
      }

      console.log("-> Filing rolled over to next cycle.");
    } else {
      console.log(
        "-> No Roll Over button visible (filing may not be completed yet). Showing filing cards..."
      );
      await cursorMove(page, '[id^="filing-"]');
    }

    await wait(PAUSE.READ);
    console.log("-> Rollover filing demo complete.");
  },
};

export default demo;
